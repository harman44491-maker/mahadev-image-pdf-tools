(() => {
  const apiBase = String(window.DOCX_API_URL || "").replace(/\/+$/, "");
  const TOKEN_KEY = "docxAdminToken";
  let token = sessionStorage.getItem(TOKEN_KEY) || "";
  const cache = { overview: null, users: [], ledger: [], orders: [] };

  const $ = id => document.getElementById(id);
  const money = paise => `₹${(Number(paise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const date = value => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const api = async (path, { method = "GET", body } = {}) => {
    if (!apiBase) throw new Error("Admin API URL is not configured.");
    const response = await fetch(apiBase + path, {
      method,
      headers: {
        ...(token ? { "X-Admin-Token": token } : {}),
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) {
      token = "";
      sessionStorage.removeItem(TOKEN_KEY);
      showLogin();
      throw new Error(result.error || "Admin session expired.");
    }
    if (!response.ok) throw new Error(result.error || "Request failed.");
    return result;
  };

  function toast(message, isError = false) {
    document.querySelectorAll(".toast").forEach(t => t.remove());
    const el = document.createElement("div");
    el.className = "toast";
    el.style.borderColor = isError ? "rgba(248,113,113,.6)" : "rgba(52,211,153,.6)";
    el.textContent = message;
    document.body.append(el);
    setTimeout(() => el.remove(), 4200);
  }

  function showLogin(message = "") {
    $("loginScreen").classList.remove("hidden");
    $("app").classList.add("hidden");
    $("loginError").textContent = message;
    $("adminPassword").value = "";
  }
  function showApp() {
    $("loginScreen").classList.add("hidden");
    $("app").classList.remove("hidden");
  }

  async function signIn() {
    const password = $("adminPassword").value;
    if (!password) return $("loginError").textContent = "Enter the admin password.";
    const btn = $("loginBtn");
    btn.disabled = true;
    btn.textContent = "Unlocking…";
    try {
      const result = await api("/api/admin/login", { method: "POST", body: { password } });
      token = result.token;
      sessionStorage.setItem(TOKEN_KEY, token);
      $("loginError").textContent = "";
      showApp();
      await loadAll();
    } catch (error) {
      $("loginError").textContent = error.message;
    } finally {
      btn.disabled = false;
      btn.textContent = "Unlock dashboard";
    }
  }

  async function loadAll() {
    try {
      const [overview, users, ledger, orders] = await Promise.all([
        api("/api/admin/overview"), api("/api/admin/users"), api("/api/admin/ledger"), api("/api/admin/orders")
      ]);
      cache.overview = overview;
      cache.users = users.users || [];
      cache.ledger = ledger.ledger || [];
      cache.orders = orders.orders || [];
      renderAll();
      $("statusPill").textContent = "● Connected";
    } catch (error) {
      toast(error.message, true);
      $("statusPill").textContent = "● Connection issue";
    }
  }

  function renderAll() {
    renderOverview();
    renderUsers();
    renderLedger();
    renderOrders();
  }

  function renderOverview() {
    const d = cache.overview || {};
    const cards = [
      ["Total users", d.users ?? 0, "profiles created"],
      ["Wallet balance", money(d.balancePaise), "sum of all balances"],
      ["Payments received", money(d.paymentsPaise), "topups incl. manual credits"],
      ["Services used", money(d.usagePaise), "charges deducted"],
      ["Refunds given", money(d.refundPaise), "returned to users"],
      ["Orders", d.orders ?? 0, `${d.capturedOrders ?? 0} captured`],
      ["Today's signups", d.todaySignups ?? 0, "new profiles today"]
    ];
    $("statCards").innerHTML = cards.map(([label, value, sub]) => `
      <div class="card"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div><div class="sub">${escapeHtml(sub)}</div></div>`).join("");

    const months = Object.entries(d.monthly || {}).sort().slice(-8);
    if (!months.length) {
      $("monthlyBars").innerHTML = `<div class="empty">No activity yet.</div>`;
    } else {
      const max = Math.max(1, ...months.map(([, v]) => Math.max(v.topup || 0, v.usage || 0)));
      $("monthlyBars").innerHTML = months.map(([key, v]) => {
        const h = n => Math.max(3, Math.round((n / max) * 130));
        return `<div class="bar-wrap"><div style="display:flex;gap:4px;align-items:flex-end;height:135px">
          <div class="bar" style="height:${h(v.topup || 0)}px" title="Topups ${money(v.topup)}"></div>
          <div class="bar usage" style="height:${h(v.usage || 0)}px" title="Usage ${money(v.usage)}"></div>
        </div><span class="bar-label">${escapeHtml(key.slice(5))}</span></div>`;
      }).join("");
    }

    const rows = cache.ledger.slice(0, 8);
    $("recentActivity").innerHTML = rows.length ? rows.map(r => {
      const badge = r.entry_type === "topup" ? "b-green" : r.entry_type === "refund" ? "b-blue" : "b-amber";
      return `<tr><td>${date(r.created_at)}</td><td>${escapeHtml(r.user_email || r.user_name || r.user_id || "—")}</td>
        <td><span class="badge ${badge}">${escapeHtml(r.entry_type)}</span></td>
        <td class="muted">${escapeHtml(r.service || "")} ${r.pages ? `· ${r.pages} page(s)` : ""}</td>
        <td style="text-align:right" class="${Number(r.amount_paise) >= 0 ? "pos" : "neg"}">${money(r.amount_paise)}</td></tr>`;
    }).join("") : `<tr><td colspan="5" class="empty">No activity yet.</td></tr>`;
  }

  function renderUsers() {
    const q = ($("usersSearch").value || "").toLowerCase().trim();
    const rows = q ? cache.users.filter(u => [u.email, u.phone, u.first_name, u.last_name, u.id]
      .some(v => String(v || "").toLowerCase().includes(q))) : cache.users;
    $("usersCount").textContent = `(${rows.length})`;
    $("usersTable").innerHTML = rows.length ? rows.map(u => `<tr>
      <td>${escapeHtml([u.first_name, u.last_name].filter(Boolean).join(" ") || "—")}</td>
      <td>${escapeHtml(u.email || u.phone || "—")}</td>
      <td style="text-align:right" class="mono">${money(u.balance_paise)}</td>
      <td class="muted">${date(u.created_at)}</td>
      <td class="muted">${date(u.last_sign_in_at)}</td>
      <td class="mono muted">${escapeHtml(String(u.id || "").slice(0, 8))}… <button class="btn btn-ghost" style="padding:3px 7px;font-size:.66rem" data-copy="${escapeHtml(u.id)}">copy ID</button></td>
    </tr>`).join("") : `<tr><td colspan="6" class="empty">No users found.</td></tr>`;
  }

  function renderLedger() {
    const q = ($("ledgerSearch").value || "").toLowerCase().trim();
    const rows = q ? cache.ledger.filter(r => [r.user_email, r.user_name, r.user_id, r.payment_id, r.service]
      .some(v => String(v || "").toLowerCase().includes(q))) : cache.ledger;
    $("ledgerCount").textContent = `(${rows.length})`;
    $("ledgerTable").innerHTML = rows.length ? rows.map(r => {
      const badge = r.entry_type === "topup" ? "b-green" : r.entry_type === "refund" ? "b-blue" : "b-amber";
      return `<tr><td class="muted">${date(r.created_at)}</td><td>${escapeHtml(r.user_email || r.user_name || r.user_id || "—")}</td>
        <td><span class="badge ${badge}">${escapeHtml(r.entry_type)}</span></td>
        <td class="muted">${escapeHtml(r.service || "")}${r.pages ? ` · ${r.pages} page(s)` : ""}</td>
        <td style="text-align:right" class="${Number(r.amount_paise) >= 0 ? "pos" : "neg"}">${money(r.amount_paise)}</td></tr>`;
    }).join("") : `<tr><td colspan="5" class="empty">No ledger entries found.</td></tr>`;
  }

  function renderOrders() {
    const q = ($("ordersSearch").value || "").toLowerCase().trim();
    const rows = q ? cache.orders.filter(r => [r.user_email, r.user_name, r.id, r.payment_id, r.status]
      .some(v => String(v || "").toLowerCase().includes(q))) : cache.orders;
    $("ordersCount").textContent = `(${rows.length})`;
    $("ordersTable").innerHTML = rows.length ? rows.map(o => {
      const badge = o.status === "captured" ? "b-green" : "b-amber";
      return `<tr><td class="mono">${escapeHtml(o.id)}</td><td>${escapeHtml(o.user_email || o.user_name || o.user_id || "—")}</td>
        <td style="text-align:right" class="mono">${money(o.amount_paise)}</td>
        <td><span class="badge ${badge}">${escapeHtml(o.status)}</span></td>
        <td class="mono muted">${escapeHtml(o.payment_id || "—")}</td>
        <td class="muted">${date(o.created_at)}</td></tr>`;
    }).join("") : `<tr><td colspan="6" class="empty">No orders found.</td></tr>`;
  }

  function switchView(view) {
    document.querySelectorAll("[data-view]").forEach(b => b.classList.toggle("active", b.dataset.view === view));
    ["overview", "users", "ledger", "orders"].forEach(v => $("view-" + v).classList.toggle("hidden", v !== view));
    const titles = { overview: ["Overview", "Business health at a glance"], users: ["Users", "Accounts, balances and activity"], ledger: ["Credit ledger", "Every credit and debit"], orders: ["Payment orders", "Razorpay orders and statuses"] };
    $("viewTitle").textContent = titles[view][0];
    $("viewSubtitle").textContent = titles[view][1];
  }

  async function submitAdjust() {
    const btn = $("adjustSubmit");
    btn.disabled = true;
    try {
      const rupees = Number($("adjustAmount").value);
      if (!Number.isFinite(rupees) || rupees === 0) throw new Error("Enter a non-zero amount.");
      await api("/api/admin/adjust", {
        method: "POST",
        body: { user_id: $("adjustUser").value.trim(), amount_paise: Math.round(rupees * 100), reason: $("adjustReason").value.trim() }
      });
      $("adjustModal").classList.add("hidden");
      $("adjustUser").value = ""; $("adjustAmount").value = ""; $("adjustReason").value = "";
      toast("Balance updated.");
      await loadAll();
    } catch (error) {
      toast(error.message, true);
    } finally {
      btn.disabled = false;
    }
  }

  $("loginBtn").onclick = signIn;
  $("adminPassword").addEventListener("keydown", e => { if (e.key === "Enter") signIn(); });
  document.querySelectorAll("[data-view]").forEach(b => b.onclick = () => switchView(b.dataset.view));
  $("refreshBtn").onclick = loadAll;
  $("logoutBtn").onclick = () => { token = ""; sessionStorage.removeItem(TOKEN_KEY); showLogin(); };
  $("adjustNavBtn").onclick = () => $("adjustModal").classList.remove("hidden");
  $("adjustCancel").onclick = () => $("adjustModal").classList.add("hidden");
  $("adjustSubmit").onclick = submitAdjust;
  $("usersSearch").oninput = renderUsers;
  $("ledgerSearch").oninput = renderLedger;
  $("ordersSearch").oninput = renderOrders;
  document.addEventListener("click", e => {
    const copy = e.target.closest("[data-copy]");
    if (copy) {
      navigator.clipboard?.writeText(copy.dataset.copy).then(() => toast("User ID copied.")).catch(() => {});
    }
  });

  if (token) {
    showApp();
    loadAll().catch(() => showLogin());
  } else {
    showLogin();
  }
})();
