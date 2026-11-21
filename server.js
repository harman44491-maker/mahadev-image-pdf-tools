import express from "express";
import multer from "multer";

const app = express();
const PORT = Number(process.env.PORT || 10000);
const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://mahadev-image-pdf-tools.onrender.com";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 }
});

app.disable("x-powered-by");
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || origin === SITE_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", origin || SITE_ORIGIN);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
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
