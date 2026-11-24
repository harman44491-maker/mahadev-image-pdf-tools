// ================= 3. WATERMARK REMOVER =================
    const wmFile = document.getElementById('wmFile');
    const wmCanvas = document.getElementById('wmCanvas');
    const wmCtx = wmCanvas.getContext('2d');
    let wmPreviewImg = null, wmDrag = false, wmStartX = 0, wmStartY = 0, wmBox = null;
    let wmPdfDoc = null, wmPageCount = 1;

    function setWmDocPreset(val) {
      document.getElementById('wmMode').value = 'doc_clean';
      document.getElementById('wmThreshold').value = val;
    }
    document.getElementById('wmMode').onchange = (e) => {
      document.getElementById('wmThreshold').value = e.target.value === 'doc_clean' ? 135 : 45;
    };
    wmFile.onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      wmBox = null;
      wmPdfDoc = null;
      wmPageCount = 1;
      document.getElementById('wmPreviewWrap').classList.remove('hidden');
      if (f.type === 'application/pdf') {
        document.getElementById('wmMode').value = 'doc_clean';
        document.getElementById('wmThreshold').value = 135;
        wmPdfDoc = await openPdfWithPasswordSupport(await f.arrayBuffer());
        wmPageCount = wmPdfDoc.numPages;
        const page = await wmPdfDoc.getPage(1);
        const vp = page.getViewport({ scale: 1.2 });
        const tmp = document.createElement('canvas'); tmp.width = vp.width; tmp.height = vp.height;
        await page.render({ canvasContext: tmp.getContext('2d'), viewport: vp }).promise;
        wmPreviewImg = await loadImg(tmp.toDataURL('image/png'));
      } else {
        wmPreviewImg = await loadImg(URL.createObjectURL(f));
      }
      const scale = Math.min(1, 560 / wmPreviewImg.width);
      wmCanvas.width = Math.round(wmPreviewImg.width * scale);
      wmCanvas.height = Math.round(wmPreviewImg.height * scale);
      drawWmPreview();
    };
    function getCanvasMousePos(canvas, evt) {
      const rect = canvas.getBoundingClientRect();
      return { x: (evt.clientX - rect.left) * (canvas.width / rect.width), y: (evt.clientY - rect.top) * (canvas.height / rect.height) };
    }
    function drawWmPreview() {
      if (!wmPreviewImg) return;
      wmCtx.clearRect(0, 0, wmCanvas.width, wmCanvas.height);
      wmCtx.drawImage(wmPreviewImg, 0, 0, wmCanvas.width, wmCanvas.height);
      if (wmBox && wmBox.w > 4 && wmBox.h > 4) {
        wmCtx.strokeStyle = '#ef4444'; wmCtx.lineWidth = 2; wmCtx.strokeRect(wmBox.x, wmBox.y, wmBox.w, wmBox.h);
        wmCtx.fillStyle = 'rgba(239, 68, 68, 0.25)'; wmCtx.fillRect(wmBox.x, wmBox.y, wmBox.w, wmBox.h);
      }
    }
    wmCanvas.onmousedown = e => { const pos = getCanvasMousePos(wmCanvas, e); wmStartX = pos.x; wmStartY = pos.y; wmDrag = true; };
    wmCanvas.onmousemove = e => {
      if (!wmDrag) return;
      const pos = getCanvasMousePos(wmCanvas, e);
      wmBox = { x: Math.min(wmStartX, pos.x), y: Math.min(wmStartY, pos.y), w: Math.abs(pos.x - wmStartX), h: Math.abs(pos.y - wmStartY) };
      drawWmPreview();
    };
    window.addEventListener('mouseup', () => wmDrag = false);
    document.getElementById('wmClearBoxBtn').onclick = () => { wmBox = null; drawWmPreview(); };

    // Remove a pale translucent pink/red overlay by estimating its alpha,
    // while reconstructing each original RGB channel independently.
    // Strongly coloured artwork/logos are deliberately left untouched.
    function unblendPaleRedWatermark(r, g, b) {
      // Estimate and remove a pale red/pink translucent overlay while retaining
      // the underlying neutral paper/text tone. This works on white paper and
      // also at watermark intersections with dark grayscale text.
      const overlay = { r: 248, g: 150, b: 160 };
      const rg = r - g;
      if (rg < 2 || rg > 96 || g < 70 || b < g - 10 || b > g + 42) return null;

      // For neutral source pixels, the watermark's RGB difference is
      // alpha * (overlay channel difference). Least-squares alpha estimate.
      const dr = overlay.r - overlay.g; // 98
      const db = overlay.b - overlay.g; // 10
      const observedB = b - g;
      const alpha = (rg * dr + observedB * db) / (dr * dr + db * db);
      if (!Number.isFinite(alpha) || alpha < 0.012 || alpha > 0.84) return null;

      const inv = 1 - alpha;
      const base = (g - overlay.g * alpha) / inv;
      if (!Number.isFinite(base) || base < -8 || base > 263) return null;

      // Reject pixels whose blue/red chroma does not match this pale overlay;
      // this protects coloured text, seals, logos and diagrams.
      const predictedB = base + alpha * (overlay.b - base);
      if (Math.abs(predictedB - b) > 15) return null;
      const predictedR = base + alpha * (overlay.r - base);
      if (Math.abs(predictedR - r) > 18) return null;

      const clean = Math.max(0, Math.min(255, Math.round(base)));
      return [clean, clean, clean];
    }

    function cleanDocumentCanvas(ctx, w, h, cutoff, sharpenText, region) {
      const imgData = ctx.getImageData(0, 0, w, h), d = imgData.data;
      const x0 = region ? Math.max(0, Math.floor(region.x)) : 0;
      const y0 = region ? Math.max(0, Math.floor(region.y)) : 0;
      const x1 = region ? Math.min(w - 1, Math.ceil(region.x + region.w)) : w - 1;
      const y1 = region ? Math.min(h - 1, Math.ceil(region.y + region.h)) : h - 1;
      const lumBuf = new Float32Array(w * h);
      const integral = new Float64Array((w + 1) * (h + 1));
      for (let y = 0; y < h; y++) {
        let rowSum = 0;
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          lumBuf[y * w + x] = lum;
          rowSum += lum;
          integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + rowSum;
        }
      }
      const radius = 14;
      const contrastDelta = Math.max(12, Math.round((220 - cutoff) * 0.45));
      for (let y = y0; y <= y1; y++) {
        const ya = Math.max(0, y - radius), yb = Math.min(h - 1, y + radius);
        for (let x = x0; x <= x1; x++) {
          const xa = Math.max(0, x - radius), xb = Math.min(w - 1, x + radius);
          const area = (xb - xa + 1) * (yb - ya + 1);
          const sum = integral[(yb + 1) * (w + 1) + xb + 1] - integral[ya * (w + 1) + xb + 1]
            - integral[(yb + 1) * (w + 1) + xa] + integral[ya * (w + 1) + xa];
          const localMean = sum / area, idx = (y * w + x) * 4;
          let r = d[idx], g = d[idx + 1], b = d[idx + 2];

          const unblended = unblendPaleRedWatermark(r, g, b);
          if (unblended) {
            [r, g, b] = unblended;
            d[idx] = r; d[idx + 1] = g; d[idx + 2] = b;
          }

          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const saturation = Math.max(r, g, b) - Math.min(r, g, b);

          // Keep genuine coloured logos, seals, diagrams and highlights intact.
          if (saturation > 24) continue;

          // Preserve dark strokes and fine text tones; only clean the light paper.
          if (lum < 115 || lum < localMean - contrastDelta) {
            if (sharpenText && lum < 175) {
              const ink = Math.max(0, Math.min(255, Math.round((lum / Math.max(1, localMean)) * 105)));
              d[idx] = Math.min(r, ink);
              d[idx + 1] = Math.min(g, ink);
              d[idx + 2] = Math.min(b, ink);
            }
          } else if (lum > 170 || lum >= localMean - contrastDelta) {
            d[idx] = 255; d[idx + 1] = 255; d[idx + 2] = 255;
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    function organicPatchErase(ctx, w, h, bx, by, bw, bh) {
      const imgData = ctx.getImageData(0, 0, w, h); const d = imgData.data, orig = new Uint8ClampedArray(d);
      const x0 = Math.max(2, bx), y0 = Math.max(2, by), x1 = Math.min(w - 3, bx + bw), y1 = Math.min(h - 3, by + bh);
      const boxW = Math.max(1, x1 - x0), boxH = Math.max(1, y1 - y0);
      const feather = Math.min(5, Math.floor(Math.min(boxW, boxH) * 0.18));
      const hash = (a, b) => Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
      for (let y = y0; y <= y1; y++) {
        const ty = (y - y0) / boxH;
        for (let x = x0; x <= x1; x++) {
          const jitterX = Math.round((hash(x, y) - Math.floor(hash(x, y)) - 0.5) * 6);
          const jitterY = Math.round((hash(y, x) - Math.floor(hash(y, x)) - 0.5) * 8);
          const sampleX = Math.min(w - 1, Math.max(0, x + jitterX));
          const topY = Math.max(0, Math.min(h - 1, y0 - 3 - Math.abs(jitterY)));
          const botY = Math.max(0, Math.min(h - 1, y1 + 3 + Math.abs(jitterY)));
          const topIdx = (topY * w + sampleX) * 4, botIdx = (botY * w + sampleX) * 4, dstIdx = (y * w + x) * 4;
          const distEdge = Math.min(x - x0, x1 - x, y - y0, y1 - y);
          const alpha = feather > 0 ? Math.min(1, (distEdge + 1) / feather) : 1;
          for (let ch = 0; ch < 3; ch++) {
            const vMix = orig[topIdx + ch] * (1 - ty) + orig[botIdx + ch] * ty;
            d[dstIdx + ch] = Math.round(orig[dstIdx + ch] * (1 - alpha) + vMix * alpha);
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    function deblendPhotoWatermark(ctx, w, h, strength, region) {
      // Always sample from the original frame; never blur or repeatedly blend
      // already modified pixels (that caused ghosting and soft text).
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data, src = new Uint8ClampedArray(d);
      const x0 = region ? Math.max(2, Math.floor(region.x)) : 2;
      const y0 = region ? Math.max(2, Math.floor(region.y)) : Math.floor(h * 0.10);
      const x1 = region ? Math.min(w - 3, Math.ceil(region.x + region.w)) : w - 3;
      const y1 = region ? Math.min(h - 3, Math.ceil(region.y + region.h)) : h - 3;
      const strengthFactor = Math.max(0.35, Math.min(0.78, (Number(strength) || 55) / 72));

      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const idx = (y * w + x) * 4;
          const r = src[idx], g = src[idx + 1], b = src[idx + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          // Stronger, channel-preserving removal for pale pink/red translucent marks.
          const unblended = unblendPaleRedWatermark(r, g, b);
          if (unblended) {
            d[idx] = unblended[0];
            d[idx + 1] = unblended[1];
            d[idx + 2] = unblended[2];
            continue;
          }

          // Neutral / pale-grey watermark cleanup. Sample a wider ring around
          // the pixel so broad, low-contrast watermark strokes are estimated
          // from the clean paper rather than only softened by 2-pixel neighbors.
          const saturation = Math.max(r, g, b) - Math.min(r, g, b);
          if (lum < 190 || saturation > 34) continue;

          const sampleLums = [];
          const sampleRGB = [];
          const offsets = [
            [0, -10], [0, 10], [-10, 0], [10, 0],
            [-20, -20], [20, -20], [-20, 20], [20, 20],
            [0, -32], [0, 32], [-32, 0], [32, 0]
          ];
          for (const [ox, oy] of offsets) {
            const sx = Math.max(0, Math.min(w - 1, x + ox));
            const sy = Math.max(0, Math.min(h - 1, y + oy));
            const si = (sy * w + sx) * 4;
            const sr = src[si], sg = src[si + 1], sb = src[si + 2];
            sampleLums.push(0.299 * sr + 0.587 * sg + 0.114 * sb);
            sampleRGB.push([sr, sg, sb]);
          }
          const orderedSamples = sampleRGB.map((rgb, i) => ({
            rgb,
            lum: sampleLums[i]
          })).sort((a, b) => a.lum - b.lum);
          const paperEstimate = (orderedSamples[5].lum + orderedSamples[6].lum + orderedSamples[7].lum) / 3;
          const delta = paperEstimate - lum;

          // Only lift pixels when most of the wider surrounding ring is
          // substantially brighter; dark text and ordinary paper texture stay.
          if (paperEstimate >= 226 && delta >= 7) {
            const amount = Math.min(0.98, Math.max(0.62, strengthFactor + 0.28) * Math.min(1, delta / 28));
            const brightSamples = orderedSamples.filter(v => v.lum >= 220).map(v => v.rgb);
            const bg = [0, 1, 2].map(ch => {
              const values = brightSamples.map(v => v[ch]).sort((a, b) => a - b);
              return values.length ? values[Math.floor(values.length / 2)] : paperEstimate;
            });
            for (let ch = 0; ch < 3; ch++) {
              d[idx + ch] = Math.max(0, Math.min(255, Math.round(src[idx + ch] * (1 - amount) + bg[ch] * amount)));
            }
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    function trimWhitePadding(canvas) {
      const w = canvas.width, h = canvas.height, d = canvas.getContext('2d').getImageData(0, 0, w, h).data;
      let minX = w, minY = h, maxX = 0, maxY = 0, found = false;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          if (d[i] < 248 || d[i + 1] < 248 || d[i + 2] < 248) {
            if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; found = true;
          }
        }
      }
      if (!found || maxX <= minX || maxY <= minY) return canvas;
      const cw = maxX - minX + 1, ch = maxY - minY + 1;
      const out = document.createElement('canvas'); out.width = cw; out.height = ch;
      out.getContext('2d').drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
      return out;
    }

    function cleanCanvasWatermark(sourceCanvas, mode, strength, normBox, autoTrim, sharpenText) {
      const w = sourceCanvas.width, h = sourceCanvas.height;
      let c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d'); ctx.drawImage(sourceCanvas, 0, 0);
      const boxPx = normBox ? { x: Math.round(normBox.x * w), y: Math.round(normBox.y * h), w: Math.round(normBox.w * w), h: Math.round(normBox.h * h) } : null;
      if (mode === 'doc_clean') cleanDocumentCanvas(ctx, w, h, strength, sharpenText, boxPx);
      else if (mode === 'photo_deblend') deblendPhotoWatermark(ctx, w, h, strength, boxPx);
      else if (mode === 'texture_clone' && boxPx) organicPatchErase(ctx, w, h, boxPx.x, boxPx.y, boxPx.w, boxPx.h);
      if (autoTrim) c = trimWhitePadding(c);
      return c;
    }

    document.getElementById('wmRunBtn').onclick = async () => {
      const f = wmFile.files[0], out = document.getElementById('wmOutput'), status = document.getElementById('wmStatus');
      out.innerHTML = '';
      if (!f) return alert('Please select an Image or PDF first.');
      if (f.type !== 'application/pdf' && !f.type.startsWith('image/')) return alert('Please select a supported image or PDF file.');
      const mode = document.getElementById('wmMode').value;
      const strength = parseInt(document.getElementById('wmThreshold').value) || 135;
      const autoTrim = document.getElementById('wmAutoTrim').checked;
      const sharpenText = document.getElementById('wmDarkText').checked;
      const normBox = (wmBox && wmBox.w > 4 && wmBox.h > 4) ? { x: wmBox.x / wmCanvas.width, y: wmBox.y / wmCanvas.height, w: wmBox.w / wmCanvas.width, h: wmBox.h / wmCanvas.height } : null;
      if (mode === 'texture_clone' && !normBox) return alert('Please drag your mouse over the watermark area on the preview image first.');
      if (f.type === 'application/pdf' && !wmPdfDoc) {
        wmPdfDoc = await openPdfWithPasswordSupport(await f.arrayBuffer());
        wmPageCount = wmPdfDoc.numPages;
      }
      const charge = await window.DOCX?.auth?.consume('watermark', wmPageCount);
      if (!charge) return;
      status.textContent = `Cleaning ${wmPageCount} page${wmPageCount === 1 ? '' : 's'}... please wait.`; status.classList.remove('hidden');

      try {
        if (f.type === 'application/pdf') {
          const outPdf = await PDFLib.PDFDocument.create();
          for (let pNum = 1; pNum <= wmPdfDoc.numPages; pNum++) {
            const page = await wmPdfDoc.getPage(pNum), vp = page.getViewport({ scale: 2.1 });
            const rawC = document.createElement('canvas'); rawC.width = vp.width; rawC.height = vp.height;
            await page.render({ canvasContext: rawC.getContext('2d'), viewport: vp }).promise;
            const cleanC = cleanCanvasWatermark(rawC, mode, strength, normBox, false, sharpenText);
            const jpgBytes = await (await toBlob(cleanC, 'image/jpeg', 0.92)).arrayBuffer();
            const emb = await outPdf.embedJpg(jpgBytes);
            const np = outPdf.addPage([emb.width, emb.height]);
            np.drawImage(emb, { x: 0, y: 0, width: emb.width, height: emb.height });
          }
          const bytes = await outPdf.save();
          addDownloadCard(out, new Blob([bytes], { type: 'application/pdf' }), `clean_${f.name}`, `Watermark Cleaned (${(bytes.length / 1024).toFixed(1)} KB)`);
        } else {
          const im = await loadImg(URL.createObjectURL(f));
          const rawC = document.createElement('canvas'); rawC.width = im.width; rawC.height = im.height;
          rawC.getContext('2d').drawImage(im, 0, 0);
          const cleanC = cleanCanvasWatermark(rawC, mode, strength, normBox, autoTrim, sharpenText);
          addDownloadCard(out, await toBlob(cleanC, 'image/jpeg', 0.95), `clean_${f.name.replace(/\.[^/.]+$/, '')}.jpg`, `Watermark Cleaned (${cleanC.width}×${cleanC.height}px)`);
        }
        status.classList.add('hidden');
      } catch (error) {
        try {
          await window.DOCX.auth.refund(charge.operation_id);
          status.textContent = `Watermark removal failed; ₹${charge.charged_paise / 100} credit has been returned. ${error.message || ''}`;
        } catch (refundError) {
          status.textContent = `Watermark removal failed (${error.message || 'unknown error'}) and the credit return could not be confirmed (${refundError.message}). Contact support with this operation.`;
        }
        status.classList.remove('hidden');
      }
    };
