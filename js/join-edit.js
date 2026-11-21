// ================= 7. JOIN, CHANGE PHOTO, DIGITAL STUDIO + HAIR SET + ZOOM AREA + BG REMOVER + 50 FRAMES =================
const sigCanvas = document.getElementById('sigCanvas');
const sigCtx = sigCanvas.getContext('2d');
let drawingSig = false;
sigCanvas.onmousedown = e => { drawingSig = true; sigCtx.beginPath(); sigCtx.moveTo(e.offsetX, e.offsetY); };
sigCanvas.onmousemove = e => { if (!drawingSig) return; sigCtx.lineWidth = 2.5; sigCtx.strokeStyle = '#0f172a'; sigCtx.lineTo(e.offsetX, e.offsetY); sigCtx.stroke(); };
window.addEventListener('mouseup', () => drawingSig = false);
document.getElementById('clearSigBtn').onclick = () => sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);

let cachedMainImg = null;
let cachedLogoImg = null;
let cachedTransparentCutout = null;
let cachedCutoutKey = '';
let cachedAutoHairFitImage = null;
let isRunningAutoHairFit = false;
let cachedHairstyleSource = null;
let cachedHairstyleMode = 'none';
let cachedHairstyleResult = null;

// Selected Area Zoom state (normalized 0..1)
let zoomSelectionNorm = null;
let isSelectingZoom = false;
let zoomDragStart = null;

// Hair Set Brush Strokes (stored normalized 0..1 relative to active view)
let hairStrokes = [];
let isBrushingHair = false;
let currentHairStroke = null;
let lastHairPos = null;

function invalidateHairAndBgCache() {
  cachedAutoHairFitImage = null;
  cachedTransparentCutout = null;
  cachedCutoutKey = '';
  cachedHairstyleSource = null;
  cachedHairstyleMode = 'none';
  cachedHairstyleResult = null;
}

function getSafeCanvasPos(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
  const scaleX = canvas.width / Math.max(1, rect.width);
  const scaleY = canvas.height / Math.max(1, rect.height);
  return {
    x: Math.max(0, Math.min(canvas.width, (clientX - rect.left) * scaleX)),
    y: Math.max(0, Math.min(canvas.height, (clientY - rect.top) * scaleY))
  };
}

function getSelectedBrushShape() {
  const shapeEl = document.getElementById('hairBrushShape');
  return (shapeEl && shapeEl.value) ? shapeEl.value : 'freehand';
}

function getSelectedBrushEffect() {
  const modeVal = document.getElementById('hairBrushMode')?.value || 'tuck_smooth';
  if (modeVal.includes('darken')) return 'darken';
  if (modeVal.includes('erase') || modeVal.includes('trim')) return 'trim';
  return 'tuck';
}

/*
 * Auto Hair Fit: cleans flyaway hair strands along head/hair contour
 * using SelfieSegmentation + edge/alpha refinement so stray hair pixels
 * are cleanly tucked/trimmed without erasing main hair volume.
 */
let autoHairFitMessage = '';

function setAutoHairFitStatus(message, isError = false) {
  autoHairFitMessage = message;
  const el = document.getElementById('psAutoHairFitStatus');
  if (el) {
    el.textContent = message;
    el.style.color = isError ? '#b91c1c' : '#0f766e';
    el.classList.remove('hidden');
  }
}

async function runAutoHairFit(img) {
  if (typeof SelfieSegmentation === 'undefined') {
    throw new Error('AI hair cleanup model did not load. Check your internet connection and refresh the page.');
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let segmenter = null;
    const finish = (error, canvas) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      try { segmenter?.close(); } catch (_) {}
      if (error) reject(error);
      else resolve(canvas);
    };
    const timeoutId = setTimeout(() => {
      finish(new Error('AI hair cleanup timed out. Please retry with a smaller photo.'));
    }, 30000);

    try {
      segmenter = new SelfieSegmentation({
        locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
      });
      segmenter.setOptions({ modelSelection: 1 });
      segmenter.onResults(results => {
        try {
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          if (!results?.segmentationMask || !w || !h) {
            throw new Error('AI did not return a usable person mask.');
          }

          const maskCanvas = document.createElement('canvas');
          maskCanvas.width = w;
          maskCanvas.height = h;
          const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
          maskCtx.drawImage(results.segmentationMask, 0, 0, w, h);
          const mask = maskCtx.getImageData(0, 0, w, h).data;

          const output = document.createElement('canvas');
          output.width = w;
          output.height = h;
          const outCtx = output.getContext('2d', { willReadFrequently: true });
          outCtx.drawImage(img, 0, 0, w, h);
          const frame = outCtx.getImageData(0, 0, w, h);
          const pixels = frame.data;

          const left = Math.floor(w * 0.08);
          const right = Math.ceil(w * 0.92);
          const topLimit = Math.floor(h * 0.65);
          const rawTop = new Int32Array(w);
          rawTop.fill(-1);

          // Detect outer hair / head boundary where segmentation confidence starts
          for (let x = left; x < right; x++) {
            for (let y = 0; y < topLimit; y++) {
              if (mask[(y * w + x) * 4] >= 48) {
                rawTop[x] = y;
                break;
              }
            }
          }

          // Median-filter contour to get smooth main hair silhouette
          const radius = Math.max(6, Math.min(36, Math.round(w * 0.02)));
          const fittedTop = new Int32Array(w);
          fittedTop.fill(-1);
          for (let x = left; x < right; x++) {
            if (rawTop[x] < 0) continue;
            const values = [];
            for (let xx = Math.max(left, x - radius); xx <= Math.min(right - 1, x + radius); xx++) {
              if (rawTop[xx] >= 0) values.push(rawTop[xx]);
            }
            if (values.length >= Math.max(4, Math.round(radius * 0.6))) {
              values.sort((a, b) => a - b);
              fittedTop[x] = values[Math.floor(values.length / 2)];
            }
          }

          let changedPixels = 0;
          const minLift = 1;
          const maxLift = Math.max(8, Math.round(h * 0.045));

          for (let x = left; x < right; x++) {
            const actualY = rawTop[x];
            const smoothY = fittedTop[x];
            if (actualY < 0 || smoothY < 0) continue;
            const lift = smoothY - actualY;
            if (lift < minLift || lift > maxLift) continue;

            // Sample slightly below fittedTop so stray hair blends into solid hair/background cleanly
            const anchorY = Math.min(h - 1, smoothY + Math.max(2, Math.round(h * 0.005)));
            const anchorIdx = (anchorY * w + x) * 4;
            const targetR = pixels[anchorIdx];
            const targetG = pixels[anchorIdx + 1];
            const targetB = pixels[anchorIdx + 2];

            for (let y = actualY; y <= smoothY + 2; y++) {
              if (y < 0 || y >= h) continue;
              const idx = (y * w + x) * 4;
              const maskVal = mask[idx];
              if (maskVal < 12) continue;

              const distFromTop = (y - actualY) / Math.max(1, lift + 2);
              const strength = Math.min(0.95, Math.max(0.45, (1 - maskVal / 255) * 0.7 + (1 - distFromTop) * 0.45));

              pixels[idx] = Math.round(pixels[idx] * (1 - strength) + targetR * strength);
              pixels[idx + 1] = Math.round(pixels[idx + 1] * (1 - strength) + targetG * strength);
              pixels[idx + 2] = Math.round(pixels[idx + 2] * (1 - strength) + targetB * strength);

              // Also tighten low-confidence outer fringe pixels
              if (maskVal < 110 && pixels[idx + 3] > 0) {
                pixels[idx + 3] = Math.round(pixels[idx + 3] * Math.max(0.15, maskVal / 140));
              }
              changedPixels++;
            }
          }

          if (changedPixels === 0) {
            output.autoHairFitChangedPixels = 0;
            setAutoHairFitStatus('AI scan complete: no stray flyaway pixels needed trimming.');
          } else {
            outCtx.putImageData(frame, 0, 0);
            output.autoHairFitChangedPixels = changedPixels;
            setAutoHairFitStatus(`Auto Hair Fit applied: cleaned ${changedPixels.toLocaleString()} edge pixels.`);
          }
          finish(null, output);
        } catch (error) {
          finish(error);
        }
      });
      segmenter.send({ image: img }).catch(error => finish(error));
    } catch (error) {
      finish(error);
    }
  });
}


// ================= HAIRSTYLE REDESIGN (LOCAL GEOMETRIC HAIR SHAPING) =================
let hairstyleRedesignMode = 'none';

function getSelectedHairstyleMode() {
  const el = document.getElementById('hairstyleRedesignSelect');
  hairstyleRedesignMode = (el && el.value) ? el.value : 'none';
  return hairstyleRedesignMode;
}

async function applyHairstyleRedesign(img, styleMode = 'rounded_golai') {
  if (!img || styleMode === 'none') return img;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return img;

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = w; srcCanvas.height = h;
  const sCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
  sCtx.drawImage(img, 0, 0, w, h);
  const srcData = sCtx.getImageData(0, 0, w, h).data;

  let maskData = null;
  if (typeof SelfieSegmentation !== 'undefined') {
    let segmenter = null;
    try {
      const maskResult = await new Promise(resolve => {
        let done = false;
        const finish = value => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          try { segmenter?.close(); } catch (_) {}
          resolve(value);
        };
        const timer = setTimeout(() => finish(null), 8000);
        try {
          segmenter = new SelfieSegmentation({
            locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
          });
          segmenter.setOptions({ modelSelection: 1 });
          segmenter.onResults(results => {
            try {
              if (!results?.segmentationMask) return finish(null);
              const mc = document.createElement('canvas');
              mc.width = w; mc.height = h;
              const mctx = mc.getContext('2d', { willReadFrequently: true });
              mctx.drawImage(results.segmentationMask, 0, 0, w, h);
              finish(mctx.getImageData(0, 0, w, h).data);
            } catch (_) { finish(null); }
          });
          Promise.resolve(segmenter.send({ image: img })).catch(() => finish(null));
        } catch (_) { finish(null); }
      });
      maskData = maskResult;
    } catch (_) {
      maskData = null;
    } finally {
      try { segmenter?.close(); } catch (_) {}
    }
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w; outCanvas.height = h;
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
    const i00 = (y0 * w + x0) * 4, i10 = (y0 * w + x1) * 4;
    const i01 = (y1 * w + x0) * 4, i11 = (y1 * w + x1) * 4;
    for (let ch = 0; ch < 4; ch++) {
      const top = srcData[i00 + ch] * (1 - wx) + srcData[i10 + ch] * wx;
      const bot = srcData[i01 + ch] * (1 - wx) + srcData[i11 + ch] * wx;
      outPx[ch] = Math.round(top * (1 - wy) + bot * wy);
    }
  };

  const px = [0, 0, 0, 255];
  for (let y = 0; y < h; y++) {
    const ny = y / Math.max(1, h);
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const dx = x - cx;
      const absDx = Math.abs(dx);
      const normX = Math.min(1, absDx / Math.max(1, maxHeadHalfW));
      const maskValue = maskData ? maskData[idx] : 200;
      const upperSide = ny >= 0.03 && ny <= 0.54 && absDx <= maxHeadHalfW * 1.25;
      const lowerEnds = ny >= 0.42 && ny <= 0.85 && absDx >= w * 0.14 && absDx <= w * 0.48;
      const hairWeight = (upperSide || lowerEnds)
        ? Math.min(1, Math.max(0.25, maskValue / 180)) : 0;
      let sx = x, sy = y;

      if (hairWeight > 0) {
        if (styleMode === 'rounded_golai') {
          if (upperSide) {
            sx = x + (normX * normX) * (w * 0.022) * (dx > 0 ? 1 : -1) * hairWeight;
            sy = y - (1 - normX * normX) * (h * 0.022) * hairWeight;
          }
          if (lowerEnds) {
            sx = x + Math.sin(((ny - 0.42) / 0.43) * Math.PI) * (w * 0.045) * (dx > 0 ? 1 : -1) * hairWeight;
          }
        } else if (styleMode === 'neat_tuck') {
          sx = x + (w * 0.025) * (dx > 0 ? 1 : -1) * hairWeight
            + (lowerEnds ? (w * 0.035) * (dx > 0 ? 1 : -1) * hairWeight : 0);
        } else if (styleMode === 'lower_gather' && lowerEnds) {
          sx = x + Math.sin(((ny - 0.42) / 0.43) * Math.PI) * (w * 0.06) * (dx > 0 ? 1 : -1) * hairWeight;
        } else if (styleMode === 'soft_volume' && upperSide) {
          sx = x + (normX * (1 - normX * 0.5)) * (w * 0.015) * (dx > 0 ? 1 : -1) * hairWeight;
          sy = y - (1 - normX * normX) * (h * 0.03) * hairWeight;
        }
      }
      sampleBilinear(sx, sy, px);
      dst[idx] = px[0]; dst[idx + 1] = px[1];
      dst[idx + 2] = px[2]; dst[idx + 3] = px[3];
    }
  }
  oCtx.putImageData(outImg, 0, 0);
  return outCanvas;
}

async function getPreparedHairstyleSource(source) {
  const mode = getSelectedHairstyleMode();
  if (mode === 'none') return source;
  if (cachedHairstyleSource === source && cachedHairstyleMode === mode && cachedHairstyleResult) {
    return cachedHairstyleResult;
  }
  cachedHairstyleSource = source;
  cachedHairstyleMode = mode;
  cachedHairstyleResult = await applyHairstyleRedesign(source, mode);
  return cachedHairstyleResult;
}

async function getPreparedHairSource(baseImg) {
  const autoHairFit = Boolean(document.getElementById('psAutoHairFitToggle')?.checked);
  if (!autoHairFit) return baseImg;

  if (cachedAutoHairFitImage) return cachedAutoHairFitImage;
  if (isRunningAutoHairFit) return baseImg;

  isRunningAutoHairFit = true;
  const st = document.getElementById('editStatus');
  try {
    if (st) {
      st.textContent = 'AI Auto Hair Fit: Scanning and cleaning flyaway hair edges...';
      st.classList.remove('hidden');
    }
    cachedAutoHairFitImage = await runAutoHairFit(baseImg);
    cachedTransparentCutout = null;
    cachedCutoutKey = '';
    return cachedAutoHairFitImage;
  } catch (error) {
    setAutoHairFitStatus(error.message || 'AI hair cleanup failed.', true);
    cachedAutoHairFitImage = null;
    return baseImg;
  } finally {
    isRunningAutoHairFit = false;
    if (st) st.classList.add('hidden');
  }
}

async function getPreparedCutoutSource(subjectSource, useAutoHairFit) {
  const key = `${useAutoHairFit ? 'hairfit' : 'raw'}_${getSelectedHairstyleMode()}_${subjectSource.width || subjectSource.naturalWidth}x${subjectSource.height || subjectSource.naturalHeight}`;
  if (cachedTransparentCutout && cachedCutoutKey === key) {
    return cachedTransparentCutout;
  }
  const st = document.getElementById('editStatus');
  if (st) {
    st.textContent = 'AI Removing Background for Live Preview...';
    st.classList.remove('hidden');
  }
  try {
    cachedTransparentCutout = await runSelfieSegmentation(subjectSource, 'transparent');
    cachedCutoutKey = key;
    return cachedTransparentCutout;
  } finally {
    if (st) st.classList.add('hidden');
  }
}

// ONLY zoom when "Zoom Photo for Hair Brush" checkbox is explicitly checked
function getEffectiveZoomRect() {
  const zoomEnabled = Boolean(document.getElementById('psZoomSelectMode')?.checked);
  if (!zoomEnabled) {
    return null;
  }

  const zoomScale = Math.max(1, Math.min(5, parseFloat(document.getElementById('psZoomScaleNum')?.value) || 2));
  if (zoomSelectionNorm && zoomSelectionNorm.w >= 0.02 && zoomSelectionNorm.h >= 0.02) {
    return zoomSelectionNorm;
  }
  if (zoomScale <= 1.02) {
    return null;
  }

  const vw = Math.min(1, 1 / zoomScale);
  const vh = Math.min(1, 1 / zoomScale);
  const cx = 0.5;
  const cy = 0.28;

  const x = Math.max(0, Math.min(1 - vw, cx - vw / 2));
  const y = Math.max(0, Math.min(1 - vh, cy - vh / 2));
  return { x, y, w: vw, h: vh };
}

function getActiveWorkingSource(baseSource) {
  const rectNorm = getEffectiveZoomRect();
  if (!rectNorm) return baseSource;

  const sw = baseSource.width || baseSource.videoWidth;
  const sh = baseSource.height || baseSource.videoHeight;
  if (!sw || !sh) return baseSource;

  const sx = Math.max(0, Math.min(sw - 1, Math.round(rectNorm.x * sw)));
  const sy = Math.max(0, Math.min(sh - 1, Math.round(rectNorm.y * sh)));
  const cw = Math.max(10, Math.min(sw - sx, Math.round(rectNorm.w * sw)));
  const ch = Math.max(10, Math.min(sh - sy, Math.round(rectNorm.h * sh)));

  const zoomScale = Math.max(1, parseFloat(document.getElementById('psZoomScaleNum')?.value) || 2);
  const outW = Math.min(3600, Math.max(160, Math.round(cw * Math.max(1, zoomScale * 0.85))));
  const outH = Math.min(3600, Math.max(160, Math.round(ch * Math.max(1, zoomScale * 0.85))));

  const cropC = document.createElement('canvas');
  cropC.width = outW;
  cropC.height = outH;
  const cctx = cropC.getContext('2d');
  cctx.imageSmoothingEnabled = true;
  cctx.imageSmoothingQuality = 'high';
  cctx.drawImage(baseSource, sx, sy, cw, ch, 0, 0, outW, outH);

  if (document.getElementById('psZoomSharpToggle')?.checked && outW * outH < 2500000) {
    const imgData = cctx.getImageData(0, 0, outW, outH);
    const d = imgData.data;
    const copy = new Uint8ClampedArray(d);
    const amt = 0.25;
    for (let y = 1; y < outH - 1; y++) {
      for (let x = 1; x < outW - 1; x++) {
        const idx = (y * outW + x) * 4;
        if (copy[idx + 3] < 10) continue;
        for (let chIdx = 0; chIdx < 3; chIdx++) {
          const center = copy[idx + chIdx] * 5;
          const neighbors = copy[((y - 1) * outW + x) * 4 + chIdx]
                          + copy[((y + 1) * outW + x) * 4 + chIdx]
                          + copy[(y * outW + (x - 1)) * 4 + chIdx]
                          + copy[(y * outW + (x + 1)) * 4 + chIdx];
          d[idx + chIdx] = Math.min(255, Math.max(0, Math.round(copy[idx + chIdx] * (1 - amt) + (center - neighbors) * amt)));
        }
      }
    }
    cctx.putImageData(imgData, 0, 0);
  }
  return cropC;
}

function getBgFillStyle(ctx, w, h) {
  const bgStyle = document.getElementById('psBgStyleSelect')?.value || 'transparent';
  if (bgStyle === 'transparent') return null;
  if (bgStyle === 'studio_gradient') {
    const g = ctx.createRadialGradient(w / 2, h * 0.4, w * 0.05, w / 2, h / 2, Math.max(w, h) * 0.8);
    g.addColorStop(0, '#475569');
    g.addColorStop(1, '#0f172a');
    return g;
  }
  if (bgStyle === 'passport_blue') return '#3b82f6';
  if (bgStyle === 'studio_slate') return '#334155';
  if (bgStyle === 'pure_white') return '#ffffff';
  return document.getElementById('psBgCustomColor')?.value || '#2563eb';
}

function applyEffectToRegion(ctx, copy, w, h, x0, y0, bw, bh, effect, testHitFn) {
  const imgData = ctx.createImageData(bw, bh);
  const d = imgData.data;
  const hasBg = Boolean(document.getElementById('psRemoveBgToggle')?.checked && document.getElementById('psBgStyleSelect')?.value !== 'transparent');

  for (let py = 0; py < bh; py++) {
    for (let px = 0; px < bw; px++) {
      const srcIdx = ((y0 + py) * w + (x0 + px)) * 4;
      const dstIdx = (py * bw + px) * 4;
      d[dstIdx] = copy[srcIdx];
      d[dstIdx + 1] = copy[srcIdx + 1];
      d[dstIdx + 2] = copy[srcIdx + 2];
      d[dstIdx + 3] = copy[srcIdx + 3];
    }
  }

  for (let py = 0; py < bh; py++) {
    for (let px = 0; px < bw; px++) {
      const gx = x0 + px;
      const gy = y0 + py;
      const strength = testHitFn(gx, gy);
      if (strength <= 0) continue;

      const idx = (py * bw + px) * 4;
      const baseIdx = (gy * w + gx) * 4;

      if (effect === 'trim') {
        if (hasBg) {
          const blend = Math.min(1, strength * 0.92);
          d[idx] = Math.round(copy[baseIdx] * (1 - blend) + 38 * blend);
          d[idx + 1] = Math.round(copy[baseIdx + 1] * (1 - blend) + 52 * blend);
          d[idx + 2] = Math.round(copy[baseIdx + 2] * (1 - blend) + 74 * blend);
          d[idx + 3] = Math.max(0, Math.round(copy[baseIdx + 3] * (1 - strength * 0.85)));
        } else if (copy[baseIdx + 3] > 0) {
          d[idx + 3] = Math.max(0, Math.round(copy[baseIdx + 3] * (1 - strength * 0.95)));
        }
      } else if (effect === 'darken') {
        const lum = 0.299 * copy[baseIdx] + 0.587 * copy[baseIdx + 1] + 0.114 * copy[baseIdx + 2];
        if (lum < 235) {
          const factor = 1 - strength * 0.52;
          d[idx] = Math.max(6, Math.round(copy[baseIdx] * factor));
          d[idx + 1] = Math.max(6, Math.round(copy[baseIdx + 1] * factor));
          d[idx + 2] = Math.max(6, Math.round(copy[baseIdx + 2] * factor));
        }
      } else {
        const lx = Math.max(0, gx - 2);
        const rx = Math.min(w - 1, gx + 2);
        const ty = Math.max(0, gy - 2);
        const by = Math.min(h - 1, gy + 2);
        const sy = Math.min(h - 1, gy + Math.max(2, Math.round(strength * 3)));

        const blend = Math.min(1, strength * 0.92);
        for (let ch = 0; ch < 3; ch++) {
          const avg = (
            copy[(ty * w + gx) * 4 + ch] +
            copy[(by * w + gx) * 4 + ch] +
            copy[(gy * w + lx) * 4 + ch] +
            copy[(gy * w + rx) * 4 + ch] +
            copy[(sy * w + gx) * 4 + ch] * 3
          ) / 7;
          d[idx + ch] = Math.round(copy[baseIdx + ch] * (1 - blend) + avg * blend);
        }
      }
    }
  }
  ctx.putImageData(imgData, x0, y0);
}

function applyHairSetBrushStrokes(targetCanvas) {
  if (!hairStrokes.length) return targetCanvas;
  const w = targetCanvas.width, h = targetCanvas.height;
  const ctx = targetCanvas.getContext('2d');
  const copy = ctx.getImageData(0, 0, w, h).data;

  for (const stroke of hairStrokes) {
    const points = stroke.points || [];
    if (!points.length) continue;
    const shape = stroke.shape || 'freehand';
    const effect = stroke.effect || 'tuck';
    const rad = Math.max(2, Math.round((stroke.radiusNorm || 0.005) * Math.min(w, h)));
    const densePoints = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const distPx = Math.hypot((b.x - a.x) * w, (b.y - a.y) * h);
      const steps = Math.max(1, Math.ceil(distPx / Math.max(1, rad * 0.3)));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        densePoints.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }

    for (const pt of densePoints) {
      const cx = Math.round(pt.x * w), cy = Math.round(pt.y * h);
      const x0 = Math.max(0, cx - rad), y0 = Math.max(0, cy - rad);
      const x1 = Math.min(w, cx + rad + 1), y1 = Math.min(h, cy + rad + 1);
      const bw = x1 - x0, bh = y1 - y0;
      if (bw < 1 || bh < 1) continue;
      applyEffectToRegion(ctx, copy, w, h, x0, y0, bw, bh, effect, (gx, gy) => {
        const dx = Math.abs(gx - cx), dy = Math.abs(gy - cy);
        const dist = shape === 'rect' ? Math.max(dx, dy) : Math.hypot(dx, dy);
        if (dist > rad) return 0;
        return Math.max(0.12, Math.pow(1 - dist / (rad * 1.05), 0.9));
      });
    }
  }
  return targetCanvas;
}

const liveEditCanvas = document.getElementById('liveEditCanvas');
liveEditCanvas.onmousedown = (e) => {
  const tool = document.getElementById('editToolSelect').value;
  if (!cachedMainImg || tool !== 'ps_auto_retouch') return;

  const pos = getSafeCanvasPos(liveEditCanvas, e);
  const nx = Math.max(0, Math.min(1, pos.x / Math.max(1, liveEditCanvas.width)));
  const ny = Math.max(0, Math.min(1, pos.y / Math.max(1, liveEditCanvas.height)));

  if ((e.shiftKey || e.altKey) && document.getElementById('psZoomSelectMode')?.checked) {
    zoomDragStart = { x: nx, y: ny };
    isSelectingZoom = true;
    zoomSelectionNorm = { x: nx, y: ny, w: 0.04, h: 0.04 };
    renderLiveEditPreview();
    return;
  }

  if (document.getElementById('hairBrushToggle')) {
    document.getElementById('hairBrushToggle').checked = true;
  }
  isBrushingHair = true;
  const brushPx = parseFloat(document.getElementById('hairBrushSize')?.value) || 24;
  const canvasRect = liveEditCanvas.getBoundingClientRect();
  const scaleX = liveEditCanvas.width / Math.max(1, canvasRect.width);
  const scaleY = liveEditCanvas.height / Math.max(1, canvasRect.height);
  const radiusCanvas = (brushPx / 2) * Math.max(scaleX, scaleY);
  currentHairStroke = {
    shape: getSelectedBrushShape(),
    effect: getSelectedBrushEffect(),
    brushSizePx: brushPx,
    radiusNorm: radiusCanvas / Math.max(1, Math.min(liveEditCanvas.width, liveEditCanvas.height)),
    points: [{ x: nx, y: ny }]
  };
  hairStrokes.push(currentHairStroke);
  lastHairPos = pos;
  renderLiveEditPreview();
};

liveEditCanvas.onmousemove = (e) => {
  const pos = getSafeCanvasPos(liveEditCanvas, e);
  const nx = Math.max(0, Math.min(1, pos.x / Math.max(1, liveEditCanvas.width)));
  const ny = Math.max(0, Math.min(1, pos.y / Math.max(1, liveEditCanvas.height)));

  if (isSelectingZoom && zoomDragStart) {
    zoomSelectionNorm = {
      x: Math.min(zoomDragStart.x, nx),
      y: Math.min(zoomDragStart.y, ny),
      w: Math.max(0.04, Math.abs(nx - zoomDragStart.x)),
      h: Math.max(0.04, Math.abs(ny - zoomDragStart.y))
    };
    renderLiveEditPreview();
    return;
  }

  if (isBrushingHair && currentHairStroke) {
    if (lastHairPos && Math.hypot(pos.x - lastHairPos.x, pos.y - lastHairPos.y) < 1.5) return;
    currentHairStroke.points.push({ x: nx, y: ny });
    lastHairPos = pos;
    renderLiveEditPreview();
  }
};

window.addEventListener('mouseup', () => {
  isBrushingHair = false;
  currentHairStroke = null;
  lastHairPos = null;
  isSelectingZoom = false;
  zoomDragStart = null;
});

document.querySelectorAll('.quick-bg-btn').forEach(btn => {
  btn.onclick = () => {
    setQuickStudioBg(btn.dataset.bgStyle, btn.dataset.bgColor);
  };
});

document.getElementById('psZoomSelectMode').onchange = () => {
  if (!document.getElementById('psZoomSelectMode').checked) {
    zoomSelectionNorm = null;
  } else if (document.getElementById('hairBrushToggle')) {
    document.getElementById('hairBrushToggle').checked = true;
  }
  updatePsBgControls();
  renderLiveEditPreview();
};

document.getElementById('psZoomResetBoxBtn').onclick = () => {
  zoomSelectionNorm = null;
  if (document.getElementById('psZoomSelectMode')) document.getElementById('psZoomSelectMode').checked = false;
  if (document.getElementById('psZoomScaleRange')) document.getElementById('psZoomScaleRange').value = 1;
  if (document.getElementById('psZoomScaleNum')) document.getElementById('psZoomScaleNum').value = 1;
  updatePsBgControls();
  renderLiveEditPreview();
};

document.getElementById('hairUndoBtn').onclick = () => {
  if (hairStrokes.length) {
    hairStrokes.pop();
    renderLiveEditPreview();
  }
};
document.getElementById('hairResetBtn').onclick = () => {
  hairStrokes = [];
  renderLiveEditPreview();
};

document.getElementById('hairBrushToggle').onchange = () => {
  const active = document.getElementById('hairBrushToggle').checked;
  if (!active) isBrushingHair = false;
  liveEditCanvas.style.cursor = active ? 'cell' : 'default';
  updatePsBgControls();
  renderLiveEditPreview();
};

document.getElementById('hairBrushMode').onchange = () => {
  if (hairStrokes.length) {
    hairStrokes[hairStrokes.length - 1].effect = getSelectedBrushEffect();
    renderLiveEditPreview();
  }
};

if (document.getElementById('hairBrushShape')) {
  document.getElementById('hairBrushShape').onchange = () => {
    if (hairStrokes.length) {
      hairStrokes[hairStrokes.length - 1].shape = getSelectedBrushShape();
      renderLiveEditPreview();
    }
  };
}

if (document.getElementById('hairBrushSize')) {
  document.getElementById('hairBrushSize').oninput = () => {
    const val = document.getElementById('hairBrushSize').value;
    const lbl = document.getElementById('hairBrushSizeVal');
    if (lbl) lbl.textContent = `${val}px`;
  };
}

function setQuickStudioBg(style, hexCol) {
  document.getElementById('psRemoveBgToggle').checked = true;
  document.getElementById('psBgStyleSelect').value = style;
  if (hexCol) document.getElementById('psBgCustomColor').value = hexCol;
  updatePsBgControls();
  renderLiveEditPreview();
}

function updatePsBgControls() {
  const enabled = document.getElementById('psRemoveBgToggle').checked;
  const hairActive = document.getElementById('hairBrushToggle').checked;
  const zoomActive = document.getElementById('psZoomSelectMode')?.checked;
  const bgStyle = document.getElementById('psBgStyleSelect').value;
  document.getElementById('psBgColorControls').classList.toggle('hidden', !enabled);
  document.getElementById('psCustomColorLbl').classList.toggle('hidden', !(enabled && bgStyle === 'solid_custom'));

  const splitEl = document.getElementById('psSplitRange');
  const splitLbl = document.getElementById('psSplitVal');
  if (splitEl && splitLbl) splitLbl.textContent = `${splitEl.value}%`;

  const hintEl = document.getElementById('canvasToolHint');
  if (zoomActive) {
    if (hintEl) hintEl.textContent = 'Zoomed Hair Brush Mode: Drag directly on zoomed hair to smooth/trim. Hold Shift+Drag to pick custom crop area.';
    document.getElementById('livePreviewCaption').textContent = 'Zoomed Hair Brush Preview: Drag on hair to set/trim stray strands';
  } else if (hairActive) {
    if (hintEl) hintEl.textContent = 'Hair Set Brush Active: Drag over top/side hairs to smooth, darken or trim stray strands.';
    document.getElementById('livePreviewCaption').textContent = 'Live Digital Studio Preview: Hair Brush & Digital Studio Retouch';
  } else {
    if (hintEl) hintEl.textContent = 'Tip: Drag over hair to retouch or enable "Zoom Photo for Hair Brush" to zoom in.';
    document.getElementById('livePreviewCaption').textContent = enabled
      ? 'Live Digital Studio Preview (AI Background Removed)'
      : 'Live Digital Studio Preview (Left: Digital Retouched • Right: Original)';
  }
}

document.getElementById('psRemoveBgToggle').onchange = () => {
  updatePsBgControls();
  renderLiveEditPreview();
};
document.getElementById('psAutoHairFitToggle').onchange = async () => {
  invalidateHairAndBgCache();
  if (document.getElementById('psAutoHairFitToggle').checked) {
    setAutoHairFitStatus('Scanning hair outline with AI...');
  } else {
    setAutoHairFitStatus('Auto Hair Fit turned off.');
  }
  updatePsBgControls();
  await renderLiveEditPreview();
};
document.getElementById('psBgStyleSelect').onchange = () => {
  updatePsBgControls();
  renderLiveEditPreview();
};
document.getElementById('psBgCustomColor').oninput = renderLiveEditPreview;

function applyPhotoshopDigitalRetouch(sourceDrawable, targetW, targetH) {
  const depthPct = (parseFloat(document.getElementById('psDepthNum').value) || 0) / 100;
  const tonePct = (parseFloat(document.getElementById('psToneNum').value) || 0) / 100;
  const smoothPct = (parseFloat(document.getElementById('psSmoothNum').value) || 0) / 100;
  const sharpPct = (parseFloat(document.getElementById('psSharpNum').value) || 0) / 100;
  const autoWb = document.getElementById('psAutoWb').checked;

  const c = document.createElement('canvas');
  c.width = targetW; c.height = targetH;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceDrawable, 0, 0, targetW, targetH);

  if (smoothPct > 0.02) {
    const blurC = document.createElement('canvas');
    blurC.width = targetW; blurC.height = targetH;
    const bCtx = blurC.getContext('2d');
    const blurRad = Math.max(2, Math.round(Math.min(targetW, targetH) * 0.007 * smoothPct));
    bCtx.filter = `blur(${blurRad}px)`;
    bCtx.drawImage(c, 0, 0);
    bCtx.filter = 'none';

    const baseData = ctx.getImageData(0, 0, targetW, targetH);
    const blurData = bCtx.getImageData(0, 0, targetW, targetH);
    const bd = baseData.data, sd = blurData.data;

    for (let i = 0; i < bd.length; i += 4) {
      if (bd[i + 3] < 10) continue;
      const r = bd[i], g = bd[i + 1], b = bd[i + 2];
      const diff = (Math.abs(r - sd[i]) + Math.abs(g - sd[i + 1]) + Math.abs(b - sd[i + 2])) / 3;
      if (diff < 32) {
        const isSkin = (r > 65 && g > 35 && b > 18 && r > g && r > b && (r - g) > 8);
        const blend = smoothPct * (isSkin ? 0.72 : 0.30) * (1 - diff / 32);
        bd[i] = Math.round(r * (1 - blend) + sd[i] * blend);
        bd[i + 1] = Math.round(g * (1 - blend) + sd[i + 1] * blend);
        bd[i + 2] = Math.round(b * (1 - blend) + sd[i + 2] * blend);
      }
    }
    ctx.putImageData(baseData, 0, 0);
  }

  const imgData = ctx.getImageData(0, 0, targetW, targetH);
  const d = imgData.data;

  let scaleR = 1, scaleG = 1, scaleB = 1;
  if (autoWb) {
    let sumR = 0, sumG = 0, sumB = 0, count = 0;
    const step = Math.max(4, Math.floor((d.length / 4) / 25000) * 4);
    for (let i = 0; i < d.length; i += step) {
      if (d[i + 3] < 128) continue;
      sumR += d[i]; sumG += d[i + 1]; sumB += d[i + 2]; count++;
    }
    if (count > 0) {
      const avgR = sumR / count, avgG = sumG / count, avgB = sumB / count;
      const avgGray = (avgR + avgG + avgB) / 3;
      scaleR = Math.min(1.16, Math.max(0.86, 1 + ((avgGray / Math.max(1, avgR)) - 1) * 0.45));
      scaleG = Math.min(1.16, Math.max(0.86, 1 + ((avgGray / Math.max(1, avgG)) - 1) * 0.45));
      scaleB = Math.min(1.16, Math.max(0.86, 1 + ((avgGray / Math.max(1, avgB)) - 1) * 0.45));
    }
  }

  const contrastFactor = 1 + depthPct * 0.34;

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 5) continue;
    let r = d[i] * scaleR;
    let g = d[i + 1] * scaleG;
    let b = d[i + 2] * scaleB;

    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    if (tonePct > 0.01 && lum < 0.48) {
      const shadowLift = Math.pow((0.48 - lum) / 0.48, 1.5) * tonePct * 24;
      r += shadowLift;
      g += shadowLift;
      b += shadowLift;
    }

    r = (r - 128) * contrastFactor + 128;
    g = (g - 128) * contrastFactor + 128;
    b = (b - 128) * contrastFactor + 128;

    const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
    const sat = maxC > 0 ? (maxC - minC) / maxC : 0;
    const vibAmt = (depthPct * 0.24 + sharpPct * 0.12) * (1 - sat * 0.7);
    const avg = (r + g + b) / 3;
    r += (r - avg) * vibAmt;
    g += (g - avg) * vibAmt;
    b += (b - avg) * vibAmt;

    d[i] = Math.min(255, Math.max(0, Math.round(r)));
    d[i + 1] = Math.min(255, Math.max(0, Math.round(g)));
    d[i + 2] = Math.min(255, Math.max(0, Math.round(b)));
  }
  ctx.putImageData(imgData, 0, 0);

  if (sharpPct > 0.02) {
    const sData = ctx.getImageData(0, 0, targetW, targetH);
    const sd = sData.data;
    const copy = new Uint8ClampedArray(sd);
    const amt = sharpPct * 0.54;
    for (let y = 1; y < targetH - 1; y++) {
      for (let x = 1; x < targetW - 1; x++) {
        const idx = (y * targetW + x) * 4;
        if (copy[idx + 3] < 20) continue;
        for (let ch = 0; ch < 3; ch++) {
          const center = copy[idx + ch] * 5;
          const neighbors = copy[((y - 1) * targetW + x) * 4 + ch]
                          + copy[((y + 1) * targetW + x) * 4 + ch]
                          + copy[(y * targetW + (x - 1)) * 4 + ch]
                          + copy[(y * targetW + (x + 1)) * 4 + ch];
          const sharpVal = center - neighbors;
          sd[idx + ch] = Math.min(255, Math.max(0, Math.round(copy[idx + ch] * (1 - amt) + sharpVal * amt)));
        }
      }
    }
    ctx.putImageData(sData, 0, 0);
  }

  return applyHairSetBrushStrokes(c);
}

function compositeBackgroundBehindSubject(subjectCanvas) {
  const bgStyle = document.getElementById('psBgStyleSelect').value;
  if (bgStyle === 'transparent') return subjectCanvas;

  const outC = document.createElement('canvas');
  outC.width = subjectCanvas.width;
  outC.height = subjectCanvas.height;
  const ctx = outC.getContext('2d');
  ctx.fillStyle = getBgFillStyle(ctx, outC.width, outC.height);
  ctx.fillRect(0, 0, outC.width, outC.height);
  ctx.drawImage(subjectCanvas, 0, 0);
  return outC;
}

document.getElementById('psPresetSelect').onchange = (e) => {
  const p = e.target.value;
  const presets = {
    digital_crisp: { dp: 65, tn: 35, sm: 45, sh: 75, wb: true },
    studio_natural: { dp: 48, tn: 42, sm: 50, sh: 60, wb: true },
    passport_clean: { dp: 52, tn: 48, sm: 45, sh: 70, wb: true },
    deep_vibrant: { dp: 82, tn: 28, sm: 35, sh: 85, wb: true },
    soft_retouch: { dp: 45, tn: 40, sm: 80, sh: 55, wb: true }
  };
  const cfg = presets[p] || presets.digital_crisp;
  document.getElementById('psDepthRange').value = cfg.dp; document.getElementById('psDepthNum').value = cfg.dp;
  document.getElementById('psToneRange').value = cfg.tn; document.getElementById('psToneNum').value = cfg.tn;
  document.getElementById('psSmoothRange').value = cfg.sm; document.getElementById('psSmoothNum').value = cfg.sm;
  document.getElementById('psSharpRange').value = cfg.sh; document.getElementById('psSharpNum').value = cfg.sh;
  document.getElementById('psAutoWb').checked = cfg.wb;
  renderLiveEditPreview();
};

function prepareLogoSource(logoImg, removeWhiteBg) {
  const c = document.createElement('canvas');
  c.width = logoImg.width; c.height = logoImg.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(logoImg, 0, 0);
  if (removeWhiteBg) {
    const imgData = ctx.getImageData(0, 0, c.width, c.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235) {
        d[i + 3] = 0;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }
  return c;
}

function drawLogoOverlayOnCanvas(ctx, cw, ch, logoImg) {
  if (!logoImg) return;
  const opacity = (parseFloat(document.getElementById('logoOpacityNum').value) || 65) / 100;
  const sizePct = (parseFloat(document.getElementById('logoSizeNum').value) || 25) / 100;
  const posMode = document.getElementById('logoPosition').value;
  const margin = parseInt(document.getElementById('logoMargin').value) || 20;
  const removeWhite = document.getElementById('logoRemoveWhiteBg').checked;

  const cleanLogo = prepareLogoSource(logoImg, removeWhite);
  const lw = Math.max(16, Math.round(cw * sizePct));
  const lh = Math.max(16, Math.round((cleanLogo.height / cleanLogo.width) * lw));

  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0.05, opacity));

  if (posMode === 'tiled') {
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate(-Math.PI / 6);
    const stepX = lw + margin * 2.5;
    const stepY = lh + margin * 2.5;
    for (let y = -ch; y < ch; y += stepY) {
      for (let x = -cw; x < cw; x += stepX) {
        ctx.drawImage(cleanLogo, x, y, lw, lh);
      }
    }
  } else {
    let lx = cw - lw - margin;
    let ly = ch - lh - margin;
    if (posMode === 'bottom-left') { lx = margin; ly = ch - lh - margin; }
    else if (posMode === 'top-right') { lx = cw - lw - margin; ly = margin; }
    else if (posMode === 'top-left') { lx = margin; ly = margin; }
    else if (posMode === 'center') { lx = (cw - lw) / 2; ly = (ch - lh) / 2; }
    ctx.drawImage(cleanLogo, lx, ly, lw, lh);
  }
  ctx.restore();
}

async function renderLiveEditPreview() {
  const tool = document.getElementById('editToolSelect').value;
  const wrap = document.getElementById('liveEditPreviewWrap');
  if (!cachedMainImg || !['ps_auto_retouch', 'img_contrast', 'add_logo_photo'].includes(tool)) {
    wrap.classList.add('hidden');
    return;
  }
  wrap.classList.remove('hidden');
  updatePsBgControls();

  const maxDim = 540;
  const sc = Math.min(1, maxDim / Math.max(cachedMainImg.width, cachedMainImg.height));
  const pw = Math.round(cachedMainImg.width * sc);
  const ph = Math.round(cachedMainImg.height * sc);
  liveEditCanvas.width = pw;
  liveEditCanvas.height = ph;
  const lctx = liveEditCanvas.getContext('2d');
  lctx.clearRect(0, 0, pw, ph);

  if (tool === 'ps_auto_retouch') {
    const zoomModeChecked = Boolean(document.getElementById('psZoomSelectMode')?.checked);
    const hairBrushChecked = Boolean(document.getElementById('hairBrushToggle')?.checked);
    liveEditCanvas.style.cursor = hairBrushChecked ? 'cell' : 'default';

    const removeBg = document.getElementById('psRemoveBgToggle').checked;
    const autoHairFit = document.getElementById('psAutoHairFitToggle').checked;

    let baseSrc = await getPreparedHairSource(cachedMainImg);
    baseSrc = await getPreparedHairstyleSource(baseSrc);
    if (removeBg) {
      baseSrc = await getPreparedCutoutSource(baseSrc, autoHairFit);
    }

    const workingSrc = getActiveWorkingSource(baseSrc);
    const enhanced = applyPhotoshopDigitalRetouch(workingSrc, pw, ph);
    const finalEnhanced = removeBg ? compositeBackgroundBehindSubject(enhanced) : enhanced;

    if (removeBg || autoHairFit || zoomModeChecked || hairStrokes.length > 0) {
      lctx.drawImage(finalEnhanced, 0, 0, pw, ph);
    } else {
      const splitPct = (parseFloat(document.getElementById('psSplitRange').value) ?? 100) / 100;
      const splitX = Math.round(pw * splitPct);
      lctx.drawImage(workingSrc, 0, 0, pw, ph);
      if (splitX > 0) {
        lctx.drawImage(finalEnhanced, 0, 0, splitX, ph, 0, 0, splitX, ph);
      }
      if (splitX > 2 && splitX < pw - 2) {
        lctx.strokeStyle = '#ffffff';
        lctx.lineWidth = 2;
        lctx.beginPath(); lctx.moveTo(splitX, 0); lctx.lineTo(splitX, ph); lctx.stroke();
      }
    }

    if (zoomSelectionNorm && isSelectingZoom) {
      const rx = zoomSelectionNorm.x * pw;
      const ry = zoomSelectionNorm.y * ph;
      const rw = zoomSelectionNorm.w * pw;
      const rh = zoomSelectionNorm.h * ph;
      lctx.save();
      lctx.strokeStyle = '#0284c7';
      lctx.lineWidth = 2.5;
      lctx.setLineDash([6, 4]);
      lctx.strokeRect(rx, ry, rw, rh);
      lctx.restore();
    }

    if (hairBrushChecked && currentHairStroke && currentHairStroke.points.length) {
      const shape = currentHairStroke.shape || 'freehand';
      const pts = currentHairStroke.points;
      const p1 = pts[pts.length - 1];
      const cx = p1.x * pw, cy = p1.y * ph;
      const rad = Math.max(1, Math.round(currentHairStroke.radiusNorm * Math.min(pw, ph)));
      lctx.save();
      lctx.strokeStyle = '#f59e0b';
      lctx.lineWidth = 2;
      lctx.setLineDash([5, 3]);
      if (shape === 'circle') {
        lctx.beginPath();
        lctx.arc(cx, cy, rad, 0, Math.PI * 2);
        lctx.stroke();
      } else if (shape === 'rect') {
        lctx.strokeRect(cx - rad, cy - rad, rad * 2, rad * 2);
      } else {
        lctx.beginPath();
        pts.forEach((pt, idx) => {
          const pxPt = pt.x * pw, pyPt = pt.y * ph;
          if (idx === 0) lctx.moveTo(pxPt, pyPt);
          else lctx.lineTo(pxPt, pyPt);
        });
        lctx.setLineDash([]);
        lctx.lineWidth = Math.max(1, rad * 2);
        lctx.lineCap = 'round';
        lctx.lineJoin = 'round';
        lctx.stroke();
      }
      lctx.restore();
    }
  } else if (tool === 'img_contrast') {
    liveEditCanvas.style.cursor = 'default';
    const cVal = Math.max(10, parseFloat(document.getElementById('cbContrastNum').value) || 100);
    const bVal = Math.max(10, parseFloat(document.getElementById('cbBrightnessNum').value) || 100);
    lctx.filter = `contrast(${cVal}%) brightness(${bVal}%)`;
    lctx.drawImage(cachedMainImg, 0, 0, pw, ph);
    lctx.filter = 'none';
  } else if (tool === 'add_logo_photo') {
    liveEditCanvas.style.cursor = 'default';
    lctx.drawImage(cachedMainImg, 0, 0, pw, ph);
    drawLogoOverlayOnCanvas(lctx, pw, ph, cachedLogoImg);
  }
}

document.getElementById('editFiles').onchange = async (e) => {
  const f = e.target.files[0];
  invalidateHairAndBgCache();
  setAutoHairFitStatus('');
  hairStrokes = [];
  zoomSelectionNorm = null;
  if (!f) { cachedMainImg = null; renderLiveEditPreview(); return; }
  cachedMainImg = await loadImg(URL.createObjectURL(f));
  renderLiveEditPreview();
};

document.getElementById('hairstyleRedesignSelect')?.addEventListener('change', async () => {
  invalidateHairAndBgCache();
  await renderLiveEditPreview();
});

// Export the full-resolution Photoshop Auto Retouch result, including the
// selected hairstyle shape adjustment and optional background replacement.
document.getElementById('editRunBtn')?.addEventListener('click', async () => {
  const tool = document.getElementById('editToolSelect')?.value;
  if (tool !== 'ps_auto_retouch') return;
  const status = document.getElementById('editStatus');
  const output = document.getElementById('editOutput');
  if (!cachedMainImg) {
    if (status) { status.textContent = 'Please select a photo first.'; status.classList.remove('hidden'); }
    return;
  }
  const btn = document.getElementById('editRunBtn');
  btn.disabled = true;
  btn.textContent = 'Processing Photo...';
  if (status) { status.textContent = 'Applying retouch and hairstyle settings...'; status.classList.remove('hidden'); }
  try {
    let source = await getPreparedHairSource(cachedMainImg);
    source = await getPreparedHairstyleSource(source);
    const removeBg = Boolean(document.getElementById('psRemoveBgToggle')?.checked);
    if (removeBg) source = await getPreparedCutoutSource(source, Boolean(document.getElementById('psAutoHairFitToggle')?.checked));

    const workSource = getActiveWorkingSource(source);
    const outW = workSource.width || workSource.naturalWidth;
    const outH = workSource.height || workSource.naturalHeight;
    const enhanced = applyPhotoshopDigitalRetouch(workSource, outW, outH);
    const finalCanvas = removeBg ? compositeBackgroundBehindSubject(enhanced) : enhanced;
    const blob = await new Promise((resolve, reject) => {
      finalCanvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not create the output image.')), 'image/png');
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mahadev-studio-hairstyle-retouch.png';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    if (status) status.textContent = 'Done! Your edited photo has been downloaded.';
    if (output) output.innerHTML = '';
  } catch (error) {
    if (status) status.textContent = error?.message || 'Photo processing failed. Please try again.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Apply & Download';
  }
});



// ================= JOIN / EDIT / CREATE TOOL PANEL RESTORE =================
function updateJoinEditToolPanel() {
  const tool = document.getElementById('editToolSelect')?.value || 'ps_auto_retouch';
  const show = (id, visible) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', !visible);
  };
  const setLabel = (id, visible) => show(id, visible);
  const isPs = tool === 'ps_auto_retouch';
  const isLogo = tool === 'add_logo_photo';
  const isContrast = tool === 'img_contrast';
  const isNameDate = tool === 'name_date';
  const isFrame = tool === 'photo_frame';
  const isHandwriting = tool === 'text_handwriting';
  const isSignature = tool === 'sig_maker';
  const isImageTool = !isHandwriting && !isSignature && tool !== 'latex_img';

  // Main photo / text controls.
  setLabel('edImgFileLbl', isImageTool);
  setLabel('edText1Lbl', ['name_date','add_text_img','watermark_img','text_handwriting','latex_img'].includes(tool));
  setLabel('edText2Lbl', isNameDate);
  setLabel('edFontLbl', ['name_date','add_text_img','watermark_img','text_handwriting'].includes(tool));
  setLabel('edBoldLbl', ['name_date','add_text_img','watermark_img','text_handwriting'].includes(tool));
  setLabel('edColorLbl', ['name_date','add_text_img','watermark_img','text_handwriting'].includes(tool));

  // Restore each tool's dedicated controls.
  show('psRetouchWrap', isPs);
  show('logoOptionsWrap', isLogo);
  show('cbControlsWrap', isContrast);
  show('ndOptionsWrap', isNameDate);
  show('frameOptionsWrap', isFrame);
  show('edNumWrap', ['rotate','blur_image','add_border'].includes(tool));
  show('hwTextWrap', isHandwriting);
  show('sigPadWrap', isSignature);
  show('liveEditPreviewWrap', false);

  const runBtn = document.getElementById('editRunBtn');
  if (runBtn) {
    const labels = {
      ps_auto_retouch: 'Apply & Download',
      merge_photo_sig: 'Merge Photo & Signature',
      join_images: 'Join Images & Download',
      name_date: 'Add Name / Date & Download',
      add_logo_photo: 'Add Logo & Download',
      photo_frame: 'Apply Photo Frame',
      add_border: 'Add Border & Download',
      blur_image: 'Apply Blur & Download',
      img_contrast: 'Apply Contrast / Brightness',
      rotate: 'Rotate & Download',
      add_text_img: 'Add Text & Download',
      watermark_img: 'Add Watermark & Download',
      flip: 'Flip & Download',
      blur_bg: 'Blur Background',
      sig_maker: 'Download Signature',
      text_handwriting: 'Create Handwriting Page',
      latex_img: 'Create Formula Image'
    };
    runBtn.textContent = labels[tool] || 'Apply & Download';
  }
  const status = document.getElementById('editStatus');
  if (status) {
    status.textContent = '';
    status.classList.add('hidden');
  }
  if (cachedMainImg && ['ps_auto_retouch','img_contrast','add_logo_photo'].includes(tool)) {
    renderLiveEditPreview();
  }
}

const joinEditToolSelect = document.getElementById('editToolSelect');
if (joinEditToolSelect) {
  joinEditToolSelect.addEventListener('change', updateJoinEditToolPanel);
  updateJoinEditToolPanel();
}


// ================= JOIN_EDIT_FULL_TOOL_DISPATCH_V1 =================
// Complete client-side processing for the non-Photoshop options.
let joinEditSelectedFrame = 0;
let joinEditCustomFrame = null;

function joinEditCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}
function joinEditDownload(canvas, filename = 'mahadev-edited-image.png', type = 'image/png') {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) return reject(new Error('Could not export the edited image.'));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1800);
      resolve();
    }, type);
  });
}
function joinEditFont() {
  const selected = document.getElementById('editFontFamily')?.value;
  return selected || 'Noto Sans, Arial, sans-serif';
}
function joinEditDrawText(ctx, text, x, y, maxWidth, size, align = 'center') {
  if (!text) return;
  const bold = document.getElementById('editBoldToggle')?.checked;
  ctx.save();
  ctx.font = (bold ? '700 ' : '400 ') + size + 'px "' + joinEditFont().replace(/["']/g, '') + '", sans-serif';
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.12);
  ctx.strokeStyle = 'rgba(0,0,0,.58)';
  ctx.fillStyle = document.getElementById('editColor')?.value || '#ffffff';
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillText(text, x, y, maxWidth);
  ctx.restore();
}
async function joinEditLoadSelectedImages() {
  const files = Array.from(document.getElementById('editFiles')?.files || []);
  if (!files.length) throw new Error('Please select the required photo file(s) first.');
  const images = [];
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const url = URL.createObjectURL(file);
    try { images.push(await loadImg(url)); }
    finally { URL.revokeObjectURL(url); }
  }
  if (!images.length) throw new Error('No valid image file was selected.');
  return images;
}
function joinEditCanvasFromImage(img) {
  const c = joinEditCanvas(img.naturalWidth || img.width, img.naturalHeight || img.height);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}
function joinEditFrameCanvas(source, frameIndex, customFrame) {
  const c = joinEditCanvas(source.width, source.height), ctx = c.getContext('2d');
  ctx.drawImage(source, 0, 0);
  if (customFrame) {
    ctx.drawImage(customFrame, 0, 0, c.width, c.height);
    return c;
  }
  const palettes = [
    ['#d4af37','#fff1a8'],['#111827','#94a3b8'],['#7f1d1d','#fca5a5'],['#1e3a8a','#93c5fd'],
    ['#14532d','#86efac'],['#581c87','#d8b4fe'],['#9a3412','#fdba74'],['#0f766e','#99f6e4'],
    ['#be185d','#fbcfe8'],['#374151','#e5e7eb']
  ];
  const pair = palettes[frameIndex % palettes.length];
  const thickness = Math.max(2, Math.min(20, Number(document.getElementById('frameThickness')?.value) || 6)) / 100 * Math.min(c.width,c.height);
  const style = Math.floor(frameIndex / 10);
  ctx.save();
  ctx.strokeStyle = pair[0]; ctx.lineWidth = thickness;
  ctx.strokeRect(thickness/2, thickness/2, c.width-thickness, c.height-thickness);
  ctx.strokeStyle = pair[1]; ctx.lineWidth = Math.max(1, thickness * .22);
  const inset = thickness * (1.25 + (style % 3) * .35);
  ctx.strokeRect(inset, inset, c.width-2*inset, c.height-2*inset);
  if (style % 2 === 0) {
    const corner = Math.max(8, thickness * 1.2);
    for (const [x,y,sx,sy] of [[inset,inset,1,1],[c.width-inset,inset,-1,1],[inset,c.height-inset,1,-1],[c.width-inset,c.height-inset,-1,-1]]) {
      ctx.beginPath(); ctx.moveTo(x,y+sy*corner); ctx.lineTo(x,y); ctx.lineTo(x+sx*corner,y); ctx.stroke();
    }
  }
  ctx.restore();
  return c;
}
function joinEditInitFrameGallery() {
  const gallery = document.getElementById('frameGallery');
  if (!gallery || gallery.dataset.ready === '1') return;
  gallery.dataset.ready = '1';
  const names = ['Royal Gold','Classic Black','Ruby Red','Royal Blue','Emerald','Violet','Copper','Teal','Rose','Silver'];
  for (let i=0;i<50;i++) {
    const b=document.createElement('button');
    b.type='button'; b.className='chip'; b.style.cssText='min-width:100px;min-height:58px;margin:4px;border:4px solid '+[['#d4af37','#fff1a8'],['#111827','#94a3b8'],['#7f1d1d','#fca5a5'],['#1e3a8a','#93c5fd'],['#14532d','#86efac'],['#581c87','#d8b4fe'],['#9a3412','#fdba74'],['#0f766e','#99f6e4'],['#be185d','#fbcfe8'],['#374151','#e5e7eb']][i%10][0]+';background:#fff;font-size:12px;';
    b.textContent=String(i+1).padStart(2,'0')+'. '+names[i%10]+' '+(Math.floor(i/10)+1);
    b.addEventListener('click',()=>{
      joinEditSelectedFrame=i;
      gallery.querySelectorAll('button').forEach((x,n)=>{x.style.outline=n===i?'3px solid #0d9488':'none';});
      const badge=document.getElementById('selectedFrameBadge');
      if(badge) badge.textContent='Selected: '+String(i+1).padStart(2,'0')+'. '+names[i%10];
    });
    gallery.appendChild(b);
  }
  gallery.querySelector('button')?.click();
}
document.getElementById('customFrameFile')?.addEventListener('change', async e=>{
  const file=e.target.files?.[0]; if(!file){joinEditCustomFrame=null;return;}
  try { const url=URL.createObjectURL(file); joinEditCustomFrame=await loadImg(url); URL.revokeObjectURL(url); }
  catch(err){ joinEditCustomFrame=null; const s=document.getElementById('editStatus'); if(s){s.textContent=err.message;s.classList.remove('hidden');} }
});
joinEditInitFrameGallery();

async function joinEditBlurBackground(img) {
  if (typeof SelfieSegmentation === 'undefined') throw new Error('Portrait segmentation model is not loaded. Refresh the page with internet access and retry.');
  return new Promise((resolve,reject)=>{
    let model,done=false;
    const finish=(err,val)=>{if(done)return;done=true;clearTimeout(timer);try{model?.close();}catch(_){};err?reject(err):resolve(val);};
    const timer=setTimeout(()=>finish(new Error('Background blur timed out. Try a smaller photo.')),30000);
    try {
      model=new SelfieSegmentation({locateFile:file=>`https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`});
      model.setOptions({modelSelection:1});
      model.onResults(results=>{
        try {
          if(!results?.segmentationMask) throw new Error('Could not detect the person in this photo.');
          const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;
          const base=joinEditCanvas(w,h),ctx=base.getContext('2d');
          ctx.filter='blur(12px)';ctx.drawImage(img,0,0,w,h);ctx.filter='none';
          const maskCanvas=joinEditCanvas(w,h),mctx=maskCanvas.getContext('2d',{willReadFrequently:true});
          mctx.drawImage(results.segmentationMask,0,0,w,h);
          const maskData=mctx.getImageData(0,0,w,h).data;
          const fg=joinEditCanvas(w,h),fctx=fg.getContext('2d',{willReadFrequently:true});
          fctx.drawImage(img,0,0,w,h);
          const fgData=fctx.getImageData(0,0,w,h),fd=fgData.data;
          for(let p=0,i=0;p<w*h;p++,i+=4) fd[i+3]=Math.round(fd[i+3]*(maskData[i]/255));
          fctx.putImageData(fgData,0,0);
          ctx.drawImage(fg,0,0);
          finish(null,base);
        } catch(err){finish(err);}
      });
      model.send({image:img}).catch(err=>finish(err));
    } catch(err){finish(err);}
  });
}
async function joinEditProcessTool(tool) {
  const files=Array.from(document.getElementById('editFiles')?.files||[]);
  const text1=document.getElementById('editText1')?.value?.trim()||'';
  const text2=document.getElementById('editText2')?.value?.trim()||'';
  const num=Math.max(0,Number(document.getElementById('editNum1')?.value)||10);
  if (tool==='sig_maker') {
    const c=joinEditCanvasFromImage(sigCanvas);
    await joinEditDownload(c,'mahadev-digital-signature.png'); return 'Signature downloaded as PNG.';
  }
  if (tool==='text_handwriting') {
    const value=document.getElementById('hwLongText')?.value?.trim()||text1;
    if(!value) throw new Error('Please enter the text for the handwriting page.');
    const c=joinEditCanvas(1240,1754),ctx=c.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
    ctx.strokeStyle='#dbeafe';ctx.lineWidth=2;
    for(let y=130;y<c.height-70;y+=54){ctx.beginPath();ctx.moveTo(75,y);ctx.lineTo(c.width-70,y);ctx.stroke();}
    ctx.fillStyle='#1e3a8a';ctx.font='30px '+joinEditFont();
    const words=value.split(/\s+/);let line='',y=120;
    for(const word of words){const test=line?line+' '+word:word;if(ctx.measureText(test).width>c.width-170&&line){ctx.fillText(line,85,y);line=word;y+=54;}else line=test;}
    if(line)ctx.fillText(line,85,y);
    await joinEditDownload(c,'mahadev-handwriting-page.png');return 'Handwriting-style page created. You can print this A4 image.';
  }
  if (tool==='latex_img') {
    if(!text1) throw new Error('Enter a formula or expression first.');
    const c=joinEditCanvas(1600,600),ctx=c.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
    ctx.fillStyle='#111827';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font='48px Georgia, serif';ctx.fillText(text1,800,300,1450);
    await joinEditDownload(c,'mahadev-formula.png');return 'Formula text exported as an image (plain text rendering; LaTeX commands are not typeset).';
  }

  const imgs=await joinEditLoadSelectedImages();
  if(tool==='join_images'||tool==='merge_photo_sig'){
    if(imgs.length<2) throw new Error('Please select at least two image files.');
    const vertical=tool==='merge_photo_sig';
    const targetW=vertical?Math.max(...imgs.map(i=>i.naturalWidth||i.width)):imgs.reduce((n,i)=>n+Math.round((i.naturalWidth||i.width)*Math.max(...imgs.map(x=>x.naturalHeight||x.height))/(i.naturalHeight||i.height)),0);
    const targetH=vertical?imgs.reduce((n,i)=>n+Math.round((i.naturalHeight||i.height)*Math.max(...imgs.map(x=>x.naturalWidth||x.width))/(i.naturalWidth||i.width)),0):Math.max(...imgs.map(i=>i.naturalHeight||i.height));
    const c=joinEditCanvas(targetW,targetH),ctx=c.getContext('2d');let offset=0;
    imgs.forEach(img=>{const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;if(vertical){const dw=targetW,dh=ih*targetW/iw;ctx.drawImage(img,0,offset,dw,dh);offset+=dh;}else{const dh=targetH,dw=iw*targetH/ih;ctx.drawImage(img,offset,0,dw,dh);offset+=dw;}});
    await joinEditDownload(c,vertical?'mahadev-photo-signature-merge.png':'mahadev-joined-images.png');
    return vertical?'Photo and signature images merged vertically.':'Images joined horizontally.';
  }

  if(tool==='blur_bg'){
    const c=await joinEditBlurBackground(imgs[0]);await joinEditDownload(c,'mahadev-background-blur.png');return 'Portrait background blur applied.';
  }
  const source=joinEditCanvasFromImage(imgs[0]);
  let c=joinEditCanvas(source.width,source.height),ctx=c.getContext('2d');
  ctx.drawImage(source,0,0);
  if(tool==='add_logo_photo'){
    const logoFile=document.getElementById('logoOverlayFile')?.files?.[0];
    if(!logoFile) throw new Error('Please upload a logo image.');
    const url=URL.createObjectURL(logoFile);const logo=await loadImg(url);URL.revokeObjectURL(url);
    drawLogoOverlayOnCanvas(ctx,c.width,c.height,logo);
  } else if(tool==='name_date'){
    const size=Math.max(16,c.width*(Number(document.getElementById('ndFontSizePct')?.value)||5)/100);
    const pos=document.getElementById('ndPosition')?.value||'bottom';
    const vertical=document.getElementById('ndOrientation')?.value==='vertical';
    const strip=document.getElementById('ndBgStyle')?.value||'transparent_outline';
    ctx.save();
    if(strip==='white_strip'){ctx.fillStyle='#fff';ctx.fillRect(0,c.height-size*2.5,c.width,size*2.5);}
    else if(strip==='transparent_glass'){ctx.fillStyle='rgba(255,255,255,.48)';ctx.fillRect(0,c.height-size*2.5,c.width,size*2.5);}
    const x=pos==='left'?size:c.width/2,y=pos==='top'?size*1.5:pos==='center'?c.height/2:c.height-size*1.5;
    if(vertical){ctx.translate(pos==='right'?c.width-size:c.width/2,y);ctx.rotate(-Math.PI/2);joinEditDrawText(ctx,text1+'  '+text2,0,0,c.height-size*2,size,'center');}
    else joinEditDrawText(ctx,[text1,text2].filter(Boolean).join('  '),pos==='left'?size:c.width/2,y,c.width-size*2,size,pos==='left'?'left':'center');
    ctx.restore();
  } else if(tool==='add_text_img'||tool==='watermark_img'){
    if(!text1) throw new Error('Please enter the text first.');
    const size=Math.max(18,c.width*(tool==='watermark_img'?.055:.06));
    if(tool==='watermark_img'){
      ctx.save();ctx.globalAlpha=.28;ctx.translate(c.width/2,c.height/2);ctx.rotate(-Math.PI/6);
      joinEditDrawText(ctx,text1,0,0,c.width*.9,size,'center');ctx.restore();
    } else joinEditDrawText(ctx,text1,c.width/2,c.height/2,c.width*.9,size,'center');
  } else if(tool==='photo_frame'){
    c=joinEditFrameCanvas(source,joinEditSelectedFrame,joinEditCustomFrame);
  } else if(tool==='add_border'){
    const border=Math.max(1,Math.min(200,num));ctx.strokeStyle=document.getElementById('editColor')?.value||'#fff';ctx.lineWidth=border;ctx.strokeRect(border/2,border/2,c.width-border,c.height-border);
  } else if(tool==='blur_image'){
    const blur=Math.max(0,Math.min(30,num));ctx.filter='blur('+blur+'px)';ctx.drawImage(source,0,0);ctx.filter='none';
  } else if(tool==='img_contrast'){
    const contrast=Math.max(20,Math.min(250,Number(document.getElementById('cbContrastNum')?.value)||110));
    const bright=Math.max(20,Math.min(250,Number(document.getElementById('cbBrightnessNum')?.value)||105));
    ctx.filter='contrast('+contrast+'%) brightness('+bright+'%)';ctx.drawImage(source,0,0);ctx.filter='none';
  } else if(tool==='rotate'){
    const angle=(num||90)*Math.PI/180,sw=source.width,sh=source.height;
    const swap=Math.abs(Math.round(num/90))%2===1;
    c=joinEditCanvas(swap?sh:sw,swap?sw:sh);ctx=c.getContext('2d');ctx.translate(c.width/2,c.height/2);ctx.rotate(angle);ctx.drawImage(source,-sw/2,-sh/2);
  } else if(tool==='flip'){
    ctx.translate(c.width,0);ctx.scale(-1,1);ctx.drawImage(source,0,0);
  } else {
    throw new Error('This tool is not yet supported: '+tool);
  }
  await joinEditDownload(c,'mahadev-'+tool.replace(/[^a-z0-9]+/gi,'-')+'.png');
  return 'Done! Your edited image has been downloaded.';
}

document.getElementById('editRunBtn')?.addEventListener('click', async()=>{
  const tool=document.getElementById('editToolSelect')?.value;
  if(!tool||tool==='ps_auto_retouch') return; // Photoshop has its own full-resolution handler above.
  const btn=document.getElementById('editRunBtn'),status=document.getElementById('editStatus');
  if(btn){btn.disabled=true;btn.textContent='Processing...';}
  if(status){status.textContent='Processing '+tool.replace(/_/g,' ')+'...';status.classList.remove('hidden');}
  try {
    const message=await joinEditProcessTool(tool);
    if(status)status.textContent=message;
  } catch(error) {
    if(status){status.textContent=error?.message||'Processing failed. Please check the selected files and try again.';status.classList.remove('hidden');}
  } finally {
    if(btn){btn.disabled=false;const label=document.getElementById('editToolSelect')?.selectedOptions?.[0]?.textContent||'Apply & Download';btn.textContent=label.length>26?'Apply & Download':label;}
  }
});
