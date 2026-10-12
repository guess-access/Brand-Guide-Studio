/* ============================================================
   PK.variations — logo variation engine
   Suggest. #4: auto-derive primary / secondary / submark /
   favicon / mono light+dark / one-color from ONE upload.
   ============================================================ */
window.PK = window.PK || {};
PK.variations = (function () {
  'use strict';
  const U = PK.util;
  const LH = PK.logoHealth;

  /* ---------- raster recolor (keeps alpha) ---------- */
  function recolorCanvas(src, hex) {
    const c = U.makeCanvas(src.width, src.height);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    const target = U.hexToRgb(hex);
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      d[i] = target.r; d[i + 1] = target.g; d[i + 2] = target.b;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  /* ---------- SVG recolor (flat fills only; gradients flagged) ---------- */
  function svgRecolor(svgText, hex) {
    return svgText
      .replace(/fill="(?!none)[^"]*"/gi, 'fill="' + hex + '"')
      .replace(/stroke="(?!none)[^"]*"/gi, 'stroke="' + hex + '"')
      .replace(/fill:\s*(?!none)[^;}]*/gi, 'fill: ' + hex)
      .replace(/stroke:\s*(?!none)[^;}]*/gi, 'stroke: ' + hex);
  }

  function svgHasGradient(svgText) {
    return /gradient|linearGradient|radialGradient/i.test(svgText || '');
  }

  /* ---------- crop to ink bounds + tight canvas ---------- */
  function trimmed(src) {
    const box = LH.inkBox(src);
    const c = U.makeCanvas(Math.max(1, box.w), Math.max(1, box.h));
    c.getContext('2d').drawImage(src, -box.x, -box.y);
    return c;
  }

  /* ---------- build all variants ---------- */
  async function build(kit, health, svgText) {
    const U2 = U;
    const notes = [];
    const brand = {
      primary: kit.colors.primary,
      ink: kit.colors.ink || '#1B1D2A',
      paper: kit.colors.paper || '#F4F1EA'
    };
    const name = kit.name || 'Brand';
    const isSvg = !!(svgText && !svgText.startsWith('data:image/png') && svgText.slice(0, 200).includes('<svg'));

    /* raster base of the primary logo */
    let baseImg = kit.logo && kit.logo.dataURL;
    let img;
    try { img = await LH.loadImage(baseImg); }
    catch (e) { notes.push('Primary logo could not be decoded.'); }

    let primaryCanvas = null, svgForExport = null;
    if (svgText && svgText.slice(0, 200).includes('<svg')) {
      svgForExport = svgText;                     // keep the original vector
      // give intrinsic-size-less SVGs an explicit box so canvas can rasterize them
      const sized = svgText.replace(/<svg(?![^>]*\bwidth=)/i, '<svg width="1024" height="1024"');
      try { img = await LH.loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sized)); } catch (e) {}
    }
    if (img && !(img.naturalWidth || img.width)) { /* not decoded — leave primaryCanvas null */ }
    if (img) primaryCanvas = trimmed(LH.toCanvas(img));

    if (health && health.needsManualFix)
      notes.push('Flagged by the health check — mono variants may need a manual touch: ' + health.issues[0]);

    const out = { primary: null, secondary: null, submark: null, favicon: {}, monoLight: null, monoDark: null, oneColor: null, notes, clearSpace: null, minSizes: {} };

    if (!primaryCanvas) {
      out.notes.push('No logo loaded — text-only lockups were used.');
      return out;
    }

    out.primary = primaryCanvas.toDataURL ? primaryCanvas.toDataURL('image/png') : primaryCanvas;

    /* mono + one-color variants */
    const gradientBlock = health && health.isPhotographic;
    const svgGrad = svgText && svgHasGradient(svgText);

    if (isSvg && svgForExport) {
      const paintSwap = (hex, tag) => {
        if (svgGrad) { notes.push(tag + ' skipped — logo uses gradients.'); return null; }
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgRecolor(svgForExport, hex));
      };
      if (!gradientBlock) {
        out.monoLight = paintSwap('#FFFFFF', 'Mono light');
        out.monoDark = paintSwap('#111318', 'Mono dark');
        out.oneColor = paintSwap(brand.primary, 'One-color (' + brand.primary + ')');
      }
    }
    if (!out.monoLight && !gradientBlock) out.monoLight = recolorCanvas(primaryCanvas, '#FFFFFF').toDataURL('image/png');
    if (!out.monoDark && !gradientBlock) out.monoDark = recolorCanvas(primaryCanvas, '#111318').toDataURL('image/png');
    if (!out.oneColor && !gradientBlock) out.oneColor = recolorCanvas(primaryCanvas, brand.primary).toDataURL('image/png');
    if (gradientBlock) notes.push('Photo/gradient logo — mono recolors skipped (fix: flatten colors first).');

    /* secondary = stacked lockup (mark over wordmark) */
    try {
      const W = 900, H = 900;
      const c = U.makeCanvas(W, H);
      const ctx = c.getContext('2d');
      const lock = trimmed(LH.toCanvas(img));
      const maxW = W * 0.62, maxH = H * 0.58;
      const r = Math.min(maxW / lock.width, maxH / lock.height);
      ctx.drawImage(lock, (W - lock.width * r) / 2, H * 0.08, lock.width * r, lock.height * r);
      // wordmark
      let px = 92;
      ctx.font = '500 ' + px + 'px ' + U2.FONTS.heading;
      const nameW = ctx.measureText(name).width;
      if (nameW > W * 0.9) { px = Math.floor(px * (W * 0.9) / nameW); ctx.font = '500 ' + px + 'px ' + U2.FONTS.heading; }
      ctx.textAlign = 'center';
      ctx.fillStyle = brand.ink;
      ctx.fillText(name, W / 2, H * 0.88);
      out.secondary = c.toDataURL('image/png');
    } catch (e) { notes.push('Stacked lockup failed: ' + e.message); }

    /* submark = square-ified mark, or monogram initials if too wide */
    try {
      const mark = trimmed(LH.toCanvas(img));
      const S = 640;
      const c = U.makeCanvas(S, S);
      const ctx = c.getContext('2d');
      const ratio = mark.width / mark.height;
      if (ratio >= 0.55 && ratio <= 1.8) {
        const r = Math.min((S * 0.86) / mark.width, (S * 0.86) / mark.height);
        ctx.drawImage(mark, (S - mark.width * r) / 2, (S - mark.height * r) / 2, mark.width * r, mark.height * r);
      } else {
        // wide/tall lockups → monogram
        const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
        ctx.fillStyle = brand.primary;
        ctx.beginPath();
        ctx.arc(S / 2, S / 2, S * 0.44, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = U2.readableInk(brand.primary);
        ctx.font = '600 ' + Math.floor(S * 0.34) + 'px ' + U2.FONTS.heading;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initials, S / 2, S / 2 + S * 0.01);
        notes.push('Wide logo → submark built from initials monogram.');
      }
      out.submark = c.toDataURL('image/png');
    } catch (e) { notes.push('Submark build failed: ' + e.message); }

    /* favicon set from submark */
    try {
      const sm = await LH.loadImage(out.submark);
      [16, 32, 48, 180].forEach((px) => {
        const c = U.makeCanvas(px, px);
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(sm, 0, 0, px, px);
        out.favicon[px] = c.toDataURL('image/png');
      });
    } catch (e) { notes.push('Favicon set failed: ' + e.message); }

    /* clear-space + min size rules */
    try {
      const baseW = primaryCanvas.width;
      out.clearSpace = { x: baseW * 0.25, y: baseW * 0.25, ratio: 0.25 };
      out.minSizes = {
        print: Math.max(24, Math.round(baseW * 0.18)),
        screen: Math.max(16, Math.round(baseW * 0.10))
      };
    } catch (e) { /* noop */ }

    return out;
  }

  return { build, recolorCanvas, svgRecolor, svgHasGradient, trimmed };
})();
