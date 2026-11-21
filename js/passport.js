// ================= 2. PASSPORT SIZE PHOTO & AI SEGMENTATION =================
    function applyStudioRetouchAndSharpen(sourceCanvas, targetW, targetH) {
      const hdW = targetW * 2, hdH = targetH * 2;
      const c = document.createElement('canvas'); c.width = hdW; c.height = hdH;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.filter = 'brightness(1.03) contrast(1.10) saturate(1.08)';
      const scale = Math.max(hdW / sourceCanvas.width, hdH / sourceCanvas.height);
      const dw = sourceCanvas.width * scale, dh = sourceCanvas.height * scale;
      ctx.drawImage(sourceCanvas, (hdW - dw) / 2, (hdH - dh) / 2, dw, dh);
      ctx.filter = 'none';

      const imgData = ctx.getImageData(0, 0, hdW, hdH);
      const d = imgData.data;
      const copy = new Uint8ClampedArray(d);
      const amount = 0.38;
      for (let y = 1; y < hdH - 1; y++) {
        for (let x = 1; x < hdW - 1; x++) {
          const idx = (y * hdW + x) * 4;
          for (let ch = 0; ch < 3; ch++) {
            const center = copy[idx + ch] * 5;
            const neighbors = copy[((y - 1) * hdW + x) * 4 + ch] + copy[((y + 1) * hdW + x) * 4 + ch] + copy[(y * hdW + (x - 1)) * 4 + ch] + copy[(y * hdW + (x + 1)) * 4 + ch];
            d[idx + ch] = Math.min(255, Math.max(0, copy[idx + ch] * (1 - amount) + (center - neighbors) * amount));
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
      return c;
    }

    document.getElementById('ppGenerateBtn').onclick = async () => {
      const file = document.getElementById('ppFile').files[0];
      const out = document.getElementById('ppOutput');
      const status = document.getElementById('ppStatus');
      out.innerHTML = '';
      if (!file) return alert('Please select a photo first.');
      status.textContent = 'Processing AI White Background & Studio HD Retouch...';
      status.classList.remove('hidden');

      const img = await loadImg(URL.createObjectURL(file));
      let baseCanvas = document.getElementById('ppAutoWhiteBg').checked ? await runSelfieSegmentation(img, 'white_bg') : (() => {
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0); return c;
      })();

      const dpi = 300;
      const preset = document.getElementById('ppSizePreset').value;
      let pw = preset === '5.1x5.1' ? Math.round(2 * dpi) : Math.round((3.5 / 2.54) * dpi);
      let ph = preset === '5.1x5.1' ? Math.round(2 * dpi) : preset === '3.5x3.5' ? Math.round((3.5 / 2.54) * dpi) : Math.round((4.5 / 2.54) * dpi);

      let finalPhotoCanvas = document.getElementById('ppHdRetouch').checked
        ? applyStudioRetouchAndSharpen(baseCanvas, pw, ph)
        : (() => {
            const c = document.createElement('canvas'); c.width = pw; c.height = ph;
            const sc = Math.max(pw / baseCanvas.width, ph / baseCanvas.height);
            c.getContext('2d').drawImage(baseCanvas, (pw - baseCanvas.width * sc) / 2, (ph - baseCanvas.height * sc) / 2, baseCanvas.width * sc, baseCanvas.height * sc);
            return c;
          })();

      if (document.getElementById('ppBorder').checked) {
        const bCtx = finalPhotoCanvas.getContext('2d');
        bCtx.strokeStyle = '#94a3b8';
        bCtx.lineWidth = Math.max(3, Math.round(finalPhotoCanvas.width * 0.008));
        bCtx.strokeRect(2, 2, finalPhotoCanvas.width - 4, finalPhotoCanvas.height - 4);
      }

      const sheetMode = document.getElementById('ppSheet').value;
      if (sheetMode === 'single' || sheetMode === 'both') {
        addDownloadCard(out, await toBlob(finalPhotoCanvas, 'image/jpeg', 0.98), 'passport_HD_white_bg.jpg', `HD Passport (${finalPhotoCanvas.width}×${finalPhotoCanvas.height}px)`);
      }
      if (sheetMode !== 'single') {
        const sheetType = sheetMode === 'a4' ? 'a4' : '4x6';
        const sCanvas = document.createElement('canvas');
        sCanvas.width = sheetType === 'a4' ? Math.round(8.27 * dpi) : Math.round(4 * dpi);
        sCanvas.height = sheetType === 'a4' ? Math.round(11.69 * dpi) : Math.round(6 * dpi);
        const sCtx = sCanvas.getContext('2d'); sCtx.fillStyle = '#ffffff'; sCtx.fillRect(0, 0, sCanvas.width, sCanvas.height);
        const copies = parseInt(document.getElementById('ppCopies').value) || 8;
        const gap = 24;
        let x = gap, y = gap, drawn = 0;
        while (drawn < copies && y + ph + gap <= sCanvas.height) {
          while (drawn < copies && x + pw + gap <= sCanvas.width) {
            sCtx.drawImage(finalPhotoCanvas, x, y, pw, ph);
            x += pw + gap; drawn++;
          }
          x = gap; y += ph + gap;
        }
        addDownloadCard(out, await toBlob(sCanvas, 'image/jpeg', 0.97), `passport_print_sheet_${sheetType}.jpg`, `${drawn} HD Copies on ${sheetType.toUpperCase()} Sheet`);
      }
      status.classList.add('hidden');
    };
