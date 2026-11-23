// ================= SHARED TOOLKIT HELPERS =================
// Common helpers used by Image Resizer, Passport, PDF, Watermark and Editor pages.
if (typeof pdfjsLib !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

function toBlob(canvas, mime = 'image/jpeg', quality = 0.92) {
  return new Promise((resolve, reject) => {
    if (!canvas || typeof canvas.toBlob !== 'function') {
      reject(new Error('Image canvas is not available in this browser.'));
      return;
    }
    try {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Could not encode the image. Try a different format or smaller dimensions.'));
      }, mime, quality);
    } catch (error) { reject(error); }
  });
}

function padBlobToExactBytes(blob, targetBytes, outputType) {
  const target = Math.max(0, Math.floor(Number(targetBytes) || 0));
  if (!(blob instanceof Blob) || !target || blob.size >= target) return blob;
  const padding = new Uint8Array(target - blob.size);
  return new Blob([blob, padding], { type: outputType || blob.type });
}

function addDownloadCard(container, blob, filename, detail = '') {
  if (!container || !(blob instanceof Blob)) throw new Error('Download output could not be created.');
  const card = document.createElement('div');
  card.className = 'output-card output-card-with-preview';
  card.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:12px;margin:10px 0;border:1px solid #dbe3ef;border-radius:10px;background:#fff;max-width:100%;box-sizing:border-box;';
  const info = document.createElement('div');
  info.textContent = [filename, detail].filter(Boolean).join(' — ');
  info.style.cssText = 'font-size:14px;color:#334155;overflow-wrap:anywhere;width:100%;';
  const url = URL.createObjectURL(blob);
  const mime = String(blob.type || '').toLowerCase();
  let preview = null;
  if (mime.startsWith('image/')) {
    preview = document.createElement('img');
    preview.src = url;
    preview.alt = filename || 'Generated image preview';
    preview.loading = 'lazy';
    preview.style.cssText = 'display:block;max-width:min(100%,360px);max-height:460px;width:auto;height:auto;object-fit:contain;margin:0 auto;border:1px solid #e2e8f0;border-radius:6px;background:#fff;';
    preview.addEventListener('error', () => { preview.alt = 'Image preview unavailable. Use Download to save the file.'; }, { once: true });
  } else if (mime === 'application/pdf' || /\.pdf$/i.test(filename || '')) {
    preview = document.createElement('iframe');
    preview.src = url + '#toolbar=1&navpanes=0&view=FitH';
    preview.title = (filename || 'PDF') + ' preview';
    preview.loading = 'lazy';
    preview.style.cssText = 'display:block;width:100%;height:480px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;';
  }
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'download';
  link.textContent = 'Download';
  link.className = 'btn-green';
  link.style.cssText = 'display:inline-block;text-decoration:none;padding:9px 16px;border-radius:7px;color:#fff;background:#059669;font-weight:700;';
  card.append(info);
  if (preview) card.appendChild(preview);
  card.appendChild(link);
  container.appendChild(card);
  return card;
}

function buildCanvasFontStr(bold, size, font) {
  const px = Math.max(1, Number(size) || 16);
  const family = String(font || 'Arial').replace(/[;{}]/g, '').trim() || 'Arial';
  // Font selectors may supply either a simple family name or a complete CSS
  // stack (including quoted names and fallback families).
  const fontStack = family.includes(',') || /^['"]/.test(family)
    ? family
    : `"${family.replace(/["']/g, '')}"`;
  return `${bold ? '700' : '400'} ${px}px ${fontStack}`;
}

function getCanvasMousePos(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / Math.max(1, rect.width);
  const sy = canvas.height / Math.max(1, rect.height);
  return { x: (event.clientX - rect.left) * sx, y: (event.clientY - rect.top) * sy };
}

async function openPdfWithPasswordSupport(inputBytes, password = '') {
  if (typeof pdfjsLib === 'undefined' || !pdfjsLib.getDocument) {
    throw new Error('PDF reader library did not load. Refresh the page and try again.');
  }

  const bytes = inputBytes instanceof Uint8Array
    ? new Uint8Array(inputBytes)
    : new Uint8Array(inputBytes instanceof ArrayBuffer ? inputBytes : await inputBytes.arrayBuffer());
  let currentPassword = password || '';

  while (true) {
    try {
      return await pdfjsLib.getDocument({
        data: new Uint8Array(bytes),
        password: currentPassword || undefined
      }).promise;
    } catch (error) {
      const needsPassword = error && (error.name === 'PasswordException' || /password/i.test(String(error)));
      if (!needsPassword) throw error;

      const entered = window.prompt(
        currentPassword ? 'Incorrect password. Enter PDF password:' : 'This PDF is password protected. Enter its password:'
      );
      if (entered === null) throw new Error('Password entry cancelled.');
      currentPassword = entered;
    }
  }
}
function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load the selected photo.'));
    img.src = src;
  });
}

// ================= CLEAN CUTOUT + SMOOTH HAIR GOLAI + HD STUDIO LIGHTING =================
function erodeAlphaMask(alphaCanvas, erodePx = 2) {
  const w = alphaCanvas.width;
  const h = alphaCanvas.height;
  const ctx = alphaCanvas.getContext('2d', { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  const alpha = new Uint8ClampedArray(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    alpha[p] = d[i + 3];
  }

  const r = Math.max(1, Math.round(erodePx));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      let minVal = alpha[p];
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) { minVal = 0; break; }
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) { minVal = 0; break; }
          const v = alpha[yy * w + xx];
          if (v < minVal) minVal = v;
        }
        if (minVal === 0) break;
      }

      const idx = p * 4;
      if (minVal <= 100) {
        d[idx + 3] = 0;
      } else if (minVal >= 215) {
        d[idx + 3] = 255;
      } else {
        d[idx + 3] = Math.round(((minVal - 100) / 115) * 255);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return alphaCanvas;
}

function cleanCutoutAndWhiteBg(cutoutCanvas) {
  return stripCurtainFringeFromCutout(cutoutCanvas);
}

function stripCurtainFringeFromCutout(cutoutCanvas) {
  const w = cutoutCanvas.width;
  const h = cutoutCanvas.height;
  const ctx = cutoutCanvas.getContext('2d', { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      const a = d[idx + 3];
      if (a === 0) continue;

      const r = d[idx], g = d[idx + 1], b = d[idx + 2];
      // Check if pixel is near transparent edge
      const nearEdge =
        d[((y - 1) * w + x) * 4 + 3] < 120 ||
        d[((y + 1) * w + x) * 4 + 3] < 120 ||
        d[(y * w + (x - 1)) * 4 + 3] < 120 ||
        d[(y * w + (x + 1)) * 4 + 3] < 120;

      // Remove brownish/peach/grey curtain fringe near edge
      const isCurtainTone = (r >= g && g >= b && (r - b) >= 12 && (r - b) <= 68 && r > 110);
      if (nearEdge && isCurtainTone && a < 235) {
        d[idx + 3] = Math.max(0, Math.round(a * 0.25));
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return cutoutCanvas;
}

function buildAlphaMaskFromSegmentation(maskSource, w, h) {
  const rawCanvas = document.createElement('canvas');
  rawCanvas.width = w;
  rawCanvas.height = h;
  const rawCtx = rawCanvas.getContext('2d', { willReadFrequently: true });
  rawCtx.drawImage(maskSource, 0, 0, w, h);
  const rawData = rawCtx.getImageData(0, 0, w, h).data;

  const alphaCanvas = document.createElement('canvas');
  alphaCanvas.width = w;
  alphaCanvas.height = h;
  const alphaCtx = alphaCanvas.getContext('2d', { willReadFrequently: true });
  const outImg = alphaCtx.createImageData(w, h);
  const out = outImg.data;

  for (let i = 0; i < rawData.length; i += 4) {
    const m = rawData[i];
    let a = 0;
    if (m <= 112) {
      a = 0;
    } else if (m >= 218) {
      a = 255;
    } else {
      a = Math.round(((m - 112) / 106) * 255);
    }
    out[i] = 255;
    out[i + 1] = 255;
    out[i + 2] = 255;
    out[i + 3] = a;
  }

  alphaCtx.putImageData(outImg, 0, 0);
  const erodeRadius = Math.max(2, Math.round(Math.min(w, h) * 0.0028));
  return erodeAlphaMask(alphaCanvas, erodeRadius);
}

function fallbackRemoveBackgroundByBorderColor(img, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  const samples = [];
  for (let x = 2; x < w - 2; x += Math.max(1, Math.floor(w / 40))) {
    samples.push([d[(2 * w + x) * 4], d[(2 * w + x) * 4 + 1], d[(2 * w + x) * 4 + 2]]);
  }
  for (let y = 2; y < Math.floor(h * 0.45); y += Math.max(1, Math.floor(h / 30))) {
    samples.push([d[(y * w + 2) * 4], d[(y * w + 2) * 4 + 1], d[(y * w + 2) * 4 + 2]]);
    samples.push([d[(y * w + (w - 3)) * 4], d[(y * w + (w - 3)) * 4 + 1], d[(y * w + (w - 3)) * 4 + 2]]);
  }

  const avgBg = samples.reduce(
    (acc, rgb) => [acc[0] + rgb[0], acc[1] + rgb[1], acc[2] + rgb[2]],
    [0, 0, 0]
  ).map(v => v / Math.max(1, samples.length));

  for (let i = 0; i < d.length; i += 4) {
    const dr = d[i] - avgBg[0];
    const dg = d[i + 1] - avgBg[1];
    const db = d[i + 2] - avgBg[2];
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist < 58) {
      d[i + 3] = 0;
    } else if (dist < 86) {
      d[i + 3] = Math.round(((dist - 58) / 28) * 255);
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return stripCurtainFringeFromCutout(erodeAlphaMask(c, 2));
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

// Shared AI Background Segmentation (Clean Cutout + Studio BG)
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
    if (onProgress) onProgress('Background set ho raha hai...');
    return composeBgFromCutout(cut, w, h, mode, blurPx, customColor, img);
  } catch (err) {
    // HD engine nahi chala (net / adblock / timeout) → Step 2 lightweight path neeche
  }

  // ---- Step 2: MediaPipe SelfieSegmentation (original lightweight path) ----
  return new Promise(async (resolve) => {
    let done = false;
    const finishWithCanvas = (cutoutCanvas) => {
      if (done) return;
      done = true;

      const cleanedCutout = stripCurtainFringeFromCutout(cutoutCanvas);

      if (mode === 'transparent') {
        resolve(cleanedCutout);
        return;
      }

      const bgCanvas = document.createElement('canvas');
      bgCanvas.width = w;
      bgCanvas.height = h;
      const bctx = bgCanvas.getContext('2d');

      if (mode === 'blur_bg') {
        bctx.filter = `blur(${blurPx}px)`;
        bctx.drawImage(img, 0, 0, w, h);
        bctx.filter = 'none';
      } else if (mode === 'studio_gradient') {
        const grad = bctx.createRadialGradient(w / 2, h * 0.42, w * 0.08, w / 2, h / 2, Math.max(w, h) * 0.78);
        grad.addColorStop(0, '#475569');
        grad.addColorStop(1, '#0f172a');
        bctx.fillStyle = grad;
        bctx.fillRect(0, 0, w, h);
      } else if (mode === 'solid_color') {
        bctx.fillStyle = customColor;
        bctx.fillRect(0, 0, w, h);
      } else {
        bctx.fillStyle = '#ffffff';
        bctx.fillRect(0, 0, w, h);
      }

      bctx.drawImage(cleanedCutout, 0, 0, w, h);
      resolve(bgCanvas);
    };

    const timer = setTimeout(() => {
      finishWithCanvas(fallbackRemoveBackgroundByBorderColor(img, w, h));
    }, 45000);

    try {
      if (typeof SelfieSegmentation === 'undefined') {
        clearTimeout(timer);
        finishWithCanvas(fallbackRemoveBackgroundByBorderColor(img, w, h));
        return;
      }

      const selfieSeg = new SelfieSegmentation({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
      });
      selfieSeg.setOptions({ modelSelection: 1 });

      selfieSeg.onResults((results) => {
        clearTimeout(timer);
        try {
          if (!results || !results.segmentationMask) {
            finishWithCanvas(fallbackRemoveBackgroundByBorderColor(img, w, h));
            return;
          }

          const alphaMask = buildAlphaMaskFromSegmentation(results.segmentationMask, w, h);
          const cutout = document.createElement('canvas');
          cutout.width = w;
          cutout.height = h;
          const cctx = cutout.getContext('2d');
          cctx.clearRect(0, 0, w, h);
          cctx.drawImage(results.image || img, 0, 0, w, h);
          cctx.globalCompositeOperation = 'destination-in';
          cctx.drawImage(alphaMask, 0, 0, w, h);
          cctx.globalCompositeOperation = 'source-over';

          try { selfieSeg.close(); } catch (_) {}
          finishWithCanvas(cutout);
        } catch (_) {
          try { selfieSeg.close(); } catch (_) {}
          finishWithCanvas(fallbackRemoveBackgroundByBorderColor(img, w, h));
        }
      });

      await selfieSeg.send({ image: img });
    } catch (_) {
      clearTimeout(timer);
      finishWithCanvas(fallbackRemoveBackgroundByBorderColor(img, w, h));
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
        sy -= dome * (h * 0.024) * topFade * sideFade;
        sx += (dx > 0 ? 1 : -1) * Math.pow(normX, 1.5) * (w * 0.022) * topFade * sideFade;
      }

      // Lower bikhre hair strands ko smooth andar gather karna
      if (lowerFade > 0.001) {
        const outerZone = smoothstep(0.14, 0.40, absDx / Math.max(1, w));
        sx += (dx > 0 ? 1 : -1) * outerZone * (w * 0.044) * lowerFade;
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

// ================= AUTO STUDIO PHOTO (HD LOOK + LIGHTING + HAIR GOLAI) =================
(function initAutoStudioReferenceEngine() {
  function applyHdStudioLightingAndGlow(ctx, w, h) {
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = w;
    glowCanvas.height = h;
    const gCtx = glowCanvas.getContext('2d');
    gCtx.drawImage(ctx.canvas, 0, 0);
    gCtx.filter = `blur(${Math.max(8, Math.round(Math.min(w, h) * 0.016))}px)`;
    gCtx.drawImage(ctx.canvas, 0, 0);
    gCtx.filter = 'none';

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.18;
    ctx.drawImage(glowCanvas, 0, 0);
    ctx.restore();
  }

  function applyReferenceStudioGrade(srcCanvas, outW, outH, enhanceLightSharp = true, tidyHair = true) {
    const shapedSubject = tidyHair && typeof window.shapeHairGolaiAndLowerStrands === 'function'
      ? window.shapeHairGolaiAndLowerStrands(srcCanvas)
      : srcCanvas;

    const c = document.createElement('canvas');
    c.width = outW;
    c.height = outH;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outW, outH);

    const scale = Math.min(outW / shapedSubject.width, outH / shapedSubject.height);
    const dw = Math.round(shapedSubject.width * scale);
    const dh = Math.round(shapedSubject.height * scale);
    const dx = Math.round((outW - dw) / 2);
    const dy = Math.round((outH - dh) / 2);

    if (enhanceLightSharp) {
      ctx.filter = 'brightness(1.10) contrast(1.18) saturate(1.15)';
    }
    ctx.drawImage(shapedSubject, dx, dy, dw, dh);
    ctx.filter = 'none';

    const imgData = ctx.getImageData(0, 0, outW, outH);
    const d = imgData.data;
    const copy = new Uint8ClampedArray(d);
    const sharpAmt = enhanceLightSharp ? 0.46 : 0.15;

    for (let y = 1; y < outH - 1; y++) {
      for (let x = 1; x < outW - 1; x++) {
        const idx = (y * outW + x) * 4;
        const r0 = copy[idx], g0 = copy[idx + 1], b0 = copy[idx + 2];

        if (r0 > 240 && g0 > 240 && b0 > 240) {
          d[idx] = 255;
          d[idx + 1] = 255;
          d[idx + 2] = 255;
          continue;
        }

        const isSkin = r0 > 85 && g0 > 50 && b0 > 30 && r0 > g0 && g0 > b0;
        const skinGlow = isSkin ? 8 : 0;

        for (let ch = 0; ch < 3; ch++) {
          const center = copy[idx + ch] * 5;
          const neighbors =
            copy[((y - 1) * outW + x) * 4 + ch] +
            copy[((y + 1) * outW + x) * 4 + ch] +
            copy[(y * outW + (x - 1)) * 4 + ch] +
            copy[(y * outW + (x + 1)) * 4 + ch];
          const sharpVal = copy[idx + ch] * (1 - sharpAmt) + (center - neighbors) * sharpAmt;
          const chBoost = ch === 0 ? skinGlow : ch === 1 ? Math.round(skinGlow * 0.75) : Math.round(skinGlow * 0.25);
          d[idx + ch] = Math.min(255, Math.max(0, Math.round(sharpVal + chBoost)));
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    if (enhanceLightSharp) {
      applyHdStudioLightingAndGlow(ctx, outW, outH);
      const finalData = ctx.getImageData(0, 0, outW, outH);
      const fd = finalData.data;
      for (let i = 0; i < fd.length; i += 4) {
        if (fd[i] > 244 && fd[i + 1] > 244 && fd[i + 2] > 244) {
          fd[i] = 255; fd[i + 1] = 255; fd[i + 2] = 255;
        }
      }
      ctx.putImageData(finalData, 0, 0);
    }

    return c;
  }

  function getStudioTargetDimensions(img, frameText, qualityText) {
    let baseW = img.naturalWidth || img.width || 1232;
    let baseH = img.naturalHeight || img.height || 1277;

    if (/1232\s*[×x]\s*1277/i.test(frameText) || /reference/i.test(frameText)) {
      baseW = 1232;
      baseH = 1277;
    } else if (/1200\s*[×x]\s*1200/i.test(frameText) || /square/i.test(frameText)) {
      baseW = 1200;
      baseH = 1200;
    } else if (/1050\s*[×x]\s*1350/i.test(frameText) || /portrait/i.test(frameText)) {
      baseW = 1050;
      baseH = 1350;
    }

    let mult = 2;
    if (/3[×x]/i.test(qualityText)) mult = 3;
    else if (/1[×x]/i.test(qualityText)) mult = 1;
    else if (/2[×x]/i.test(qualityText)) mult = 2;

    return { width: baseW * mult, height: baseH * mult };
  }

  async function buildReferenceStudioOutput(file, frameText, qualityText, useWhiteBg, enhanceLightSharp, tidyHair = true) {
    const img = await loadImg(URL.createObjectURL(file));
    let subjectCanvas;

    if (useWhiteBg && typeof runSelfieSegmentation === 'function') {
      subjectCanvas = await runSelfieSegmentation(img, 'transparent');
    } else {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || img.width;
      c.height = img.naturalHeight || img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      subjectCanvas = useWhiteBg ? fallbackRemoveBackgroundByBorderColor(img, c.width, c.height) : c;
    }

    const dims = getStudioTargetDimensions(img, frameText, qualityText);
    return applyReferenceStudioGrade(subjectCanvas, dims.width, dims.height, enhanceLightSharp, tidyHair);
  }


  // Expose the functions used by js/studio-photo.js. The page owns all UI events.
  window.buildReferenceStudioOutput = buildReferenceStudioOutput;
  window.applyReferenceStudioGrade = applyReferenceStudioGrade;
})();


// ================= SIDE & CROWN EDGE CLEANER TOOL =================
// Linear-time edge-distance pass; avoids the quadratic neighbourhood scan
// from the supplied draft and only blends likely curtain-coloured fringe pixels.
function cleanSideAndCrownEdges(sourceCanvas, options = {}) {
  if (!sourceCanvas || !sourceCanvas.width || !sourceCanvas.height) return sourceCanvas;
  const w = sourceCanvas.width, h = sourceCanvas.height, total = w * h;
  const trimPx = Math.max(3, Math.min(10, Math.round(options.trimPx || Math.min(w, h) * 0.0045)));
  const work = document.createElement('canvas');
  work.width = w; work.height = h;
  const ctx = work.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(sourceCanvas, 0, 0);
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  const dist = new Uint8Array(total);
  const limit = trimPx + 1;

  // White-background pixels are distance-map seeds.
  for (let p = 0, i = 0; p < total; p++, i += 4) {
    dist[p] = (d[i] > 245 && d[i + 1] > 245 && d[i + 2] > 245) ? 0 : limit;
  }

  // Forward chamfer pass.
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const p = row + x;
      let best = dist[p];
      if (x > 0) best = Math.min(best, dist[p - 1] + 1);
      if (y > 0) {
        best = Math.min(best, dist[p - w] + 1);
        if (x > 0) best = Math.min(best, dist[p - w - 1] + 1);
        if (x + 1 < w) best = Math.min(best, dist[p - w + 1] + 1);
      }
      dist[p] = Math.min(limit, best);
    }
  }

  // Backward chamfer pass.
  for (let y = h - 1; y >= 0; y--) {
    const row = y * w;
    for (let x = w - 1; x >= 0; x--) {
      const p = row + x;
      let best = dist[p];
      if (x + 1 < w) best = Math.min(best, dist[p + 1] + 1);
      if (y + 1 < h) {
        best = Math.min(best, dist[p + w] + 1);
        if (x > 0) best = Math.min(best, dist[p + w - 1] + 1);
        if (x + 1 < w) best = Math.min(best, dist[p + w + 1] + 1);
      }
      dist[p] = Math.min(limit, best);
    }
  }

  // Suppress only likely curtain fringe in the narrow outer contour.
  // Dark hair, skin and clothing are deliberately left untouched.
  for (let p = 0, i = 0; p < total; p++, i += 4) {
    const edgeDist = dist[p];
    if (edgeDist === 0 || edgeDist > trimPx) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
    const brightness = (r + g + b) / 3;
    const warmCurtain = r > g && g >= b && (r - b) >= 8 && (r - b) <= 78;
    const greyCurtain = (maxC - minC) <= 24;
    const midTone = brightness >= 92 && brightness <= 238;
    if (!midTone || !(warmCurtain || greyCurtain)) continue;

    const proximity = 1 - (edgeDist - 1) / Math.max(1, trimPx);
    const blend = Math.max(0.18, Math.min(0.72, 0.22 + proximity * 0.5));
    d[i] = Math.round(r * (1 - blend) + 255 * blend);
    d[i + 1] = Math.round(g * (1 - blend) + 255 * blend);
    d[i + 2] = Math.round(b * (1 - blend) + 255 * blend);
    d[i + 3] = 255;
  }

  ctx.putImageData(image, 0, 0);
  return work;
}
window.cleanSideAndCrownEdges = cleanSideAndCrownEdges;
