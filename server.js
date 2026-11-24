import express from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";

const app = express();
const PORT = Number(process.env.PORT || 10000);
const ALLOWED_ORIGINS = new Set(
  (process.env.SITE_ORIGINS || "https://harman44491-maker.github.io")
    .split(",").map(origin => origin.trim()).filter(Boolean)
);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 }
});

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || [...ALLOWED_ORIGINS][0]);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

function requireSupabase(res) {
  if (!supabaseAdmin || !SUPABASE_ANON_KEY) {
    res.status(503).json({ error: "Account and wallet services are not configured on the server." });
    return false;
  }
  return true;
}

async function authenticatedUser(req, res) {
  if (!requireSupabase(res)) return null;
  const token = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) {
    res.status(401).json({ error: "Please sign in to continue." });
    return null;
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: "Your session has expired. Please sign in again." });
    return null;
  }
  return data.user;
}

function publicProfile(profile) {
  if (!profile) return null;
  const { id, email, phone, first_name, last_name, address, city, state, country, pincode, balance_paise } = profile;
  return { id, email, phone, first_name, last_name, address, city, state, country, pincode, balance_paise };
}

app.get("/api/config", (_req, res) => {
  res.json({
    configured: Boolean(supabaseAdmin && SUPABASE_ANON_KEY),
    supabaseUrl: SUPABASE_URL || null,
    supabaseAnonKey: SUPABASE_ANON_KEY || null,
    razorpayKeyId: RAZORPAY_KEY_ID || null
  });
});

app.get("/api/me", async (req, res) => {
  try {
    const user = await authenticatedUser(req, res);
    if (!user) return;
    const { data, error } = await supabaseAdmin.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) throw error;
    const profile = data || {
      id: user.id, email: user.email || null, phone: user.phone || null,
      first_name: "", last_name: "", address: "", city: "", state: "", country: "", pincode: "", balance_paise: 0
    };
    const { data: ledger, error: ledgerError } = await supabaseAdmin.from("credit_ledger")
      .select("id, entry_type, amount_paise, service, pages, created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    if (ledgerError) throw ledgerError;
    res.json({ profile: publicProfile(profile), ledger: ledger || [] });
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not load your account." });
  }
});

app.put("/api/profile", async (req, res) => {
  try {
    const user = await authenticatedUser(req, res);
    if (!user) return;
    const fields = ["first_name", "last_name", "address", "city", "state", "country", "pincode"];
    const profile = {};
    for (const field of fields) profile[field] = String(req.body?.[field] || "").trim().slice(0, 180);
    if (fields.some(field => !profile[field])) {
      return res.status(400).json({ error: "Please complete all name and address fields." });
    }
    if (!/^[\p{L}\p{N}\s-]{3,12}$/u.test(profile.pincode)) {
      return res.status(400).json({ error: "Please enter a valid postal or PIN code." });
    }
    const { data, error } = await supabaseAdmin.from("profiles")
      .upsert({ id: user.id, email: user.email || null, phone: user.phone || null, ...profile }, { onConflict: "id" })
      .select("*").single();
    if (error) throw error;
    res.json({ profile: publicProfile(data) });
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not save your profile." });
  }
});

app.get("/api/billing/authorize", async (req, res) => {
  try {
    const user = await authenticatedUser(req, res);
    if (!user) return;
    const service = String(req.query.service || "");
    if (service !== "pdf_editor") return res.status(400).json({ error: "Unknown paid service." });
    const { data: profile, error } = await supabaseAdmin.from("profiles").select("balance_paise, first_name, last_name, address, city, state, country, pincode")
      .eq("id", user.id).maybeSingle();
    if (error) throw error;
    if (!profile || ["first_name", "last_name", "address", "city", "state", "country", "pincode"].some(key => !profile[key])) {
      return res.status(409).json({ error: "Please complete your account profile before using paid tools.", code: "PROFILE_REQUIRED" });
    }
    if (Number(profile.balance_paise || 0) < 1000) {
      return res.status(402).json({ error: "PDF Editor costs ₹10. Add credits to continue.", code: "INSUFFICIENT_CREDITS" });
    }
    res.json({ authorized: true, balance_paise: profile.balance_paise });
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not verify your balance." });
  }
});

app.post("/api/billing/consume", async (req, res) => {
  try {
    const user = await authenticatedUser(req, res);
    if (!user) return;
    const service = String(req.body?.service || "");
    const pages = Number(req.body?.pages);
    const operationId = String(req.body?.operation_id || "");
    const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId);
    if (!validUuid || !Number.isInteger(pages) || pages < 1 || pages > 1000 ||
      !["watermark", "pdf_editor"].includes(service) || (service === "pdf_editor" && pages !== 1)) {
      return res.status(400).json({ error: "Invalid service charge request." });
    }
    const { data: result, error } = await supabaseAdmin.rpc("consume_credits", {
      p_user_id: user.id, p_operation_id: operationId, p_service: service, p_pages: pages
    });
    if (error) {
      if (error.message.includes("insufficient_credits")) {
        return res.status(402).json({ error: "Not enough credits for this service. Please add credits.", code: "INSUFFICIENT_CREDITS" });
      }
      if (error.message.includes("profile_required")) {
        return res.status(409).json({ error: "Please complete your account profile before using paid tools.", code: "PROFILE_REQUIRED" });
      }
      throw error;
    }
    res.json({ operation_id: operationId, charged_paise: result.charged_paise, balance_paise: result.balance_paise });
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not charge your wallet." });
  }
});

app.post("/api/billing/refund", async (req, res) => {
  try {
    const user = await authenticatedUser(req, res);
    if (!user) return;
    const operationId = String(req.body?.operation_id || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) {
      return res.status(400).json({ error: "Invalid service operation." });
    }
    const { data, error } = await supabaseAdmin.rpc("refund_credits", {
      p_user_id: user.id, p_operation_id: operationId
    });
    if (error) throw error;
    res.json({ refunded: data.refunded, balance_paise: data.balance_paise });
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not return service credits." });
  }
});

app.get("/api/wallet", async (req, res) => {
  try {
    const user = await authenticatedUser(req, res);
    if (!user) return;
    const { data: profile, error } = await supabaseAdmin.from("profiles").select("balance_paise").eq("id", user.id).maybeSingle();
    if (error) throw error;
    res.json({ balance_paise: profile?.balance_paise || 0 });
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not load your balance." });
  }
});

app.post("/api/payments/order", async (req, res) => {
  try {
    const user = await authenticatedUser(req, res);
    if (!user) return;
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ error: "Payments are not configured on the server yet." });
    }
    const amountRupees = Number(req.body?.amount_rupees);
    if (!Number.isInteger(amountRupees) || amountRupees < 10 || amountRupees > 100000) {
      return res.status(400).json({ error: "Add an amount between ₹10 and ₹1,00,000." });
    }
    const amountPaise = amountRupees * 100;
    const receipt = randomUUID();
    const upstream = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(RAZORPAY_KEY_ID + ":" + RAZORPAY_KEY_SECRET).toString("base64"),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt, notes: { user_id: user.id } })
    });
    const order = await upstream.json().catch(() => ({}));
    if (!upstream.ok || !order.id) {
      return res.status(502).json({ error: order.error?.description || "Payment provider could not create an order." });
    }
    const { error } = await supabaseAdmin.from("payment_orders").insert({
      id: order.id, user_id: user.id, amount_paise: amountPaise, status: "created"
    });
    if (error) throw error;
    res.json({ order_id: order.id, amount: amountPaise, currency: "INR", key_id: RAZORPAY_KEY_ID });
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not start payment." });
  }
});

app.post("/api/payments/verify", async (req, res) => {
  try {
    const user = await authenticatedUser(req, res);
    if (!user) return;
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ error: "Payments are not configured on the server yet." });
    }
    const orderId = String(req.body?.razorpay_order_id || "");
    const paymentId = String(req.body?.razorpay_payment_id || "");
    const signature = String(req.body?.razorpay_signature || "");
    if (!orderId || !paymentId || !/^[a-f0-9]{64}$/i.test(signature)) {
      return res.status(400).json({ error: "Invalid payment verification details." });
    }
    const { data: order, error: orderError } = await supabaseAdmin.from("payment_orders")
      .select("id, amount_paise, status").eq("id", orderId).eq("user_id", user.id).maybeSingle();
    if (orderError) throw orderError;
    if (!order) return res.status(404).json({ error: "Payment order was not found." });
    const expected = createHmac("sha256", RAZORPAY_KEY_SECRET).update(orderId + "|" + paymentId).digest();
    const provided = Buffer.from(signature, "hex");
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      return res.status(400).json({ error: "Payment signature is invalid." });
    }
    const paymentResponse = await fetch("https://api.razorpay.com/v1/payments/" + encodeURIComponent(paymentId), {
      headers: { Authorization: "Basic " + Buffer.from(RAZORPAY_KEY_ID + ":" + RAZORPAY_KEY_SECRET).toString("base64") }
    });
    const payment = await paymentResponse.json().catch(() => ({}));
    if (!paymentResponse.ok || payment.order_id !== orderId || payment.amount !== order.amount_paise || payment.currency !== "INR") {
      return res.status(400).json({ error: "Payment details do not match this order." });
    }
    if (payment.status !== "captured") {
      return res.status(409).json({ error: "Payment is not captured yet. Please check the payment status before retrying." });
    }
    const { error: updateError } = await supabaseAdmin.from("payment_orders")
      .update({ status: "captured", payment_id: paymentId }).eq("id", orderId).eq("user_id", user.id);
    if (updateError) throw updateError;
    const { data: balance, error } = await supabaseAdmin.rpc("credit_payment", {
      p_user_id: user.id, p_payment_id: paymentId, p_amount_paise: order.amount_paise
    });
    if (error) throw error;
    res.json({ credited_paise: order.amount_paise, balance_paise: balance });
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not verify payment." });
  }
});

const requestTimes = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const recent = (requestTimes.get(key) || []).filter(t => now - t < 10 * 60 * 1000);
  if (recent.length >= 4) {
    return res.status(429).json({ error: "Too many AI edits. Please wait 10 minutes before trying again." });
  }
  recent.push(now);
  requestTimes.set(key, recent);
  next();
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "studio-ai-backend" });
});

app.get("/api/studio-photo/status", (_req, res) => {
  res.json({
    available: Boolean(process.env.OPENAI_API_KEY),
    provider: "OpenAI Images API",
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.6-sunburst"
  });
});

app.post("/api/studio-photo", rateLimit, upload.single("image"), async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: "AI Studio Pro is not configured yet. Add OPENAI_API_KEY to the Render backend environment variables. Browser Fast is available meanwhile."
      });
    }

    if (!req.file) return res.status(400).json({ error: "Please upload a JPG, PNG or WEBP photo." });
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowed.has(req.file.mimetype)) {
      return res.status(415).json({ error: "Only JPG, PNG and WEBP photos are supported." });
    }

    const frame = String(req.body.frame || "Reference Style (1232 × 1277)").slice(0, 100);
    const quality = String(req.body.quality || "High Resolution – 2×").slice(0, 80);
    const enhance = req.body.enhance !== "false";
    const prompt = [
      "Edit the uploaded portrait photo into a realistic professional studio/passport-style portrait.",
      "IDENTITY PRESERVATION IS THE HIGHEST PRIORITY: keep the exact same person, recognizable facial identity, facial geometry, eyes, nose, mouth, expression, skin tone, age appearance, pose, camera angle and clothing. Do not beautify, reshape, slim, age, de-age, or replace the face or body.",
      "Replace the entire original background with a perfectly clean, evenly lit, pure white (#FFFFFF) seamless studio background.",
      "Neatly groom only obvious stray flyaway hairs around the outer hair silhouette. Create a tidy, natural, softly rounded crown and clean lower hair outline while preserving the original hairstyle, hair length, parting, texture, density, color and natural hairline. Do not invent bangs, add hair, remove substantial hair, or make the hairstyle artificial.",
      "Preserve natural skin texture and realistic detail. Keep clothing and all visible accessories unchanged. Use balanced, soft, neutral studio lighting and crisp photographic detail.",
      "Do not add text, borders, watermarks, props, jewelry, makeup, or decorative effects.",
      "Requested frame: " + frame + ". Requested output quality: " + quality + ".",
      enhance ? "Apply only subtle professional exposure and clarity correction; keep natural colors." : "Do not apply extra beauty, exposure, or sharpening effects.",
      "This is a faithful photo edit, not a new person or a stylized reinterpretation."
    ].join("\n");

    const form = new FormData();
    form.append("model", process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.6-sunburst");
    form.append("prompt", prompt);
    form.append("quality", "high");
    form.append("size", "auto");
    form.append("output_format", "png");
    form.append("image[]", new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname || "portrait.jpg");

    const upstream = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY },
      body: form,
      signal: AbortSignal.timeout(180000)
    });

    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const message = payload?.error?.message || "The image editing provider rejected the request.";
      return res.status(upstream.status === 429 ? 429 : 502).json({ error: message });
    }

    const encoded = payload?.data?.[0]?.b64_json;
    if (!encoded) return res.status(502).json({ error: "The AI provider returned no edited image." });
    const imageBuffer = Buffer.from(encoded, "base64");
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", imageBuffer.length);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Studio-Engine", "generative-ai");
    return res.status(200).send(imageBuffer);
  } catch (error) {
    const message = error?.name === "TimeoutError"
      ? "AI editing took too long. Please try again with a smaller photo."
      : (error?.message || "AI Studio Pro failed.");
    return res.status(500).json({ error: message });
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "Photo is too large. Please use an image smaller than 15 MB." });
  }
  return res.status(400).json({ error: error?.message || "Invalid upload." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Studio AI backend listening on port " + PORT);
});
