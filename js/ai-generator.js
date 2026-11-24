/* ================= AI PHOTO STUDIO =================
   Mode 1: Text prompt -> image   (Pollinations classic, free, no key)
   Mode 2: Upload photo + command -> edited image (gen.pollinations.ai /v1/images/edits, free key)
==================================================== */
(function () {
  const $ = id => document.getElementById(id);

  const els = {
    modeGroup: $('aiModeGroup'), modeText: $('aiModeText'), modeEdit: $('aiModeEdit'),
    engineGroup: $('aiEngineGroup'),
    prompt: $('aiPrompt'), seed: $('aiSeed'), size: $('aiSize'), genBtn: $('aiGenBtn'),
    drop: $('aiDrop'), file: $('aiFile'), selectBtn: $('aiSelectBtn'), fileInfo: $('aiFileInfo'),
    preview: $('aiPreview'), command: $('aiCommand'), editModel: $('aiEditModel'),
    editSize: $('aiEditSize'), editBtn: $('aiEditBtn'),
    keyInput: $('aiKeyInput'), keySave: $('aiKeySaveBtn'), keyClear: $('aiKeyClearBtn'),
    keyStatus: $('aiKeyStatus'), status: $('aiStatus'), loading: $('aiLoading'), output: $('aiOutput')
  };

  let selectedFile = null;
  let selectedDataUrl = '';
  let engine = 'local'; // 'local' (bina key) | 'cloud' (API key)
  let busy = false;

  /* ---------- status / loading ---------- */
  function setStatus(msg, isErr) {
    els.status.textContent = msg || '';
    els.status.classList.remove('hidden');
    els.status.classList.toggle('ai-err', !!isErr);
  }
  function hideStatus() { els.status.classList.add('hidden'); }
  function setLoading(on) {
    els.loading.style.display = on ? 'block' : 'none';
    els.genBtn.disabled = on;
    els.editBtn.disabled = on;
    busy = on;
  }

  /* ---------- mode switching ---------- */
  els.modeGroup.addEventListener('click', e => {
    const btn = e.target.closest('.seg');
    if (!btn) return;
    els.modeGroup.querySelectorAll('.seg').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    const edit = btn.dataset.mode === 'edit';
    els.modeEdit.classList.toggle('hidden', !edit);
    els.modeText.classList.toggle('hidden', edit);
    hideStatus();
  });

  /* ---------- engine switching (Local / Cloud) ---------- */
  function setEngine(eng) {
    engine = (eng === 'cloud') ? 'cloud' : 'local';
    els.engineGroup.querySelectorAll('.seg').forEach(s =>
      s.classList.toggle('active', s.dataset.engine === engine));
    const isLocal = engine === 'local';
    document.querySelectorAll('#aiModeEdit .cloud-only').forEach(el => {
      el.style.display = isLocal ? 'none' : '';
    });
    els.editBtn.innerHTML = isLocal
      ? '&#128295; Edit Photo (Bina Key)'
      : '&#10024; Edit Photo with AI (Cloud)';
    hideStatus();
  }
  els.engineGroup.addEventListener('click', e => {
    const btn = e.target.closest('.seg');
    if (btn) setEngine(btn.dataset.engine);
  });

  /* ---------- quick chips ---------- */
  document.querySelectorAll('[data-ai-prompt]').forEach(c =>
    c.addEventListener('click', () => { els.prompt.value = c.dataset.aiPrompt; els.prompt.focus(); }));
  document.querySelectorAll('[data-ai-cmd]').forEach(c =>
    c.addEventListener('click', () => {
      els.command.value = c.dataset.aiCmd;
      if (c.dataset.engine) setEngine(c.dataset.engine); // chip ke hisaab se engine auto-switch
      els.command.focus();
    }));

  /* ---------- file pick / drag-drop ---------- */
  els.selectBtn.addEventListener('click', e => { e.stopPropagation(); els.file.click(); });
  els.drop.addEventListener('click', () => els.file.click());
  els.file.addEventListener('change', () => els.file.files[0] && handleFile(els.file.files[0]));
  ['dragover', 'dragenter'].forEach(ev => els.drop.addEventListener(ev, e => { e.preventDefault(); els.drop.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => els.drop.addEventListener(ev, e => { e.preventDefault(); els.drop.classList.remove('drag'); }));
  els.drop.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) handleFile(f); });

  function handleFile(f) {
    if (!f.type.startsWith('image/')) { setStatus('Sirf image file select karo (JPG / PNG / WEBP).', true); return; }
    if (f.size > 7 * 1024 * 1024) { setStatus('Image 7 MB se chhoti honi chahiye.', true); return; }
    selectedFile = f;
    els.fileInfo.textContent = `${f.name} (${(f.size / 1024).toFixed(0)} KB) — ready ✓`;
    const rd = new FileReader();
    rd.onload = e2 => {
      selectedDataUrl = e2.target.result;
      els.preview.src = selectedDataUrl;
      els.preview.style.display = 'block';
    };
    rd.readAsDataURL(f);
    hideStatus();
  }

  /* ---------- API key (localStorage) ---------- */
  const KEY_STORE = 'docx_ai_pollinations_key';
  function getKey() { try { return localStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; } }
  function renderKeyState() {
    const k = getKey();
    els.keyInput.value = k;
    els.keyStatus.textContent = k ? '✓ Key saved — Edit mode ready' : '';
    els.keyStatus.classList.remove('ai-err');
  }
  els.keySave.addEventListener('click', () => {
    const v = els.keyInput.value.trim();
    if (!v) { els.keyStatus.textContent = 'Pehle key paste karo.'; els.keyStatus.classList.add('ai-err'); return; }
    try { localStorage.setItem(KEY_STORE, v); } catch (e) {}
    renderKeyState();
  });
  els.keyClear.addEventListener('click', () => {
    try { localStorage.removeItem(KEY_STORE); } catch (e) {}
    els.keyInput.value = '';
    renderKeyState();
    els.keyStatus.textContent = 'Key removed.';
  });
  renderKeyState();
  setEngine('local'); // default: bina key wala local mode

  /* ---------- result card + download ---------- */
  function addResultCard(urlOrBlob, filename, label) {
    const url = typeof urlOrBlob === 'string' ? urlOrBlob : URL.createObjectURL(urlOrBlob);
    const card = document.createElement('div');
    card.className = 'card';
    const safeLabel = String(label).replace(/[<>&]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch]));
    card.innerHTML = `
      <img src="${url}" alt="AI result">
      <div style="font-size:.84rem;color:#334155;word-break:break-word;">${safeLabel}</div>
      <a class="dl-btn" href="#" style="cursor:pointer;">Download ${filename.split('.').pop().toUpperCase()}</a>`;
    card.querySelector('.dl-btn').addEventListener('click', e => { e.preventDefault(); smartDownload(url, filename); });
    els.output.prepend(card);
    return url;
  }

  async function smartDownload(url, filename) {
    // 1) direct fetch (gen.pollinations / data URLs ke liye)
    // 2) weserv proxy (classic images — browser par Turnstile fetch block karta hai)
    // 3) naye tab me kholega
    const attempts = [url];
    if (/^https?:\/\//i.test(url) && !/gen\.pollinations/i.test(url)) {
      attempts.push('https://images.weserv.nl/?url=' + encodeURIComponent(url.replace(/^https?:\/\//i, '')));
    }
    for (const u of attempts) {
      try {
        const r = await fetch(u);
        const ct = (r.headers.get('content-type') || '').toLowerCase();
        if (r.ok && ct.startsWith('image/')) {
          const b = await r.blob();
          const o = URL.createObjectURL(b);
          const a = document.createElement('a');
          a.href = o; a.download = filename;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(o), 8000);
          return;
        }
      } catch (e) { /* agla attempt */ }
    }
    window.open(url, '_blank');
  }

  /* ---------- MODE 1: prompt -> image (classic, no key) ----------
     Note: browser CORS fetch par Pollinations Turnstile (403) maangta hai,
     isliye <img> element se load karte hain (ye allowed hai). Status
     resource-timing responseStatus se padha jata hai. */
  let lastGenAt = 0;
  els.genBtn.addEventListener('click', generateFromPrompt);

  function generateFromPrompt() {
    if (busy) return;
    const prompt = els.prompt.value.trim();
    if (!prompt) { setStatus('Prompt likho pehle — kya dikhana hai?', true); return; }

    const since = Date.now() - lastGenAt;
    if (since < 45000) {
      setStatus(`Free limit: 1 image / 45 sec — ${Math.ceil((45000 - since) / 1000)} sec baad dobara try karo.`, true);
      return;
    }

    const [w, h] = els.size.value.split('x');
    let seed = parseInt(els.seed.value, 10);
    if (!seed || seed < 0) seed = Math.floor(Math.random() * 999999);

    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
      `?width=${w}&height=${h}&seed=${seed}&nologo=true`;

    setLoading(true);
    lastGenAt = Date.now();
    setStatus('Image ban rahi hai... 10-30 second lag sakte hain ⏳');

    const img = new Image();
    let settled = false;
    const finish = (msg, isErr) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      setLoading(false);
      setStatus(msg, isErr);
    };
    const timer = setTimeout(() => finish('Timeout — server slow tha. 45 sec baad dobara try karo.', true), 75000);

    img.onload = () => {
      // HTTP status check (Chromium resource timing)
      let st = 0;
      try {
        const entries = performance.getEntriesByName(url);
        if (entries.length) st = entries[entries.length - 1].responseStatus || 0;
      } catch (e) {}
      if (st && st !== 200) {
        if (st === 402) finish('Free limit: 1 image / 45 sec per IP — thodi der baad dobara try karo.', true);
        else finish(`Server ne request reject ki (HTTP ${st}) — thodi der baad / naya prompt try karo.`, true);
        return;
      }
      addResultCard(url, `ai-image-${Date.now()}.jpg`, `✨ ${prompt}`);
      finish('✅ Image taiyaar! Neeche se download karo.');
    };
    img.onerror = () => finish('Image nahi bani — limit ya prompt reject ho sakti hai. 45 sec baad dobara try karo.', true);
    img.src = url;
  }

  /* ---------- MODE 2: upload + command -> edit ---------- */
  els.editBtn.addEventListener('click', editWithCommand);

  async function editWithCommand() {
    if (busy) return;
    const cmd = els.command.value.trim();
    if (!selectedFile) { setStatus('Photo select karo (upar wale box me).', true); return; }
    if (!cmd) { setStatus('Command likho — AI ko kya change karna hai?', true); return; }
    if (engine === 'local') { await localEdit(cmd); return; } // bina key wala mode
    const key = getKey();
    if (!key) {
      setStatus('API key chahiye — neeche wale box me free key save karo (ek baar).', true);
      $('aiKeyBox').scrollIntoView({ behavior: 'smooth', block: 'center' });
      els.keyInput.focus();
      return;
    }

    const fd = new FormData();
    fd.append('image', selectedFile);
    fd.append('prompt', cmd);
    fd.append('model', els.editModel.value || 'black-forest-labs/flux.1-kontext-pro');
    if (els.editSize.value) fd.append('size', els.editSize.value);
    fd.append('response_format', 'url');

    setLoading(true);
    setStatus('AI photo edit kar raha hai... 15-40 second ⏳');
    try {
      const res = await fetch('https://gen.pollinations.ai/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: fd
      });
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (res.ok && ct.startsWith('image/')) {
        const blob = await res.blob();
        addResultCard(blob, `ai-edit-${Date.now()}.jpg`, `✂️ ${cmd}`);
        setStatus('✅ Edited image taiyaar!');
        return;
      }
      let j = null;
      try { j = await res.json(); } catch (e) {}
      if (res.ok) {
        const item = (j && j.data && j.data[0]) || j || {};
        const out = item.url || item.image_url ||
          (item.b64_json ? `data:image/png;base64,${item.b64_json}` : null) ||
          (j && j.b64_json ? `data:image/png;base64,${j.b64_json}` : null);
        if (out) {
          addResultCard(out, `ai-edit-${Date.now()}.jpg`, `✂️ ${cmd}`);
          setStatus('✅ Edited image taiyaar!');
          return;
        }
      }
      setStatus(await friendlyError(res, 'edit', j), true);
    } catch (err) {
      setStatus('Network error — internet check karke dobara try karo.', true);
    } finally {
      setLoading(false);
    }
  }

  /* ---------- MODE 2A: LOCAL edit — bina key, browser me hi (canvas + MediaPipe) ---------- */
  function loadImage(u) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Image load fail.')); i.src = u; });
  }
  function newCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function canvasToBlob(c, type, q) { return new Promise(r => c.toBlob(r, type || 'image/png', q || 0.92)); }

  function scaleImage(img, max) {
    const s = Math.min(1, max / Math.max(img.width, img.height));
    if (s === 1) return Promise.resolve(img);
    const c = newCanvas(Math.round(img.width * s), Math.round(img.height * s));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = c.toDataURL('image/jpeg', 0.92); });
  }

  // Command parser: Hinglish/English keywords -> local operation
  function parseLocalCommand(cmd) {
    const c = cmd.toLowerCase();
    const has = (...ws) => ws.some(w => c.includes(w));
    const bgWord = has('background', 'bg', 'backdrop');

    // Passport / ID photo — pehle check (warna "white background" isko overlap kar deta)
    if (has('passport', 'id photo', 'id proof', 'visa photo', 'aadhaar', 'aadhar',
             'pan card', 'license photo', 'face center', 'id card photo'))
      return { op: 'passport' };

    if (has('transparent', 'cutout', 'remove background', 'remove bg', 'background remove',
             'background hatao', 'bg hatao', 'background nikal', 'erase background', 'no background'))
      return { op: 'seg', mode: 'transparent' };

    if (bgWord && has('blur', 'dhundhla')) return { op: 'seg', mode: 'blur_bg', blurPx: 16 };
    if (bgWord && has('studio', 'gradient')) return { op: 'seg', mode: 'studio_gradient' };

    if (bgWord) {
      if (has('white', 'safed')) return { op: 'seg', mode: 'solid_color', color: '#ffffff' };
      if (has('black', 'kaala', 'kala')) return { op: 'seg', mode: 'solid_color', color: '#000000' };
      if (has('blue', 'neela', 'nyla')) return { op: 'seg', mode: 'solid_color', color: '#2563eb' };
      if (has('green', 'hara', 'hari')) return { op: 'seg', mode: 'solid_color', color: '#22c55e' };
      if (has('red', 'laal')) return { op: 'seg', mode: 'solid_color', color: '#ef4444' };
      if (has('yellow', 'peela', 'peeli')) return { op: 'seg', mode: 'solid_color', color: '#eab308' };
      if (has('pink', 'gulaabi', 'gulabi')) return { op: 'seg', mode: 'solid_color', color: '#ec4899' };
      if (has('grey', 'gray', 'silver')) return { op: 'seg', mode: 'solid_color', color: '#94a3b8' };
    }

    if (has('black and white', 'black & white', 'b&w', 'b and w', 'grayscale', 'greyscale', 'monochrome'))
      return { op: 'filter', filter: 'grayscale(1)' };
    if (has('sepia', 'vintage', 'retro')) return { op: 'filter', filter: 'sepia(0.85)' };
    if (has('cartoon', 'anime', 'comic')) return { op: 'cartoon' };
    if (has('sketch', 'pencil')) return { op: 'sketch' };
    if (has('enhance', 'improve', 'sharp', 'bright', 'quality', 'hd', 'nikhar', 'chamkao',
             'vibrant', 'colorful', 'saturation', 'clarity', 'boost'))
      return { op: 'enhance' };
    return null;
  }

  function applyFilter(img, filter) {
    const c = newCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.filter = filter;
    ctx.drawImage(img, 0, 0);
    return c;
  }

  function applyEnhance(img) {
    const c = newCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.filter = 'brightness(1.06) contrast(1.12) saturate(1.25)';
    ctx.drawImage(img, 0, 0);
    ctx.filter = 'none';
    // halka sharpen (convolution)
    try {
      const id = ctx.getImageData(0, 0, c.width, c.height);
      const d = id.data, w = id.width, h = id.height, src = new Uint8ClampedArray(d);
      const k = 0.45, center = 1 + 4 * k;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = (y * w + x) * 4;
          for (let ch = 0; ch < 3; ch++) {
            const p = i + ch;
            d[p] = src[p] * center - k * (src[p - 4] + src[p + 4] + src[p - w * 4] + src[p + w * 4]);
          }
        }
      }
      ctx.putImageData(id, 0, 0);
    } catch (e) {}
    return c;
  }

  function applyCartoon(img) {
    const w = img.width, h = img.height;
    const c = newCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const id = ctx.getImageData(0, 0, w, h);
    const d = id.data, lum = new Uint8Array(w * h);
    const poster = v => Math.round(v * 6 / 255) * (255 / 6);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      d[i] = poster(d[i]); d[i + 1] = poster(d[i + 1]); d[i + 2] = poster(d[i + 2]);
      lum[p] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) >> 10;
    }
    for (let y = 0; y < h - 1; y++) {
      for (let x = 0; x < w - 1; x++) {
        const p = y * w + x;
        if (Math.abs(lum[p] - lum[p + 1]) + Math.abs(lum[p] - lum[p + w]) > 44) {
          const i = p * 4;
          d[i] *= 0.25; d[i + 1] *= 0.25; d[i + 2] *= 0.25;
        }
      }
    }
    ctx.putImageData(id, 0, 0);
    return c;
  }

  function applySketch(img) {
    const w = img.width, h = img.height;
    const gray = newCanvas(w, h);
    const g = gray.getContext('2d');
    g.filter = 'grayscale(1)';
    g.drawImage(img, 0, 0);
    const inv = newCanvas(w, h);
    const iv = inv.getContext('2d');
    iv.filter = 'grayscale(1) invert(1) blur(3px)';
    iv.drawImage(img, 0, 0);
    const out = newCanvas(w, h);
    const o = out.getContext('2d');
    o.drawImage(gray, 0, 0);
    o.globalCompositeOperation = 'color-dodge';
    o.drawImage(inv, 0, 0);
    o.globalCompositeOperation = 'source-over';
    return out;
  }

  /* ---------- Passport / ID photo: face detect + smart crop + white BG ---------- */
  function detectFace(img) {
    return new Promise(resolve => {
      if (typeof FaceDetection === 'undefined') return resolve(null);
      let fd, done = false;
      const finish = v => { if (!done) { done = true; resolve(v); } };
      try {
        fd = new FaceDetection({
          locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${f}`
        });
      } catch (e) { return resolve(null); }
      fd.setOptions({ modelSelection: 0 }); // short-range — selfies ke liye best
      fd.onResults(res => {
        const d = res.detections && res.detections[0];
        finish(d && d.boundingBox ? d.boundingBox : null);
      });
      setTimeout(() => finish(null), 45000);
      fd.send({ image: img }).catch(() => finish(null));
    });
  }

  // ICAO/passport style crop: face ~52% of height, head-top se ~10% margin, 35:45 ratio
  async function buildPassportPhoto(img) {
    const W = img.width, H = img.height;
    const AR = 35 / 45; // passport photo aspect (width / height)
    const box = await detectFace(img);

    let ch, cx0, cy0;
    if (box) {
      const fh = box.height * H;          // face height in px
      ch = fh / 0.52;                     // face = 52% of photo height
      cy0 = box.y * H - 0.10 * ch;        // head top se 10% margin
      const fcx = (box.x + box.width / 2) * W;
      cx0 = fcx - (ch * AR) / 2;          // face horizontally center
    } else {
      ch = H * 0.92;                      // fallback: top-heavy center crop
      cy0 = 0; // top se bilkul crop mat karo (baal na katein)
      cx0 = (W - ch * AR) / 2;
    }
    let cw = ch * AR;

    // crop image ke bahar na jaaye
    if (ch > H) { ch = H; cw = ch * AR; }
    if (cw > W) { cw = W; ch = cw / AR; }
    cy0 = Math.max(0, Math.min(cy0, H - ch));
    cx0 = Math.max(0, Math.min(cx0, W - cw));

    const c = newCanvas(Math.round(cw), Math.round(ch));
    c.getContext('2d').drawImage(
      img,
      Math.round(cx0), Math.round(cy0), Math.round(cw), Math.round(ch),
      0, 0, c.width, c.height
    );

    // white background — HD hair-safe engine (imgly IS-Net), fail ho to MediaPipe
    const white = await runSelfieSegmentation(c, 'white_bg', 12, '#ffffff',
      m => setStatus('💇 ' + m));

    // Hair ko subtle round golai + niche bikhre strands andar set (face untouched)
    let shaped = white;
    if (typeof window.shapeHairGolaiAndLowerStrands === 'function') {
      setStatus('💇 Hair edges round ho rahe hain...');
      try { shaped = window.shapeHairGolaiAndLowerStrands(white); } catch (_) { shaped = white; }
    }

    // gentle ID-photo polish: thoda bright + clear
    const fin = newCanvas(shaped.width, shaped.height);
    const fc = fin.getContext('2d');
    fc.fillStyle = '#ffffff'; // shape warp se edges transparent hoti hain — white base
    fc.fillRect(0, 0, fin.width, fin.height);
    fc.filter = 'brightness(1.05) contrast(1.07) saturate(1.08)';
    fc.drawImage(shaped, 0, 0);
    fc.filter = 'none';
    return fin;
  }

  async function localEdit(cmd) {
    const op = parseLocalCommand(cmd);
    if (!op) {
      setStatus('Local mode ye command samajh nahi paya. Try keywords: remove background, ' +
        'white/blue/black/green background, blur background, enhance, black & white, cartoon, sketch, sepia ' +
        '— ya "AI Cloud" engine switch karke rich commands do.', true);
      return;
    }
    setLoading(true);
    setStatus('Local AI process kar raha hai... (bina key, turant)');
    try {
      const img = await loadImage(selectedDataUrl);
      let out, type = 'image/jpeg';
      if (op.op === 'seg') {
        if (typeof SelfieSegmentation === 'undefined') throw new Error('Background AI (MediaPipe) load nahi hua — internet check karke retry karo.');
        const scaled = await scaleImage(img, 1400);
        out = await Promise.race([
          runSelfieSegmentation(scaled, op.mode, op.blurPx || 14, op.color || '#2563eb',
            m => setStatus('💇 ' + m)),
          new Promise((_, rej) => setTimeout(() => rej(new Error('Background AI slow tha — retry karo.')), 180000))
        ]);
        if (op.mode === 'transparent') type = 'image/png';
      } else if (op.op === 'passport') {
        out = await buildPassportPhoto(img);
        type = 'image/jpeg';
      } else if (op.op === 'filter') {
        out = applyFilter(img, op.filter);
      } else if (op.op === 'enhance') {
        out = applyEnhance(img);
      } else if (op.op === 'cartoon') {
        out = applyCartoon(img);
      } else if (op.op === 'sketch') {
        out = applySketch(img);
      }
      const blob = await canvasToBlob(out, type, 0.92);
      addResultCard(blob, `ai-local-${Date.now()}.${type === 'image/png' ? 'png' : 'jpg'}`, `🔧 ${cmd}`);
      setStatus('✅ Local edit taiyaar! Bina key, turant ban gaya.');
    } catch (err) {
      setStatus('Local edit fail: ' + (err && err.message ? err.message : err), true);
    } finally {
      setLoading(false);
    }
  }

  /* ---------- friendly error messages ---------- */
  async function friendlyError(res, kind, parsed) {
    let msg = '';
    let j = parsed;
    if (!j) { try { j = await res.json(); } catch (e) {} }
    if (j) {
      const e2 = j.error || j;
      msg = (e2 && (e2.message || e2.msg)) || j.message || '';
    }
    const retry = res.headers.get('retry-after');

    if (res.status === 401) {
      return 'API key invalid ya missing hai — free key lekar Save Key dabao (enter.pollinations.ai/keys).';
    }
    if (res.status === 402) {
      const wait = retry ? ` — ${retry} sec baad free slot milega` : '';
      if (kind === 'edit') return `Free balance/pollen khatam ho gaya${wait}. enter.pollinations.ai se free pollen lein ya thodi der baad try karo.`;
      return `Free limit: 1 image per 45 sec per IP${wait}. Thodi der baad dobara try karo.`;
    }
    if (res.status === 429) {
      return `Bahut jaldi request ho gayi${retry ? ` — ${retry} sec wait karo` : ''}.`;
    }
    if (res.status === 400) {
      return `Request problem: ${msg || 'prompt/photo theek se check karo'}.`;
    }
    if (res.status === 403) {
      return 'Pollinations ne request block ki (security check). Page reload karke dobara try karo.';
    }
    if (msg) return `Error (${res.status}): ${msg}`;
    return `Error ${res.status} — dobara try karo.`;
  }

  /* ---------- dynamic edit-model list (no auth needed) ---------- */
  (function loadEditModels() {
    fetch('https://gen.pollinations.ai/image/models')
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d) ? d : (d.data || d.models || []);
        if (!arr.length) return;
        let list = arr.filter(m => Array.isArray(m.supported_endpoints) && m.supported_endpoints.includes('/v1/images/edits'));
        if (!list.length) list = arr.filter(m => JSON.stringify(m.input_modalities || []).includes('image'));
        if (!list.length) return;
        const prev = els.editModel.value;
        els.editModel.innerHTML = '';
        list.forEach(m => {
          const o = document.createElement('option');
          o.value = m.id || m.name;
          o.textContent = m.name || m.id;
          els.editModel.appendChild(o);
        });
        if ([...els.editModel.options].some(o => o.value === prev)) els.editModel.value = prev;
        else if ([...els.editModel.options].some(o => o.value === 'black-forest-labs/flux.1-kontext-pro'))
          els.editModel.value = 'black-forest-labs/flux.1-kontext-pro';
      })
      .catch(() => { /* fallback options already in HTML */ });
  })();

  /* ---------- Ctrl+Enter shortcuts ---------- */
  els.prompt.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generateFromPrompt(); });
  els.command.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) editWithCommand(); });
})();
