// ================= 6. PDF FORM FILLER =================
    let ffLoadedDoc = null, ffFieldsList = [], ffIsVisualMode = false;
    let ffVisPdfDoc = null, ffVisPage = 1, ffVisItems = {};
    const ffCanvas = document.getElementById('ffCanvas');
    const ffCtx = ffCanvas.getContext('2d');
    let ffBgCanvas = document.createElement('canvas');

    async function loadPdfFormHandler() {
      const f = document.getElementById('ffPdfFile').files[0];
      const grid = document.getElementById('ffFieldsContainer');
      const status = document.getElementById('ffStatus');
      const visWrap = document.getElementById('ffVisualWrap');
      const saveBtn = document.getElementById('ffSaveBtn');
      grid.innerHTML = ''; ffFieldsList = []; ffIsVisualMode = false;
      visWrap.classList.add('hidden'); saveBtn.classList.add('hidden');
      if (!f) return alert('Please choose a PDF file first.');

      status.textContent = 'Opening PDF form...'; status.classList.remove('hidden');
      const buf = await f.arrayBuffer();
      const openPass = document.getElementById('ffOpenPass').value;

      try {
        ffLoadedDoc = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: true });
        const form = ffLoadedDoc.getForm();
        const fields = form.getFields();

        if (fields.length > 0 && !ffLoadedDoc.isEncrypted) {
          status.textContent = `${fields.length} fillable form fields detected. Fill details below:`;
          saveBtn.classList.remove('hidden');

          fields.forEach((field, idx) => {
            const name = field.getName();
            const type = field.constructor.name;
            const card = document.createElement('div');
            card.className = 'field-card';
            const lbl = document.createElement('label');
            lbl.textContent = `${idx + 1}. ${name}`;
            card.appendChild(lbl);

            let inputEl;
            if (type.includes('CheckBox')) {
              inputEl = document.createElement('input');
              inputEl.type = 'checkbox';
              inputEl.checked = field.isChecked();
            } else if (type.includes('Dropdown')) {
              inputEl = document.createElement('select');
              field.getOptions().forEach(opt => {
                const o = document.createElement('option'); o.value = opt; o.textContent = opt;
                inputEl.appendChild(o);
              });
            } else {
              inputEl = document.createElement('input');
              inputEl.type = 'text';
              try { inputEl.value = field.getText() || ''; } catch (e) {}
              inputEl.placeholder = `Enter ${name}`;
            }
            card.appendChild(inputEl);
            grid.appendChild(card);
            ffFieldsList.push({ field, type, inputEl });
          });
          return;
        }
      } catch (e) {}

      try {
        ffVisPdfDoc = await openPdfWithPasswordSupport(buf, openPass);
        ffIsVisualMode = true;
        ffVisItems = {};
        const sel = document.getElementById('ffPageSelect');
        sel.innerHTML = '';
        for (let i = 1; i <= ffVisPdfDoc.numPages; i++) {
          ffVisItems[i] = [];
          const opt = document.createElement('option'); opt.value = i; opt.textContent = `Page ${i} of ${ffVisPdfDoc.numPages}`;
          sel.appendChild(opt);
        }
        ffVisPage = 1;
        visWrap.classList.remove('hidden');
        saveBtn.classList.remove('hidden');
        status.textContent = 'PDF opened in Visual Form Fill mode! Type your text above and click anywhere on the form to fill.';
        await renderFfVisualPage(1);
      } catch (err) {
        status.textContent = 'Error opening PDF: ' + err.message;
      }
    }

    document.getElementById('ffPdfFile').onchange = loadPdfFormHandler;
    document.getElementById('ffLoadBtn').onclick = loadPdfFormHandler;

    document.getElementById('ffPageSelect').onchange = async (e) => {
      ffVisPage = parseInt(e.target.value);
      await renderFfVisualPage(ffVisPage);
    };

    async function renderFfVisualPage(pageNum) {
      if (!ffVisPdfDoc) return;
      const page = await ffVisPdfDoc.getPage(pageNum);
      const vp = page.getViewport({ scale: 1.5 });
      ffCanvas.width = vp.width; ffCanvas.height = vp.height;
      ffBgCanvas.width = vp.width; ffBgCanvas.height = vp.height;
      await page.render({ canvasContext: ffBgCanvas.getContext('2d'), viewport: vp }).promise;
      redrawFfCanvas();
    }

    function redrawFfCanvas() {
      ffCtx.clearRect(0, 0, ffCanvas.width, ffCanvas.height);
      ffCtx.drawImage(ffBgCanvas, 0, 0);
      (ffVisItems[ffVisPage] || []).forEach(it => {
        ffCtx.font = buildCanvasFontStr(it.bold, it.size, it.font);
        ffCtx.fillStyle = '#0f172a';
        ffCtx.fillText(it.text, it.x, it.y);
      });
    }

    ffCanvas.onmousedown = (e) => {
      if (!ffIsVisualMode) return;
      const txt = document.getElementById('ffVisText').value.trim();
      if (!txt) return alert('First type the text you want to fill in "Text to Place on Form" box above.');
      const pos = getCanvasMousePos(ffCanvas, e);
      const size = parseInt(document.getElementById('ffVisSize').value) || 15;
      const font = document.getElementById('ffFontFamily').value;
      const bold = document.getElementById('ffBoldToggle').checked;
      ffVisItems[ffVisPage].push({ x: pos.x, y: pos.y, text: txt, size, font, bold });
      redrawFfCanvas();
    };

    document.getElementById('ffUndoVisBtn').onclick = () => {
      if (ffVisItems[ffVisPage]?.length) {
        ffVisItems[ffVisPage].pop();
        redrawFfCanvas();
      }
    };

    document.getElementById('ffSaveBtn').onclick = async () => {
      const out = document.getElementById('ffOutput'); out.innerHTML = '';
      const pass = document.getElementById('ffPassword').value;

      if (ffIsVisualMode && ffVisPdfDoc) {
        const outPdf = await PDFLib.PDFDocument.create();
        for (let pNum = 1; pNum <= ffVisPdfDoc.numPages; pNum++) {
          const page = await ffVisPdfDoc.getPage(pNum);
          const vp = page.getViewport({ scale: 1.5 });
          const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
          const ctx = c.getContext('2d');
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          (ffVisItems[pNum] || []).forEach(it => {
            ctx.font = buildCanvasFontStr(it.bold, it.size, it.font);
            ctx.fillStyle = '#0f172a';
            ctx.fillText(it.text, it.x, it.y);
          });
          const emb = await outPdf.embedJpg(await (await toBlob(c, 'image/jpeg', 0.94)).arrayBuffer());
          const np = outPdf.addPage([emb.width, emb.height]);
          np.drawImage(emb, { x: 0, y: 0, width: emb.width, height: emb.height });
        }
        const bytes = pass ? await outPdf.save({ userPassword: pass, ownerPassword: pass }) : await outPdf.save();
        addDownloadCard(out, new Blob([bytes], { type: 'application/pdf' }), 'filled_form.pdf', `Filled PDF (${(bytes.length / 1024).toFixed(1)} KB)`);
        return;
      }

      if (!ffLoadedDoc) return;
      ffFieldsList.forEach(({ field, type, inputEl }) => {
        try {
          if (type.includes('CheckBox')) inputEl.checked ? field.check() : field.uncheck();
          else if (type.includes('Dropdown')) field.select(inputEl.value);
          else field.setText(inputEl.value);
        } catch (err) {}
      });

      if (document.getElementById('ffFlatten').checked) {
        try { ffLoadedDoc.getForm().flatten(); } catch (e) {}
      }
      const bytes = pass ? await ffLoadedDoc.save({ userPassword: pass, ownerPassword: pass }) : await ffLoadedDoc.save();
      addDownloadCard(out, new Blob([bytes], { type: 'application/pdf' }), 'filled_form.pdf', `Filled PDF Form (${(bytes.length / 1024).toFixed(1)} KB)`);
    };
