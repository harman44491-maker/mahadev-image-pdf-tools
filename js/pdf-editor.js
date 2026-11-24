// ================= 5. VISUAL PDF EDITOR =================
    let edPdfDoc = null, edCurrentPage = 1, edMode = 'select';
    let edPageItems = {}, edExtractedTextBoxes = [];
    let edSelectedIdx = -1, edDragging = false, edDragOffset = { x: 0, y: 0 }, edDrawStart = null;
    const edCanvas = document.getElementById('edCanvas');
    const edCtx = edCanvas.getContext('2d');
    let edBgCanvas = document.createElement('canvas');

    document.querySelectorAll('#edToolbar .chip').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('#edToolbar .chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        edMode = btn.dataset.edmode;
        if (edMode === 'add_text') {
          // A new-text draft must not change the text item that was selected before.
          edSelectedIdx = -1;
          edDragging = false;
          edDrawStart = null;
        }
        redrawEditorCanvas();
      };
    });

    async function loadPdfIntoEditor() {
      const f = document.getElementById('edPdfFile').files[0];
      const status = document.getElementById('edStatus');
      if (!f) return alert('Please choose a PDF file first.');
      if (!window.DOCX?.auth || !(await window.DOCX.auth.authorizeEditor())) return;
      status.textContent = 'Opening PDF in editor...'; status.classList.remove('hidden');
      try {
        const openPass = document.getElementById('edOpenPass').value;
        edPdfDoc = await openPdfWithPasswordSupport(await f.arrayBuffer(), openPass);
        edPageItems = {};
        const sel = document.getElementById('edPageSelect');
        sel.innerHTML = '';
        for (let i = 1; i <= edPdfDoc.numPages; i++) {
          edPageItems[i] = [];
          const opt = document.createElement('option'); opt.value = i; opt.textContent = `Page ${i} of ${edPdfDoc.numPages}`;
          sel.appendChild(opt);
        }
        edCurrentPage = 1;
        await renderEditorPage(1);
        status.classList.add('hidden');
      } catch (err) {
        status.textContent = 'Could not open PDF: ' + err.message;
      }
    }

    document.getElementById('edPdfFile').onchange = loadPdfIntoEditor;
    document.getElementById('edLoadBtn').onclick = loadPdfIntoEditor;

    document.getElementById('edPageSelect').onchange = async (e) => {
      edCurrentPage = parseInt(e.target.value);
      edSelectedIdx = -1;
      await renderEditorPage(edCurrentPage);
    };

    async function renderEditorPage(pageNum) {
      if (!edPdfDoc) return;
      const page = await edPdfDoc.getPage(pageNum);
      const vp = page.getViewport({ scale: 1.5 });
      edCanvas.width = vp.width; edCanvas.height = vp.height;
      edBgCanvas.width = vp.width; edBgCanvas.height = vp.height;
      await page.render({ canvasContext: edBgCanvas.getContext('2d'), viewport: vp }).promise;

      const tc = await page.getTextContent();
      edExtractedTextBoxes = tc.items.map(item => {
        const tx = pdfjsLib.Util.transform(vp.transform, item.transform);
        const fontSize = Math.max(10, Math.round(Math.hypot(tx[2], tx[3])));
        const w = Math.max(20, item.width * vp.scale);
        const h = fontSize + 4;
        return { x: tx[4], y: tx[5] - fontSize + 2, w, h, text: item.str, fontSize };
      }).filter(t => t.text.trim().length > 0);

      redrawEditorCanvas();
    }

    function redrawEditorCanvas() {
      edCtx.clearRect(0, 0, edCanvas.width, edCanvas.height);
      edCtx.drawImage(edBgCanvas, 0, 0);

      if (edMode === 'edit_existing') {
        edCtx.strokeStyle = 'rgba(15, 118, 110, 0.45)';
        edCtx.lineWidth = 1;
        edExtractedTextBoxes.forEach(tb => edCtx.strokeRect(tb.x, tb.y, tb.w, tb.h));
      }

      const items = edPageItems[edCurrentPage] || [];
      items.forEach((it, idx) => {
        if (it.type === 'whiteout') {
          edCtx.fillStyle = '#ffffff';
          edCtx.fillRect(it.x, it.y, it.w, it.h);
        } else if (it.type === 'text') {
          edCtx.font = buildCanvasFontStr(it.bold, it.size, it.font);
          edCtx.fillStyle = it.color;
          const displayText = transliterateIndicText(it.text, it.script || getFontScript(it.font));
          edCtx.fillText(displayText, it.x, it.y + it.size);
          it.w = Math.max(30, edCtx.measureText(displayText).width);
          it.h = it.size + 6;
        } else if (it.type === 'image' && it.imgObj) {
          edCtx.drawImage(it.imgObj, it.x, it.y, it.w, it.h);
        }

        if (idx === edSelectedIdx) {
          edCtx.strokeStyle = '#ef4444';
          edCtx.lineWidth = 2;
          edCtx.strokeRect(it.x - 2, it.y - 2, it.w + 4, it.h + 4);
        }
      });
    }

    function syncSelectedEditorTextStyle() {
      const items = edPageItems[edCurrentPage] || [];
      if (edSelectedIdx >= 0 && items[edSelectedIdx]?.type === 'text') {
        items[edSelectedIdx].text = document.getElementById('edTextInput').value;
        items[edSelectedIdx].font = document.getElementById('edFontFamily').value;
        items[edSelectedIdx].script = getFontScript(document.getElementById('edFontFamily'));
        items[edSelectedIdx].bold = document.getElementById('edBoldToggle').checked;
        items[edSelectedIdx].size = parseInt(document.getElementById('edFontSize').value) || 16;
        items[edSelectedIdx].color = document.getElementById('edColor').value;
        redrawEditorCanvas();
      }
    }
    document.getElementById('edTextInput').oninput = syncSelectedEditorTextStyle;
    document.getElementById('edFontFamily').onchange = syncSelectedEditorTextStyle;
    document.getElementById('edBoldToggle').onchange = syncSelectedEditorTextStyle;
    document.getElementById('edFontSize').oninput = syncSelectedEditorTextStyle;
    document.getElementById('edColor').oninput = syncSelectedEditorTextStyle;

    document.getElementById('edAddImgInput').onchange = async (e) => {
      const f = e.target.files[0];
      if (!f || !edPdfDoc) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const imgObj = await loadImg(reader.result);
        const w = Math.min(180, imgObj.width);
        const h = (imgObj.height / imgObj.width) * w;
        edPageItems[edCurrentPage].push({ type: 'image', x: 60, y: 60, w, h, imgObj });
        edSelectedIdx = edPageItems[edCurrentPage].length - 1;
        redrawEditorCanvas();
      };
      reader.readAsDataURL(f);
    };

    document.getElementById('edDeleteItemBtn').onclick = () => {
      const items = edPageItems[edCurrentPage] || [];
      if (edSelectedIdx >= 0) {
        items.splice(edSelectedIdx, 1);
        edSelectedIdx = -1;
        redrawEditorCanvas();
      }
    };

    edCanvas.onmousedown = (e) => {
      if (!edPdfDoc) return;
      const pos = getCanvasMousePos(edCanvas, e);
      const items = edPageItems[edCurrentPage] || [];
      const curFont = document.getElementById('edFontFamily').value;
      const curBold = document.getElementById('edBoldToggle').checked;
      const curColor = document.getElementById('edColor').value;

      if (edMode === 'edit_existing') {
        const hit = edExtractedTextBoxes.find(tb => pos.x >= tb.x && pos.x <= tb.x + tb.w && pos.y >= tb.y && pos.y <= tb.y + tb.h);
        if (hit) {
          items.push({ type: 'whiteout', x: hit.x - 2, y: hit.y - 2, w: hit.w + 6, h: hit.h + 4 });
          items.push({ type: 'text', x: hit.x, y: hit.y, w: hit.w, h: hit.h, text: hit.text, size: hit.fontSize, font: curFont, script: getFontScript(document.getElementById('edFontFamily')), bold: curBold, color: curColor });
          edSelectedIdx = items.length - 1;
          document.getElementById('edTextInput').value = hit.text;
          document.getElementById('edTextInput').focus();
          redrawEditorCanvas();
        }
        return;
      }

      if (edMode === 'add_text') {
        // In Add Text mode, clicking an existing added text selects/moves it.
        // A click on blank page space remains the action that creates new text.
        for (let i = items.length - 1; i >= 0; i--) {
          const existing = items[i];
          if (existing.type !== 'text' || pos.x < existing.x || pos.x > existing.x + existing.w || pos.y < existing.y || pos.y > existing.y + existing.h) continue;
          edSelectedIdx = i;
          edDragging = true;
          edDragOffset = { x: pos.x - existing.x, y: pos.y - existing.y };
          document.getElementById('edTextInput').value = existing.text;
          if (existing.font) document.getElementById('edFontFamily').value = existing.font;
          if (typeof existing.bold === 'boolean') document.getElementById('edBoldToggle').checked = existing.bold;
          document.getElementById('edFontSize').value = existing.size || 16;
          document.getElementById('edColor').value = existing.color || '#111827';
          redrawEditorCanvas();
          return;
        }

        const txt = document.getElementById('edTextInput').value || 'New Edited Text';
        const size = parseInt(document.getElementById('edFontSize').value) || 16;
        items.push({ type: 'text', x: pos.x, y: pos.y - size, w: 100, h: size + 6, text: txt, size, font: curFont, script: getFontScript(document.getElementById('edFontFamily')), bold: curBold, color: curColor });
        edSelectedIdx = items.length - 1;
        redrawEditorCanvas();
        return;
      }

      if (edMode === 'whiteout') {
        edDrawStart = pos;
        items.push({ type: 'whiteout', x: pos.x, y: pos.y, w: 1, h: 1 });
        edSelectedIdx = items.length - 1;
        return;
      }

      edSelectedIdx = -1;
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (pos.x >= it.x && pos.x <= it.x + it.w && pos.y >= it.y && pos.y <= it.y + it.h) {
          edSelectedIdx = i;
          edDragging = true;
          edDragOffset = { x: pos.x - it.x, y: pos.y - it.y };
          if (it.type === 'text') {
            document.getElementById('edTextInput').value = it.text;
            if (it.font) document.getElementById('edFontFamily').value = it.font;
            if (typeof it.bold === 'boolean') document.getElementById('edBoldToggle').checked = it.bold;
          }
          break;
        }
      }
      redrawEditorCanvas();
    };

    edCanvas.onmousemove = (e) => {
      const pos = getCanvasMousePos(edCanvas, e);
      const items = edPageItems[edCurrentPage] || [];
      if (edMode === 'whiteout' && edDrawStart && edSelectedIdx >= 0) {
        const it = items[edSelectedIdx];
        it.x = Math.min(edDrawStart.x, pos.x);
        it.y = Math.min(edDrawStart.y, pos.y);
        it.w = Math.abs(pos.x - edDrawStart.x);
        it.h = Math.abs(pos.y - edDrawStart.y);
        redrawEditorCanvas();
      } else if (edDragging && edSelectedIdx >= 0) {
        items[edSelectedIdx].x = pos.x - edDragOffset.x;
        items[edSelectedIdx].y = pos.y - edDragOffset.y;
        redrawEditorCanvas();
      }
    };

    window.addEventListener('mouseup', () => { edDragging = false; edDrawStart = null; });

    document.getElementById('edSavePdfBtn').onclick = async () => {
      if (!edPdfDoc) return alert('Please upload and load a PDF first.');
      const charge = await window.DOCX?.auth?.consume('pdf_editor', 1);
      if (!charge) return;
      const status = document.getElementById('edStatus');
      const out = document.getElementById('edOutput');
      out.innerHTML = '';
      status.textContent = 'Saving edited PDF...'; status.classList.remove('hidden');
      try {
        const outPdf = await PDFLib.PDFDocument.create();
        for (let pNum = 1; pNum <= edPdfDoc.numPages; pNum++) {
          const page = await edPdfDoc.getPage(pNum);
          const vp = page.getViewport({ scale: 1.5 });
          const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
          const ctx = c.getContext('2d');
          await page.render({ canvasContext: ctx, viewport: vp }).promise;

          (edPageItems[pNum] || []).forEach(it => {
            if (it.type === 'whiteout') {
              ctx.fillStyle = '#ffffff'; ctx.fillRect(it.x, it.y, it.w, it.h);
            } else if (it.type === 'text') {
              ctx.font = buildCanvasFontStr(it.bold, it.size, it.font);
              ctx.fillStyle = it.color;
              ctx.fillText(transliterateIndicText(it.text, it.script || getFontScript(it.font)), it.x, it.y + it.size);
            } else if (it.type === 'image' && it.imgObj) {
              ctx.drawImage(it.imgObj, it.x, it.y, it.w, it.h);
            }
          });

          const emb = await outPdf.embedJpg(await (await toBlob(c, 'image/jpeg', 0.94)).arrayBuffer());
          const np = outPdf.addPage([emb.width, emb.height]);
          np.drawImage(emb, { x: 0, y: 0, width: emb.width, height: emb.height });
        }

        const pass = document.getElementById('edPdfPassword').value;
        const bytes = pass ? await outPdf.save({ userPassword: pass, ownerPassword: pass }) : await outPdf.save();
        addDownloadCard(out, new Blob([bytes], { type: 'application/pdf' }), 'edited_document.pdf', `Edited PDF (${(bytes.length / 1024).toFixed(1)} KB)${pass ? ' • Password Protected' : ''}`);
        status.classList.add('hidden');
      } catch (error) {
        try {
          await window.DOCX.auth.refund(charge.operation_id);
          status.textContent = `PDF save failed; ₹${charge.charged_paise / 100} credit has been returned. ${error.message || ''}`;
        } catch (refundError) {
          status.textContent = `PDF save failed (${error.message || 'unknown error'}) and the credit return could not be confirmed (${refundError.message}). Contact support with this operation.`;
        }
        status.classList.remove('hidden');
      }
    };
