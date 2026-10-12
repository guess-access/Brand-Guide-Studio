/* ============================================================
   PK.util — color math, canvas helpers, downloads, fonts
   Zero dependencies. Exposes window.PK.util
   ============================================================ */
window.PK = window.PK || {};
PK.util = (function () {
  'use strict';

  /* ---------- color ---------- */
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function parseColor(str) {
    if (!str) return null;
    str = String(str).trim();
    let m = /^#([0-9a-f]{3})$/i.exec(str);
    if (m) return { r: parseInt(m[1][0] + m[1][0], 16), g: parseInt(m[1][1] + m[1][1], 16), b: parseInt(m[1][2] + m[1][2], 16) };
    m = /^#([0-9a-f]{6})$/i.exec(str);
    if (m) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16) };
    m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(str);
    if (m) return { r: +m[1], g: +m[2], b: +m[3] };
    return null;
  }

  function hexToRgb(hex) { return parseColor(hex) || { r: 0, g: 0, b: 0 }; }
  function rgbToHex(r, g, b) {
    const h = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
    return '#' + h(r) + h(g) + h(b);
  }
  function isValidHex(s) { return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(s || '')); }

  function relLuminance(hex) {           // WCAG relative luminance 0..1
    const c = hexToRgb(hex);
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  /* Contrast ratio — the fix for the "black on light" and "yellow on white" bugs */
  function contrastRatio(a, b) {
    const l1 = relLuminance(a), l2 = relLuminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function isLight(hex) { return relLuminance(hex) > 0.45; }

  function mix(a, b, t) {
    const x = hexToRgb(a), y = hexToRgb(b);
    return rgbToHex(x.r + (y.r - x.r) * t, x.g + (y.g - x.g) * t, x.b + (y.b - x.b) * t);
  }
  const shade = (hex, t) => mix(hex, '#000000', t);   // t 0..1 → darker
  const tint  = (hex, t) => mix(hex, '#FFFFFF', t);   // t 0..1 → lighter

  function rgbToHsl(hex) {
    const c = hexToRgb(hex), r = c.r / 255, g = c.g / 255, b = c.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4;
      }
      h *= 60;
    }
    return { h, s, l };
  }

  /* Pick the readable ink for a background: whichever of paper/ink
     actually has more contrast (thresholds misjudge mid-tones like gold
     and amber — the yellow-on-white class of bug). */
  function readableInk(bgHex) {
    const paper = '#F4F1EA', ink = '#1B1D2A';
    return contrastRatio(ink, bgHex) >= contrastRatio(paper, bgHex) ? ink : paper;
  }

  /* ---------- dom / misc ---------- */
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function uid(p) { return (p || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
  function slug(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'client';
  }
  function timeout(ms, v) { return new Promise((res) => setTimeout(() => res(v), ms)); }

  /* Google fonts are optional; canvas silently falls back to the local stack */
  const FONTS = {
    heading: '"Fraunces", Georgia, serif',
    body: '"Work Sans", system-ui, sans-serif',
    mono: '"Space Mono", ui-monospace, monospace'
  };
  async function ensureFonts() {
    try {
      await Promise.race([document.fonts.ready, timeout(3500)]);
      await Promise.all([
        document.fonts.load('500 64px "Fraunces"'),
        document.fonts.load('600 48px "Work Sans"'),
        document.fonts.load('700 32px "Space Mono"')
      ]);
    } catch (e) { /* offline → fallback fonts */ }
  }

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function canvasToDataURL(c, quality) { return c.toDataURL('image/jpeg', quality || 0.94); }

  /* ---------- downloads ---------- */
  function downloadBlob(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  function downloadDataURL(name, dataURL) {
    const a = document.createElement('a');
    a.href = dataURL; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => a.remove(), 3000);
  }
  function downloadText(name, text, mime) {
    downloadBlob(name, new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' }));
  }

  return {
    clamp, parseColor, hexToRgb, rgbToHex, isValidHex, relLuminance, contrastRatio,
    isLight, mix, shade, tint, rgbToHsl, readableInk,
    el, escapeHtml, uid, slug, timeout, FONTS, ensureFonts, makeCanvas,
    canvasToDataURL, downloadBlob, downloadDataURL, downloadText
  };
})();
