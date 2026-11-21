// ================= 1. IMAGE RESIZER =================
    let resUnit = 'px', resFiles = [];
    document.querySelectorAll('#dimUnitGroup .seg').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('#dimUnitGroup .seg').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        resUnit = b.dataset.unit;
        document.querySelectorAll('.u-lbl').forEach(s => s.textContent = resUnit);
      });
    });

    const resDrop = document.getElementById('resDrop');
    const resFile = document.getElementById('resFile');
    document.getElementById('resSelectBtn').onclick = e => { e.stopPropagation(); resFile.click(); };
    resDrop.onclick = () => resFile.click();
    resDrop.ondragover = e => { e.preventDefault(); resDrop.classList.add('drag'); };
    resDrop.ondragleave = () => resDrop.classList.remove('drag');
    resDrop.ondrop = e => { e.preventDefault(); resDrop.classList.remove('drag'); setResFiles(e.dataTransfer.files); };
    resFile.onchange = e => setResFiles(e.target.files);

    function setResFiles(list) {
      resFiles = Array.from(list).filter(f => f.type.startsWith('image/'));
      document.getElementById('resFileInfo').textContent = resFiles.length ? resFiles.map(f => f.name).join(', ') : 'No files selected';
    }
    function setResPreset(size, sUnit, dUnit, w, h) {
      document.getElementById('resTargetSize').value = size;
      document.getElementById('resSizeUnit').value = sUnit;
      resUnit = dUnit;
      document.querySelectorAll('#dimUnitGroup .seg').forEach(b => b.classList.toggle('active', b.dataset.unit === dUnit));
      document.querySelectorAll('.u-lbl').forEach(s => s.textContent = dUnit);
      document.getElementById('resW').value = w;
      document.getElementById('resH').value = h;
    }
    function toPx(val, unit, dpi) {
      if (!val || val <= 0) return null;
      if (unit === 'px') return Math.round(val);
      if (unit === 'cm') return Math.round((val / 2.54) * dpi);
      if (unit === 'mm') return Math.round((val / 25.4) * dpi);
      return Math.round(val);
    }

    async function compressToBytes(img, w, h, exactTargetBytes, mime, hasCustomDims) {
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      let startW = w, startH = h;
      c.width = startW; c.height = startH;
      if (mime === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const initialBlob = await toBlob(c, mime, 1.0);

      if (!hasCustomDims && initialBlob.size < exactTargetBytes) {
        const upFactor = Math.min(Math.sqrt(exactTargetBytes / Math.max(1, initialBlob.size)), 2.5);
        startW = Math.round(w * upFactor); startH = Math.round(h * upFactor);
      }

      let scale = 1, best = null;
      for (let s = 0; s < 7; s++) {
        c.width = Math.max(10, Math.round(startW * scale));
        c.height = Math.max(10, Math.round(startH * scale));
        if (mime === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
        ctx.drawImage(img, 0, 0, c.width, c.height);
        if (mime === 'image/png') {
          const b = await toBlob(c, 'image/png', 1);
          best = b;
          if (b.size <= exactTargetBytes) break;
        } else {
          let lo = 0.05, hi = 1.0, ok = null;
          for (let i = 0; i < 10; i++) {
            const mid = (lo + hi) / 2;
            const b = await toBlob(c, mime, mid);
            if (b.size <= exactTargetBytes) { ok = b; lo = mid; } else { hi = mid; }
          }
          if (ok) { best = ok; break; }
          best = await toBlob(c, mime, 0.05);
        }
        scale *= 0.78;
      }
      best = padBlobToExactBytes(best, exactTargetBytes, mime);
      return { blob: best, w: c.width, h: c.height };
    }

    document.getElementById('resRunBtn').onclick = async () => {
      const out = document.getElementById('resOutput'); out.innerHTML = '';
      if (!resFiles.length) return alert('Please select images first.');
      const sizeVal = parseFloat(document.getElementById('resTargetSize').value) || 20;
      const unitStr = document.getElementById('resSizeUnit').value;
      const exactTargetBytes = Math.round(sizeVal * (unitStr === 'MB' ? 1048576 : 1024));
      const dpi = parseInt(document.getElementById('resDpi').value) || 300;
      const reqW = toPx(parseFloat(document.getElementById('resW').value), resUnit, dpi);
      const reqH = toPx(parseFloat(document.getElementById('resH').value), resUnit, dpi);
      const lock = document.getElementById('resLock').checked;
      const mime = document.getElementById('resFormat').value;
      const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
      const hasCustomDims = Boolean(reqW || reqH);

      for (const f of resFiles) {
        const img = await loadImg(URL.createObjectURL(f));
        let fw = img.width, fh = img.height;
        if (reqW && reqH) { fw = reqW; fh = reqH; }
        else if (reqW) { fw = reqW; fh = lock ? Math.round((img.height / img.width) * reqW) : img.height; }
        else if (reqH) { fh = reqH; fw = lock ? Math.round((img.width / img.height) * reqH) : img.width; }
        const r = await compressToBytes(img, fw, fh, exactTargetBytes, mime, hasCustomDims);
        const name = `${f.name.replace(/\.[^/.]+$/, '')}_${sizeVal}${unitStr.toLowerCase()}.${ext}`;
        addDownloadCard(out, r.blob, name, `${(r.blob.size / 1024).toFixed(1)} KB (${r.w}×${r.h}px)`);
      }
    };
