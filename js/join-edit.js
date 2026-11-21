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
  const key = `${useAutoHairFit ? 'hairfit' : 'raw'}_${subjectSource.width || subjectSource.naturalWidth}x${subjectSource.height || subjectSource.naturalHeight}`;
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
