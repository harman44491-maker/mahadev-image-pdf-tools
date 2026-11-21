// ================= IMAGE RESIZER — RESTORED & SELF-CONTAINED =================
(() => {
  'use strict';

  let resUnit = 'px';
  let resFiles = [];

  const $ = id => document.getElementById(id);
  const setStatus = (message, isError = false) => {
    const out = $('resOutput');
    if (!out) return;
    const p = document.createElement('p');
    p.className = isError ? 'status error' : 'status';
    p.textContent = message;
    out.appendChild(p);
  };

  function canvasToBlob(canvas, mime, quality) {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Image encoding failed. Try another format or smaller dimensions.'));
        }, mime, quality);
      } catch (err) { reject(err); }
    });
  }

  function padBlobToExactBytes(blob, targetBytes) {
    if (!blob || blob.size > targetBytes) return blob;
    if (blob.size === targetBytes) return blob;
    return new Blob([blob, new Uint8Array(targetBytes - blob.size)], { type: blob.type });
  }

  function addDownloadCard(container, blob, filename, detail) {
    if (!container || !(blob instanceof Blob)) throw new Error('Image output could not be created.');
    const card = document.createElement('div');
    card.className = 'output-card output-card-with-preview';
    card.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:12px;margin:10px 0;border:1px solid #dbe3ef;border-radius:10px;background:#fff;max-width:100%;box-sizing:border-box;';
    const info = document.createElement('div');
    info.textContent = [filename, detail].filter(Boolean).join(' — ');
    info.style.cssText = 'font-size:14px;color:#334155;overflow-wrap:anywhere;width:100%;';
    const url = URL.createObjectURL(blob);
    const preview = document.createElement('img');
    preview.src = url;
    preview.alt = filename || 'Resized image preview';
    preview.loading = 'lazy';
    preview.style.cssText = 'display:block;max-width:min(100%,360px);max-height:460px;width:auto;height:auto;object-fit:contain;margin:0 auto;border:1px solid #e2e8f0;border-radius:6px;background:#fff;';
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'resized-image';
    link.textContent = 'Download';
    link.className = 'btn-green';
    link.style.cssText = 'display:inline-block;text-decoration:none;padding:9px 16px;border-radius:7px;color:#fff;background:#059669;font-weight:700;';
    card.append(info, preview, link);
    container.appendChild(card);
  }

  document.querySelectorAll('#dimUnitGroup .seg').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('#dimUnitGroup .seg').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      resUnit = button.dataset.unit || 'px';
      document.querySelectorAll('.u-lbl').forEach(label => label.textContent = resUnit);
    });
  });

  const resDrop = $('resDrop');
  const resFile = $('resFile');
  $('resSelectBtn').onclick = event => { event.stopPropagation(); resFile.click(); };
  resDrop.onclick = event => { if (event.target === resDrop || event.target.tagName === 'P') resFile.click(); };
  resDrop.ondragover = event => { event.preventDefault(); resDrop.classList.add('drag'); };
  resDrop.ondragleave = () => resDrop.classList.remove('drag');
  resDrop.ondrop = event => {
    event.preventDefault();
    resDrop.classList.remove('drag');
    setResFiles(event.dataTransfer.files);
  };
  resFile.onchange = event => setResFiles(event.target.files);

  function setResFiles(list) {
    resFiles = Array.from(list || []).filter(file => /^image\/(jpeg|png|webp)$/i.test(file.type));
    $('resFileInfo').textContent = resFiles.length ? resFiles.map(file => file.name).join(', ') : 'No supported images selected';
    $('resOutput').innerHTML = '';
  }

  window.setResPreset = function(size, sizeUnit, dimensionUnit, width, height) {
    $('resTargetSize').value = size;
    $('resSizeUnit').value = sizeUnit;
    resUnit = dimensionUnit;
    document.querySelectorAll('#dimUnitGroup .seg').forEach(button => button.classList.toggle('active', button.dataset.unit === dimensionUnit));
    document.querySelectorAll('.u-lbl').forEach(label => label.textContent = dimensionUnit);
    $('resW').value = width;
    $('resH').value = height;
  };

  function toPx(value, unit, dpi) {
    if (!Number.isFinite(value) || value <= 0) return null;
    if (unit === 'cm') return Math.round(value / 2.54 * dpi);
    if (unit === 'mm') return Math.round(value / 25.4 * dpi);
    return Math.round(value);
  }

  async function compressToBytes(img, width, height, targetBytes, mime) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser could not create an image canvas.');

    let bestBlob = null;
    let bestWidth = width;
    let bestHeight = height;
    let scale = 1;

    for (let attempt = 0; attempt < 14; attempt++) {
      const w = Math.max(1, Math.round(width * scale));
      const h = Math.max(1, Math.round(height * scale));
      if (w > 12000 || h > 12000 || w * h > 40000000) {
        scale *= 0.8;
        continue;
      }

      canvas.width = w;
      canvas.height = h;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      if (mime === 'image/jpeg') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(img, 0, 0, w, h);

      if (mime === 'image/png') {
        const blob = await canvasToBlob(canvas, mime);
        if (!bestBlob || blob.size < bestBlob.size) {
          bestBlob = blob; bestWidth = w; bestHeight = h;
        }
        if (blob.size <= targetBytes) {
          return { blob: padBlobToExactBytes(blob, targetBytes), w, h, padded: true };
        }
      } else {
        let low = 0.04, high = 0.96, under = null;
        for (let q = 0; q < 12; q++) {
          const quality = (low + high) / 2;
          const blob = await canvasToBlob(canvas, mime, quality);
          if (!bestBlob || (blob.size < bestBlob.size && blob.size > targetBytes)) {
            bestBlob = blob; bestWidth = w; bestHeight = h;
          }
          if (blob.size <= targetBytes) {
            under = blob;
            low = quality;
          } else {
            high = quality;
          }
        }
        if (under) return { blob: padBlobToExactBytes(under, targetBytes), w, h, padded: true };
        const lowestQuality = await canvasToBlob(canvas, mime, 0.04);
        if (!bestBlob || lowestQuality.size < bestBlob.size) {
          bestBlob = lowestQuality; bestWidth = w; bestHeight = h;
        }
      }
      scale *= 0.82;
    }

    if (!bestBlob) throw new Error('Could not process this image.');
    if (bestBlob.size > targetBytes) {
      throw new Error('This target size is too small for the selected dimensions. Reduce width/height or increase target KB.');
    }
    return { blob: padBlobToExactBytes(bestBlob, targetBytes), w: bestWidth, h: bestHeight, padded: true };
  }

  $('resRunBtn').onclick = async () => {
    const output = $('resOutput');
    output.innerHTML = '';
    if (!resFiles.length) {
      setStatus('Please select at least one JPG, PNG or WEBP image.', true);
      return;
    }

    const sizeValue = Number($('resTargetSize').value);
    if (!Number.isFinite(sizeValue) || sizeValue <= 0) {
      setStatus('Enter a valid target size greater than zero.', true);
      return;
    }
    const unit = $('resSizeUnit').value;
    const targetBytes = Math.round(sizeValue * (unit === 'MB' ? 1048576 : 1024));
    const dpi = Math.min(600, Math.max(72, Number($('resDpi').value) || 300));
    const requestedW = toPx(Number($('resW').value), resUnit, dpi);
    const requestedH = toPx(Number($('resH').value), resUnit, dpi);
    const lock = $('resLock').checked;
    const mime = $('resFormat').value;
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const runButton = $('resRunBtn');

    runButton.disabled = true;
    const oldText = runButton.textContent;
    runButton.textContent = 'Processing…';

    try {
      for (const file of resFiles) {
        let objectUrl;
        try {
          objectUrl = URL.createObjectURL(file);
          const img = await new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('Could not open ' + file.name));
            image.src = objectUrl;
          });

          let width = img.naturalWidth;
          let height = img.naturalHeight;
          if (requestedW && requestedH) {
            width = requestedW; height = requestedH;
          } else if (requestedW) {
            width = requestedW;
            if (lock) height = Math.round(img.naturalHeight / img.naturalWidth * width);
          } else if (requestedH) {
            height = requestedH;
            if (lock) width = Math.round(img.naturalWidth / img.naturalHeight * height);
          }

          if (width < 1 || height < 1 || width > 12000 || height > 12000) {
            throw new Error('Invalid dimensions for ' + file.name + '. Maximum dimension is 12000 px.');
          }

          const result = await compressToBytes(img, width, height, targetBytes, mime);
          const base = file.name.replace(/\.[^/.]+$/, '');
          const filename = base + '_' + sizeValue + unit.toLowerCase() + '.' + ext;
          addDownloadCard(output, result.blob, filename,
            (result.blob.size / 1024).toFixed(1) + ' KB · ' + result.w + ' × ' + result.h + ' px');
        } finally {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
        }
      }
      setStatus('Done. Download each resized image below. Target size: ' + sizeValue + ' ' + unit + '.');
    } catch (error) {
      setStatus(error && error.message ? error.message : 'Image resize failed. Please try again.', true);
    } finally {
      runButton.disabled = false;
      runButton.textContent = oldText;
    }
  };
})();
