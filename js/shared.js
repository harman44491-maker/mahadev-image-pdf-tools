if (typeof pdfjsLib !== 'undefined') { pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; }

    // ================= 100+ ENGLISH, HINDI (DEVANAGARI) & PUNJABI (GURMUKHI) FONTS =================
    const FONTS_100_PLUS = [
      { label: '[Punjabi] Noto Sans Gurmukhi', css: "'Noto Sans Gurmukhi', sans-serif" },
      { label: '[Punjabi] Baloo Paaji 2', css: "'Baloo Paaji 2', 'Noto Sans Gurmukhi', sans-serif" },
      { label: '[Punjabi] Mukta Mahee', css: "'Mukta Mahee', 'Noto Sans Gurmukhi', sans-serif" },
      { label: '[Punjabi] Noto Serif Gurmukhi', css: "'Noto Serif Gurmukhi', serif" },
      { label: '[Punjabi] Tiro Gurmukhi', css: "'Tiro Gurmukhi', 'Noto Serif Gurmukhi', serif" },
      { label: '[Punjabi] Raavi Classic', css: "'Raavi', 'Noto Sans Gurmukhi', sans-serif" },
      { label: '[Punjabi] AnmolLipi Style', css: "'AnmolLipi', 'Noto Serif Gurmukhi', serif" },
      { label: '[Punjabi] GurbaniAkhar Style', css: "'GurbaniAkhar', 'Noto Serif Gurmukhi', serif" },
      { label: '[Punjabi] Saab Gurmukhi', css: "'Saab', 'Noto Sans Gurmukhi', sans-serif" },
      { label: '[Punjabi] Joy Gurmukhi', css: "'Joy', 'Baloo Paaji 2', sans-serif" },
      { label: '[Hindi] Noto Sans Devanagari', css: "'Noto Sans Devanagari', sans-serif" },
      { label: '[Hindi] Hind', css: "'Hind', 'Noto Sans Devanagari', sans-serif" },
      { label: '[Hindi] Mukta', css: "'Mukta', 'Noto Sans Devanagari', sans-serif" },
      { label: '[Hindi] Kalam (Handwriting)', css: "'Kalam', cursive" },
      { label: '[Hindi] Khand (Display)', css: "'Khand', 'Noto Sans Devanagari', sans-serif" },
      { label: '[Hindi] Laila (Serif)', css: "'Laila', 'Noto Serif Devanagari', serif" },
      { label: '[Hindi] Noto Serif Devanagari', css: "'Noto Serif Devanagari', serif" },
      { label: '[Hindi] Tiro Devanagari Hindi', css: "'Tiro Devanagari Hindi', serif" },
      { label: '[Hindi] Rozha One (Bold Title)', css: "'Rozha One', serif" },
      { label: '[Hindi] Yatra One (Poster)', css: "'Yatra One', cursive" },
      { label: '[Hindi] Modak (Fun Display)', css: "'Modak', cursive" },
      { label: '[Hindi] Baloo 2 Devanagari', css: "'Baloo 2', 'Noto Sans Devanagari', sans-serif" },
      { label: '[Hindi] Baloo Bhai 2', css: "'Baloo Bhai 2', sans-serif" },
      { label: '[Hindi] Baloo Bhaina 2', css: "'Baloo Bhaina 2', sans-serif" },
      { label: '[Hindi] Hind Vadodara', css: "'Hind Vadodara', sans-serif" },
      { label: '[Hindi] Hind Siliguri', css: "'Hind Siliguri', sans-serif" },
      { label: '[Hindi] Mukta Vaani', css: "'Mukta Vaani', sans-serif" },
      { label: '[Hindi] Mukta Malayalam', css: "'Mukta Malayalam', sans-serif" },
      { label: '[Hindi] Baloo Da 2', css: "'Baloo Da 2', sans-serif" },
      { label: '[Hindi] Baloo Tamma 2', css: "'Baloo Tamma 2', sans-serif" },
      { label: '[Eng] Arial', css: "Arial, sans-serif" },
      { label: '[Eng] Roboto', css: "'Roboto', sans-serif" },
      { label: '[Eng] Open Sans', css: "'Open Sans', sans-serif" },
      { label: '[Eng] Lato', css: "'Lato', sans-serif" },
      { label: '[Eng] Montserrat', css: "'Montserrat', sans-serif" },
      { label: '[Eng] Poppins', css: "'Poppins', sans-serif" },
      { label: '[Eng] Inter', css: "'Inter', sans-serif" },
      { label: '[Eng] Oswald', css: "'Oswald', sans-serif" },
      { label: '[Eng] Raleway', css: "'Raleway', sans-serif" },
      { label: '[Eng] PT Sans', css: "'PT Sans', sans-serif" },
      { label: '[Eng] Merriweather', css: "'Merriweather', serif" },
      { label: '[Eng] Nunito', css: "'Nunito', sans-serif" },
      { label: '[Eng] Playfair Display', css: "'Playfair Display', serif" },
      { label: '[Eng] Ubuntu', css: "'Ubuntu', sans-serif" },
      { label: '[Eng] Rubik', css: "'Rubik', sans-serif" },
      { label: '[Eng] Lora', css: "'Lora', serif" },
      { label: '[Eng] PT Serif', css: "'PT Serif', serif" },
      { label: '[Eng] Work Sans', css: "'Work Sans', sans-serif" },
      { label: '[Eng] Fira Code', css: "'Fira Code', monospace" },
      { label: '[Eng] Quicksand', css: "'Quicksand', sans-serif" },
      { label: '[Eng] Bitter', css: "'Bitter', serif" },
      { label: '[Eng] Josefin Sans', css: "'Josefin Sans', sans-serif" },
      { label: '[Eng] Dancing Script', css: "'Dancing Script', cursive" },
      { label: '[Eng] Pacifico', css: "'Pacifico', cursive" },
      { label: '[Eng] Bebas Neue', css: "'Bebas Neue', cursive" },
      { label: '[Eng] Anton', css: "'Anton', sans-serif" },
      { label: '[Eng] Lobster', css: "'Lobster', cursive" },
      { label: '[Eng] Caveat', css: "'Caveat', cursive" },
      { label: '[Eng] Abril Fatface', css: "'Abril Fatface', cursive" },
      { label: '[Eng] Righteous', css: "'Righteous', cursive" },
      { label: '[Eng] Cinzel', css: "'Cinzel', serif" },
      { label: '[Eng] Great Vibes', css: "'Great Vibes', cursive" },
      { label: '[Eng] Architects Daughter', css: "'Architects Daughter', cursive" },
      { label: '[Eng] Indie Flower', css: "'Indie Flower', cursive" },
      { label: '[Eng] Shadows Into Light', css: "'Shadows Into Light', cursive" },
      { label: '[Eng] Satisfy', css: "'Satisfy', cursive" },
      { label: '[Eng] Kaushan Script', css: "'Kaushan Script', cursive" },
      { label: '[Eng] Courgette', css: "'Courgette', cursive" },
      { label: '[Eng] Cookie', css: "'Cookie', cursive" },
      { label: '[Eng] Sacramento', css: "'Sacramento', cursive" },
      { label: '[Eng] Bangers', css: "'Bangers', cursive" },
      { label: '[Eng] Creepster', css: "'Creepster', cursive" },
      { label: '[Eng] Alfa Slab One', css: "'Alfa Slab One', cursive" },
      { label: '[Eng] Acme', css: "'Acme', sans-serif" },
      { label: '[Eng] Amatic SC', css: "'Amatic SC', cursive" },
      { label: '[Eng] Patrick Hand', css: "'Patrick Hand', cursive" },
      { label: '[Eng] Gloria Hallelujah', css: "'Gloria Hallelujah', cursive" },
      { label: '[Eng] Permanent Marker', css: "'Permanent Marker', cursive" },
      { label: '[Eng] Zeyada', css: "'Zeyada', cursive" },
      { label: '[Eng] Space Grotesk', css: "'Space Grotesk', sans-serif" },
      { label: '[Eng] Plus Jakarta Sans', css: "'Plus Jakarta Sans', sans-serif" },
      { label: '[Eng] DM Sans', css: "'DM Sans', sans-serif" },
      { label: '[Eng] DM Serif Display', css: "'DM Serif Display', serif" },
      { label: '[Eng] Outfit', css: "'Outfit', sans-serif" },
      { label: '[Eng] Teko', css: "'Teko', sans-serif" },
      { label: '[Eng] Rajdhani', css: "'Rajdhani', sans-serif" },
      { label: '[Eng] Exo 2', css: "'Exo 2', sans-serif" },
      { label: '[Eng] Varela Round', css: "'Varela Round', sans-serif" },
      { label: '[Eng] Comfortaa', css: "'Comfortaa', cursive" },
      { label: '[Eng] Arvo', css: "'Arvo', serif" },
      { label: '[Eng] Rokkitt', css: "'Rokkitt', serif" },
      { label: '[Eng] Libre Baskerville', css: "'Libre Baskerville', serif" },
      { label: '[Eng] EB Garamond', css: "'EB Garamond', serif" },
      { label: '[Eng] Crimson Text', css: "'Crimson Text', serif" },
      { label: '[Eng] Noto Sans', css: "'Noto Sans', sans-serif" },
      { label: '[Eng] Noto Serif', css: "'Noto Serif', serif" },
      { label: '[Eng] Roboto Slab', css: "'Roboto Slab', serif" },
      { label: '[Eng] Roboto Mono', css: "'Roboto Mono', monospace" },
      { label: '[Eng] Source Code Pro', css: "'Source Code Pro', monospace" },
      { label: '[Eng] JetBrains Mono', css: "'JetBrains Mono', monospace" },
      { label: '[Eng] Inconsolata', css: "'Inconsolata', monospace" },
      { label: '[Eng] Fredoka', css: "'Fredoka', sans-serif" },
      { label: '[Eng] Baloo Tammudu 2', css: "'Baloo Tammudu 2', sans-serif" },
      { label: '[Eng] Baloo Thambi 2', css: "'Baloo Thambi 2', sans-serif" },
      { label: '[Eng] Times New Roman', css: "'Times New Roman', Times, serif" },
      { label: '[Eng] Georgia', css: "Georgia, serif" },
      { label: '[Eng] Courier New', css: "'Courier New', Courier, monospace" },
      { label: '[Eng] Verdana', css: "Verdana, Geneva, sans-serif" },
      { label: '[Eng] Trebuchet MS', css: "'Trebuchet MS', sans-serif" },
      { label: '[Eng] Impact', css: "Impact, Charcoal, sans-serif" }
    ];

    document.querySelectorAll('.font-selector-100').forEach(sel => {
      FONTS_100_PLUS.forEach((f, idx) => {
        const opt = document.createElement('option');
        opt.value = f.css;
        opt.textContent = `${idx + 1}. ${f.label}`;
        opt.style.fontFamily = f.css;
        sel.appendChild(opt);
      });
    });

    function buildCanvasFontStr(isBold, sizePx, fontCss) {
      return `${isBold ? '700' : '400'} ${sizePx}px ${fontCss}`;
    }

    document.querySelectorAll('.menu-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      });
    });

    function loadImg(src) {
      return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
    }
    function toBlob(canvas, type, q) {
      return new Promise(r => canvas.toBlob(b => r(b), type, q));
    }
    function padBlobToExactBytes(blob, exactBytes, mimeType) {
      if (!blob || blob.size >= exactBytes) return blob;
      const padding = new Uint8Array(exactBytes - blob.size);
      return new Blob([blob, padding], { type: mimeType });
    }
    function addDownloadCard(container, blobOrUrl, filename, labelText) {
      const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
      const card = document.createElement('div');
      card.className = 'card';
      const isImg = filename.match(/\.(jpg|jpeg|png|webp)$/i);
      card.innerHTML = `
        ${isImg ? `<img src="${url}" alt="${filename}">` : `<div class="card-title">${filename}</div>`}
        <div style="font-size:.84rem;color:#334155;">${labelText}</div>
        <a class="dl-btn" href="${url}" download="${filename}">Download ${filename.split('.').pop().toUpperCase()}</a>
      `;
      container.appendChild(card);
    }

    async function openPdfWithPasswordSupport(arrayBuffer, initialPass = '') {
      let pass = initialPass;
      while (true) {
        try {
          return await pdfjsLib.getDocument({ data: arrayBuffer.slice(0), password: pass || undefined }).promise;
        } catch (err) {
          if (err && (err.name === 'PasswordException' || String(err).toLowerCase().includes('password'))) {
            const entered = prompt(pass ? 'Incorrect password. Enter PDF password:' : 'This PDF is password protected. Enter PDF password:');
            if (entered === null) throw new Error('Password entry cancelled.');
            pass = entered;
          } else {
            throw err;
          }
        }
      }
    }

// ================= HD HAIR-SAFE BACKGROUND REMOVAL (imgly IS-Net ONNX, bina key) =================
// MediaPipe ka mask blocky/staircase aata tha (jagged hair edges). imgly IS-Net strands-accurate
// cutout deta hai — pehli baar model download (~88 MB, browser cache), uske baad instant.
let _imglyMod = null;
let _imglyLoad = null;
function loadImglyBgRem() {
  if (_imglyMod) return Promise.resolve(_imglyMod);
  if (!_imglyLoad) {
    _imglyLoad = import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm')
      .then(m => { _imglyMod = m; return m; })
      .catch(e => { _imglyLoad = null; throw e; });
  }
  return _imglyLoad;
}

async function hdRemoveBackgroundBlob(img, onProgress) {
  const mod = await loadImglyBgRem();
  let input;
  if (typeof img === 'string') input = img;
  else if (img instanceof HTMLCanvasElement) {
    input = await new Promise((res, rej) => img.toBlob(b => b ? res(b) : rej(new Error('toBlob fail')), 'image/png'));
  } else if (img && img.src) input = img.src;
  else throw new Error('HD engine: input not supported');
  return await mod.removeBackground(input, {
    output: { format: 'image/png' },
    progress: (key, cur, total) => {
      if (!onProgress || !total) return;
      const pct = Math.min(100, Math.round((cur / total) * 100));
      const isFetch = key && String(key).indexOf('fetch') !== -1;
      onProgress((isFetch ? 'HD model download: ' : 'HD hair-AI process: ') + pct + '%...');
    }
  });
}

// Faint wispy semi-transparent strands hatao (white bg pe grey wisps dikh the) +
// solid edges banao — top region zyada aggressive (flyaways wahan sabse zyada).
// Threshold ke baad erode+dilate (morphological opening) se jagged steps khatam,
// phir 2-pass blur se bilkul round smooth edge.
function removeWispySemiTransparent(cutoutCanvas) {
  const w = cutoutCanvas.width;
  const h = cutoutCanvas.height;
  const ctx = cutoutCanvas.getContext('2d', { willReadFrequently: true });
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  const topCut = Math.floor(h * 0.30); // top 30% = flyaway zone
  // Step 1: threshold — faint wisps hatao, solid karo
  for (let y = 0; y < h; y++) {
    const inTop = y < topCut;
    const lo = inTop ? 130 : 90;
    const hi = 215;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4 + 3;
      const a = d[i];
      if (a === 0) continue;
      if (a < lo) d[i] = 0;
      else if (a >= hi) d[i] = 255;
      else d[i] = Math.round(((a - lo) * 255) / (hi - lo));
    }
  }
  // Step 2: alpha channels alag se process (RGB rehne do)
  const alpha = new Uint8ClampedArray(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) alpha[p] = d[i + 3];
  const morph = (src, op) => { // op: 'min' (erode) | 'max' (dilate)
    const out = new Uint8ClampedArray(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = op === 'min' ? 255 : 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy; if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx; if (xx < 0 || xx >= w) continue;
            const a = src[yy * w + xx];
            if (op === 'min') { if (a < v) v = a; } else { if (a > v) v = a; }
          }
        }
        out[y * w + x] = v;
      }
    }
    return out;
  };
  // Opening = erode -> dilate: chhote jagged spikes/steps hatate hain, size same
  let a2 = morph(alpha, 'min');
  a2 = morph(a2, 'max');
  // Step 3: 2-pass box blur (R=2) — near-gaussian smooth round edge
  const blurPass = (src) => {
    const out = new Uint8ClampedArray(w * h);
    const R = 2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0, n = 0;
        for (let dy = -R; dy <= R; dy++) {
          const yy = y + dy; if (yy < 0 || yy >= h) continue;
          for (let dx = -R; dx <= R; dx++) {
            const xx = x + dx; if (xx < 0 || xx >= w) continue;
            sum += src[yy * w + xx]; n++;
          }
        }
        out[y * w + x] = Math.round(sum / n);
      }
    }
    return out;
  };
  a2 = blurPass(a2);
  a2 = blurPass(a2);
  // Wapas RGBA me — edge band ya thodi transparent: alpha ~60 neeche = 0 (clean),
  // upar scale — blur ke baad halki transparency anti-aliasing deti hai.
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    let v = a2[p];
    if (v < 48) v = 0; else if (v > 235) v = 255;
    d[i + 3] = v;
  }
  ctx.putImageData(id, 0, 0);
  return cutoutCanvas;
}

// Strong round crown — hair ke top profile ko smooth ellipse dome pe trim karo
// (natural clumps/irregular hairline ko bhi bilkul round). Niche side tuck bhi.
function roundCrownStrong(cutout) {
  const w = cutout.width;
  const h = cutout.height;
  const ctx = cutout.getContext('2d', { willReadFrequently: true });
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;

  // Har column me sabse upar ka opaque pixel (hair top profile)
  const tops = new Array(w).fill(-1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (d[(y * w + x) * 4 + 3] > 70) { tops[x] = y; break; }
    }
  }
  let first = -1, last = -1;
  for (let x = 0; x < w; x++) if (tops[x] >= 0) { first = x; break; }
  for (let x = w - 1; x >= 0; x--) if (tops[x] >= 0) { last = x; break; }
  if (first < 0 || last - first < w * 0.2) return cutout;

  // Range ke andar empty columns fill
  const fallback = tops[first];
  for (let x = first; x <= last; x++) if (tops[x] < 0) tops[x] = fallback;

  // Heavy moving average = irregular bumps khatam, round curve
  const span = last - first;
  const win = Math.max(9, Math.round(span * 0.22));
  const smooth = new Array(w).fill(0);
  for (let x = first; x <= last; x++) {
    let sum = 0, n = 0;
    for (let k = -win; k <= win; k++) {
      const xx = Math.min(last, Math.max(first, x + k));
      sum += tops[xx]; n++;
    }
    smooth[x] = sum / n;
  }

  // Ellipse blend — guaranteed gol dome (center highest, sides gently down)
  const cx = (first + last) / 2;
  let minT = Infinity, maxT = -Infinity;
  for (let x = first; x <= last; x++) { if (smooth[x] < minT) minT = smooth[x]; if (smooth[x] > maxT) maxT = smooth[x]; }
  const depth = Math.max(8, maxT - minT);
  for (let x = first; x <= last; x++) {
    const t = (x - cx) / Math.max(1, span / 2);
    const ellipse = minT + (1 - Math.sqrt(Math.max(0, 1 - t * t))) * depth;
    smooth[x] = smooth[x] * 0.4 + ellipse * 0.6; // 60% round ellipse + 40% natural
  }

  // Curve ke upar wale pixels hatao (3px margin + 4px anti-alias fade)
  const MARGIN = 3;
  for (let x = first; x <= last; x++) {
    const cut = smooth[x] + MARGIN;
    const maxY = Math.min(h, Math.ceil(cut + 4));
    for (let y = 0; y < maxY; y++) {
      const i = (y * w + x) * 4 + 3;
      if (d[i] === 0) continue;
      if (y < cut - 2) d[i] = 0;
      else if (y < cut + 2) d[i] = Math.round(d[i] * (y - (cut - 2)) / 4);
    }
  }

  ctx.putImageData(id, 0, 0);
  return cutout;
}

function composeBgFromCutout(cutout, w, h, mode, blurPx, customColor, img) {
  if (mode === 'transparent') return cutout;
  const bg = document.createElement('canvas');
  bg.width = w;
  bg.height = h;
  const bctx = bg.getContext('2d');
  if (mode === 'blur_bg') {
    bctx.filter = `blur(${blurPx || 14}px)`;
    bctx.drawImage(img, 0, 0, w, h);
    bctx.filter = 'none';
  } else if (mode === 'studio_gradient') {
    const grad = bctx.createRadialGradient(w / 2, h * 0.42, w * 0.08, w / 2, h / 2, Math.max(w, h) * 0.78);
    grad.addColorStop(0, '#475569');
    grad.addColorStop(1, '#0f172a');
    bctx.fillStyle = grad;
    bctx.fillRect(0, 0, w, h);
  } else if (mode === 'solid_color') {
    bctx.fillStyle = customColor || '#2563eb';
    bctx.fillRect(0, 0, w, h);
  } else {
    bctx.fillStyle = '#ffffff';
    bctx.fillRect(0, 0, w, h);
  }
  bctx.drawImage(cutout, 0, 0, w, h);
  return bg;
}

// Shared AI Background Segmentation
// Pehle HD hair-safe engine (imgly IS-Net) try hota hai, fail ho to MediaPipe lightweight path.
async function runSelfieSegmentation(img, mode = 'white_bg', blurPx = 12, customColor = '#2563eb', onProgress) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  // ---- Step 1: HD engine — hair strands tak clean cutout (jagged edges fix) ----
  try {
    if (onProgress) onProgress('HD hair-AI load ho raha hai... (pehli baar ~30 sec, uske baad instant)');
    const blob = await Promise.race([
      hdRemoveBackgroundBlob(img, onProgress),
      new Promise((_, rej) => setTimeout(() => rej(new Error('HD timeout')), 70000))
    ]);
    const bmp = await createImageBitmap(blob);
    const cut = document.createElement('canvas');
    cut.width = w;
    cut.height = h;
    cut.getContext('2d').drawImage(bmp, 0, 0, w, h);
    try { bmp.close(); } catch (_) {}
    removeWispySemiTransparent(cut); // faint wispy strands hatao — clean round edge
    if (onProgress) onProgress('Background set ho raha hai...');
    return composeBgFromCutout(cut, w, h, mode, blurPx, customColor, img);
  } catch (err) {
    // HD engine nahi chala (net / adblock / timeout) → Step 2 lightweight path neeche
  }

  // ---- Step 2: MediaPipe SelfieSegmentation (original lightweight path) ----
  return new Promise(async (resolve) => {
        try {
          const selfieSeg = new SelfieSegmentation({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
          });
          selfieSeg.setOptions({ modelSelection: 1 });
          const outCanvas = document.createElement('canvas');
          outCanvas.width = img.width; outCanvas.height = img.height;
          const ctx = outCanvas.getContext('2d');
          selfieSeg.onResults((results) => {
            ctx.save();
            ctx.clearRect(0, 0, outCanvas.width, outCanvas.height);
            ctx.drawImage(results.segmentationMask, 0, 0, outCanvas.width, outCanvas.height);
            ctx.globalCompositeOperation = 'source-in';
            ctx.drawImage(results.image, 0, 0, outCanvas.width, outCanvas.height);

            if (mode === 'transparent') {
              ctx.restore();
              resolve(outCanvas);
              return;
            }

            ctx.globalCompositeOperation = 'destination-over';
            if (mode === 'blur_bg') {
              ctx.filter = `blur(${blurPx}px)`;
              ctx.drawImage(results.image, 0, 0, outCanvas.width, outCanvas.height);
              ctx.filter = 'none';
            } else if (mode === 'studio_gradient') {
              const grad = ctx.createRadialGradient(outCanvas.width / 2, outCanvas.height * 0.42, outCanvas.width * 0.08, outCanvas.width / 2, outCanvas.height / 2, Math.max(outCanvas.width, outCanvas.height) * 0.78);
              grad.addColorStop(0, '#475569');
              grad.addColorStop(1, '#0f172a');
              ctx.fillStyle = grad;
              ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
            } else if (mode === 'solid_color') {
              ctx.fillStyle = customColor;
              ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
            } else {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
            }
            ctx.restore();
            resolve(outCanvas);
          });
          await selfieSeg.send({ image: img });
        } catch (err) {
          const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
          c.getContext('2d').drawImage(img, 0, 0); resolve(c);
        }
      });
    }

// Smooth Golai (rounded dome) + Niche bikhre hairs ko smoothly andar set karna
window.shapeHairGolaiAndLowerStrands = function shapeHairGolaiAndLowerStrands(srcCanvas) {
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const sCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
  const srcData = sCtx.getImageData(0, 0, w, h).data;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const oCtx = outCanvas.getContext('2d', { willReadFrequently: true });
  const outImg = oCtx.createImageData(w, h);
  const dst = outImg.data;

  const cx = w * 0.5;
  const maxHeadHalfW = w * 0.34;

  const sampleBilinear = (fx, fy, outPx) => {
    if (fx < 0 || fx >= w - 1 || fy < 0 || fy >= h - 1) {
      outPx[0] = 255; outPx[1] = 255; outPx[2] = 255; outPx[3] = 0;
      return;
    }
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const x1 = x0 + 1, y1 = y0 + 1;
    const wx = fx - x0, wy = fy - y0;

    const i00 = (y0 * w + x0) * 4;
    const i10 = (y0 * w + x1) * 4;
    const i01 = (y1 * w + x0) * 4;
    const i11 = (y1 * w + x1) * 4;

    for (let ch = 0; ch < 4; ch++) {
      const top = srcData[i00 + ch] * (1 - wx) + srcData[i10 + ch] * wx;
      const bot = srcData[i01 + ch] * (1 - wx) + srcData[i11 + ch] * wx;
      outPx[ch] = Math.round(top * (1 - wy) + bot * wy);
    }
  };

  const smoothstep = (edge0, edge1, x) => {
    const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(0.0001, edge1 - edge0)));
    return t * t * (3 - 2 * t);
  };

  const px = [255, 255, 255, 0];

  for (let y = 0; y < h; y++) {
    const ny = y / Math.max(1, h);
    const topFade = smoothstep(0.02, 0.14, ny) * (1 - smoothstep(0.38, 0.55, ny));
    const lowerFade = smoothstep(0.40, 0.55, ny) * (1 - smoothstep(0.76, 0.90, ny));

    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const absDx = Math.abs(dx);
      const normX = Math.min(1, absDx / Math.max(1, maxHeadHalfW));
      const sideFade = 1 - smoothstep(0.70, 1.25, normX);

      let sx = x;
      let sy = y;

      // Smooth rounded crown golai + side tuck
      if (topFade > 0.001 && sideFade > 0.001) {
        const dome = Math.cos(normX * Math.PI * 0.5);
        sy -= dome * (h * 0.045) * topFade * sideFade;
        sx += (dx > 0 ? 1 : -1) * Math.pow(normX, 1.5) * (w * 0.035) * topFade * sideFade;
      }

      // Lower bikhre hair strands ko smooth andar gather karna
      if (lowerFade > 0.001) {
        const outerZone = smoothstep(0.14, 0.40, absDx / Math.max(1, w));
        sx += (dx > 0 ? 1 : -1) * outerZone * (w * 0.075) * lowerFade;
      }

      sampleBilinear(sx, sy, px);
      const dstIdx = (y * w + x) * 4;
      dst[dstIdx] = px[0];
      dst[dstIdx + 1] = px[1];
      dst[dstIdx + 2] = px[2];
      dst[dstIdx + 3] = px[3];
    }
  }

  oCtx.putImageData(outImg, 0, 0);
  return outCanvas;
};
