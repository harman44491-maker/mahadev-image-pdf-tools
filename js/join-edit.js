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

    // Selected Area Zoom state (normalized 0..1)
    let zoomSelectionNorm = null;
    let isSelectingZoom = false;
    let zoomDragStart = null;

    // Hair Set Brush Strokes (stored normalized 0..1)
    let hairStrokes = [];
    let isBrushingHair = false;
    let currentHairStroke = null;
    let lastHairPos = null;

    function applyHairSetBrushStrokes(targetCanvas) {
      if (!hairStrokes.length) return targetCanvas;
      const w = targetCanvas.width;
      const h = targetCanvas.height;
      const ctx = targetCanvas.getContext('2d');

      for (const stroke of hairStrokes) {
        const rad = Math.max(4, Math.round(stroke.radiusNorm * Math.min(w, h)));
        for (let i = 0; i < stroke.points.length; i++) {
          const pt = stroke.points[i];
          const cx = Math.round(pt.x * w);
          const cy = Math.round(pt.y * h);
          const prev = i > 0 ? stroke.points[i - 1] : pt;
          const dx = (pt.x - prev.x) * w;
          const dy = (pt.y - prev.y) * h;

          const x0 = Math.max(1, cx - rad);
          const y0 = Math.max(1, cy - rad);
          const bw = Math.min(w - x0 - 1, rad * 2);
          const bh = Math.min(h - y0 - 1, rad * 2);
          if (bw <= 2 || bh <= 2) continue;

          const imgData = ctx.getImageData(x0, y0, bw, bh);
          const d = imgData.data;
          const copy = new Uint8ClampedArray(d);

          for (let py = 0; py < bh; py++) {
            for (let px = 0; px < bw; px++) {
              const dist = Math.hypot((x0 + px) - cx, (y0 + py) - cy);
              if (dist > rad) continue;
              const falloff = Math.pow(1 - dist / rad, 1.4);
              const idx = (py * bw + px) * 4;

              if (stroke.mode === 'erase_stray') {
                if (copy[idx + 3] > 0) {
                  d[idx + 3] = Math.max(0, Math.round(copy[idx + 3] * (1 - falloff * 0.92)));
                }
              } else if (stroke.mode === 'darken_shine') {
                const lum = 0.299 * copy[idx] + 0.587 * copy[idx + 1] + 0.114 * copy[idx + 2];
                if (lum < 165) {
                  const factor = 1 - falloff * 0.34;
                  d[idx] = Math.max(12, Math.round(copy[idx] * factor));
                  d[idx + 1] = Math.max(10, Math.round(copy[idx + 1] * factor));
                  d[idx + 2] = Math.max(10, Math.round(copy[idx + 2] * factor));
                }
              } else {
                const shiftX = Math.round(dx * 0.38 * falloff);
                const shiftY = Math.round(dy * 0.38 * falloff);
                const sx = Math.min(bw - 1, Math.max(0, px - shiftX));
                const sy = Math.min(bh - 1, Math.max(0, py - shiftY));
                const sIdx = (sy * bw + sx) * 4;

                const nx = Math.min(bw - 1, Math.max(0, sx + (dx >= 0 ? -1 : 1)));
                const ny = Math.min(bh - 1, Math.max(0, sy + (dy >= 0 ? -1 : 1)));
                const nIdx = (ny * bw + nx) * 4;

                const blend = falloff * 0.68;
                for (let ch = 0; ch < 4; ch++) {
                  const smoothed = copy[sIdx + ch] * 0.65 + copy[nIdx + ch] * 0.35;
                  d[idx + ch] = Math.round(copy[idx + ch] * (1 - blend) + smoothed * blend);
                }
              }
            }
          }
          ctx.putImageData(imgData, x0, y0);
        }
      }
      return targetCanvas;
    }

    function buildZoomedSelectionCanvas(srcImg, selNorm, zoomFactor, sharpen) {
      const box = selNorm || { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
      const sx = Math.max(0, Math.min(srcImg.width - 1, Math.round(box.x * srcImg.width)));
      const sy = Math.max(0, Math.min(srcImg.height - 1, Math.round(box.y * srcImg.height)));
      const sw = Math.max(10, Math.min(srcImg.width - sx, Math.round(box.w * srcImg.width)));
      const sh = Math.max(10, Math.min(srcImg.height - sy, Math.round(box.h * srcImg.height)));

      const outW = Math.min(3600, Math.max(120, Math.round(sw * zoomFactor)));
      const outH = Math.min(3600, Math.max(120, Math.round(sh * zoomFactor)));

      const c = document.createElement('canvas');
      c.width = outW;
      c.height = outH;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(srcImg, sx, sy, sw, sh, 0, 0, outW, outH);

      if (sharpen && outW * outH < 2500000) {
        const imgData = ctx.getImageData(0, 0, outW, outH);
        const d = imgData.data;
        const copy = new Uint8ClampedArray(d);
        const amt = 0.35;
        for (let y = 1; y < outH - 1; y++) {
          for (let x = 1; x < outW - 1; x++) {
            const idx = (y * outW + x) * 4;
            for (let ch = 0; ch < 3; ch++) {
              const center = copy[idx + ch] * 5;
              const neighbors = copy[((y - 1) * outW + x) * 4 + ch]
                              + copy[((y + 1) * outW + x) * 4 + ch]
                              + copy[(y * outW + (x - 1)) * 4 + ch]
                              + copy[(y * outW + (x + 1)) * 4 + ch];
              d[idx + ch] = Math.min(255, Math.max(0, Math.round(copy[idx + ch] * (1 - amt) + (center - neighbors) * amt)));
            }
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }
      return c;
    }

    const liveEditCanvas = document.getElementById('liveEditCanvas');
    liveEditCanvas.onmousedown = (e) => {
      const tool = document.getElementById('editToolSelect').value;
      if (!cachedMainImg) return;

      if (tool === 'zoom_area') {
        const pos = getCanvasMousePos(liveEditCanvas, e);
        zoomDragStart = { x: pos.x / liveEditCanvas.width, y: pos.y / liveEditCanvas.height };
        isSelectingZoom = true;
        zoomSelectionNorm = { x: zoomDragStart.x, y: zoomDragStart.y, w: 0.01, h: 0.01 };
        renderLiveEditPreview();
        return;
      }

      if (tool === 'ps_auto_retouch' && document.getElementById('hairBrushToggle').checked) {
        isBrushingHair = true;
        const pos = getCanvasMousePos(liveEditCanvas, e);
        const normPt = { x: pos.x / liveEditCanvas.width, y: pos.y / liveEditCanvas.height };
        const brushPx = parseFloat(document.getElementById('hairBrushSize').value) || 24;
        currentHairStroke = {
          mode: document.getElementById('hairBrushMode').value,
          radiusNorm: brushPx / Math.min(liveEditCanvas.width, liveEditCanvas.height),
          points: [normPt]
        };
        hairStrokes.push(currentHairStroke);
        lastHairPos = pos;
        renderLiveEditPreview();
      }
    };

    liveEditCanvas.onmousemove = (e) => {
      const tool = document.getElementById('editToolSelect').value;
      if (tool === 'zoom_area' && isSelectingZoom && zoomDragStart) {
        const pos = getCanvasMousePos(liveEditCanvas, e);
        const curX = Math.max(0, Math.min(1, pos.x / liveEditCanvas.width));
        const curY = Math.max(0, Math.min(1, pos.y / liveEditCanvas.height));
        zoomSelectionNorm = {
          x: Math.min(zoomDragStart.x, curX),
          y: Math.min(zoomDragStart.y, curY),
          w: Math.max(0.02, Math.abs(curX - zoomDragStart.x)),
          h: Math.max(0.02, Math.abs(curY - zoomDragStart.y))
        };
        renderLiveEditPreview();
        return;
      }

      if (isBrushingHair && currentHairStroke) {
        const pos = getCanvasMousePos(liveEditCanvas, e);
        if (lastHairPos && Math.hypot(pos.x - lastHairPos.x, pos.y - lastHairPos.y) < 3) return;
        currentHairStroke.points.push({ x: pos.x / liveEditCanvas.width, y: pos.y / liveEditCanvas.height });
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

    document.getElementById('zoomResetBoxBtn').onclick = () => {
      zoomSelectionNorm = null;
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
      liveEditCanvas.style.cursor = active ? 'cell' : 'default';
      updatePsBgControls();
    };

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
      const bgStyle = document.getElementById('psBgStyleSelect').value;
      document.getElementById('psBgColorControls').classList.toggle('hidden', !enabled);
      document.getElementById('psCustomColorLbl').classList.toggle('hidden', !(enabled && bgStyle === 'solid_custom'));
      if (hairActive) {
        document.getElementById('livePreviewCaption').textContent = 'Hair Set Brush Active: Drag mouse over top/side hairs to smooth, tuck & neat!';
      } else {
        document.getElementById('livePreviewCaption').textContent = enabled
          ? 'Live Digital Studio Preview (AI Background Removed • Checkerboard = Transparent):'
          : 'Live Digital Studio Preview (Left: Digital Retouched • Right: Original):';
      }
    }

    document.getElementById('psRemoveBgToggle').onchange = () => {
      updatePsBgControls();
      renderLiveEditPreview();
    };
    document.getElementById('psBgStyleSelect').onchange = () => {
      updatePsBgControls();
      renderLiveEditPreview();
    };
    document.getElementById('psBgCustomColor').oninput = renderLiveEditPreview;

    // Digital DSLR Studio Retouch Engine
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

      if (bgStyle === 'studio_gradient') {
        const g = ctx.createRadialGradient(outC.width / 2, outC.height * 0.4, outC.width * 0.05, outC.width / 2, outC.height / 2, Math.max(outC.width, outC.height) * 0.8);
        g.addColorStop(0, '#475569');
        g.addColorStop(1, '#0f172a');
        ctx.fillStyle = g;
      } else if (bgStyle === 'passport_blue') {
        ctx.fillStyle = '#3b82f6';
      } else if (bgStyle === 'studio_slate') {
        ctx.fillStyle = '#334155';
      } else if (bgStyle === 'pure_white') {
        ctx.fillStyle = '#ffffff';
      } else {
        ctx.fillStyle = document.getElementById('psBgCustomColor').value || '#2563eb';
      }
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
      if (!cachedMainImg || !['ps_auto_retouch', 'zoom_area', 'img_contrast', 'add_logo_photo'].includes(tool)) {
        wrap.classList.add('hidden');
        return;
      }
      wrap.classList.remove('hidden');
      const maxDim = 540;
      const sc = Math.min(1, maxDim / Math.max(cachedMainImg.width, cachedMainImg.height));
      const pw = Math.round(cachedMainImg.width * sc);
      const ph = Math.round(cachedMainImg.height * sc);
      liveEditCanvas.width = pw;
      liveEditCanvas.height = ph;
      const lctx = liveEditCanvas.getContext('2d');
      lctx.clearRect(0, 0, pw, ph);

      if (tool === 'zoom_area') {
        liveEditCanvas.style.cursor = 'crosshair';
        document.getElementById('livePreviewCaption').textContent = 'Drag mouse over the area you want to zoom, then click Apply & Download:';
        lctx.drawImage(cachedMainImg, 0, 0, pw, ph);
        if (zoomSelectionNorm) {
          const rx = zoomSelectionNorm.x * pw;
          const ry = zoomSelectionNorm.y * ph;
          const rw = zoomSelectionNorm.w * pw;
          const rh = zoomSelectionNorm.h * ph;
          lctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
          lctx.fillRect(0, 0, pw, ry);
          lctx.fillRect(0, ry + rh, pw, ph - (ry + rh));
          lctx.fillRect(0, ry, rx, rh);
          lctx.fillRect(rx + rw, ry, pw - (rx + rw), rh);
          lctx.strokeStyle = '#10b981';
          lctx.lineWidth = 2.5;
          lctx.strokeRect(rx, ry, rw, rh);
        }
      } else if (tool === 'ps_auto_retouch') {
        liveEditCanvas.style.cursor = document.getElementById('hairBrushToggle').checked ? 'cell' : 'default';
        const removeBg = document.getElementById('psRemoveBgToggle').checked;
        if (removeBg) {
          if (!cachedTransparentCutout) {
            const st = document.getElementById('editStatus');
            st.textContent = 'AI Removing Background for Live Preview...';
            st.classList.remove('hidden');
            cachedTransparentCutout = await runSelfieSegmentation(cachedMainImg, 'transparent');
            st.classList.add('hidden');
          }
          const enhancedSubject = applyPhotoshopDigitalRetouch(cachedTransparentCutout, pw, ph);
          const finalPreview = compositeBackgroundBehindSubject(enhancedSubject);
          lctx.drawImage(finalPreview, 0, 0, pw, ph);
        } else {
          const enhanced = applyPhotoshopDigitalRetouch(cachedMainImg, pw, ph);
          const splitPct = (parseFloat(document.getElementById('psSplitRange').value) ?? 100) / 100;
          const splitX = Math.round(pw * splitPct);
          lctx.drawImage(cachedMainImg, 0, 0, pw, ph);
          if (splitX > 0) {
            lctx.drawImage(enhanced, 0, 0, splitX, ph, 0, 0, splitX, ph);
          }
          if (splitX > 2 && splitX < pw - 2) {
            lctx.strokeStyle = '#ffffff';
            lctx.lineWidth = 2;
            lctx.beginPath(); lctx.moveTo(splitX, 0); lctx.lineTo(splitX, ph); lctx.stroke();
          }
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
      cachedTransparentCutout = null;
      hairStrokes = [];
      zoomSelectionNorm = null;
      if (!f) { cachedMainImg = null; renderLiveEditPreview(); return; }
      cachedMainImg = await loadImg(URL.createObjectURL(f));
      renderLiveEditPreview();
    };

    document.getElementById('logoOverlayFile').onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) { cachedLogoImg = null; renderLiveEditPreview(); return; }
      cachedLogoImg = await loadImg(URL.createObjectURL(f));
      renderLiveEditPreview();
    };

    function bindRangeAndNum(rangeId, numId, onChangeCb) {
      const r = document.getElementById(rangeId), n = document.getElementById(numId);
      r.oninput = () => { n.value = r.value; if (onChangeCb) onChangeCb(); };
      n.oninput = () => { r.value = n.value; if (onChangeCb) onChangeCb(); };
    }
    bindRangeAndNum('psDepthRange', 'psDepthNum', renderLiveEditPreview);
    bindRangeAndNum('psToneRange', 'psToneNum', renderLiveEditPreview);
    bindRangeAndNum('psSmoothRange', 'psSmoothNum', renderLiveEditPreview);
    bindRangeAndNum('psSharpRange', 'psSharpNum', renderLiveEditPreview);
    bindRangeAndNum('cbContrastRange', 'cbContrastNum', renderLiveEditPreview);
    bindRangeAndNum('cbBrightnessRange', 'cbBrightnessNum', renderLiveEditPreview);
    bindRangeAndNum('logoOpacityRange', 'logoOpacityNum', renderLiveEditPreview);
    bindRangeAndNum('logoSizeRange', 'logoSizeNum', renderLiveEditPreview);
    bindRangeAndNum('zoomScaleRange', 'zoomScaleNum', renderLiveEditPreview);
    document.getElementById('zoomSharpToggle').onchange = renderLiveEditPreview;

    document.getElementById('psAutoWb').onchange = renderLiveEditPreview;
    document.getElementById('psSplitRange').oninput = renderLiveEditPreview;
    document.getElementById('logoPosition').onchange = renderLiveEditPreview;
    document.getElementById('logoMargin').oninput = renderLiveEditPreview;
    document.getElementById('logoRemoveWhiteBg').onchange = renderLiveEditPreview;

    document.getElementById('cbResetBtn').onclick = () => {
      document.getElementById('cbContrastRange').value = 100; document.getElementById('cbContrastNum').value = 100;
      document.getElementById('cbBrightnessRange').value = 100; document.getElementById('cbBrightnessNum').value = 100;
      renderLiveEditPreview();
    };

    // 50 Ready-Made Pro Frames
    const PRO_FRAME_NAMES = [
      'Royal Gold', 'Silver Shine', 'Rose Gold', 'Neon Cyan', 'Neon Magenta',
      'Obsidian Pro', 'Ivory Mat', 'Champagne Gold', 'Emerald Luxe', 'Sapphire Pro',
      'Crimson Royal', 'Violet Glow', 'Sunset Amber', 'Mint Studio', 'Polaroid Classic',
      'Polaroid Dark', 'Double Gold', 'Double Navy', 'Triple Frame', 'Corner Gold',
      'Corner Silver', 'Corner Red', 'Corner Blue', 'Corner Emerald', 'Corner Purple',
      'Vintage Parchment', 'Art Deco Gold', 'Minimalist Slate', 'Film Strip', 'Cinema Frame',
      'Wedding Gold', 'Wedding Rose', 'Award Bronze', 'Award Platinum', 'Modern Teal',
      'Coral Border', 'Cobalt Grid', 'Indigo Frame', 'Lime Pop', 'Peach Soft',
      'Steel Metallic', 'Copper Gloss', 'Midnight Gold', 'Ruby Luxe', 'Aqua Frame',
      'Lavender Soft', 'Mustard Bold', 'Charcoal Mat', 'Pearl White', 'Pro Studio Edge'
    ];
    let selectedFrameIndex = 0;

    function drawProFrame(ctx, w, h, idx, thickPct) {
      const t = Math.max(5, Math.round(Math.min(w, h) * (thickPct / 100)));
      const palette = [
        ['#b45309', '#fbbf24', '#fef3c7'], ['#475569', '#cbd5e1', '#f8fafc'],
        ['#9d174d', '#f472b6', '#fce7f3'], ['#0284c7', '#22d3ee', '#cffafe'],
        ['#9333ea', '#e879f9', '#fae8ff'], ['#09090b', '#27272a', '#a1a1aa'],
        ['#d6d3d1', '#fafaf9', '#78716c'], ['#a16207', '#fde047', '#fef9c3'],
        ['#065f46', '#10b981', '#d1fae5'], ['#1e40af', '#3b82f6', '#dbeafe'],
        ['#991b1b', '#ef4444', '#fee2e2'], ['#5b21b6', '#8b5cf6', '#ede9fe'],
        ['#c2410c', '#fb923c', '#ffedd5'], ['#0f766e', '#2dd4bf', '#ccfbf1']
      ];
      const [c1, c2, c3] = palette[idx % palette.length];
      ctx.save();
      const styleType = idx % 5;

      if (styleType === 0) {
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, c1); g.addColorStop(0.5, c2); g.addColorStop(1, c1);
        ctx.strokeStyle = g; ctx.lineWidth = t * 2; ctx.strokeRect(0, 0, w, h);
        ctx.strokeStyle = c3; ctx.lineWidth = Math.max(1.5, t * 0.22);
        ctx.strokeRect(t * 0.75, t * 0.75, w - t * 1.5, h - t * 1.5);
      } else if (styleType === 1) {
        ctx.strokeStyle = c1; ctx.lineWidth = t * 1.9; ctx.strokeRect(0, 0, w, h);
        ctx.strokeStyle = c2; ctx.lineWidth = Math.max(2, t * 0.35);
        ctx.strokeRect(t * 1.1, t * 1.1, w - t * 2.2, h - t * 2.2);
      } else if (styleType === 2) {
        ctx.strokeStyle = c2; ctx.lineWidth = t * 1.3; ctx.strokeRect(0, 0, w, h);
        const cs = t * 2.5;
        ctx.fillStyle = c1;
        [[0, 0], [w - cs, 0], [0, h - cs], [w - cs, h - cs]].forEach(([cx, cy]) => ctx.fillRect(cx, cy, cs, cs));
        ctx.strokeStyle = c3; ctx.lineWidth = 2;
        [[2, 2], [w - cs + 2, 2], [2, h - cs + 2], [w - cs + 2, h - cs + 2]].forEach(([cx, cy]) => ctx.strokeRect(cx, cy, cs - 4, cs - 4));
      } else if (styleType === 3) {
        ctx.strokeStyle = c3; ctx.lineWidth = t * 2.1; ctx.strokeRect(0, 0, w, h);
        ctx.fillStyle = c3; ctx.fillRect(0, h - t * 3.1, w, t * 3.1);
        ctx.strokeStyle = c1; ctx.lineWidth = 2; ctx.strokeRect(2, 2, w - 4, h - 4);
      } else {
        ctx.strokeStyle = c1; ctx.lineWidth = t * 1.5; ctx.strokeRect(t * 0.4, t * 0.4, w - t * 0.8, h - t * 0.8);
        ctx.setLineDash([t * 1.2, t * 0.6]);
        ctx.strokeStyle = c2; ctx.lineWidth = Math.max(2, t * 0.35);
        ctx.strokeRect(t * 1.2, t * 1.2, w - t * 2.4, h - t * 2.4);
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    function init50FrameGallery() {
      const gal = document.getElementById('frameGallery');
      gal.innerHTML = '';
      PRO_FRAME_NAMES.forEach((name, idx) => {
        const item = document.createElement('div');
        item.className = 'frame-thumb' + (idx === selectedFrameIndex ? ' selected' : '');
        const c = document.createElement('canvas'); c.width = 58; c.height = 68;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#e2e8f0'; ctx.fillRect(8, 10, 42, 48);
        drawProFrame(ctx, 58, 68, idx, 9);
        const lbl = document.createElement('span');
        lbl.textContent = `${String(idx + 1).padStart(2, '0')}. ${name}`;
        lbl.title = `${String(idx + 1).padStart(2, '0')}. ${name}`;
        item.appendChild(c); item.appendChild(lbl);
        item.onclick = () => {
          selectedFrameIndex = idx;
          document.getElementById('customFrameFile').value = '';
          document.querySelectorAll('.frame-thumb').forEach(el => el.classList.remove('selected'));
          item.classList.add('selected');
          document.getElementById('selectedFrameBadge').textContent = `Selected: ${String(idx + 1).padStart(2, '0')}. ${name}`;
        };
        gal.appendChild(item);
      });
    }
    init50FrameGallery();

    function updateEditToolUI() {
      const v = document.getElementById('editToolSelect').value;
      document.getElementById('sigPadWrap').classList.toggle('hidden', v !== 'sig_maker');
      document.getElementById('hwTextWrap').classList.toggle('hidden', v !== 'text_handwriting');
      document.getElementById('edImgFileLbl').classList.toggle('hidden', ['sig_maker', 'text_handwriting', 'latex_img'].includes(v));
      document.getElementById('psRetouchWrap').classList.toggle('hidden', v !== 'ps_auto_retouch');
      document.getElementById('zoomAreaWrap').classList.toggle('hidden', v !== 'zoom_area');
      document.getElementById('ndOptionsWrap').classList.toggle('hidden', v !== 'name_date');
      document.getElementById('logoOptionsWrap').classList.toggle('hidden', v !== 'add_logo_photo');
      document.getElementById('frameOptionsWrap').classList.toggle('hidden', v !== 'photo_frame');
      document.getElementById('cbControlsWrap').classList.toggle('hidden', v !== 'img_contrast');
      document.getElementById('edText1Lbl').classList.toggle('hidden', !['name_date', 'add_text_img', 'watermark_img', 'text_handwriting', 'latex_img'].includes(v));
      document.getElementById('edText2Lbl').classList.toggle('hidden', v !== 'name_date');
      document.getElementById('edFontLbl').classList.toggle('hidden', !['name_date', 'add_text_img', 'watermark_img', 'text_handwriting', 'latex_img'].includes(v));
      document.getElementById('edBoldLbl').classList.toggle('hidden', !['name_date', 'add_text_img', 'watermark_img', 'text_handwriting', 'latex_img'].includes(v));
      document.getElementById('edColorLbl').classList.toggle('hidden', !['name_date', 'add_border', 'add_text_img', 'watermark_img', 'text_handwriting', 'latex_img'].includes(v));
      document.getElementById('edNumWrap').classList.toggle('hidden', !['add_border', 'blur_image', 'rotate', 'blur_bg'].includes(v));
      if (v === 'name_date' && document.getElementById('editColor').value === '#1e293b') {
        document.getElementById('editColor').value = '#ffffff';
      }
      updatePsBgControls();
      renderLiveEditPreview();
    }
    document.getElementById('editToolSelect').onchange = updateEditToolUI;
    updateEditToolUI();

    document.getElementById('editRunBtn').onclick = async () => {
      const tool = document.getElementById('editToolSelect').value;
      const out = document.getElementById('editOutput');
      const status = document.getElementById('editStatus');
      out.innerHTML = ''; status.classList.add('hidden');
      const files = Array.from(document.getElementById('editFiles').files);
      const fontScript = getFontScript(document.getElementById('editFontFamily'));
      const rawT1 = document.getElementById('editText1').value;
      const rawT2 = document.getElementById('editText2').value;
      const t1 = transliterateIndicText(rawT1, fontScript);
      const t2 = transliterateIndicText(rawT2, fontScript);
      const n1 = parseFloat(document.getElementById('editNum1').value) || 10;
      const col = document.getElementById('editColor').value;
      const chosenFont = document.getElementById('editFontFamily').value;
      const isBold = document.getElementById('editBoldToggle').checked;

      if (tool === 'sig_maker') {
        addDownloadCard(out, await toBlob(sigCanvas, 'image/png', 1), 'signature.png', 'Digital Signature PNG');
        return;
      }

      if (tool === 'text_handwriting') {
        const rawText = document.getElementById('hwLongText').value || rawT1 || 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ • नमस्ते • Hello';
        const text = transliterateIndicText(rawText, fontScript);
        const c = document.createElement('canvas'); c.width = 900; c.height = 1200;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fffdf7'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1;
        for (let y = 110; y < 1150; y += 38) { ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(840, y); ctx.stroke(); }
        ctx.strokeStyle = '#f87171'; ctx.beginPath(); ctx.moveTo(110, 0); ctx.lineTo(110, 1200); ctx.stroke();
        ctx.fillStyle = col; ctx.font = buildCanvasFontStr(isBold, 26, chosenFont);
        const words = text.split(/\s+/);
        let line = '', y = 104;
        for (const w of words) {
          const test = line + w + ' ';
          if (ctx.measureText(test).width > 700) { ctx.fillText(line, 125, y); line = w + ' '; y += 38; }
          else line = test;
        }
        ctx.fillText(line, 125, y);
        addDownloadCard(out, await toBlob(c, 'image/jpeg', 0.95), 'handwriting_page.jpg', 'Handwriting Page Created');
        return;
      }

      if (tool === 'latex_img') {
        const expr = rawT1 ? t1 : 'E = mc²  |  x = (-b ± √(b² - 4ac)) / 2a';
        const c = document.createElement('canvas'); c.width = 900; c.height = 240;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.fillStyle = col; ctx.font = buildCanvasFontStr(isBold, 34, chosenFont);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(expr, c.width / 2, c.height / 2);
        addDownloadCard(out, await toBlob(c, 'image/png', 1), 'formula_image.png', 'Formula / LaTeX Image');
        return;
      }

      if (!files.length) return alert('Please select image file(s).');
      const imgs = await Promise.all(files.map(f => loadImg(URL.createObjectURL(f))));

      if (tool === 'join_images' || tool === 'merge_photo_sig') {
        const c = document.createElement('canvas');
        if (tool === 'merge_photo_sig') {
          c.width = Math.max(...imgs.map(i => i.width)); c.height = imgs.reduce((acc, i) => acc + i.height, 0);
        } else {
          c.width = imgs.reduce((acc, i) => acc + i.width, 0); c.height = Math.max(...imgs.map(i => i.height));
        }
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        let pos = 0;
        for (const im of imgs) {
          if (tool === 'merge_photo_sig') { ctx.drawImage(im, 0, pos); pos += im.height; }
          else { ctx.drawImage(im, pos, 0); pos += im.width; }
        }
        addDownloadCard(out, await toBlob(c, 'image/jpeg', 0.94), `${tool}.jpg`, `${c.width}×${c.height}px`);
        return;
      }

      const im = imgs[0];

      if (tool === 'zoom_area') {
        const zoomFactor = parseFloat(document.getElementById('zoomScaleNum').value) || 2.5;
        const sharpen = document.getElementById('zoomSharpToggle').checked;
        const zoomedC = buildZoomedSelectionCanvas(im, zoomSelectionNorm, zoomFactor, sharpen);
        addDownloadCard(out, await toBlob(zoomedC, 'image/jpeg', 0.97), `zoomed_${zoomFactor}x_${files[0].name.replace(/\.[^/.]+$/, '')}.jpg`, `Zoomed ${zoomFactor}x (${zoomedC.width}×${zoomedC.height}px)`);
        return;
      }

      if (tool === 'ps_auto_retouch') {
        const removeBg = document.getElementById('psRemoveBgToggle').checked;
        const bgStyle = document.getElementById('psBgStyleSelect').value;
        status.textContent = removeBg
          ? 'Removing Background & Applying Digital Studio Retouch...'
          : 'Applying Photoshop Digital Studio Look...';
        status.classList.remove('hidden');

        if (removeBg) {
          const cutout = cachedTransparentCutout || await runSelfieSegmentation(im, 'transparent');
          cachedTransparentCutout = cutout;
          const enhancedSubject = applyPhotoshopDigitalRetouch(cutout, im.width, im.height);
          const finalCanvas = compositeBackgroundBehindSubject(enhancedSubject);
          status.classList.add('hidden');

          if (bgStyle === 'transparent') {
            addDownloadCard(out, await toBlob(finalCanvas, 'image/png', 1.0), `digital_nobg_${files[0].name.replace(/\.[^/.]+$/, '')}.png`, `Transparent PNG • No Background (${im.width}×${im.height}px)`);
          } else {
            addDownloadCard(out, await toBlob(finalCanvas, 'image/jpeg', 0.97), `digital_studio_${files[0].name.replace(/\.[^/.]+$/, '')}.jpg`, `Digital Studio + Custom BG (${im.width}×${im.height}px)`);
          }
        } else {
          const retouchedCanvas = applyPhotoshopDigitalRetouch(im, im.width, im.height);
          status.classList.add('hidden');
          addDownloadCard(out, await toBlob(retouchedCanvas, 'image/jpeg', 0.97), `ps_digital_${files[0].name.replace(/\.[^/.]+$/, '')}.jpg`, `Digital Studio Retouched (${im.width}×${im.height}px)`);
        }
        return;
      }

      if (tool === 'blur_bg') {
        status.textContent = 'Applying AI Portrait Background Blur...'; status.classList.remove('hidden');
        const blurred = await runSelfieSegmentation(im, 'blur_bg', Math.max(4, n1));
        status.classList.add('hidden');
        addDownloadCard(out, await toBlob(blurred, 'image/jpeg', 0.94), 'blur_background.jpg', 'Background Blurred');
        return;
      }

      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      const rad = (n1 * Math.PI) / 180;
      if (tool === 'rotate') {
        c.width = Math.abs(im.width * Math.cos(rad)) + Math.abs(im.height * Math.sin(rad));
        c.height = Math.abs(im.width * Math.sin(rad)) + Math.abs(im.height * Math.cos(rad));
        ctx.translate(c.width / 2, c.height / 2); ctx.rotate(rad); ctx.drawImage(im, -im.width / 2, -im.height / 2);
      } else {
        c.width = im.width; c.height = im.height;
        if (tool === 'flip') { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
        if (tool === 'blur_image') ctx.filter = `blur(${Math.max(1, n1)}px)`;
        if (tool === 'img_contrast') {
          const cVal = Math.max(10, parseFloat(document.getElementById('cbContrastNum').value) || 100);
          const bVal = Math.max(10, parseFloat(document.getElementById('cbBrightnessNum').value) || 100);
          ctx.filter = `contrast(${cVal}%) brightness(${bVal}%)`;
        }
        ctx.drawImage(im, 0, 0, c.width, c.height);
        ctx.filter = 'none';

        if (tool === 'add_logo_photo') {
          const logoF = document.getElementById('logoOverlayFile').files[0];
          if (!logoF && !cachedLogoImg) return alert('Please upload a Logo image first.');
          const logoImg = cachedLogoImg || await loadImg(URL.createObjectURL(logoF));
          drawLogoOverlayOnCanvas(ctx, c.width, c.height, logoImg);
        }

        if (tool === 'add_border') {
          ctx.strokeStyle = col;
          ctx.lineWidth = Math.max(4, n1 || 12);
          ctx.strokeRect(0, 0, c.width, c.height);
        }

        if (tool === 'photo_frame') {
          const customF = document.getElementById('customFrameFile').files[0];
          const thickPct = parseFloat(document.getElementById('frameThickness').value) || 6;
          if (customF) {
            const frameImg = await loadImg(URL.createObjectURL(customF));
            ctx.drawImage(frameImg, 0, 0, c.width, c.height);
          } else {
            drawProFrame(ctx, c.width, c.height, selectedFrameIndex, thickPct);
          }
        }

        if (tool === 'name_date') {
          const styleMode = document.getElementById('ndBgStyle').value;
          const posMode = document.getElementById('ndPosition').value;
          const orient = document.getElementById('ndOrientation').value;
          const sizePct = parseFloat(document.getElementById('ndFontSizePct').value) || 5;
          const labelStr = `${t1 || 'Name'}${t2 ? '  |  ' + t2 : ''}`;
          const fs = Math.max(16, Math.round(Math.min(c.width, c.height) * (sizePct / 100)));

          ctx.save();
          ctx.font = buildCanvasFontStr(isBold, fs, chosenFont);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const pad = Math.round(fs * 0.85);
          let cx = c.width / 2, cy = c.height - pad * 1.4;
          if (posMode === 'top') { cx = c.width / 2; cy = pad * 1.4; }
          else if (posMode === 'center') { cx = c.width / 2; cy = c.height / 2; }
          else if (posMode === 'left') { cx = pad * 1.5; cy = c.height / 2; }
          else if (posMode === 'right') { cx = c.width - pad * 1.5; cy = c.height / 2; }

          if (styleMode === 'white_strip') {
            const bh = Math.round(fs * 2.1);
            ctx.fillStyle = '#ffffff';
            if (posMode === 'top') ctx.fillRect(0, 0, c.width, bh);
            else if (posMode === 'left') ctx.fillRect(0, 0, bh, c.height);
            else if (posMode === 'right') ctx.fillRect(c.width - bh, 0, bh, c.height);
            else ctx.fillRect(0, c.height - bh, c.width, bh);
          } else if (styleMode === 'transparent_glass') {
            const bh = Math.round(fs * 2.0);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
            if (posMode === 'top') ctx.fillRect(0, 0, c.width, bh);
            else if (posMode === 'center') ctx.fillRect(0, c.height / 2 - bh / 2, c.width, bh);
            else if (posMode === 'left') ctx.fillRect(0, 0, bh, c.height);
            else if (posMode === 'right') ctx.fillRect(c.width - bh, 0, bh, c.height);
            else ctx.fillRect(0, c.height - bh, c.width, bh);
          }

          ctx.translate(cx, cy);
          if (orient === 'vertical') ctx.rotate(-Math.PI / 2);

          if (styleMode === 'transparent_outline') {
            ctx.lineJoin = 'round';
            ctx.lineWidth = Math.max(3, Math.round(fs * 0.16));
            ctx.strokeStyle = (col.toLowerCase() === '#000000') ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.88)';
            ctx.strokeText(labelStr, 0, 0);
          }
          ctx.fillStyle = col;
          ctx.fillText(labelStr, 0, 0);
          ctx.restore();
        }

        if (tool === 'add_text_img') {
          const fs = Math.max(24, Math.round(c.width * 0.05));
          ctx.fillStyle = col;
          ctx.font = buildCanvasFontStr(isBold, fs, chosenFont);
          ctx.textAlign = 'center';
          ctx.fillText(t1 || 'Sample Text', c.width / 2, c.height * 0.88);
        }
        if (tool === 'watermark_img') {
          ctx.save(); ctx.translate(c.width / 2, c.height / 2); ctx.rotate(-Math.PI / 6);
          ctx.fillStyle = col; ctx.globalAlpha = 0.35;
          ctx.font = buildCanvasFontStr(isBold, Math.max(28, Math.round(c.width * 0.06)), chosenFont);
          ctx.textAlign = 'center';
          ctx.fillText(t1 || 'WATERMARK', 0, 0); ctx.restore();
        }
      }
      addDownloadCard(out, await toBlob(c, 'image/jpeg', 0.94), `${tool}_result.jpg`, 'Processed Image');
    };
