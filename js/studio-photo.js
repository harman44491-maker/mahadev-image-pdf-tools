(() => {
  const fileInput = document.getElementById('studioFile');
  const preview = document.getElementById('studioPreview');
  const status = document.getElementById('studioStatus');
  const createBtn = document.getElementById('studioCreate');
  let sourceImage = null;
  let sourceUrl = null;
  let outputUrl = null;

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.remove('hidden');
    status.style.color = isError ? '#b91c1c' : '#0f766e';
  }
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => resolve({ image, url });
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not open this image.')); };
      image.src = url;
    });
  }
  function frameSize(frame, image, scale) {
    if (frame === 'square') return [1200 * scale, 1200 * scale];
    if (frame === 'portrait') return [1050 * scale, 1350 * scale];
    if (frame === 'original') {
      const h = 1277 * scale;
      return [Math.round(h * image.width / image.height), h];
    }
    return [1232 * scale, 1277 * scale];
  }
  function composeStudioPhoto(subjectCanvas, width, height, enhance) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const fit = Math.min(width / subjectCanvas.width, height / subjectCanvas.height);
    const drawW = subjectCanvas.width * fit;
    const drawH = subjectCanvas.height * fit;
    const dx = (width - drawW) / 2;
    const dy = (height - drawH) / 2;
    ctx.save();
    if (enhance) ctx.filter = 'brightness(1.025) contrast(1.045) saturate(1.035)';
    ctx.drawImage(subjectCanvas, dx, dy, drawW, drawH);
    ctx.restore();
    return canvas;
  }
  function addPreview(title, src, details) {
    const figure = document.createElement('figure');
    const caption = document.createElement('figcaption');
    const image = document.createElement('img');
    const heading = document.createElement('strong');
    const detail = document.createElement('div');
    heading.textContent = title;
    detail.textContent = details;
    detail.style.cssText = 'font-size:.8rem;color:#64748b;margin-top:4px';
    caption.append(heading, detail);
    image.src = src;
    image.alt = title;
    figure.append(image, caption);
    preview.appendChild(figure);
    return figure;
  }
  function tidyHairEdges(subjectCanvas) {
    // Gently suppress faint detached segmentation wisps while retaining
    // the stronger hair silhouette. This is local edge cleanup, not AI hair restyling.
    const canvas = document.createElement('canvas');
    canvas.width = subjectCanvas.width;
    canvas.height = subjectCanvas.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(subjectCanvas, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    for (let i = 0; i < pixels.length; i += 4) {
      const alpha = pixels[i + 3];
      if (alpha < 55) pixels[i + 3] = 0;
      else if (alpha < 190) pixels[i + 3] = Math.round(((alpha - 55) / 135) * 255);
      else pixels[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  async function runBrowserFast() {
    let subjectCanvas;
    if (document.getElementById('studioWhiteBg').checked) {
      if (typeof SelfieSegmentation === 'undefined' || typeof runSelfieSegmentation !== 'function') {
        throw new Error('Browser segmentation library did not load. Refresh and try again.');
      }
      setStatus('Separating the person from the background locally...');
      subjectCanvas = await runSelfieSegmentation(sourceImage, 'transparent');
      if (document.getElementById('studioHairTidy')?.checked) subjectCanvas = tidyHairEdges(subjectCanvas);
    } else {
      subjectCanvas = document.createElement('canvas');
      subjectCanvas.width = sourceImage.naturalWidth || sourceImage.width;
      subjectCanvas.height = sourceImage.naturalHeight || sourceImage.height;
      subjectCanvas.getContext('2d').drawImage(sourceImage, 0, 0);
    }
    const scale = Number(document.getElementById('studioScale').value) || 2;
    const [width, height] = frameSize(document.getElementById('studioFrame').value, sourceImage, scale);
    const canvas = composeStudioPhoto(subjectCanvas, width, height, document.getElementById('studioEnhance').checked);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .96));
    if (!blob) throw new Error('The browser could not export this image. Try a smaller output size.');
    return { blob, width, height, engine: 'Browser Fast' };
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setStatus('Please choose a JPG, PNG or WEBP photo.', true);
      fileInput.value = '';
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setStatus('Photo is too large. Please choose an image smaller than 15 MB.', true);
      fileInput.value = '';
      return;
    }
    try {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      const loaded = await loadImage(file);
      sourceImage = loaded.image;
      sourceUrl = loaded.url;
      preview.replaceChildren();
      if (outputUrl) { URL.revokeObjectURL(outputUrl); outputUrl = null; }
      addPreview('Original Photo', sourceUrl, sourceImage.width + ' × ' + sourceImage.height + ' px');
      setStatus('Photo loaded. Click Create HD Studio Photo to process it locally.');
    } catch (error) {
      sourceImage = null;
      setStatus(error.message || 'Could not open this image.', true);
    }
  });

  createBtn.addEventListener('click', async () => {
    if (!sourceImage) {
      setStatus('Please upload a photo first.', true);
      return;
    }
    createBtn.disabled = true;
    preview.replaceChildren();
    addPreview('Original Photo', sourceUrl, sourceImage.width + ' × ' + sourceImage.height + ' px');
    try {
      const frameSelect = document.getElementById('studioFrame');
      const qualitySelect = document.getElementById('studioScale');
      const result = await runBrowserFast();

      if (outputUrl) URL.revokeObjectURL(outputUrl);
      outputUrl = URL.createObjectURL(result.blob);
      const dimensions = result.width && result.height
        ? result.width + ' × ' + result.height + ' px'
        : 'Generative high-resolution PNG';
      const figure = addPreview(result.engine + ' Result', outputUrl, dimensions + ' • Review identity and details before use');
      const download = document.createElement('a');
      download.className = 'dl-btn';
      download.href = outputUrl;
      download.download = 'studio_photo_' + result.engine.toLowerCase().replace(/[^a-z0-9]+/g, '_') + (result.width ? '_' + result.width + 'x' + result.height : '') + '.png';
      download.textContent = 'Download Studio Photo';
      figure.appendChild(download);
      setStatus('Done. Review the edited image carefully, especially the hair edges and background.');
    } catch (error) {
      console.error(error);
      setStatus(error.message || 'Photo processing failed. Please try again.', true);
    } finally {
      createBtn.disabled = false;
    }
  });

  const dropZone = document.querySelector('.studio-upload');
  ['dragenter', 'dragover'].forEach(type => dropZone.addEventListener(type, event => {
    event.preventDefault();
    dropZone.style.borderColor = '#0f766e';
  }));
  ['dragleave', 'drop'].forEach(type => dropZone.addEventListener(type, event => {
    event.preventDefault();
    dropZone.style.borderColor = '#94a3b8';
    if (type === 'drop' && event.dataTransfer.files.length) {
      fileInput.files = event.dataTransfer.files;
      fileInput.dispatchEvent(new Event('change'));
    }
  }));
})();
