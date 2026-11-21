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
  return new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
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

function erodeAlphaMask(alphaCanvas, erodePx = 2) {
  const w=alphaCanvas.width,h=alphaCanvas.height,ctx=alphaCanvas.getContext('2d',{willReadFrequently:true});
  const image=ctx.getImageData(0,0,w,h),src=new Uint8Array(w*h),tmp=new Uint8Array(w*h),out=new Uint8Array(w*h);
  for(let p=0,i=3;p<src.length;p++,i+=4)src[p]=image.data[i];
  const r=Math.max(1,Math.round(erodePx));
  for(let y=0;y<h;y++){const base=y*w,q=new Int32Array(w);let head=0,tail=0;
    for(let x=0;x<w;x++){while(tail>head&&src[base+q[tail-1]]>=src[base+x])tail--;q[tail++]=x;while(tail>head&&q[head]<x-2*r)head++;if(x>=r)tmp[base+x-r]=src[base+q[head]]}
    for(let x=0;x<r;x++)tmp[base+x]=0;for(let x=Math.max(0,w-r);x<w;x++)tmp[base+x]=0;
  }
  for(let x=0;x<w;x++){const q=new Int32Array(h);let head=0,tail=0;
    for(let y=0;y<h;y++){while(tail>head&&tmp[q[tail-1]*w+x]>=tmp[y*w+x])tail--;q[tail++]=y;while(tail>head&&q[head]<y-2*r)head++;if(y>=r)out[(y-r)*w+x]=tmp[q[head]*w+x]}
    for(let y=0;y<r;y++)out[y*w+x]=0;for(let y=Math.max(0,h-r);y<h;y++)out[y*w+x]=0;
  }
  for(let p=0,i=3;p<out.length;p++,i+=4){const a=out[p];image.data[i]=a<=90?0:a>=210?255:Math.round((a-90)/120*255)}
  ctx.putImageData(image,0,0);return alphaCanvas;
}

function tightenMaskCanvas(maskSource, w, h) {
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
    if (m <= 105) {
      a = 0;
    } else if (m >= 215) {
      a = 255;
    } else {
      a = Math.round(((m - 105) / 110) * 255);
    }
    out[i] = 255;
    out[i + 1] = 255;
    out[i + 2] = 255;
    out[i + 3] = a;
  }

  alphaCtx.putImageData(outImg, 0, 0);
  const erodeRadius = Math.max(2, Math.round(Math.min(w, h) * 0.0022));
  return erodeAlphaMask(alphaCanvas, erodeRadius);
}

// Shared AI Background Segmentation
async function runSelfieSegmentation(img, mode = 'white_bg', blurPx = 12, customColor = '#2563eb') {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  return new Promise(async (resolve) => {
    let done = false;
    const finishWithCanvas = (cutoutCanvas) => {
      if (done) return;
      done = true;

      if (mode === 'transparent') {
        resolve(cutoutCanvas);
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

      bctx.drawImage(cutoutCanvas, 0, 0, w, h);
      resolve(bgCanvas);
    };

    const timer = setTimeout(() => {
      finishWithCanvas(fallbackRemoveBackgroundByBorderColor(img, w, h));
    }, 6000);

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

function shapeHairGolaiAndLowerStrands(srcCanvas) {
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
    const topFade = smoothstep(0.03, 0.14, ny) * (1 - smoothstep(0.36, 0.54, ny));
    const lowerFade = smoothstep(0.42, 0.56, ny) * (1 - smoothstep(0.74, 0.88, ny));

    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const absDx = Math.abs(dx);
      const normX = Math.min(1, absDx / Math.max(1, maxHeadHalfW));
      const sideFade = 1 - smoothstep(0.75, 1.25, normX);

      let sx = x;
      let sy = y;

      // Smooth rounded crown golai + side tuck
      if (topFade > 0.001 && sideFade > 0.001) {
        const dome = Math.cos(normX * Math.PI * 0.5);
        sy -= dome * (h * 0.018) * topFade * sideFade;
        sx += (dx > 0 ? 1 : -1) * Math.pow(normX, 1.6) * (w * 0.016) * topFade * sideFade;
      }

      // Lower bikhre hair strands ko smooth andar gather karna
      if (lowerFade > 0.001) {
        const outerZone = smoothstep(0.16, 0.42, absDx / Math.max(1, w));
        sx += (dx > 0 ? 1 : -1) * outerZone * (w * 0.034) * lowerFade;
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
}

// ================= AUTO STUDIO PHOTO (2-PIC REFERENCE MATCH PIPELINE) =================
(function initAutoStudioReferenceEngine() {
  function cleanCutoutAndWhiteBg(rawCanvas) {
    const w = rawCanvas.width;
    const h = rawCanvas.height;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(rawCanvas, 0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    const alphaCopy = new Uint8ClampedArray(w * h);

    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      alphaCopy[p] = d[i + 3];
    }

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        const idx = p * 4;
        const a = alphaCopy[p];
        const r = d[idx], g = d[idx + 1], b = d[idx + 2];

        const neighborMaxA = Math.max(
          alphaCopy[p - 1], alphaCopy[p + 1],
          alphaCopy[p - w], alphaCopy[p + w]
        );

        if (a < 135 || (a < 215 && neighborMaxA < 190)) {
          d[idx] = 255;
          d[idx + 1] = 255;
          d[idx + 2] = 255;
          d[idx + 3] = 255;
          continue;
        }

        const maxCh = Math.max(r, g, b);
        const minCh = Math.min(r, g, b);
        if (a < 245 && minCh > 165 && (maxCh - minCh) < 28) {
          d[idx] = 255;
          d[idx + 1] = 255;
          d[idx + 2] = 255;
          d[idx + 3] = 255;
        } else {
          d[idx + 3] = 255;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return c;
  }

  function applyReferenceStudioGrade(srcCanvas, outW, outH, enhanceLightSharp = true) {
    const shapedSubject = shapeHairGolaiAndLowerStrands(srcCanvas);

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
      ctx.filter = 'brightness(1.08) contrast(1.15) saturate(1.14)';
    }
    ctx.drawImage(shapedSubject, dx, dy, dw, dh);
    ctx.filter = 'none';

    const imgData = ctx.getImageData(0, 0, outW, outH);
    const d = imgData.data;
    const copy = new Uint8ClampedArray(d);
    const sharpAmt = enhanceLightSharp ? 0.38 : 0.12;

    for (let y = 1; y < outH - 1; y++) {
      for (let x = 1; x < outW - 1; x++) {
        const idx = (y * outW + x) * 4;
        const r0 = copy[idx], g0 = copy[idx + 1], b0 = copy[idx + 2];

        // Pure studio white background lock
        if (r0 > 242 && g0 > 242 && b0 > 242) {
          d[idx] = 255;
          d[idx + 1] = 255;
          d[idx + 2] = 255;
          continue;
        }

        // Subtle warm chamak on skin tones
        const isSkin = r0 > 85 && g0 > 50 && b0 > 30 && r0 > g0 && g0 > b0;
        const skinGlow = isSkin ? 6 : 0;

        for (let ch = 0; ch < 3; ch++) {
          const center = copy[idx + ch] * 5;
          const neighbors =
            copy[((y - 1) * outW + x) * 4 + ch] +
            copy[((y + 1) * outW + x) * 4 + ch] +
            copy[(y * outW + (x - 1)) * 4 + ch] +
            copy[(y * outW + (x + 1)) * 4 + ch];
          const sharpVal = copy[idx + ch] * (1 - sharpAmt) + (center - neighbors) * sharpAmt;
          const chBoost = ch === 0 ? skinGlow : ch === 1 ? Math.round(skinGlow * 0.7) : 0;
          d[idx + ch] = Math.min(255, Math.max(0, Math.round(sharpVal + chBoost)));
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    if (enhanceLightSharp) {
      applyFaceChamakAndGlow(ctx, outW, outH);
      // Re-lock pure white outside subject so glow doesn't tint background
      const finalData = ctx.getImageData(0, 0, outW, outH);
      const fd = finalData.data;
      for (let i = 0; i < fd.length; i += 4) {
        if (fd[i] > 245 && fd[i + 1] > 245 && fd[i + 2] > 245) {
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

  async function buildReferenceStudioOutput(file, frameText, qualityText, useWhiteBg, enhanceLightSharp) {
    const img = await loadImg(URL.createObjectURL(file));
    let subjectCanvas;

    if (useWhiteBg && typeof runSelfieSegmentation === 'function') {
      const segCanvas = await runSelfieSegmentation(img, 'transparent');
      subjectCanvas = cleanCutoutAndWhiteBg(segCanvas);
    } else {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || img.width;
      c.height = img.naturalHeight || img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      subjectCanvas = useWhiteBg ? cleanCutoutAndWhiteBg(c) : c;
    }

    const dims = getStudioTargetDimensions(img, frameText, qualityText);
    return applyReferenceStudioGrade(subjectCanvas, dims.width, dims.height, enhanceLightSharp);
  }

  function bindAutoStudioPage() {
    // The dedicated studio-photo.js page owns its own preview and download flow.
    // Do not attach the legacy shared handler here; it races with the dedicated engine.
    if (/studio-photo/i.test(window.location.pathname || '') || /auto studio photo/i.test(document.title || '')) {
      return;
    }

    if (!/studio-photo/i.test(window.location.pathname || '') && !/auto studio photo/i.test(document.title || '')) {
      return;
    }

    const selects = Array.from(document.querySelectorAll('select'));
    const frameSelect = selects.find(s => /1232|1200|1050|reference|square|portrait/i.test(s.textContent || ''));
    const qualitySelect = selects.find(s => /2×|1×|3×|high resolution|extra large/i.test(s.textContent || ''));
    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    const whiteBgBox = checkboxes[0] || null;
    const sharpBox = checkboxes[1] || null;
    const fileInput = document.querySelector('input[type="file"]');
    const runBtn = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'))
      .find(el => /create hd studio photo/i.test(el.textContent || el.value || ''));

    if (!fileInput || !runBtn) return;

    async function runAndUpdatePreview() {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

      const frameText = frameSelect ? (frameSelect.options[frameSelect.selectedIndex]?.text || frameSelect.value) : '1232 × 1277';
      const qualityText = qualitySelect ? (qualitySelect.options[qualitySelect.selectedIndex]?.text || qualitySelect.value) : '2×';
      const useWhiteBg = whiteBgBox ? whiteBgBox.checked : true;
      const enhanceLightSharp = sharpBox ? sharpBox.checked : true;

      const resultCanvas = await buildReferenceStudioOutput(file, frameText, qualityText, useWhiteBg, enhanceLightSharp);
      const dataUrl = resultCanvas.toDataURL('image/jpeg', 0.96);

      const imgs = Array.from(document.querySelectorAll('img'));
      const outImg = imgs.length > 1 ? imgs[imgs.length - 1] : imgs[0];
      if (outImg) {
        outImg.src = dataUrl;
      }

      const dlLink = Array.from(document.querySelectorAll('a')).find(a => /download hd photo/i.test(a.textContent || ''));
      if (dlLink) {
        dlLink.href = dataUrl;
        dlLink.download = `studio_photo_${resultCanvas.width}x${resultCanvas.height}.jpg`;
      }
    }

    runBtn.addEventListener('click', () => {
      setTimeout(() => {
        runAndUpdatePreview().catch(() => {});
      }, 200);
    });

    fileInput.addEventListener('change', () => {
      setTimeout(() => {
        runAndUpdatePreview().catch(() => {});
      }, 300);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindAutoStudioPage);
  } else {
    bindAutoStudioPage();
  }
})();
