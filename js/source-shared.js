if (typeof pdfjsLib !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}
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

    // Map responsive canvas coordinates back to the PDF page's pixel space.
    function getCanvasMousePos(canvas, event) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * canvas.width / Math.max(1, rect.width),
        y: (event.clientY - rect.top) * canvas.height / Math.max(1, rect.height)
      };
    }

    function loadImg(src) {
      return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
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
// Shared portrait segmentation used by passport and photo editing tools.
    async function runSelfieSegmentation(img, mode = 'white_bg', blurPx = 12, customColor = '#2563eb') {
      return new Promise(async (resolve) => {
        try {
          const selfieSeg = new SelfieSegmentation({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
          });
          selfieSeg.setOptions({ modelSelection: 1 });
          const outCanvas = document.createElement('canvas');
          outCanvas.width = img.width; outCanvas.height = img.height;
          const ctx = outCanvas.getContext('2d');
          selfieSeg.onResults((results) => {
            ctx.save();
            ctx.clearRect(0, 0, outCanvas.width, outCanvas.height);
            ctx.drawImage(results.segmentationMask, 0, 0, outCanvas.width, outCanvas.height);
            ctx.globalCompositeOperation = 'source-in';
            ctx.drawImage(results.image, 0, 0, outCanvas.width, outCanvas.height);

            if (mode === 'transparent') {
              ctx.restore();
              resolve(outCanvas);
              return;
            }

            ctx.globalCompositeOperation = 'destination-over';
            if (mode === 'blur_bg') {
              ctx.filter = `blur(${blurPx}px)`;
              ctx.drawImage(results.image, 0, 0, outCanvas.width, outCanvas.height);
              ctx.filter = 'none';
            } else if (mode === 'studio_gradient') {
              const grad = ctx.createRadialGradient(outCanvas.width / 2, outCanvas.height * 0.42, outCanvas.width * 0.08, outCanvas.width / 2, outCanvas.height / 2, Math.max(outCanvas.width, outCanvas.height) * 0.78);
              grad.addColorStop(0, '#475569');
              grad.addColorStop(1, '#0f172a');
              ctx.fillStyle = grad;
              ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
            } else if (mode === 'solid_color') {
              ctx.fillStyle = customColor;
              ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
            } else {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
            }
            ctx.restore();
            resolve(outCanvas);
          });
          await selfieSeg.send({ image: img });
        } catch (err) {
          const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
          c.getContext('2d').drawImage(img, 0, 0); resolve(c);
        }
      });
    }
