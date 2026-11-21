// ================= 4. ALL PDF TOOLS & SECURITY =================
    function setPdfTarget(val, unit) {
      document.getElementById('pdfToolSelect').value = 'resize_pdf_custom';
      document.getElementById('pdfTargetSize').value = val;
      document.getElementById('pdfTargetUnit').value = unit;
      updatePdfControls();
    }
    function updatePdfControls() {
      const tool = document.getElementById('pdfToolSelect').value;
      document.getElementById('pdfTargetBox').classList.toggle('hidden', tool !== 'resize_pdf_custom');
      document.getElementById('pdfQuickPresets').classList.toggle('hidden', tool !== 'resize_pdf_custom');
      document.getElementById('pdfPageSizeBox').classList.toggle('hidden', tool !== 'resize_pdf_page');
      document.getElementById('pdfRangeLbl').classList.toggle('hidden', tool !== 'split_pdf');
      document.getElementById('pdfSecondFileBox').classList.toggle('hidden', !['sign_pdf', 'add_img_pdf'].includes(tool));
      document.getElementById('pdfTextLbl').classList.toggle('hidden', tool !== 'watermark_pdf');
      document.getElementById('pdfWmStyleBox').classList.toggle('hidden', tool !== 'watermark_pdf');
      document.getElementById('pdfContrastLbl').classList.toggle('hidden', tool !== 'contrast_pdf');
      document.getElementById('pdfPassLbl').classList.toggle('hidden', !['protect_pdf', 'unlock_pdf'].includes(tool));
      document.getElementById('pdfCropLbl').classList.toggle('hidden', !['crop_pdf', 'redact_pdf'].includes(tool));
    }
    document.getElementById('pdfToolSelect').onchange = updatePdfControls;

    function updatePdfWatermarkOptions() {
      const customPosition = document.getElementById('pdfWmPosition').value === 'custom';
      const customAngle = document.getElementById('pdfWmDirection').value === 'custom';
      document.getElementById('pdfWmXBox').classList.toggle('hidden', !customPosition);
      document.getElementById('pdfWmYBox').classList.toggle('hidden', !customPosition);
      document.getElementById('pdfWmRotationBox').classList.toggle('hidden', !customAngle);
    }
    document.getElementById('pdfWmPosition').addEventListener('change', updatePdfWatermarkOptions);
    document.getElementById('pdfWmDirection').addEventListener('change', updatePdfWatermarkOptions);
    document.getElementById('pdfWmFont').value = 'Arial, sans-serif';
    updatePdfWatermarkOptions();

    async function createPdfWatermarkImage(text, font, bold, color, opacity, sizePt, rotation) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const pxSize = Math.max(8, Math.min(120, Number(sizePt) || 36)) * 2;
      const displayText = transliterateIndicText(text, getFontScript(document.getElementById('pdfWmFont')));
      const fontCss = buildCanvasFontStr(bold, pxSize, font);
      await document.fonts.load(fontCss, displayText || 'Watermark ਪੰਜਾਬੀ हिन्दी');
      ctx.font = fontCss;
      const textWidth = Math.max(1, ctx.measureText(displayText).width);
      const radians = Math.max(-180, Math.min(180, Number(rotation) || 0)) * Math.PI / 180;
      const rotatedWidth = Math.abs(Math.cos(radians)) * textWidth + Math.abs(Math.sin(radians)) * pxSize;
      const rotatedHeight = Math.abs(Math.sin(radians)) * textWidth + Math.abs(Math.cos(radians)) * pxSize;
      const padding = Math.ceil(pxSize * 0.35 + 4);
      canvas.width = Math.ceil(rotatedWidth + padding * 2);
      canvas.height = Math.ceil(rotatedHeight + padding * 2);
      ctx.font = fontCss;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(radians);
      ctx.globalAlpha = Math.max(0.05, Math.min(1, (Number(opacity) || 45) / 100));
      ctx.fillStyle = color || '#777777';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayText, 0, 0);
      return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not render watermark text.')), 'image/png'));
    }

    async function buildCompressedPdfFromPages(pdf, scale, quality, filterCss = 'none') {
      const outPdf = await PDFLib.PDFDocument.create();
      for (let pNum = 1; pNum <= pdf.numPages; pNum++) {
        const page = await pdf.getPage(pNum), vp = page.getViewport({ scale });
        const c = document.createElement('canvas');
        c.width = Math.max(50, Math.round(vp.width)); c.height = Math.max(50, Math.round(vp.height));
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        if (filterCss !== 'none') {
          const tmp = document.createElement('canvas'); tmp.width = c.width; tmp.height = c.height;
          const tctx = tmp.getContext('2d'); tctx.filter = filterCss; tctx.drawImage(c, 0, 0);
          ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(tmp, 0, 0);
        }
        const jpgBytes = await (await toBlob(c, 'image/jpeg', quality)).arrayBuffer();
        const emb = await outPdf.embedJpg(jpgBytes);
        const np = outPdf.addPage([emb.width, emb.height]);
        np.drawImage(emb, { x: 0, y: 0, width: emb.width, height: emb.height });
      }
      return await outPdf.save();
    }

    async function htmlToPdfBlob(htmlString) {
      const holder = document.createElement('div');
      holder.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;padding:36px;color:#111;font-size:14px;line-height:1.5;';
      holder.innerHTML = htmlString;
      document.body.appendChild(holder);
      const canvas = await html2canvas(holder, { scale: 1.6 });
      document.body.removeChild(holder);
      const pdfDoc = await PDFLib.PDFDocument.create();
      const pageH = Math.round(canvas.width * 1.414);
      for (let y = 0; y < canvas.height; y += pageH) {
        const sliceH = Math.min(pageH, canvas.height - y);
        const sc = document.createElement('canvas'); sc.width = canvas.width; sc.height = sliceH;
        sc.getContext('2d').drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        const emb = await pdfDoc.embedJpg(await (await toBlob(sc, 'image/jpeg', 0.92)).arrayBuffer());
        const p = pdfDoc.addPage([595.28, (sliceH / canvas.width) * 595.28]);
        p.drawImage(emb, { x: 0, y: 0, width: p.getWidth(), height: p.getHeight() });
      }
      return new Blob([await pdfDoc.save()], { type: 'application/pdf' });
    }

    document.getElementById('pdfRunBtn').onclick = async () => {
      const tool = document.getElementById('pdfToolSelect').value;
      const files = Array.from(document.getElementById('pdfFiles').files);
      const out = document.getElementById('pdfOutput');
      const status = document.getElementById('pdfStatus');
      const txtBox = document.getElementById('pdfTextResultBox');
      out.innerHTML = ''; status.classList.add('hidden'); txtBox.classList.add('hidden');
      if (!files.length) return alert('Please select file(s).');

      status.textContent = 'Processing... please wait.'; status.classList.remove('hidden');
      try {
        if (tool === 'resize_pdf_custom') {
          const targetVal = parseFloat(document.getElementById('pdfTargetSize').value) || 150;
          const unitStr = document.getElementById('pdfTargetUnit').value;
          const exactTargetBytes = Math.round(targetVal * (unitStr === 'MB' ? 1048576 : 1024));
          const pdf = await openPdfWithPasswordSupport(await files[0].arrayBuffer());
          let bestBytes = null;
          for (const sc of [2.0, 1.5, 1.15, 0.85, 0.65, 0.5]) {
            let lo = 0.15, hi = 0.98, candidate = null;
            for (let step = 0; step < 6; step++) {
              const midQ = (lo + hi) / 2;
              const bytes = await buildCompressedPdfFromPages(pdf, sc, midQ);
              if (bytes.length <= exactTargetBytes) { candidate = bytes; lo = midQ; } else { hi = midQ; }
            }
            if (candidate) { bestBytes = candidate; break; }
            bestBytes = await buildCompressedPdfFromPages(pdf, sc, 0.15);
          }
          const finalPdfBlob = padBlobToExactBytes(new Blob([bestBytes], { type: 'application/pdf' }), exactTargetBytes, 'application/pdf');
          addDownloadCard(out, finalPdfBlob, `resized_${targetVal}${unitStr.toLowerCase()}_${files[0].name}`, `Exact Size: ${(finalPdfBlob.size / 1024).toFixed(1)} KB`);
        }

        else if (tool === 'resize_pdf_page') {
          const paper = document.getElementById('pdfPaperFormat').value;
          const dims = paper === 'letter' ? [612, 792] : paper === 'legal' ? [612, 1008] : [595.28, 841.89];
          const srcDoc = await PDFLib.PDFDocument.load(await files[0].arrayBuffer());
          const newDoc = await PDFLib.PDFDocument.create();
          const embeddedPages = await newDoc.embedPages(srcDoc.getPages());
          for (const ep of embeddedPages) {
            const page = newDoc.addPage(dims);
            const scale = Math.min(dims[0] / ep.width, dims[1] / ep.height);
            page.drawPage(ep, { x: (dims[0] - ep.width * scale) / 2, y: (dims[1] - ep.height * scale) / 2, width: ep.width * scale, height: ep.height * scale });
          }
          const bytes = await newDoc.save();
          addDownloadCard(out, new Blob([bytes], { type: 'application/pdf' }), `${paper}_${files[0].name}`, `Resized to ${paper.toUpperCase()}`);
        }

        else if (tool === 'pdf_to_jpg') {
          const pdf = await openPdfWithPasswordSupport(await files[0].arrayBuffer());
          for (let pNum = 1; pNum <= pdf.numPages; pNum++) {
            const page = await pdf.getPage(pNum), vp = page.getViewport({ scale: 1.5 });
            const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
            await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
            addDownloadCard(out, await toBlob(c, 'image/jpeg', 0.92), `page_${pNum}.jpg`, `Page ${pNum}`);
          }
        }

        else if (tool === 'pdf_to_word' || tool === 'pdf_to_excel') {
          const pdf = await openPdfWithPasswordSupport(await files[0].arrayBuffer());
          let fullText = '', csvRows = [];
          for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const tc = await page.getTextContent();
            const lines = tc.items.map(i => i.str).join(' ');
            fullText += `--- Page ${p} ---\n${lines}\n\n`;
            csvRows.push(`"Page ${p}","${lines.replace(/"/g, '""')}"`);
          }
          if (tool === 'pdf_to_word') {
            const docHtml = `<html><body><pre style="font-family:Arial;white-space:pre-wrap;">${fullText}</pre></body></html>`;
            addDownloadCard(out, new Blob([docHtml], { type: 'application/msword' }), `${files[0].name.replace(/\.pdf$/i, '')}.doc`, 'Converted to Word (.doc)');
          } else {
            addDownloadCard(out, new Blob([csvRows.join('\n')], { type: 'text/csv' }), `${files[0].name.replace(/\.pdf$/i, '')}.csv`, 'Converted to Excel (.csv)');
          }
        }

        else if (tool === 'img_to_pdf' || tool === 'jpg_to_pdf_100') {
          const pdfDoc = await PDFLib.PDFDocument.create();
          const q = tool === 'jpg_to_pdf_100' ? 0.55 : 0.92;
          for (const f of files) {
            const im = await loadImg(URL.createObjectURL(f));
            const c = document.createElement('canvas');
            const sc = Math.min(1, (tool === 'jpg_to_pdf_100' ? 1100 : 1800) / Math.max(im.width, im.height));
            c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc);
            const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(im, 0, 0, c.width, c.height);
            const emb = await pdfDoc.embedJpg(await (await toBlob(c, 'image/jpeg', q)).arrayBuffer());
            const page = pdfDoc.addPage([emb.width, emb.height]);
            page.drawImage(emb, { x: 0, y: 0, width: emb.width, height: emb.height });
          }
          let pdfBlob = new Blob([await pdfDoc.save()], { type: 'application/pdf' });
          if (tool === 'jpg_to_pdf_100') pdfBlob = padBlobToExactBytes(pdfBlob, 100 * 1024, 'application/pdf');
          addDownloadCard(out, pdfBlob, 'images_to_pdf.pdf', `${(pdfBlob.size / 1024).toFixed(1)} KB`);
        }

        else if (tool === 'word_to_pdf') {
          const res = await mammoth.convertToHtml({ arrayBuffer: await files[0].arrayBuffer() });
          const blob = await htmlToPdfBlob(res.value || '<p>Empty Document</p>');
          addDownloadCard(out, blob, `${files[0].name.replace(/\.[^/.]+$/, '')}.pdf`, 'Word converted to PDF');
        }

        else if (tool === 'excel_to_pdf') {
          const wb = XLSX.read(await files[0].arrayBuffer(), { type: 'array' });
          const html = XLSX.utils.sheet_to_html(wb.Sheets[wb.SheetNames[0]]);
          const blob = await htmlToPdfBlob(`<style>table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:5px;font-size:11px}</style>${html}`);
          addDownloadCard(out, blob, `${files[0].name.replace(/\.[^/.]+$/, '')}.pdf`, 'Excel converted to PDF');
        }

        else if (tool === 'ppt_to_pdf') {
          const zip = await JSZip.loadAsync(await files[0].arrayBuffer());
          const slideFiles = Object.keys(zip.files).filter(k => k.match(/^ppt\/slides\/slide\d+\.xml$/)).sort();
          let slidesHtml = '';
          for (let i = 0; i < slideFiles.length; i++) {
            const xml = await zip.files[slideFiles[i]].async('string');
            const texts = Array.from(xml.matchAll(/<a:t>(.*?)<\/a:t>/g)).map(m => m[1]).join(' ');
            slidesHtml += `<div style="border:1px solid #cbd5e1;padding:24px;margin-bottom:20px;min-height:220px;"><h3>Slide ${i + 1}</h3><p>${texts}</p></div>`;
          }
          const blob = await htmlToPdfBlob(slidesHtml || '<p>No slide text found</p>');
          addDownloadCard(out, blob, `${files[0].name.replace(/\.[^/.]+$/, '')}.pdf`, 'PowerPoint converted to PDF');
        }

        else if (tool === 'sign_pdf' || tool === 'add_img_pdf') {
          const ovFile = document.getElementById('pdfOverlayFile').files[0];
          if (!ovFile) throw new Error('Please select Signature / Image file in second input.');
          const pdfDoc = await PDFLib.PDFDocument.load(await files[0].arrayBuffer());
          const ovBytes = await ovFile.arrayBuffer();
          const embImg = ovFile.type === 'image/png' ? await pdfDoc.embedPng(ovBytes) : await pdfDoc.embedJpg(ovBytes);
          const pages = pdfDoc.getPages();
          const targetPage = pages[pages.length - 1];
          const w = tool === 'sign_pdf' ? 130 : 180;
          const h = (embImg.height / embImg.width) * w;
          targetPage.drawImage(embImg, { x: targetPage.getWidth() - w - 40, y: 40, width: w, height: h });
          addDownloadCard(out, new Blob([await pdfDoc.save()], { type: 'application/pdf' }), `signed_${files[0].name}`, 'Image / Signature added to PDF');
        }

        else if (tool === 'ocr_pdf') {
          const pdf = await openPdfWithPasswordSupport(await files[0].arrayBuffer());
          let ocrAll = '';
          for (let p = 1; p <= pdf.numPages; p++) {
            status.textContent = `Running OCR on Page ${p} of ${pdf.numPages}...`;
            const page = await pdf.getPage(p), vp = page.getViewport({ scale: 1.8 });
            const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
            await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
            const res = await Tesseract.recognize(c, 'eng');
            ocrAll += `=== Page ${p} ===\n${res.data.text}\n\n`;
          }
          document.getElementById('pdfExtractedText').value = ocrAll;
          txtBox.classList.remove('hidden');
          addDownloadCard(out, new Blob([ocrAll], { type: 'text/plain' }), `${files[0].name.replace(/\.pdf$/i, '')}_ocr.txt`, 'OCR Text Extracted');
        }

        else if (tool === 'page_num_pdf' || tool === 'watermark_pdf') {
          const pdfDoc = await PDFLib.PDFDocument.load(await files[0].arrayBuffer());
          const pages = pdfDoc.getPages();
          if (tool === 'page_num_pdf') {
            pages.forEach((p, idx) => p.drawText(`Page ${idx + 1} of ${pages.length}`, { x: p.getWidth() / 2 - 35, y: 20, size: 11, color: PDFLib.rgb(0.2, 0.2, 0.2) }));
          } else {
            const wmTxt = document.getElementById('pdfCustomText').value || 'CONFIDENTIAL';
            const direction = document.getElementById('pdfWmDirection').value;
            const rotation = direction === 'vertical' ? 90 : direction === 'custom' ? Number(document.getElementById('pdfWmRotation').value) || 0 : 0;
            const imageBlob = await createPdfWatermarkImage(
              wmTxt,
              document.getElementById('pdfWmFont').value || 'Arial, sans-serif',
              document.getElementById('pdfWmBold').checked,
              document.getElementById('pdfWmColor').value,
              document.getElementById('pdfWmOpacity').value,
              document.getElementById('pdfWmSize').value,
              rotation
            );
            const image = await pdfDoc.embedPng(await imageBlob.arrayBuffer());
            const position = document.getElementById('pdfWmPosition').value;
            pages.forEach(p => {
              const maxW = p.getWidth() * 0.9, maxH = p.getHeight() * 0.9;
              const scale = Math.min(0.5, maxW / image.width, maxH / image.height);
              const w = image.width * scale, h = image.height * scale;
              const margin = Math.min(24, Math.min(p.getWidth(), p.getHeight()) * 0.04);
              let cx = p.getWidth() / 2, cy = p.getHeight() / 2;
              if (position === 'top') cy = p.getHeight() - h / 2 - margin;
              else if (position === 'bottom') cy = h / 2 + margin;
              else if (position === 'left') cx = w / 2 + margin;
              else if (position === 'right') cx = p.getWidth() - w / 2 - margin;
              else if (position === 'custom') {
                const x = Math.max(0, Math.min(100, Number(document.getElementById('pdfWmX').value) || 50));
                const y = Math.max(0, Math.min(100, Number(document.getElementById('pdfWmY').value) || 50));
                cx = Math.max(w / 2, Math.min(p.getWidth() - w / 2, p.getWidth() * x / 100));
                cy = Math.max(h / 2, Math.min(p.getHeight() - h / 2, p.getHeight() * y / 100));
              }
              p.drawImage(image, { x: cx - w / 2, y: cy - h / 2, width: w, height: h });
            });
          }
          addDownloadCard(out, new Blob([await pdfDoc.save()], { type: 'application/pdf' }), `updated_${files[0].name}`, 'Updated PDF ready');
        }

        else if (tool === 'contrast_pdf' || tool === 'bw_pdf') {
          const pdf = await openPdfWithPasswordSupport(await files[0].arrayBuffer());
          const cVal = document.getElementById('pdfContrastVal').value || 140;
          const filter = tool === 'bw_pdf' ? 'grayscale(100%) contrast(135%)' : `contrast(${cVal}%)`;
          const bytes = await buildCompressedPdfFromPages(pdf, 1.5, 0.9, filter);
          addDownloadCard(out, new Blob([bytes], { type: 'application/pdf' }), `${tool}_${files[0].name}`, 'PDF Processed');
        }

        else if (tool === 'crop_pdf' || tool === 'flipkart_crop' || tool === 'redact_pdf') {
          const pdfDoc = await PDFLib.PDFDocument.load(await files[0].arrayBuffer());
          const pages = pdfDoc.getPages();
          const m = (document.getElementById('pdfCropMargins').value || '5,5,5,5').split(',').map(x => parseFloat(x.trim()) || 0);
          pages.forEach(p => {
            const w = p.getWidth(), h = p.getHeight();
            if (tool === 'flipkart_crop') {
              p.setCropBox(w * 0.26, h * 0.50, w * 0.48, h * 0.46);
            } else if (tool === 'crop_pdf') {
              const top = (m[0] / 100) * h, right = (m[1] / 100) * w, bot = (m[2] / 100) * h, left = (m[3] / 100) * w;
              p.setCropBox(left, bot, Math.max(50, w - left - right), Math.max(50, h - top - bot));
            } else if (tool === 'redact_pdf') {
              const top = (m[0] / 100) * h, right = (m[1] / 100) * w, bot = (m[2] / 100) * h, left = (m[3] / 100) * w;
              p.drawRectangle({ x: left, y: bot, width: Math.max(20, w - left - right), height: Math.max(20, h - top - bot), color: PDFLib.rgb(0, 0, 0) });
            }
          });
          addDownloadCard(out, new Blob([await pdfDoc.save()], { type: 'application/pdf' }), `${tool}_${files[0].name}`, 'PDF Updated');
        }

        else if (tool === 'protect_pdf') {
          const pass = document.getElementById('pdfPasswordInput').value;
          if (!pass) throw new Error('Please enter a password.');
          const pdfDoc = await PDFLib.PDFDocument.load(await files[0].arrayBuffer());
          const bytes = await pdfDoc.save({ userPassword: pass, ownerPassword: pass });
          addDownloadCard(out, new Blob([bytes], { type: 'application/pdf' }), `protected_${files[0].name}`, 'Password Protected PDF');
        }

        else if (tool === 'unlock_pdf') {
          const pass = document.getElementById('pdfPasswordInput').value;
          const pdf = await openPdfWithPasswordSupport(await files[0].arrayBuffer(), pass);
          const bytes = await buildCompressedPdfFromPages(pdf, 1.6, 0.94);
          addDownloadCard(out, new Blob([bytes], { type: 'application/pdf' }), `unlocked_${files[0].name}`, 'PDF Password Removed');
        }

        else if (tool === 'merge_pdf') {
          const merged = await PDFLib.PDFDocument.create();
          for (const f of files) {
            const src = await PDFLib.PDFDocument.load(await f.arrayBuffer());
            (await merged.copyPages(src, src.getPageIndices())).forEach(p => merged.addPage(p));
          }
          addDownloadCard(out, new Blob([await merged.save()], { type: 'application/pdf' }), 'merged.pdf', 'Merged PDF');
        }

        else if (tool === 'split_pdf') {
          const src = await PDFLib.PDFDocument.load(await files[0].arrayBuffer());
          const range = document.getElementById('pdfRange').value.split('-').map(x => parseInt(x.trim()) - 1);
          const start = Math.max(0, range[0] || 0), end = Math.min(src.getPageCount() - 1, range[1] ?? start);
          const sub = await PDFLib.PDFDocument.create();
          const indices = []; for (let i = start; i <= end; i++) indices.push(i);
          (await sub.copyPages(src, indices)).forEach(p => sub.addPage(p));
          addDownloadCard(out, new Blob([await sub.save()], { type: 'application/pdf' }), `pages_${start + 1}-${end + 1}.pdf`, 'Split PDF');
        }
      } catch (err) {
        alert('Error: ' + err.message);
      }
      status.classList.add('hidden');
    };
