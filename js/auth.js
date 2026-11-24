import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

(() => {
  const apiBase = String(window.DOCX_API_URL || "").replace(/\/+$/, "");
  const state = { client: null, session: null, profile: null, ledger: [], authMode: "login", otpTarget: null };
  const money = paise => `₹${(Number(paise || 0) / 100).toFixed(2)}`;
  const modalMarkup = `
    <div id="docxAccountModal" class="docx-modal hidden" role="dialog" aria-modal="true" aria-labelledby="docxModalTitle">
      <div class="docx-modal-card">
        <button class="docx-modal-close" id="docxModalClose" type="button" aria-label="Close">×</button>
        <h2 id="docxModalTitle">DocX Studio account</h2>
        <p id="docxModalStatus" class="docx-modal-status" role="status"></p>
        <section id="docxAuthView">
          <div class="docx-switch-row"><button type="button" id="docxLoginTab" class="docx-tab active">Sign in</button><button type="button" id="docxSignupTab" class="docx-tab">Create account</button></div>
          <div class="docx-switch-row"><button type="button" id="docxEmailTab" class="docx-tab active">Email OTP</button><button type="button" id="docxPhoneTab" class="docx-tab">Mobile OTP</button></div>
          <form id="docxOtpForm">
            <label class="docx-field" id="docxEmailField">Email address<input id="docxEmail" type="email" autocomplete="email" required></label>
            <label class="docx-field hidden" id="docxPhoneField">Mobile number<input id="docxPhone" type="tel" autocomplete="tel" placeholder="+91 9876543210"></label>
            <div id="docxSignupProfile" class="hidden">
              <div class="docx-two-col">
                <label class="docx-field">First name<input id="docxFirstName" autocomplete="given-name" required></label>
                <label class="docx-field">Last name<input id="docxLastName" autocomplete="family-name" required></label>
              </div>
              <label class="docx-field">Address<input id="docxAddress" autocomplete="street-address" required></label>
              <div class="docx-two-col">
                <label class="docx-field">Country<select id="docxCountry" required><option value="">Loading countries…</option></select></label>
                <label class="docx-field">State<select id="docxState" required disabled><option value="">Select country first</option></select></label>
              </div>
              <div class="docx-two-col">
                <label class="docx-field">City<select id="docxCity" required disabled><option value="">Select state first</option></select></label>
                <label class="docx-field">PIN / postal code<input id="docxPincode" autocomplete="postal-code" required></label>
              </div>
            </div>
            <label class="docx-field hidden" id="docxOtpField">One-time password<input id="docxOtp" inputmode="numeric" autocomplete="one-time-code" minlength="6" maxlength="8"></label>
            <button type="submit" class="btn-blue docx-wide-btn" id="docxOtpButton">Send OTP</button>
          </form>
          <p class="docx-divider"><span>or continue with</span></p>
          <div class="docx-social-row"><button type="button" id="docxGoogleBtn" class="docx-social">Google</button><button type="button" id="docxFacebookBtn" class="docx-social">Facebook</button></div>
        </section>
        <section id="docxAccountView" class="hidden">
          <div class="docx-balance-card"><span>Available credit</span><strong id="docxBalance">₹0.00</strong><small>1 credit = ₹1</small></div>
          <form id="docxProfileForm">
            <h3>Profile and billing address</h3>
            <div class="docx-two-col">
              <label class="docx-field">First name<input id="docxProfileFirstName" required></label>
              <label class="docx-field">Last name<input id="docxProfileLastName" required></label>
            </div>
            <label class="docx-field">Address<input id="docxProfileAddress" required></label>
            <div class="docx-two-col">
              <label class="docx-field">Country<select id="docxProfileCountry" required><option value="">Loading countries…</option></select></label>
              <label class="docx-field">State<select id="docxProfileState" required disabled><option value="">Select country first</option></select></label>
            </div>
            <div class="docx-two-col">
              <label class="docx-field">City<select id="docxProfileCity" required disabled><option value="">Select state first</option></select></label>
              <label class="docx-field">PIN / postal code<input id="docxProfilePincode" required></label>
            </div>
            <button type="submit" class="btn-green docx-wide-btn">Save profile</button>
          </form>
          <form id="docxTopupForm" class="docx-topup">
            <h3>Add credits</h3>
            <label class="docx-field">Amount (₹10–₹1,00,000)<input id="docxTopupAmount" type="number" min="10" max="100000" step="1" value="100" required></label>
            <button type="submit" class="btn-blue docx-wide-btn">Pay securely · Google Pay / UPI</button>
            <small>Payments are processed by Razorpay. Google Pay availability depends on your device and payment setup.</small>
          </form>
          <div class="docx-ledger-heading"><h3>Payment and balance details</h3><button type="button" id="docxLogoutBtn" class="docx-link-btn">Sign out</button></div>
          <div id="docxLedger" class="docx-ledger"></div>
        </section>
      </div>
    </div>`;

  document.body.insertAdjacentHTML("beforeend", modalMarkup);
  const modal = document.getElementById("docxAccountModal");
  const statusEl = document.getElementById("docxModalStatus");
  const setStatus = (message, isError = false) => {
    statusEl.textContent = message || "";
    statusEl.classList.toggle("error", isError);
  };
  const api = async (path, { method = "GET", body } = {}) => {
    if (!apiBase) throw new Error("Account service is not configured. Please contact the site owner.");
    const token = state.session?.access_token;
    const response = await fetch(apiBase + path, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.error || "The request could not be completed.");
      error.code = result.code;
      error.status = response.status;
      throw error;
    }
    return result;
  };
  const openModal = (view = "auth") => {
    modal.classList.remove("hidden");
    showView(view);
  };
  const showView = view => {
    document.getElementById("docxAuthView").classList.toggle("hidden", view !== "auth");
    document.getElementById("docxAccountView").classList.toggle("hidden", view !== "account");
    document.getElementById("docxModalTitle").textContent = view === "account" ? "Your account and credits" : "DocX Studio account";
    setStatus("");
    if (view === "account") populateProfile(state.profile);
  };
  const closeModal = () => modal.classList.add("hidden");
  document.getElementById("docxModalClose").onclick = closeModal;
  modal.addEventListener("click", event => { if (event.target === modal) closeModal(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeModal(); });
  document.getElementById("docxLoginTab").onclick = () => switchAuthMode("login");
  document.getElementById("docxSignupTab").onclick = () => switchAuthMode("signup");
  document.getElementById("docxEmailTab").onclick = () => switchMethod("email");
  document.getElementById("docxPhoneTab").onclick = () => switchMethod("phone");

  function switchAuthMode(mode) {
    if (state.authMode !== mode && state.otpTarget) {
      state.otpTarget = null;
      document.getElementById("docxOtpField").classList.add("hidden");
      document.getElementById("docxOtp").required = false;
      document.getElementById("docxOtp").value = "";
    }
    state.authMode = mode;
    document.getElementById("docxLoginTab").classList.toggle("active", mode === "login");
    document.getElementById("docxSignupTab").classList.toggle("active", mode === "signup");
    const signupProfile = document.getElementById("docxSignupProfile");
    signupProfile.classList.toggle("hidden", mode !== "signup");
    signupProfile.querySelectorAll("input, select").forEach(field => { field.required = mode === "signup"; });
    document.getElementById("docxOtpButton").textContent = state.otpTarget ? "Verify OTP" : "Send OTP";
    document.getElementById("docxOtpField").classList.toggle("hidden", !state.otpTarget);
    document.getElementById("docxOtp").required = Boolean(state.otpTarget);
    setStatus("");
  }
  function switchMethod(method) {
    state.method = method;
    document.getElementById("docxEmailTab").classList.toggle("active", method === "email");
    document.getElementById("docxPhoneTab").classList.toggle("active", method === "phone");
    document.getElementById("docxEmailField").classList.toggle("hidden", method !== "email");
    document.getElementById("docxPhoneField").classList.toggle("hidden", method !== "phone");
    document.getElementById("docxEmail").required = method === "email";
    document.getElementById("docxPhone").required = method === "phone";
    state.otpTarget = null;
    document.getElementById("docxOtpField").classList.add("hidden");
    document.getElementById("docxOtpButton").textContent = "Send OTP";
    document.getElementById("docxOtp").value = "";
    setStatus("");
  }
  switchAuthMode("login");
  switchMethod("email");

  async function locationOptions(country, stateName) {
    const response = await fetch("https://countriesnow.space/api/v0.1/countries/states", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ country })
    });
    const result = await response.json();
    if (!response.ok || result.error) throw new Error("Could not load states for this country.");
    if (stateName === null) return (result.data?.states || []).map(item => item.name).filter(Boolean).sort();
    const cityResponse = await fetch("https://countriesnow.space/api/v0.1/countries/state/cities", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ country, state: stateName })
    });
    const cityResult = await cityResponse.json();
    if (!cityResponse.ok || cityResult.error) throw new Error("Could not load cities for this state.");
    return (cityResult.data || []).filter(Boolean).sort();
  }
  async function loadCountries(select) {
    const response = await fetch("https://countriesnow.space/api/v0.1/countries/positions");
    const result = await response.json();
    if (!response.ok || result.error) throw new Error("Could not load the country list.");
    const countries = (result.data || []).map(item => item.name).filter(Boolean).sort();
    select.replaceChildren(new Option("Select country", ""));
    countries.forEach(country => select.add(new Option(country, country)));
  }
  async function updateStates(prefix, selected = "") {
    const country = document.getElementById(prefix + "Country").value;
    const stateSelect = document.getElementById(prefix + "State");
    const citySelect = document.getElementById(prefix + "City");
    stateSelect.replaceChildren(new Option(country ? "Loading states…" : "Select country first", ""));
    citySelect.replaceChildren(new Option("Select state first", ""));
    citySelect.disabled = true;
    stateSelect.disabled = true;
    if (!country) return;
    try {
      const items = await locationOptions(country, null);
      stateSelect.replaceChildren(new Option("Select state", ""));
      items.forEach(item => stateSelect.add(new Option(item, item)));
      stateSelect.disabled = false;
      if (selected) {
        stateSelect.value = selected;
        if (stateSelect.value) await updateCities(prefix);
      }
    } catch (error) {
      setStatus(error.message, true);
    }
  }
  async function updateCities(prefix, selected = "") {
    const country = document.getElementById(prefix + "Country").value;
    const region = document.getElementById(prefix + "State").value;
    const citySelect = document.getElementById(prefix + "City");
    citySelect.replaceChildren(new Option(region ? "Loading cities…" : "Select state first", ""));
    citySelect.disabled = true;
    if (!country || !region) return;
    try {
      const items = await locationOptions(country, region);
      citySelect.replaceChildren(new Option("Select city", ""));
      items.forEach(item => citySelect.add(new Option(item, item)));
      citySelect.disabled = false;
      if (selected) citySelect.value = selected;
    } catch (error) {
      setStatus(error.message, true);
    }
  }
  for (const prefix of ["docx", "docxProfile"]) {
    const country = document.getElementById(prefix + "Country");
    country.onchange = () => updateStates(prefix);
    document.getElementById(prefix + "State").onchange = () => updateCities(prefix);
    loadCountries(country).catch(error => setStatus(error.message, true));
  }

  function profileForm(prefix) {
    return {
      first_name: document.getElementById(prefix + "FirstName").value.trim(),
      last_name: document.getElementById(prefix + "LastName").value.trim(),
      address: document.getElementById(prefix + "Address").value.trim(),
      country: document.getElementById(prefix + "Country").value,
      state: document.getElementById(prefix + "State").value,
      city: document.getElementById(prefix + "City").value,
      pincode: document.getElementById(prefix + "Pincode").value.trim()
    };
  }
  async function populateProfile(profile) {
    if (!profile) return;
    for (const [field, input] of Object.entries({
      first_name: "docxProfileFirstName", last_name: "docxProfileLastName",
      address: "docxProfileAddress", pincode: "docxProfilePincode"
    })) document.getElementById(input).value = profile[field] || "";
    const country = document.getElementById("docxProfileCountry");
    if (profile.country && !Array.from(country.options).some(option => option.value === profile.country)) {
      country.add(new Option(profile.country, profile.country));
    }
    country.value = profile.country || "";
    await updateStates("docxProfile", profile.state || "");
    if (profile.city) await updateCities("docxProfile", profile.city);
  }

  document.getElementById("docxOtpForm").onsubmit = async event => {
    event.preventDefault();
    if (!state.client) return setStatus("Authentication is not configured on the server yet.", true);
    const button = document.getElementById("docxOtpButton");
    button.disabled = true;
    try {
      if (!state.otpTarget) {
        let target;
        const options = {};
        if (state.method === "email") {
          target = document.getElementById("docxEmail").value.trim();
          if (!target) throw new Error("Enter your email address.");
        } else {
          target = document.getElementById("docxPhone").value.trim();
          if (!/^\+[1-9]\d{7,14}$/.test(target.replace(/[\s()-]/g, ""))) throw new Error("Enter your mobile number with country code, for example +919876543210.");
          target = target.replace(/[\s()-]/g, "");
        }
        if (state.authMode === "signup") {
          const form = profileForm("docx");
          if (Object.values(form).some(value => !value)) throw new Error("Complete all name and address fields first.");
          options.data = { first_name: form.first_name, last_name: form.last_name };
        }
        const payload = state.method === "email"
          ? await state.client.auth.signInWithOtp({ email: target, options: { shouldCreateUser: state.authMode === "signup", data: options.data } })
          : await state.client.auth.signInWithOtp({ phone: target, options: { shouldCreateUser: state.authMode === "signup", data: options.data } });
        if (payload.error) throw payload.error;
        state.otpTarget = target;
        document.getElementById("docxOtpField").classList.remove("hidden");
        document.getElementById("docxOtp").required = true;
        button.textContent = "Verify OTP";
        setStatus(`We sent a one-time code to ${target}.`);
      } else {
        const token = document.getElementById("docxOtp").value.trim();
        const result = state.method === "email"
          ? await state.client.auth.verifyOtp({ email: state.otpTarget, token, type: "email" })
          : await state.client.auth.verifyOtp({ phone: state.otpTarget, token, type: "sms" });
        if (result.error) throw result.error;
        state.session = result.data.session;
        await refreshAccount();
        if (state.authMode === "signup") {
          await api("/api/profile", { method: "PUT", body: profileForm("docx") });
          await refreshAccount();
        }
        showView("account");
        setStatus("You are signed in.");
      }
    } catch (error) {
      setStatus(error.message || "Could not complete sign-in.", true);
    } finally {
      button.disabled = false;
    }
  };
  document.getElementById("docxProfileForm").onsubmit = async event => {
    event.preventDefault();
    try {
      const result = await api("/api/profile", { method: "PUT", body: profileForm("docxProfile") });
      state.profile = result.profile;
      await refreshAccount();
      setStatus("Profile saved.");
    } catch (error) {
      setStatus(error.message, true);
    }
  };

  async function socialLogin(provider) {
    if (!state.client) return setStatus("Authentication is not configured on the server yet.", true);
    const { error } = await state.client.auth.signInWithOAuth({
      provider, options: { redirectTo: window.location.href.split("#")[0] }
    });
    if (error) setStatus(error.message, true);
  }
  document.getElementById("docxGoogleBtn").onclick = () => socialLogin("google");
  document.getElementById("docxFacebookBtn").onclick = () => socialLogin("facebook");

  function renderLedger(items) {
    const container = document.getElementById("docxLedger");
    container.replaceChildren();
    if (!items.length) {
      container.textContent = "No payments or service usage yet.";
      return;
    }
    for (const item of items) {
      const row = document.createElement("div");
      row.className = "docx-ledger-row";
      const label = document.createElement("span");
      const amount = document.createElement("strong");
      const kind = item.entry_type === "topup" ? "Credit added" : item.entry_type === "refund" ? "Service refund" : item.service === "watermark" ? `Watermark remover · ${item.pages} page${item.pages === 1 ? "" : "s"}` : "PDF Editor";
      label.textContent = `${kind} · ${new Date(item.created_at).toLocaleString()}`;
      amount.textContent = `${Number(item.amount_paise) >= 0 ? "+" : "−"}${money(Math.abs(Number(item.amount_paise)))}`;
      amount.classList.toggle("negative", Number(item.amount_paise) < 0);
      row.append(label, amount);
      container.append(row);
    }
  }
  async function refreshAccount() {
    if (!state.session) {
      state.profile = null;
      state.ledger = [];
      updateNav();
      return;
    }
    const result = await api("/api/me");
    state.profile = result.profile;
    state.ledger = result.ledger || [];
    document.getElementById("docxBalance").textContent = money(state.profile.balance_paise);
    renderLedger(state.ledger);
    updateNav();
  }
  function updateNav() {
    const nav = document.querySelector(".menu");
    if (!nav) return;
    let button = document.getElementById("docxNavAccount");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.id = "docxNavAccount";
      button.className = "menu-btn docx-nav-account";
      nav.append(button);
      button.onclick = () => openModal(state.session ? "account" : "auth");
    }
    setNavText();
  }
  function setNavText() {
    const button = document.getElementById("docxNavAccount");
    if (!button) return;
    button.textContent = state.session
      ? `${money(state.profile?.balance_paise)} · ${state.profile?.first_name || state.session.user?.email || state.session.user?.phone || "Account"}`
      : "Sign in / Sign up";
  }
  document.getElementById("docxLogoutBtn").onclick = async () => {
    await state.client?.auth.signOut();
    closeModal();
  };
  document.getElementById("docxTopupForm").onsubmit = async event => {
    event.preventDefault();
    const button = event.submitter || event.currentTarget.querySelector("button");
    button.disabled = true;
    try {
      const amount = Number(document.getElementById("docxTopupAmount").value);
      const order = await api("/api/payments/order", { method: "POST", body: { amount_rupees: amount } });
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = resolve;
          script.onerror = () => reject(new Error("Could not load the secure payment window."));
          document.head.append(script);
        });
      }
      const checkout = new window.Razorpay({
        key: order.key_id, amount: order.amount, currency: order.currency,
        name: "DocX Studio", description: "Add credits to your account", order_id: order.order_id,
        prefill: { email: state.session.user?.email, contact: state.session.user?.phone },
        handler: async response => {
          try {
            await api("/api/payments/verify", { method: "POST", body: response });
            await refreshAccount();
            setStatus("Payment received. Credits have been added to your balance.");
          } catch (error) {
            setStatus(error.message, true);
          }
        },
        modal: { ondismiss: () => setStatus("Payment was not completed.") }
      });
      checkout.on("payment.failed", response => setStatus(response.error?.description || "Payment failed.", true));
      checkout.open();
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      button.disabled = false;
    }
  };

  const ready = (async () => {
    try {
      if (!apiBase) throw new Error("Set DOCX_API_URL in js/auth-config.js to enable account features.");
      const response = await fetch(apiBase + "/api/config");
      const config = await response.json();
      if (!response.ok || !config.configured) {
        throw new Error("Account services are not configured. Please contact the site owner.");
      }
      state.client = createClient(config.supabaseUrl, config.supabaseAnonKey);
      const { data } = await state.client.auth.getSession();
      state.session = data.session;
      if (state.session) await refreshAccount();
      state.client.auth.onAuthStateChange(async (_event, session) => {
        state.session = session;
        try {
          await refreshAccount();
          if (session) showView("account");
        } catch (error) {
          setStatus(error.message, true);
        }
      });
    } catch (error) {
      updateNav();
      setStatus(error.message, true);
    }
  })();

  async function consume(service, pages) {
    await ready;
    if (!state.session) {
      switchAuthMode("login");
      openModal("auth");
      setStatus("Sign in to use this paid service.");
      return null;
    }
    try {
      const result = await api("/api/billing/consume", {
        method: "POST", body: { service, pages, operation_id: crypto.randomUUID() }
      });
      await refreshAccount();
      return result;
    } catch (error) {
      openModal(error.code === "PROFILE_REQUIRED" ? "account" : "account");
      setStatus(error.message, true);
      return null;
    }
  }
  async function refund(operationId) {
    await api("/api/billing/refund", { method: "POST", body: { operation_id: operationId } });
    await refreshAccount();
  }
  async function authorizeEditor() {
    await ready;
    if (!state.session) {
      openModal("auth");
      setStatus("Sign in and add at least ₹10 to use PDF Editor.");
      return false;
    }
    try {
      await api("/api/billing/authorize?service=pdf_editor");
      return true;
    } catch (error) {
      openModal("account");
      setStatus(error.message, true);
      return false;
    }
  }
  window.DOCX = {
    auth: {
      ready,
      consume,
      refund,
      authorizeEditor,
      open: () => openModal(state.session ? "account" : "auth"),
      get session() { return state.session; }
    }
  };
  updateNav();
})();
