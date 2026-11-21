// ================= 7. JOIN, CHANGE PHOTO, DIGITAL STUDIO + HAIR SET + ZOOM AREA + BG REMOVER + 50 FRAMES =================
const sigCanvas = document.getElementById('sigCanvas');
const sigCtx = sigCanvas.getContext('2d');
let drawingSig = false;
sigCanvas.onmousedown = e => { drawingSig = true; sigCtx.beginPath(); sigCtx.moveTo(e.offsetX, e.offsetY); };
sigCanvas.onmousemove = e => { if (!drawingSig) return; sigCtx.lineWidth = 2.5; sigCtx.strokeStyle = '#0f172a'; sigCtx.lineTo(e.offsetX, e.offsetY); sigCtx.stroke(); };
window.addEventListener('mouseup', () => drawingSig = false);
document.getElementById('clearSigBtn').onclick = () => sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);

let cachedMainImg = null;
let cachedLogoImg = null;
let cachedTransparentCutout = null;

// Selected Area Zoom state (normalized 0..1) - Works inside ps_auto_retouch for Hair Brush
let zoomSelectionNorm = null;
let isSelectingZoom = false;
let zoomDragStart = null;

// Hair Set Brush Strokes (stored normalized 0..1 relative to active view)
let hairStrokes = [];
let isBrushingHair = false;
let currentHairStroke = null;
let lastHairPos = null;

function getSafeCanvasPos(canvas, e) {
  if (typeof getCanvasMousePos === 'function') {
    const p = getCanvasMousePos(canvas, e);
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return p;
  }
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
  const scaleX = canvas.width / Math.max(1, rect.width);
  const scaleY = canvas.height / Math.max(1, rect.height);
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function getSelectedBrushShape() {
  const shapeEl = document.getElementById('hairBrushShape');
  const modeVal = document.getElementById('hairBrushMode')?.value || 'tuck_smooth';
  if (shapeEl && shapeEl.value) return shapeEl.value;
  if (modeVal.startsWith('circle')) return 'circle';
  if (modeVal.startsWith('rect')) return 'rect';
  return 'freehand';
}

function getSelectedBrushEffect() {
  const modeVal = document.getElementById('hairBrushMode')?.value || 'tuck_smooth';
  if (modeVal.includes('darken')) return 'darken';
  if (modeVal.includes('erase') || modeVal.includes('trim')) return 'trim';
  return 'tuck';
}

function getBrushMagnification() {
  const enabled = Boolean(document.getElementById('psZoomSelectMode')?.checked);
  const value = parseFloat(document.getElementById('psZoomScaleNum')?.value) || 1;
  return enabled ? Math.max(1, Math.min(6, value)) : 1;
}

// Brush magnification is a precision loupe only. Never crop the source or exported photo.
function getActiveWorkingSource(baseSource) {
  return baseSource;
}

function applyEffectToRegion(ctx, copy, w, h, x0, y0, bw, bh, effect, testHitFn) {
  const imgData = ctx.createImageData(bw, bh);
  const d = imgData.data;

  for (let py = 0; py < bh; py++) {
    for (let px = 0; px < bw; px++) {
      const srcIdx = ((y0 + py) * w + (x0 + px)) * 4;
      const dstIdx = (py * bw + px) * 4;
      d[dstIdx] = copy[srcIdx];
      d[dstIdx + 1] = copy[srcIdx + 1];
      d[dstIdx + 2] = copy[srcIdx + 2];
      d[dstIdx + 3] = copy[srcIdx + 3];
    }
  }

  for (let py = 0; py < bh; py++) {
    for (let px = 0; px < bw; px++) {
      const gx = x0 + px;
      const gy = y0 + py;
      const strength = testHitFn(gx, gy);
      if (strength <= 0) continue;

      const idx = (py * bw + px) * 4;
      const baseIdx = (gy * w + gx) * 4;

      if (effect === 'trim') {
        // Non-destructive stray-hair cleanup: blend the strand into its local surroundings.
        // Keep alpha intact so ordinary JPEG photos do not get transparent holes.
        const lx = Math.max(0, gx - 2), rx = Math.min(w - 1, gx + 2);
        const ty = Math.max(0, gy - 2), by = Math.min(h - 1, gy + 2);
        for (let ch = 0; ch < 3; ch++) {
          const surround = (
            copy[(ty * w + gx) * 4 + ch] +
            copy[(by * w + gx) * 4 + ch] +
            copy[(gy * w + lx) * 4 + ch] +
            copy[(gy * w + rx) * 4 + ch]
          ) / 4;
          d[idx + ch] = Math.round(copy[baseIdx + ch] * (1 - strength * 0.94) + surround * (strength * 0.94));
        }
        d[idx + 3] = copy[baseIdx + 3];
      } else if (effect === 'darken') {
        const lum = 0.299 * copy[baseIdx] + 0.587 * copy[baseIdx + 1] + 0.114 * copy[baseIdx + 2];
        if (lum < 235) {
          const factor = 1 - strength * 0.68;
          d[idx] = Math.max(5, Math.round(copy[baseIdx] * factor));
          d[idx + 1] = Math.max(5, Math.round(copy[baseIdx + 1] * factor));
          d[idx + 2] = Math.max(5, Math.round(copy[baseIdx + 2] * factor));
        }
      } else {
        // Stronger directional smudge for visible hair tuck/smoothing.
        const lx = Math.max(0, gx - 2);
        const rx = Math.min(w - 1, gx + 2);
        const ty = Math.max(0, gy - 2);
        const by = Math.min(h - 1, gy + 2);
        const sy = Math.min(h - 1, gy + Math.max(1, Math.round(strength * 4)));
        const blend = Math.min(0.96, strength * 0.96);
        for (let ch = 0; ch < 3; ch++) {
          const avg = (
            copy[(ty * w + gx) * 4 + ch] +
            copy[(by * w + gx) * 4 + ch] +
            copy[(gy * w + lx) * 4 + ch] +
            copy[(gy * w + rx) * 4 + ch] +
            copy[(sy * w + gx) * 4 + ch] * 2
          ) / 6;
          d[idx + ch] = Math.round(copy[baseIdx + ch] * (1 - blend) + avg * blend);
        }
        d[idx + 3] = copy[baseIdx + 3];
      }
    }
  }
  ctx.putImageData(imgData, x0, y0);
}

function applyHairSetBrushStrokes(targetCanvas) {
  if (!hairStrokes.length) return targetCanvas;
  const w = targetCanvas.width, h = targetCanvas.height;
  const ctx = targetCanvas.getContext('2d');

  for (const stroke of hairStrokes) {
    const points = stroke.points || [];
    if (!points.length) continue;
    const shape = stroke.shape || 'freehand';
    const effect = stroke.effect || 'tuck';
    // radiusNorm stores half of the requested on-screen brush diameter,
    // mapped to the canvas backing pixels. Magnifier zoom never changes it.
    const rad = Math.max(1, Math.round((stroke.radiusNorm || 0.01) * Math.min(w, h)));
    const xs = points.map(p => p.x * w), ys = points.map(p => p.y * h);
    const minX = Math.max(0, Math.floor(Math.min(...xs) - rad - 2));
    const minY = Math.max(0, Math.floor(Math.min(...ys) - rad - 2));
    const maxX = Math.min(w, Math.ceil(Math.max(...xs) + rad + 2));
    const maxY = Math.min(h, Math.ceil(Math.max(...ys) + rad + 2));
    const bw = maxX - minX, bh = maxY - minY;
    if (bw < 1 || bh < 1) continue;

    const source = ctx.getImageData(0, 0, w, h).data;
    let softened = null;
    if (effect === 'tuck') {
      const blurCanvas = document.createElement('canvas');
      blurCanvas.width = w; blurCanvas.height = h;
      const blurCtx = blurCanvas.getContext('2d');
      blurCtx.filter = `blur(${Math.max(1, Math.min(2.2, rad * 0.07))}px)`;
      blurCtx.drawImage(targetCanvas, 0, 0);
      blurCtx.filter = 'none';
      softened = blurCtx.getImageData(0, 0, w, h).data;
    }
    const out = ctx.createImageData(bw, bh);
    const feather = Math.max(1, rad * 0.28);

    for (let y = minY; y < maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        const si = (y * w + x) * 4, oi = ((y - minY) * bw + (x - minX)) * 4;
        out.data[oi] = source[si];
        out.data[oi + 1] = source[si + 1];
        out.data[oi + 2] = source[si + 2];
        out.data[oi + 3] = source[si + 3];

        let dist = Infinity, dxBest = 0, dyBest = 0;
        for (let i = 0; i < points.length; i++) {
          const a = points[Math.max(0, i - 1)], b = points[i];
          const ax = a.x * w, ay = a.y * h, bx = b.x * w, by = b.y * h;
          const vx = bx - ax, vy = by - ay, len2 = vx * vx + vy * vy;
          const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / len2)) : 0;
          const dx = x - (ax + t * vx), dy = y - (ay + t * vy);
          const d = shape === 'rect' ? Math.max(Math.abs(dx), Math.abs(dy)) : Math.hypot(dx, dy);
          if (d < dist) { dist = d; dxBest = dx; dyBest = dy; }
        }
        if (dist > rad) continue;

        let strength;
        if (shape === 'rect') {
          const edge = Math.min(rad - Math.abs(dxBest), rad - Math.abs(dyBest));
          strength = Math.max(0.12, Math.min(1, (edge + feather) / feather));
        } else {
          strength = Math.pow(Math.max(0, 1 - dist / Math.max(1, rad)), 0.65);
        }
        if (strength <= 0) continue;

        if (effect === 'darken') {
          const factor = 1 - strength * 0.42;
          out.data[oi] = Math.max(4, Math.round(source[si] * factor));
          out.data[oi + 1] = Math.max(4, Math.round(source[si + 1] * factor));
          out.data[oi + 2] = Math.max(4, Math.round(source[si + 2] * factor));
        } else if (effect === 'trim') {
          const neigh = [[], [], []];
          for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
            if (!ox && !oy) continue;
            const xx = Math.max(0, Math.min(w - 1, x + ox)), yy = Math.max(0, Math.min(h - 1, y + oy));
            const ni = (yy * w + xx) * 4;
            for (let ch = 0; ch < 3; ch++) neigh[ch].push(source[ni + ch]);
          }
          const med = neigh.map(a => { a.sort((m, n) => m - n); return a[4]; });
          const lum = 0.299 * source[si] + 0.587 * source[si + 1] + 0.114 * source[si + 2];
          const medLum = 0.299 * med[0] + 0.587 * med[1] + 0.114 * med[2];
          const contrast = Math.abs(lum - medLum);
          if (contrast > 24) {
            const blend = Math.min(0.62, Math.max(0, (contrast - 24) / 90) * 0.62 * strength);
            for (let ch = 0; ch < 3; ch++) out.data[oi + ch] = Math.round(source[si + ch] * (1 - blend) + med[ch] * blend);
          }
        } else {
          const blend = Math.min(0.24, strength * 0.24);
          for (let ch = 0; ch < 3; ch++) out.data[oi + ch] = Math.round(source[si + ch] * (1 - blend) + softened[si + ch] * blend);
        }
        out.data[oi + 3] = source[si + 3];
      }
    }
    ctx.putImageData(out, minX, minY);
  }
  return targetCanvas;
}

function hideHairBrushMagnifier() {
  if (hairBrushMagnifier) hairBrushMagnifier.style.display = 'none';
}

function drawHairBrushMagnifier(pos) {
  if (!hairBrushMagnifier || !pos || !cachedMainImg ||
      !document.getElementById('hairBrushToggle')?.checked ||
      !document.getElementById('psZoomSelectMode')?.checked) {
    hideHairBrushMagnifier(); return;
  }
  const zoom = getBrushMagnification();
  if (zoom <= 1.01) { hideHairBrushMagnifier(); return; }
  const cw=liveEditCanvas.width, ch=liveEditCanvas.height;
  if (!cw || !ch) return;
  const sw=Math.max(1,cw/zoom), sh=Math.max(1,ch/zoom);
  const sx=Math.max(0,Math.min(cw-sw,pos.x-sw/2));
  const sy=Math.max(0,Math.min(ch-sh,pos.y-sh/2));
  const ctx=hairBrushMagnifier.getContext('2d');
  const mw=hairBrushMagnifier.width, mh=hairBrushMagnifier.height;
  ctx.clearRect(0,0,mw,mh);
  ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
  ctx.drawImage(liveEditCanvas,sx,sy,sw,sh,0,0,mw,mh);
  const kx=mw/sw, ky=mh/sh, lx=x=>(x-sx)*kx, ly=y=>(y-sy)*ky;
  const cx=lx(pos.x), cy=ly(pos.y);
  ctx.save(); ctx.strokeStyle='#f59e0b'; ctx.lineWidth=2; ctx.setLineDash([5,3]);
  if(currentHairStroke && currentHairStroke.points.length){
    const pts=currentHairStroke.points, p0=pts[0], p1=pts[pts.length-1];
    const x0=p0.x*cw,y0=p0.y*ch,x1=p1.x*cw,y1=p1.y*ch;
    if(currentHairStroke.shape==='circle'){
      const r=currentHairStroke.radiusNorm*Math.min(cw,ch);
      ctx.beginPath();ctx.arc(lx(x1),ly(y1),r*kx,0,Math.PI*2);ctx.stroke();
    }else if(currentHairStroke.shape==='rect'){
      const r=currentHairStroke.radiusNorm*Math.min(cw,ch);
      ctx.strokeRect(lx(x1-r),ly(y1-r),Math.max(1,2*r*kx),Math.max(1,2*r*ky));
    }else{
      ctx.beginPath();pts.forEach((p,i)=>{const x=lx(p.x*cw),y=ly(p.y*ch);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();
    }
  }else{
    const brushPx=parseFloat(document.getElementById('hairBrushSize')?.value)||24;
    ctx.beginPath();ctx.arc(cx,cy,Math.max(2,brushPx*mw/cw),0,Math.PI*2);ctx.stroke();
  }
  ctx.setLineDash([]);ctx.strokeStyle='#fff';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(cx-8,cy);ctx.lineTo(cx+8,cy);ctx.moveTo(cx,cy-8);ctx.lineTo(cx,cy+8);ctx.stroke();
  ctx.restore(); hairBrushMagnifier.style.display='block';
}

liveEditCanvas.addEventListener('pointerdown',(e)=>{
  const tool=document.getElementById('editToolSelect').value;
  if(!cachedMainImg||tool!=='ps_auto_retouch')return;
  e.preventDefault();try{liveEditCanvas.setPointerCapture(e.pointerId);}catch(_){}
  const pos=getSafeCanvasPos(liveEditCanvas,e);
  const nx=Math.max(0,Math.min(1,pos.x/Math.max(1,liveEditCanvas.width)));
  const ny=Math.max(0,Math.min(1,pos.y/Math.max(1,liveEditCanvas.height)));
  lastMagnifierPos=pos;
  if(document.getElementById('hairBrushToggle')?.checked){
    isBrushingHair=true;
    const brushPx=parseFloat(document.getElementById('hairBrushSize')?.value)||24;
    const canvasRect=liveEditCanvas.getBoundingClientRect();
    const scaleX=liveEditCanvas.width/Math.max(1,canvasRect.width);
    const scaleY=liveEditCanvas.height/Math.max(1,canvasRect.height);
    const radiusCanvas=(brushPx/2)*Math.max(scaleX,scaleY);
    currentHairStroke={
      shape:getSelectedBrushShape(),effect:getSelectedBrushEffect(),brushSizePx:brushPx,
      radiusNorm:radiusCanvas/Math.max(1,Math.min(liveEditCanvas.width,liveEditCanvas.height)),
      points:[{x:nx,y:ny}]
    };
    hairStrokes.push(currentHairStroke);lastHairPos=pos;
    renderLiveEditPreview().then(()=>drawHairBrushMagnifier(pos));
  }else drawHairBrushMagnifier(pos);
});

window.addEventListener('pointermove',(e)=>{
  const rect=liveEditCanvas.getBoundingClientRect();
  const inside=e.clientX>=rect.left&&e.clientX<=rect.right&&e.clientY>=rect.top&&e.clientY<=rect.bottom;
  if(!inside&&!isBrushingHair){hideHairBrushMagnifier();return;}
  const pos=getSafeCanvasPos(liveEditCanvas,e);
  const nx=Math.max(0,Math.min(1,pos.x/Math.max(1,liveEditCanvas.width)));
  const ny=Math.max(0,Math.min(1,pos.y/Math.max(1,liveEditCanvas.height)));
  lastMagnifierPos=pos;
  if(isBrushingHair&&currentHairStroke){
    if(lastHairPos&&Math.hypot(pos.x-lastHairPos.x,pos.y-lastHairPos.y)<1.5)return;
    currentHairStroke.points.push({x:nx,y:ny});lastHairPos=pos;
    renderLiveEditPreview().then(()=>drawHairBrushMagnifier(pos));
  }else if(inside)drawHairBrushMagnifier(pos);
});

const finishCanvasPointer=()=>{
  isBrushingHair=false;currentHairStroke=null;lastHairPos=null;
  drawHairBrushMagnifier(lastMagnifierPos);
};
window.addEventListener('pointerup',finishCanvasPointer);
window.addEventListener('pointercancel',finishCanvasPointer);
liveEditCanvas.addEventListener('pointerleave',()=>{if(!isBrushingHair)hideHairBrushMagnifier();});

document.querySelectorAll('.quick-bg-btn').forEach(btn => {
  btn.onclick = () => {
    setQuickStudioBg(btn.dataset.bgStyle, btn.dataset.bgColor);
  };
});

document.getElementById('psZoomSelectMode').onchange = () => {
  if (document.getElementById('psZoomSelectMode').checked && document.getElementById('hairBrushToggle')) document.getElementById('hairBrushToggle').checked = true;
  updatePsBgControls();
  renderLiveEditPreview().then(()=>drawHairBrushMagnifier(lastMagnifierPos));
};

document.getElementById('psZoomResetBoxBtn').onclick = () => {
  document.getElementById('psZoomScaleRange').value=1;
  document.getElementById('psZoomScaleNum').value=1;
  renderLiveEditPreview().then(()=>drawHairBrushMagnifier(lastMagnifierPos));
};

document.getElementById('hairUndoBtn').onclick = () => {
  if (hairStrokes.length) {
    hairStrokes.pop();
    renderLiveEditPreview();
  }
};
document.getElementById('hairResetBtn').onclick = () => {
  hairStrokes = [];
  renderLiveEditPreview();
};

document.getElementById('hairBrushToggle').onchange = () => {
  const active = document.getElementById('hairBrushToggle').checked;
  if (!active) { isBrushingHair = false; hideHairBrushMagnifier(); }
  liveEditCanvas.style.cursor = active ? 'cell' : 'default';
  updatePsBgControls();
  renderLiveEditPreview();
};

document.getElementById('hairBrushMode').onchange = () => {
  if (hairStrokes.length) {
    hairStrokes[hairStrokes.length - 1].effect = getSelectedBrushEffect();
    renderLiveEditPreview();
  }
};

if (document.getElementById('hairBrushShape')) {
  document.getElementById('hairBrushShape').onchange = () => {
    if (hairStrokes.length) {
      hairStrokes[hairStrokes.length - 1].shape = getSelectedBrushShape();
      renderLiveEditPreview();
    }
  };
}

if (document.getElementById('hairBrushSize')) {
  document.getElementById('hairBrushSize').oninput = () => {
    const val = document.getElementById('hairBrushSize').value;
    const lbl = document.getElementById('hairBrushSizeVal');
    if (lbl) lbl.textContent = `${val}px`;
    drawHairBrushMagnifier(lastMagnifierPos);
  };
}

function setQuickStudioBg(style, hexCol) {
  document.getElementById('psRemoveBgToggle').checked = true;
  document.getElementById('psBgStyleSelect').value = style;
  if (hexCol) document.getElementById('psBgCustomColor').value = hexCol;
  updatePsBgControls();
  renderLiveEditPreview();
}

function updatePsBgControls() {
  const enabled = document.getElementById('psRemoveBgToggle').checked;
  const hairActive = document.getElementById('hairBrushToggle').checked;
  const zoomActive = document.getElementById('psZoomSelectMode')?.checked;
  const bgStyle = document.getElementById('psBgStyleSelect').value;
  document.getElementById('psBgColorControls').classList.toggle('hidden', !enabled);
  document.getElementById('psCustomColorLbl').classList.toggle('hidden', !(enabled && bgStyle === 'solid_custom'));

  const splitEl = document.getElementById('psSplitRange');
  const splitLbl = document.getElementById('psSplitVal');
  if (splitEl && splitLbl) splitLbl.textContent = `${splitEl.value}%`;

  const hintEl = document.getElementById('canvasToolHint');
  if (zoomActive && hairActive) {
    if (hintEl) hintEl.textContent = 'Brush Magnifier Active: Move over the photo to inspect the exact area; drag to retouch that same area. Zoom does not crop the final photo.';
    document.getElementById('livePreviewCaption').textContent = 'Live Hair Retouch Preview • Magnified Brush Area';
  } else if (hairActive) {
    if (hintEl) hintEl.textContent = 'Hair Set Brush Active: Drag over top/side hairs to smooth, darken or trim stray strands.';
    document.getElementById('livePreviewCaption').textContent = 'Live Digital Studio Preview: Hair Brush & Digital Studio Retouch';
  } else {
    if (hintEl) hintEl.textContent = 'Tip: Enable Hair Set Brush to retouch. Brush Magnifier helps inspect the exact area.';
    document.getElementById('livePreviewCaption').textContent = enabled
      ? 'Live Digital Studio Preview (AI Background Removed)'
      : 'Live Digital Studio Preview (Left: Digital Retouched • Right: Original)';
  }
}

document.getElementById('psRemoveBgToggle').onchange = () => {
  updatePsBgControls();
  renderLiveEditPreview();
};
document.getElementById('psBgStyleSelect').onchange = () => {
  updatePsBgControls();
  renderLiveEditPreview();
};
document.getElementById('psBgCustomColor').oninput = renderLiveEditPreview;

function applyPhotoshopDigitalRetouch(sourceDrawable, targetW, targetH) {
  const depthPct = (parseFloat(document.getElementById('psDepthNum').value) || 0) / 100;
  const tonePct = (parseFloat(document.getElementById('psToneNum').value) || 0) / 100;
  const smoothPct = (parseFloat(document.getElementById('psSmoothNum').value) || 0) / 100;
  const sharpPct = (parseFloat(document.getElementById('psSharpNum').value) || 0) / 100;
  const autoWb = document.getElementById('psAutoWb').checked;

  const c = document.createElement('canvas');
  c.width = targetW; c.height = targetH;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceDrawable, 0, 0, targetW, targetH);

  if (smoothPct > 0.02) {
    const blurC = document.createElement('canvas');
    blurC.width = targetW; blurC.height = targetH;
    const bCtx = blurC.getContext('2d');
    const blurRad = Math.max(2, Math.round(Math.min(targetW, targetH) * 0.007 * smoothPct));
    bCtx.filter = `blur(${blurRad}px)`;
    bCtx.drawImage(c, 0, 0);
    bCtx.filter = 'none';

    const baseData = ctx.getImageData(0, 0, targetW, targetH);
    const blurData = bCtx.getImageData(0, 0, targetW, targetH);
    const bd = baseData.data, sd = blurData.data;

    for (let i = 0; i < bd.length; i += 4) {
      if (bd[i + 3] < 10) continue;
      const r = bd[i], g = bd[i + 1], b = bd[i + 2];
      const diff = (Math.abs(r - sd[i]) + Math.abs(g - sd[i + 1]) + Math.abs(b - sd[i + 2])) / 3;
      if (diff < 32) {
        const isSkin = (r > 65 && g > 35 && b > 18 && r > g && r > b && (r - g) > 8);
        const blend = smoothPct * (isSkin ? 0.72 : 0.30) * (1 - diff / 32);
        bd[i] = Math.round(r * (1 - blend) + sd[i] * blend);
        bd[i + 1] = Math.round(g * (1 - blend) + sd[i + 1] * blend);
        bd[i + 2] = Math.round(b * (1 - blend) + sd[i + 2] * blend);
      }
    }
    ctx.putImageData(baseData, 0, 0);
  }

  const imgData = ctx.getImageData(0, 0, targetW, targetH);
  const d = imgData.data;

  let scaleR = 1, scaleG = 1, scaleB = 1;
  if (autoWb) {
    let sumR = 0, sumG = 0, sumB = 0, count = 0;
    const step = Math.max(4, Math.floor((d.length / 4) / 25000) * 4);
    for (let i = 0; i < d.length; i += step) {
      if (d[i + 3] < 128) continue;
      sumR += d[i]; sumG += d[i + 1]; sumB += d[i + 2]; count++;
    }
    if (count > 0) {
      const avgR = sumR / count, avgG = sumG / count, avgB = sumB / count;
      const avgGray = (avgR + avgG + avgB) / 3;
      scaleR = Math.min(1.16, Math.max(0.86, 1 + ((avgGray / Math.max(1, avgR)) - 1) * 0.45));
      scaleG = Math.min(1.16, Math.max(0.86, 1 + ((avgGray / Math.max(1, avgG)) - 1) * 0.45));
      scaleB = Math.min(1.16, Math.max(0.86, 1 + ((avgGray / Math.max(1, avgB)) - 1) * 0.45));
    }
  }

  const contrastFactor = 1 + depthPct * 0.34;

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 5) continue;
    let r = d[i] * scaleR;
    let g = d[i + 1] * scaleG;
    let b = d[i + 2] * scaleB;

    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    if (tonePct > 0.01 && lum < 0.48) {
      const shadowLift = Math.pow((0.48 - lum) / 0.48, 1.5) * tonePct * 24;
      r += shadowLift;
      g += shadowLift;
      b += shadowLift;
    }

    r = (r - 128) * contrastFactor + 128;
    g = (g - 128) * contrastFactor + 128;
    b = (b - 128) * contrastFactor + 128;

    const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
    const sat = maxC > 0 ? (maxC - minC) / maxC : 0;
    const vibAmt = (depthPct * 0.24 + sharpPct * 0.12) * (1 - sat * 0.7);
    const avg = (r + g + b) / 3;
    r += (r - avg) * vibAmt;
    g += (g - avg) * vibAmt;
    b += (b - avg) * vibAmt;

    d[i] = Math.min(255, Math.max(0, Math.round(r)));
    d[i + 1] = Math.min(255, Math.max(0, Math.round(g)));
    d[i + 2] = Math.min(255, Math.max(0, Math.round(b)));
  }
  ctx.putImageData(imgData, 0, 0);

  if (sharpPct > 0.02) {
    const sData = ctx.getImageData(0, 0, targetW, targetH);
    const sd = sData.data;
    const copy = new Uint8ClampedArray(sd);
    const amt = sharpPct * 0.54;
    for (let y = 1; y < targetH - 1; y++) {
      for (let x = 1; x < targetW - 1; x++) {
        const idx = (y * targetW + x) * 4;
        if (copy[idx + 3] < 20) continue;
        for (let ch = 0; ch < 3; ch++) {
          const center = copy[idx + ch] * 5;
          const neighbors = copy[((y - 1) * targetW + x) * 4 + ch]
                          + copy[((y + 1) * targetW + x) * 4 + ch]
                          + copy[(y * targetW + (x - 1)) * 4 + ch]
                          + copy[(y * targetW + (x + 1)) * 4 + ch];
          const sharpVal = center - neighbors;
          sd[idx + ch] = Math.min(255, Math.max(0, Math.round(copy[idx + ch] * (1 - amt) + sharpVal * amt)));
        }
      }
    }
    ctx.putImageData(sData, 0, 0);
  }

  return applyHairSetBrushStrokes(c);
}

function compositeBackgroundBehindSubject(subjectCanvas) {
  const bgStyle = document.getElementById('psBgStyleSelect').value;
  if (bgStyle === 'transparent') return subjectCanvas;

  const outC = document.createElement('canvas');
  outC.width = subjectCanvas.width;
  outC.height = subjectCanvas.height;
  const ctx = outC.getContext('2d');

  if (bgStyle === 'studio_gradient') {
    const g = ctx.createRadialGradient(outC.width / 2, outC.height * 0.4, outC.width * 0.05, outC.width / 2, outC.height / 2, Math.max(outC.width, outC.height) * 0.8);
    g.addColorStop(0, '#475569');
    g.addColorStop(1, '#0f172a');
    ctx.fillStyle = g;
  } else if (bgStyle === 'passport_blue') {
    ctx.fillStyle = '#3b82f6';
  } else if (bgStyle === 'studio_slate') {
    ctx.fillStyle = '#334155';
  } else if (bgStyle === 'pure_white') {
    ctx.fillStyle = '#ffffff';
  } else {
    ctx.fillStyle = document.getElementById('psBgCustomColor').value || '#2563eb';
  }
  ctx.fillRect(0, 0, outC.width, outC.height);
  ctx.drawImage(subjectCanvas, 0, 0);
  return outC;
}

document.getElementById('psPresetSelect').onchange = (e) => {
  const p = e.target.value;
  const presets = {
    digital_crisp: { dp: 65, tn: 35, sm: 45, sh: 75, wb: true },
    studio_natural: { dp: 48, tn: 42, sm: 50, sh: 60, wb: true },
    passport_clean: { dp: 52, tn: 48, sm: 45, sh: 70, wb: true },
    deep_vibrant: { dp: 82, tn: 28, sm: 35, sh: 85, wb: true },
    soft_retouch: { dp: 45, tn: 40, sm: 80, sh: 55, wb: true }
  };
  const cfg = presets[p] || presets.digital_crisp;
  document.getElementById('psDepthRange').value = cfg.dp; document.getElementById('psDepthNum').value = cfg.dp;
  document.getElementById('psToneRange').value = cfg.tn; document.getElementById('psToneNum').value = cfg.tn;
  document.getElementById('psSmoothRange').value = cfg.sm; document.getElementById('psSmoothNum').value = cfg.sm;
  document.getElementById('psSharpRange').value = cfg.sh; document.getElementById('psSharpNum').value = cfg.sh;
  document.getElementById('psAutoWb').checked = cfg.wb;
  renderLiveEditPreview();
};

function prepareLogoSource(logoImg, removeWhiteBg) {
  const c = document.createElement('canvas');
  c.width = logoImg.width; c.height = logoImg.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(logoImg, 0, 0);
  if (removeWhiteBg) {
    const imgData = ctx.getImageData(0, 0, c.width, c.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235) {
        d[i + 3] = 0;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }
  return c;
}

function drawLogoOverlayOnCanvas(ctx, cw, ch, logoImg) {
  if (!logoImg) return;
  const opacity = (parseFloat(document.getElementById('logoOpacityNum').value) || 65) / 100;
  const sizePct = (parseFloat(document.getElementById('logoSizeNum').value) || 25) / 100;
  const posMode = document.getElementById('logoPosition').value;
  const margin = parseInt(document.getElementById('logoMargin').value) || 20;
  const removeWhite = document.getElementById('logoRemoveWhiteBg').checked;

  const cleanLogo = prepareLogoSource(logoImg, removeWhite);
  const lw = Math.max(16, Math.round(cw * sizePct));
  const lh = Math.max(16, Math.round((cleanLogo.height / cleanLogo.width) * lw));

  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0.05, opacity));

  if (posMode === 'tiled') {
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate(-Math.PI / 6);
    const stepX = lw + margin * 2.5;
    const stepY = lh + margin * 2.5;
    for (let y = -ch; y < ch; y += stepY) {
      for (let x = -cw; x < cw; x += stepX) {
        ctx.drawImage(cleanLogo, x, y, lw, lh);
      }
    }
  } else {
    let lx = cw - lw - margin;
    let ly = ch - lh - margin;
    if (posMode === 'bottom-left') { lx = margin; ly = ch - lh - margin; }
    else if (posMode === 'top-right') { lx = cw - lw - margin; ly = margin; }
    else if (posMode === 'top-left') { lx = margin; ly = margin; }
    else if (posMode === 'center') { lx = (cw - lw) / 2; ly = (ch - lh) / 2; }
    ctx.drawImage(cleanLogo, lx, ly, lw, lh);
  }
  ctx.restore();
}

async function renderLiveEditPreview() {
  const tool = document.getElementById('editToolSelect').value;
  const wrap = document.getElementById('liveEditPreviewWrap');
  if (!cachedMainImg || !['ps_auto_retouch', 'img_contrast', 'add_logo_photo'].includes(tool)) {
    wrap.classList.add('hidden');
    return;
  }
  wrap.classList.remove('hidden');
  updatePsBgControls();

  const maxDim = 540;
  const sc = Math.min(1, maxDim / Math.max(cachedMainImg.width, cachedMainImg.height));
  const pw = Math.round(cachedMainImg.width * sc);
  const ph = Math.round(cachedMainImg.height * sc);
  // Keep the canvas bitmap intact during a brush drag; resetting it can interrupt pointer tracking.
  if (liveEditCanvas.width !== pw) liveEditCanvas.width = pw;
  if (liveEditCanvas.height !== ph) liveEditCanvas.height = ph;
  const lctx = liveEditCanvas.getContext('2d');
  lctx.clearRect(0, 0, pw, ph);

  if (tool === 'ps_auto_retouch') {
    const zoomModeChecked = Boolean(document.getElementById('psZoomSelectMode')?.checked);
    const hairBrushChecked = Boolean(document.getElementById('hairBrushToggle')?.checked);
    liveEditCanvas.style.cursor = hairBrushChecked ? 'cell' : 'default';

    const removeBg = document.getElementById('psRemoveBgToggle').checked;
    let baseSrc = cachedMainImg;
    if (removeBg) {
      if (!cachedTransparentCutout) {
        const st = document.getElementById('editStatus');
        st.textContent = 'AI Removing Background for Live Preview...';
        st.classList.remove('hidden');
        cachedTransparentCutout = await runSelfieSegmentation(cachedMainImg, 'transparent');
        st.classList.add('hidden');
      }
      baseSrc = cachedTransparentCutout;
    }

    const workingSrc = getActiveWorkingSource(baseSrc);
    const enhanced = applyPhotoshopDigitalRetouch(workingSrc, pw, ph);
    const finalEnhanced = removeBg ? compositeBackgroundBehindSubject(enhanced) : enhanced;

    if (removeBg || zoomModeChecked) {
      lctx.drawImage(finalEnhanced, 0, 0, pw, ph);
    } else {
      const splitPct = (parseFloat(document.getElementById('psSplitRange').value) ?? 100) / 100;
      const splitX = Math.round(pw * splitPct);
      lctx.drawImage(workingSrc, 0, 0, pw, ph);
      if (splitX > 0) {
        lctx.drawImage(finalEnhanced, 0, 0, splitX, ph, 0, 0, splitX, ph);
      }
      if (splitX > 2 && splitX < pw - 2) {
        lctx.strokeStyle = '#ffffff';
        lctx.lineWidth = 2;
        lctx.beginPath(); lctx.moveTo(splitX, 0); lctx.lineTo(splitX, ph); lctx.stroke();
      }
    }

    if (zoomSelectionNorm && isSelectingZoom) {
      const rx = zoomSelectionNorm.x * pw;
      const ry = zoomSelectionNorm.y * ph;
      const rw = zoomSelectionNorm.w * pw;
      const rh = zoomSelectionNorm.h * ph;
      lctx.save();
      lctx.strokeStyle = '#0284c7';
      lctx.lineWidth = 2.5;
      lctx.setLineDash([6, 4]);
      lctx.strokeRect(rx, ry, rw, rh);
      lctx.restore();
    }

    if (hairBrushChecked && currentHairStroke && currentHairStroke.points.length) {
      const shape = currentHairStroke.shape || 'freehand';
      const pts = currentHairStroke.points;
      const p1 = pts[pts.length - 1];
      const cx = p1.x * pw, cy = p1.y * ph;
      const rad = Math.max(1, Math.round(currentHairStroke.radiusNorm * Math.min(pw, ph)));
      lctx.save();
      lctx.strokeStyle = '#f59e0b';
      lctx.lineWidth = 2;
      lctx.setLineDash([5, 3]);
      if (shape === 'circle') {
        lctx.beginPath();
        lctx.arc(cx, cy, rad, 0, Math.PI * 2);
        lctx.stroke();
      } else if (shape === 'rect') {
        lctx.strokeRect(cx - rad, cy - rad, rad * 2, rad * 2);
      } else {
        lctx.beginPath();
        pts.forEach((pt, idx) => {
          const pxPt = pt.x * pw, pyPt = pt.y * ph;
          if (idx === 0) lctx.moveTo(pxPt, pyPt);
          else lctx.lineTo(pxPt, pyPt);
        });
        lctx.setLineDash([]);
        lctx.lineWidth = Math.max(1, rad * 2);
        lctx.lineCap = 'round';
        lctx.lineJoin = 'round';
        lctx.stroke();
      }
      lctx.restore();
    }
  } else if (tool === 'img_contrast') {
    liveEditCanvas.style.cursor = 'default';
    const cVal = Math.max(10, parseFloat(document.getElementById('cbContrastNum').value) || 100);
    const bVal = Math.max(10, parseFloat(document.getElementById('cbBrightnessNum').value) || 100);
    lctx.filter = `contrast(${cVal}%) brightness(${bVal}%)`;
    lctx.drawImage(cachedMainImg, 0, 0, pw, ph);
    lctx.filter = 'none';
  } else if (tool === 'add_logo_photo') {
    liveEditCanvas.style.cursor = 'default';
    lctx.drawImage(cachedMainImg, 0, 0, pw, ph);
    drawLogoOverlayOnCanvas(lctx, pw, ph, cachedLogoImg);
  }
}

document.getElementById('editFiles').onchange = async (e) => {
  const f = e.target.files[0];
  cachedTransparentCutout = null;
  hairStrokes = [];
  zoomSelectionNorm = null;
  if (!f) { cachedMainImg = null; renderLiveEditPreview(); return; }
  cachedMainImg = await loadImg(URL.createObjectURL(f));
  renderLiveEditPreview();
};

document.getElementById('logoOverlayFile').onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) { cachedLogoImg = null; renderLiveEditPreview(); return; }
  cachedLogoImg = await loadImg(URL.createObjectURL(f));
  renderLiveEditPreview();
};

function bindRangeAndNum(rangeId, numId, onChangeCb) {
  const r = document.getElementById(rangeId), n = document.getElementById(numId);
  if (!r || !n) return;
  r.oninput = () => { n.value = r.value; if (onChangeCb) onChangeCb(); };
  n.oninput = () => { r.value = n.value; if (onChangeCb) onChangeCb(); };
}
bindRangeAndNum('psDepthRange', 'psDepthNum', renderLiveEditPreview);
bindRangeAndNum('psToneRange', 'psToneNum', renderLiveEditPreview);
bindRangeAndNum('psSmoothRange', 'psSmoothNum', renderLiveEditPreview);
bindRangeAndNum('psSharpRange', 'psSharpNum', renderLiveEditPreview);
bindRangeAndNum('cbContrastRange', 'cbContrastNum', renderLiveEditPreview);
bindRangeAndNum('cbBrightnessRange', 'cbBrightnessNum', renderLiveEditPreview);
bindRangeAndNum('logoOpacityRange', 'logoOpacityNum', renderLiveEditPreview);
bindRangeAndNum('logoSizeRange', 'logoSizeNum', renderLiveEditPreview);
bindRangeAndNum('psZoomScaleRange','psZoomScaleNum',()=>renderLiveEditPreview().then(()=>drawHairBrushMagnifier(lastMagnifierPos)));
if (document.getElementById('psZoomSharpToggle')) {
  document.getElementById('psZoomSharpToggle').onchange = renderLiveEditPreview;
}

document.getElementById('psAutoWb').onchange = renderLiveEditPreview;
document.getElementById('psSplitRange').oninput = renderLiveEditPreview;
document.getElementById('logoPosition').onchange = renderLiveEditPreview;
document.getElementById('logoMargin').oninput = renderLiveEditPreview;
document.getElementById('logoRemoveWhiteBg').onchange = renderLiveEditPreview;

document.getElementById('cbResetBtn').onclick = () => {
  document.getElementById('cbContrastRange').value = 100; document.getElementById('cbContrastNum').value = 100;
  document.getElementById('cbBrightnessRange').value = 100; document.getElementById('cbBrightnessNum').value = 100;
  renderLiveEditPreview();
};

const PRO_FRAME_NAMES = [
  'Royal Gold', 'Silver Shine', 'Rose Gold', 'Neon Cyan', 'Neon Magenta',
  'Obsidian Pro', 'Ivory Mat', 'Champagne Gold', 'Emerald Luxe', 'Sapphire Pro',
  'Crimson Royal', 'Violet Glow', 'Sunset Amber', 'Mint Studio', 'Polaroid Classic',
  'Polaroid Dark', 'Double Gold', 'Double Navy', 'Triple Frame', 'Corner Gold',
  'Corner Silver', 'Corner Red', 'Corner Blue', 'Corner Emerald', 'Corner Purple',
  'Vintage Parchment', 'Art Deco Gold', 'Minimalist Slate', 'Film Strip', 'Cinema Frame',
  'Wedding Gold', 'Wedding Rose', 'Award Bronze', 'Award Platinum', 'Modern Teal',
  'Coral Border', 'Cobalt Grid', 'Indigo Frame', 'Lime Pop', 'Peach Soft',
  'Steel Metallic', 'Copper Gloss', 'Midnight Gold', 'Ruby Luxe', 'Aqua Frame',
  'Lavender Soft', 'Mustard Bold', 'Charcoal Mat', 'Pearl White', 'Pro Studio Edge'
];
let selectedFrameIndex = 0;

function drawProFrame(ctx, w, h, idx, thickPct) {
  const t = Math.max(5, Math.round(Math.min(w, h) * (thickPct / 100)));
  const palette = [
    ['#b45309', '#fbbf24', '#fef3c7'], ['#475569', '#cbd5e1', '#f8fafc'],
    ['#9d174d', '#f472b6', '#fce7f3'], ['#0284c7', '#22d3ee', '#cffafe'],
    ['#9333ea', '#e879f9', '#fae8ff'], ['#09090b', '#27272a', '#a1a1aa'],
    ['#d6d3d1', '#fafaf9', '#78716c'], ['#a16207', '#fde047', '#fef9c3'],
    ['#065f46', '#10b981', '#d1fae5'], ['#1e40af', '#3b82f6', '#dbeafe'],
    ['#991b1b', '#ef4444', '#fee2e2'], ['#5b21b6', '#8b5cf6', '#ede9fe'],
    ['#c2410c', '#fb923c', '#ffedd5'], ['#0f766e', '#2dd4bf', '#ccfbf1']
  ];
  const [c1, c2, c3] = palette[idx % palette.length];
  ctx.save();
  const styleType = idx % 5;

  if (styleType === 0) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, c1); g.addColorStop(0.5, c2); g.addColorStop(1, c1);
    ctx.strokeStyle = g; ctx.lineWidth = t * 2; ctx.strokeRect(0, 0, w, h);
    ctx.strokeStyle = c3; ctx.lineWidth = Math.max(1.5, t * 0.22);
    ctx.strokeRect(t * 0.75, t * 0.75, w - t * 1.5, h - t * 1.5);
  } else if (styleType === 1) {
    ctx.strokeStyle = c1; ctx.lineWidth = t * 1.9; ctx.strokeRect(0, 0, w, h);
    ctx.strokeStyle = c2; ctx.lineWidth = Math.max(2, t * 0.35);
    ctx.strokeRect(t * 1.1, t * 1.1, w - t * 2.2, h - t * 2.2);
  } else if (styleType === 2) {
    ctx.strokeStyle = c2; ctx.lineWidth = t * 1.3; ctx.strokeRect(0, 0, w, h);
    const cs = t * 2.5;
    ctx.fillStyle = c1;
    [[0, 0], [w - cs, 0], [0, h - cs], [w - cs, h - cs]].forEach(([cx, cy]) => ctx.fillRect(cx, cy, cs, cs));
    ctx.strokeStyle = c3; ctx.lineWidth = 2;
    [[2, 2], [w - cs + 2, 2], [2, h - cs + 2], [w - cs + 2, h - cs + 2]].forEach(([cx, cy]) => ctx.strokeRect(cx, cy, cs - 4, cs - 4));
  } else if (styleType === 3) {
    ctx.strokeStyle = c3; ctx.lineWidth = t * 2.1; ctx.strokeRect(0, 0, w, h);
    ctx.fillStyle = c3; ctx.fillRect(0, h - t * 3.1, w, t * 3.1);
    ctx.strokeStyle = c1; ctx.lineWidth = 2; ctx.strokeRect(2, 2, w - 4, h - 4);
  } else {
    ctx.strokeStyle = c1; ctx.lineWidth = t * 1.5; ctx.strokeRect(t * 0.4, t * 0.4, w - t * 0.8, h - t * 0.8);
    ctx.setLineDash([t * 1.2, t * 0.6]);
    ctx.strokeStyle = c2; ctx.lineWidth = Math.max(2, t * 0.35);
    ctx.strokeRect(t * 1.2, t * 1.2, w - t * 2.4, h - t * 2.4);
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function init50FrameGallery() {
  const gal = document.getElementById('frameGallery');
  gal.innerHTML = '';
  PRO_FRAME_NAMES.forEach((name, idx) => {
    const item = document.createElement('div');
    item.className = 'frame-thumb' + (idx === selectedFrameIndex ? ' selected' : '');
    const c = document.createElement('canvas'); c.width = 58; c.height = 68;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e2e8f0'; ctx.fillRect(8, 10, 42, 48);
    drawProFrame(ctx, 58, 68, idx, 9);
    const lbl = document.createElement('span');
    lbl.textContent = `${String(idx + 1).padStart(2, '0')}. ${name}`;
    lbl.title = `${String(idx + 1).padStart(2, '0')}. ${name}`;
    item.appendChild(c); item.appendChild(lbl);
    item.onclick = () => {
      selectedFrameIndex = idx;
      document.getElementById('customFrameFile').value = '';
      document.querySelectorAll('.frame-thumb').forEach(el => el.classList.remove('selected'));
      item.classList.add('selected');
      document.getElementById('selectedFrameBadge').textContent = `Selected: ${String(idx + 1).padStart(2, '0')}. ${name}`;
    };
    gal.appendChild(item);
  });
}
init50FrameGallery();

function updateEditToolUI() {
  const v = document.getElementById('editToolSelect').value;
  document.getElementById('sigPadWrap').classList.toggle('hidden', v !== 'sig_maker');
  document.getElementById('hwTextWrap').classList.toggle('hidden', v !== 'text_handwriting');
  document.getElementById('edImgFileLbl').classList.toggle('hidden', ['sig_maker', 'text_handwriting', 'latex_img'].includes(v));
  document.getElementById('psRetouchWrap').classList.toggle('hidden', v !== 'ps_auto_retouch');
  document.getElementById('ndOptionsWrap').classList.toggle('hidden', v !== 'name_date');
  document.getElementById('logoOptionsWrap').classList.toggle('hidden', v !== 'add_logo_photo');
  document.getElementById('frameOptionsWrap').classList.toggle('hidden', v !== 'photo_frame');
  document.getElementById('cbControlsWrap').classList.toggle('hidden', v !== 'img_contrast');
  document.getElementById('edText1Lbl').classList.toggle('hidden', !['name_date', 'add_text_img', 'watermark_img', 'text_handwriting', 'latex_img'].includes(v));
  document.getElementById('edText2Lbl').classList.toggle('hidden', v !== 'name_date');
  document.getElementById('edFontLbl').classList.toggle('hidden', !['name_date', 'add_text_img', 'watermark_img', 'text_handwriting', 'latex_img'].includes(v));
  document.getElementById('edBoldLbl').classList.toggle('hidden', !['name_date', 'add_text_img', 'watermark_img', 'text_handwriting', 'latex_img'].includes(v));
  document.getElementById('edColorLbl').classList.toggle('hidden', !['name_date', 'add_border', 'add_text_img', 'watermark_img', 'text_handwriting', 'latex_img'].includes(v));
  document.getElementById('edNumWrap').classList.toggle('hidden', !['add_border', 'blur_image', 'rotate', 'blur_bg'].includes(v));
  if (v === 'name_date' && document.getElementById('editColor').value === '#1e293b') {
    document.getElementById('editColor').value = '#ffffff';
  }
  updatePsBgControls();
  renderLiveEditPreview();
}
document.getElementById('editToolSelect').onchange = updateEditToolUI;
updateEditToolUI();

document.getElementById('editRunBtn').onclick = async () => {
  const tool = document.getElementById('editToolSelect').value;
  const out = document.getElementById('editOutput');
  const status = document.getElementById('editStatus');
  out.innerHTML = ''; status.classList.add('hidden');
  const files = Array.from(document.getElementById('editFiles').files);
  const t1 = document.getElementById('editText1').value;
  const t2 = document.getElementById('editText2').value;
  const n1 = parseFloat(document.getElementById('editNum1').value) || 10;
  const col = document.getElementById('editColor').value;
  const chosenFont = document.getElementById('editFontFamily').value;
  const isBold = document.getElementById('editBoldToggle').checked;

  if (tool === 'sig_maker') {
    addDownloadCard(out, await toBlob(sigCanvas, 'image/png', 1), 'signature.png', 'Digital Signature PNG');
    return;
  }

  if (tool === 'text_handwriting') {
    const text = document.getElementById('hwLongText').value || t1 || 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ • नमस्ते • Hello';
    const c = document.createElement('canvas'); c.width = 900; c.height = 1200;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fffdf7'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1;
    for (let y = 110; y < 1150; y += 38) { ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(840, y); ctx.stroke(); }
    ctx.strokeStyle = '#f87171'; ctx.beginPath(); ctx.moveTo(110, 0); ctx.lineTo(110, 1200); ctx.stroke();
    ctx.fillStyle = col; ctx.font = buildCanvasFontStr(isBold, 26, chosenFont);
    const words = text.split(/\s+/);
    let line = '', y = 104;
    for (const w of words) {
      const test = line + w + ' ';
      if (ctx.measureText(test).width > 700) { ctx.fillText(line, 125, y); line = w + ' '; y += 38; }
      else line = test;
    }
    ctx.fillText(line, 125, y);
    addDownloadCard(out, await toBlob(c, 'image/jpeg', 0.95), 'handwriting_page.jpg', 'Handwriting Page Created');
    return;
  }

  if (tool === 'latex_img') {
    const expr = t1 || 'E = mc²  |  x = (-b ± √(b² - 4ac)) / 2a';
    const c = document.createElement('canvas'); c.width = 900; c.height = 240;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = col; ctx.font = buildCanvasFontStr(isBold, 34, chosenFont);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(expr, c.width / 2, c.height / 2);
    addDownloadCard(out, await toBlob(c, 'image/png', 1), 'formula_image.png', 'Formula / LaTeX Image');
    return;
  }

  if (!files.length) return alert('Please select image file(s).');
  const imgs = await Promise.all(files.map(f => loadImg(URL.createObjectURL(f))));

  if (tool === 'join_images' || tool === 'merge_photo_sig') {
    const c = document.createElement('canvas');
    if (tool === 'merge_photo_sig') {
      c.width = Math.max(...imgs.map(i => i.width)); c.height = imgs.reduce((acc, i) => acc + i.height, 0);
    } else {
      c.width = imgs.reduce((acc, i) => acc + i.width, 0); c.height = Math.max(...imgs.map(i => i.height));
    }
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    let pos = 0;
    for (const im of imgs) {
      if (tool === 'merge_photo_sig') { ctx.drawImage(im, 0, pos); pos += im.height; }
      else { ctx.drawImage(im, pos, 0); pos += im.width; }
    }
    addDownloadCard(out, await toBlob(c, 'image/jpeg', 0.94), `${tool}.jpg`, `${c.width}×${c.height}px`);
    return;
  }

  const im = imgs[0];

  if (tool === 'ps_auto_retouch') {
    const removeBg = document.getElementById('psRemoveBgToggle').checked;
    const bgStyle = document.getElementById('psBgStyleSelect').value;
    status.textContent = removeBg
      ? 'Removing Background & Applying Digital Studio Retouch...'
      : 'Applying Photoshop Digital Studio Look...';
    status.classList.remove('hidden');

    const baseSource = removeBg
      ? (cachedTransparentCutout || (cachedTransparentCutout = await runSelfieSegmentation(im, 'transparent')))
      : im;

    const workingSrc = getActiveWorkingSource(baseSource);
    const outW = workingSrc.width || im.width;
    const outH = workingSrc.height || im.height;

    const enhancedSubject = applyPhotoshopDigitalRetouch(workingSrc, outW, outH);
    const finalCanvas = removeBg ? compositeBackgroundBehindSubject(enhancedSubject) : enhancedSubject;
    status.classList.add('hidden');

    if (removeBg && bgStyle === 'transparent') {
      addDownloadCard(out, await toBlob(finalCanvas, 'image/png', 1.0), `digital_nobg_${files[0].name.replace(/\.[^/.]+$/, '')}.png`, `Transparent PNG • No Background (${outW}×${outH}px)`);
    } else {
      addDownloadCard(out, await toBlob(finalCanvas, 'image/jpeg', 0.97), `digital_studio_${files[0].name.replace(/\.[^/.]+$/, '')}.jpg`, `Digital Studio (${outW}×${outH}px)`);
    }
    return;
  }

  if (tool === 'blur_bg') {
    status.textContent = 'Applying AI Portrait Background Blur...'; status.classList.remove('hidden');
    const blurred = await runSelfieSegmentation(im, 'blur_bg', Math.max(4, n1));
    status.classList.add('hidden');
    addDownloadCard(out, await toBlob(blurred, 'image/jpeg', 0.94), 'blur_background.jpg', 'Background Blurred');
    return;
  }

  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const rad = (n1 * Math.PI) / 180;
  if (tool === 'rotate') {
    c.width = Math.abs(im.width * Math.cos(rad)) + Math.abs(im.height * Math.sin(rad));
    c.height = Math.abs(im.width * Math.sin(rad)) + Math.abs(im.height * Math.cos(rad));
    ctx.translate(c.width / 2, c.height / 2); ctx.rotate(rad); ctx.drawImage(im, -im.width / 2, -im.height / 2);
  } else {
    c.width = im.width; c.height = im.height;
    if (tool === 'flip') { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
    if (tool === 'blur_image') ctx.filter = `blur(${Math.max(1, n1)}px)`;
    if (tool === 'img_contrast') {
      const cVal = Math.max(10, parseFloat(document.getElementById('cbContrastNum').value) || 100);
      const bVal = Math.max(10, parseFloat(document.getElementById('cbBrightnessNum').value) || 100);
      ctx.filter = `contrast(${cVal}%) brightness(${bVal}%)`;
    }
    ctx.drawImage(im, 0, 0, c.width, c.height);
    ctx.filter = 'none';

    if (tool === 'add_logo_photo') {
      const logoF = document.getElementById('logoOverlayFile').files[0];
      if (!logoF && !cachedLogoImg) return alert('Please upload a Logo image first.');
      const logoImg = cachedLogoImg || await loadImg(URL.createObjectURL(logoF));
      drawLogoOverlayOnCanvas(ctx, c.width, c.height, logoImg);
    }

    if (tool === 'add_border') {
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(4, n1 || 12);
      ctx.strokeRect(0, 0, c.width, c.height);
    }

    if (tool === 'photo_frame') {
      const customF = document.getElementById('customFrameFile').files[0];
      const thickPct = parseFloat(document.getElementById('frameThickness').value) || 6;
      if (customF) {
        const frameImg = await loadImg(URL.createObjectURL(customF));
        ctx.drawImage(frameImg, 0, 0, c.width, c.height);
      } else {
        drawProFrame(ctx, c.width, c.height, selectedFrameIndex, thickPct);
      }
    }

    if (tool === 'name_date') {
      const styleMode = document.getElementById('ndBgStyle').value;
      const posMode = document.getElementById('ndPosition').value;
      const orient = document.getElementById('ndOrientation').value;
      const sizePct = parseFloat(document.getElementById('ndFontSizePct').value) || 5;
      const labelStr = `${t1 || 'Name'}${t2 ? '  |  ' + t2 : ''}`;
      const fs = Math.max(16, Math.round(Math.min(c.width, c.height) * (sizePct / 100)));

      ctx.save();
      ctx.font = buildCanvasFontStr(isBold, fs, chosenFont);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const pad = Math.round(fs * 0.85);
      let cx = c.width / 2, cy = c.height - pad * 1.4;
      if (posMode === 'top') { cx = c.width / 2; cy = pad * 1.4; }
      else if (posMode === 'center') { cx = c.width / 2; cy = c.height / 2; }
      else if (posMode === 'left') { cx = pad * 1.5; cy = c.height / 2; }
      else if (posMode === 'right') { cx = c.width - pad * 1.5; cy = c.height / 2; }

      if (styleMode === 'white_strip') {
        const bh = Math.round(fs * 2.1);
        ctx.fillStyle = '#ffffff';
        if (posMode === 'top') ctx.fillRect(0, 0, c.width, bh);
        else if (posMode === 'left') ctx.fillRect(0, 0, bh, c.height);
        else if (posMode === 'right') ctx.fillRect(c.width - bh, 0, bh, c.height);
        else ctx.fillRect(0, c.height - bh, c.width, bh);
      } else if (styleMode === 'transparent_glass') {
        const bh = Math.round(fs * 2.0);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
        if (posMode === 'top') ctx.fillRect(0, 0, c.width, bh);
        else if (posMode === 'center') ctx.fillRect(0, c.height / 2 - bh / 2, c.width, bh);
        else if (posMode === 'left') ctx.fillRect(0, 0, bh, c.height);
        else if (posMode === 'right') ctx.fillRect(c.width - bh, 0, bh, c.height);
        else ctx.fillRect(0, c.height - bh, c.width, bh);
      }

      ctx.translate(cx, cy);
      if (orient === 'vertical') ctx.rotate(-Math.PI / 2);

      if (styleMode === 'transparent_outline') {
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(3, Math.round(fs * 0.16));
        ctx.strokeStyle = (col.toLowerCase() === '#000000') ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.88)';
        ctx.strokeText(labelStr, 0, 0);
      }
      ctx.fillStyle = col;
      ctx.fillText(labelStr, 0, 0);
      ctx.restore();
    }

    if (tool === 'add_text_img') {
      const fs = Math.max(24, Math.round(c.width * 0.05));
      ctx.fillStyle = col;
      ctx.font = buildCanvasFontStr(isBold, fs, chosenFont);
      ctx.textAlign = 'center';
      ctx.fillText(t1 || 'Sample Text', c.width / 2, c.height * 0.88);
    }
    if (tool === 'watermark_img') {
      ctx.save(); ctx.translate(c.width / 2, c.height / 2); ctx.rotate(-Math.PI / 6);
      ctx.fillStyle = col; ctx.globalAlpha = 0.35;
      ctx.font = buildCanvasFontStr(isBold, Math.max(28, Math.round(c.width * 0.06)), chosenFont);
      ctx.textAlign = 'center';
      ctx.fillText(t1 || 'WATERMARK', 0, 0); ctx.restore();
    }
  }
  addDownloadCard(out, await toBlob(c, 'image/jpeg', 0.94), `${tool}_result.jpg`, 'Processed Image');
};
