/* ============================================================
   PK.slides â€” parameterized deck renderer (1920x1080 per slide)
   Suggest. #2: deterministic slide templates driven by a kit object.
   Suggest. #3 (part 1): every placement records its bg + fg so the
   QA gate can verify contrast instead of eyeballing it.
   ============================================================ */
window.PK = window.PK || {};
PK.slides = (function () {
  'use strict';
  const U = PK.util;

  const W = 1920, H = 1080;
  const ORDER = [
    { id: '01-cover',     title: 'Cover',          file: '01-cover.png' },
    { id: '02-primary',   title: 'Primary Logo',   file: '02-primary-logo.png' },
    { id: '03-versions',  title: 'Logo Versions',  file: '03-logo-versions.png' },
    { id: '04-palette',   title: 'Color Palette',  file: '04-color-palette.png' },
    { id: '05-type',      title: 'Typography',     file: '05-typography.png' },
    { id: '06-facebook',  title: 'Facebook Page',  file: '06-facebook-page.png' },
    { id: '07-instagram', title: 'Instagram',      file: '07-instagram-profile.png' },
    { id: '08-linkedin',  title: 'LinkedIn',       file: '08-linkedin-profile.png' },
    { id: '09-uniform',   title: 'Employee Uniform', file: '09-employee-uniform.png' },
    { id: '10-cards',     title: 'Business Cards', file: '10-business-cards.png' },
    { id: '11-stickers',  title: 'Stickers',       file: '11-stickers.png' },
    { id: '12-storefront',title: 'Storefront',     file: '12-storefront-signage.png' },
    { id: '13-wallpaper', title: 'Desktop Wallpaper', file: '13-desktop-wallpaper.png' },
    { id: '14-thankyou',  title: 'Thank You',      file: '14-thank-you.png' }
  ];

  /* ---------------- helpers ---------------- */
  function tracked(ctx, text, x, y, tracking, align) {
    const chars = String(text).split('');
    let total = 0;
    chars.forEach((c) => { total += ctx.measureText(c).width + tracking; });
    total -= tracking;
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    ctx.textAlign = 'left';
    chars.forEach((c) => { ctx.fillText(c, cx, y); cx += ctx.measureText(c).width + tracking; });
    return total;
  }

  function drawFit(ctx, img, cx, cy, maxW, maxH) {
    if (!img || !img.width) return null;
    const r = Math.min(maxW / img.width, maxH / img.height);
    const w = img.width * r, h = img.height * r;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    return { w, h };
  }

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function shadow(ctx, blur, dx, dy, alpha) {
    ctx.shadowColor = 'rgba(15,25,40,' + (alpha == null ? 0.18 : alpha) + ')';
    ctx.shadowBlur = blur; ctx.shadowOffsetX = dx || 0; ctx.shadowOffsetY = dy == null ? 10 : dy;
  }
  function noShadow(ctx) {
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  }

  function toRgba(hex, a) {
    const c = U.hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }
  const tint = (hex, t) => U.tint(hex, t);

  function place(slide, label, bg, fg, kind) {
    return { slide, label, bg, fg, kind: kind || 'logo' };
  }

  /* Logo selection â€” encodes the two historic bugs (black-on-light,
     yellow-on-white) as rules instead of manual fixes. */
  function pickLogo(bgHex, P) {
    const imgs = P.vars.images || {};
    const major = (P.health && P.health.palette || []).filter((p) => p.share > 0.15);
    const allOk = major.length ? major.every((p) => U.contrastRatio(p.hex, bgHex) >= 3) : true;
    const cands = [];
    if (imgs.primary && allOk) cands.push({ key: 'primary', img: imgs.primary, fg: (major[0] || {}).hex });
    if (imgs.oneColor) cands.push({ key: 'oneColor', img: imgs.oneColor, fg: P.brand.roles.primary });
    if (imgs.monoDark) cands.push({ key: 'monoDark', img: imgs.monoDark, fg: '#111318' });
    if (imgs.monoLight) cands.push({ key: 'monoLight', img: imgs.monoLight, fg: '#FFFFFF' });
    if (!cands.length) return null;
    cands.sort((a, b) => U.contrastRatio(b.fg, bgHex) - U.contrastRatio(a.fg, bgHex));
    const best = cands[0];
    return { ...best, ratio: +U.contrastRatio(best.fg, bgHex).toFixed(2) };
  }

  function footer(ctx, P, idx) {
    ctx.save();
    ctx.font = '700 13px ' + P.brand.fonts.mono;
    ctx.textBaseline = 'alphabetic';
    tracked(ctx, 'PRIME KREATIVES â€” BRAND SYSTEM', 96, H - 52, 3, 'left');
    tracked(ctx, (P.kit.name || 'CLIENT').toUpperCase(), W / 2, H - 52, 3, 'center');
    tracked(ctx, String(idx + 1).padStart(2, '0') + ' / ' + ORDER.length, W - 96, H - 52, 3, 'right');
    ctx.restore();
  }

  function titleBlock(ctx, P, eyebrow, title, dark) {
    const r = P.brand.roles;
    ctx.save();
    ctx.font = '700 13px ' + P.brand.fonts.mono;
    ctx.fillStyle = r.accent;
    ctx.textBaseline = 'alphabetic';
    tracked(ctx, eyebrow.toUpperCase(), 96, 132, 4, 'left');
    ctx.font = '500 44px ' + P.brand.fonts.heading;
    ctx.fillStyle = dark ? r.paper : r.ink;
    ctx.fillText(title, 96, 196);
    ctx.restore();
  }

  /* ---------------- small components ---------------- */
  function cap(ctx, P, text, cx, y, fill) {
    ctx.save();
    ctx.font = '700 12px ' + P.brand.fonts.mono;
    ctx.fillStyle = fill;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    tracked(ctx, text, cx, y, 2, 'center');
    ctx.restore();
  }

  function chip(ctx, P, text, x, y, fill) {
    ctx.save();
    ctx.font = '700 10.5px ' + P.brand.fonts.mono;
    const w = ctx.measureText(text).width + 22, h = 24;
    rr(ctx, x, y, w, h, 12);
    ctx.globalAlpha = 0.14; ctx.fillStyle = fill; ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = fill; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = fill;
    ctx.fillText(text, x + 11, y + 16);
    ctx.restore();
  }

  function button(ctx, P, label, x, y, w, h, bg, fg) {
    ctx.save();
    rr(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = bg; ctx.fill();
    ctx.font = '600 15px ' + P.brand.fonts.body;
    ctx.fillStyle = fg;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    ctx.restore();
  }

  function wrapText(ctx, text, x, y, maxW, lh) {
    const words = String(text).split(' ');
    let line = '', yy = y;
    words.forEach((wd) => {
      const test = line ? line + ' ' + wd : wd;
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = wd; yy += lh; }
      else line = test;
    });
    if (line) ctx.fillText(line, x, yy);
    return yy;
  }

  /* crew shirt (round collar) + cap + badge paths */
  function crewShirtPath(ctx, cx, cy, w) {
    const h = w * 0.95;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.28, cy - h * 0.48);
    ctx.lineTo(cx - w * 0.08, cy - h * 0.42);
    ctx.quadraticCurveTo(cx, cy - h * 0.46, cx + w * 0.08, cy - h * 0.42);
    ctx.lineTo(cx + w * 0.28, cy - h * 0.48);
    ctx.lineTo(cx + w * 0.52, cy - h * 0.12);
    ctx.lineTo(cx + w * 0.38, cy + h * 0.08);
    ctx.lineTo(cx + w * 0.32, cy - h * 0.02);
    ctx.lineTo(cx + w * 0.32, cy + h * 0.48);
    ctx.lineTo(cx - w * 0.32, cy + h * 0.48);
    ctx.lineTo(cx - w * 0.32, cy - h * 0.02);
    ctx.lineTo(cx - w * 0.38, cy + h * 0.08);
    ctx.lineTo(cx - w * 0.52, cy - h * 0.12);
    ctx.closePath();
  }

  function crewShirt(ctx, cx, cy, w, hex) {
    crewShirtPath(ctx, cx, cy, w);
    ctx.fillStyle = hex; ctx.fill();
    // crew collar
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.085, cy - hOf(w) * 0.42);
    ctx.quadraticCurveTo(cx, cy - hOf(w) * 0.32, cx + w * 0.085, cy - hOf(w) * 0.42);
    ctx.strokeStyle = U.shade(hex, 0.22); ctx.lineWidth = 6; ctx.stroke();
    // sleeve hems + hem
    ctx.strokeStyle = U.shade(hex, 0.18); ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.46, cy - w * 0.08); ctx.lineTo(cx - w * 0.36, cy + w * 0.06);
    ctx.moveTo(cx + w * 0.46, cy - w * 0.08); ctx.lineTo(cx + w * 0.36, cy + w * 0.06);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.32, cy + w * 0.40); ctx.lineTo(cx + w * 0.32, cy + w * 0.40);
    ctx.stroke();
  }
  function hOf(w) { return w * 0.95; }

  function capPath(ctx, cx, cy, w) {
    const h = w * 0.42;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, cy + h * 0.55);            // brim left
    ctx.quadraticCurveTo(cx - w * 0.62, cy + h * 0.95, cx - w * 0.34, cy + h * 0.95);
    ctx.lineTo(cx + w * 0.42, cy + h * 0.95);
    ctx.quadraticCurveTo(cx + w * 0.66, cy + h * 0.9, cx + w * 0.46, cy + h * 0.5);
    ctx.lineTo(cx + w * 0.40, cy - h * 0.1);
    ctx.quadraticCurveTo(cx + w * 0.38, cy - h * 0.62, cx, cy - h * 0.66);
    ctx.quadraticCurveTo(cx - w * 0.42, cy - h * 0.62, cx - w / 2, cy + h * 0.55);
    ctx.closePath();
  }

  function cap(ctx, cx, cy, w, hex) {
    capPath(ctx, cx, cy, w);
    ctx.fillStyle = hex; ctx.fill();
    // panel seams
    ctx.strokeStyle = U.shade(hex, 0.2); ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy - w * 0.30); ctx.lineTo(cx, cy + w * 0.10);
    ctx.moveTo(cx - w * 0.18, cy - w * 0.24); ctx.quadraticCurveTo(cx - w * 0.10, cy - w * 0.02, cx - w * 0.06, cy + w * 0.12);
    ctx.moveTo(cx + w * 0.18, cy - w * 0.24); ctx.quadraticCurveTo(cx + w * 0.10, cy - w * 0.02, cx + w * 0.06, cy + w * 0.12);
    ctx.stroke();
    // brim
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.34, cy + w * 0.05);
    ctx.quadraticCurveTo(cx - w * 0.62, cy + w * 0.36, cx - w * 0.34, cy + w * 0.36);
    ctx.lineTo(cx + w * 0.42, cy + w * 0.36);
    ctx.quadraticCurveTo(cx + w * 0.66, cy + w * 0.34, cx + w * 0.46, cy + w * 0.02);
    ctx.closePath();
    ctx.fillStyle = U.shade(hex, 0.12); ctx.fill();
  }

  function shirtPath(ctx, cx, cy, w) {
    const h = w * 0.95;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.28, cy - h * 0.48);
    ctx.lineTo(cx - w * 0.07, cy - h * 0.42);
    ctx.quadraticCurveTo(cx, cy - h * 0.52, cx + w * 0.07, cy - h * 0.42);
    ctx.lineTo(cx + w * 0.28, cy - h * 0.48);
    ctx.lineTo(cx + w * 0.52, cy - h * 0.12);
    ctx.lineTo(cx + w * 0.38, cy + h * 0.08);
    ctx.lineTo(cx + w * 0.32, cy - h * 0.02);
    ctx.lineTo(cx + w * 0.32, cy + h * 0.48);
    ctx.lineTo(cx - w * 0.32, cy + h * 0.48);
    ctx.lineTo(cx - w * 0.32, cy - h * 0.02);
    ctx.lineTo(cx - w * 0.38, cy + h * 0.08);
    ctx.lineTo(cx - w * 0.52, cy - h * 0.12);
    ctx.closePath();
  }

  function shirt(ctx, cx, cy, w, hex) {
    shirtPath(ctx, cx, cy, w);
    ctx.fillStyle = hex; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.07, cy - w * 0.42);
    ctx.lineTo(cx, cy - w * 0.30);
    ctx.lineTo(cx + w * 0.07, cy - w * 0.42);
    ctx.strokeStyle = U.shade(hex, 0.25); ctx.lineWidth = 4; ctx.stroke();
    ctx.strokeStyle = U.shade(hex, 0.18); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, cy - w * 0.28); ctx.lineTo(cx, cy + w * 0.02); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.46, cy - w * 0.08); ctx.lineTo(cx - w * 0.36, cy + w * 0.06);
    ctx.moveTo(cx + w * 0.46, cy - w * 0.08); ctx.lineTo(cx + w * 0.36, cy + w * 0.06);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.32, cy + w * 0.40); ctx.lineTo(cx + w * 0.32, cy + w * 0.40);
    ctx.stroke();
  }

  /* ---------------- slides 01â€“05 ---------------- */
  const SLIDES = {};

  SLIDES['01-cover'] = function (ctx, P) {
    const r = P.brand.roles, pl = [];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, r.primaryDark); g.addColorStop(1, r.primary);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const rg = ctx.createRadialGradient(W * 0.82, 240, 40, W * 0.82, 240, 620);
    rg.addColorStop(0, toRgba(r.accent, 0.32));
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);

    const pick = pickLogo(r.primaryDark, P);
    if (pick) { drawFit(ctx, pick.img, W / 2, 430, 720, 420); pl.push(place('01-cover', 'Cover logo', r.primaryDark, pick.fg)); }

    ctx.textAlign = 'center';
    ctx.font = '500 78px ' + P.brand.fonts.heading;
    ctx.fillStyle = r.paper;
    ctx.fillText(P.kit.name || 'Brand Name', W / 2, 730);
    pl.push(place('01-cover', 'Brand name', r.primaryDark, r.paper, 'text'));

    if (P.kit.tagline) {
      ctx.font = '400 27px ' + P.brand.fonts.body;
      ctx.fillStyle = r.accentSoft;
      ctx.fillText(P.kit.tagline, W / 2, 795);
      pl.push(place('01-cover', 'Tagline', r.primaryDark, r.accentSoft, 'text'));
    }
    ctx.fillStyle = r.accent; ctx.fillRect(W / 2 - 60, 850, 120, 2);
    ctx.font = '700 14px ' + P.brand.fonts.mono;
    tracked(ctx, 'BRAND SYSTEM & MOCKUP DECK', W / 2, 895, 5, 'center');
    pl.push(place('01-cover', 'Deck label', r.primaryDark, r.accent, 'decorative'));
    footer(ctx, P, 0);
    return { placements: pl, notes: P.kit.tagline ? [] : ['Tagline empty (optional).'] };
  };

  SLIDES['02-primary'] = function (ctx, P) {
    const r = P.brand.roles, pl = [];
    ctx.fillStyle = r.paper; ctx.fillRect(0, 0, W, H);
    titleBlock(ctx, P, 'Logo â€” primary', 'The primary lockup');

    const pad = 90;
    rr(ctx, 130, 270, 810, 560, 22); ctx.fillStyle = r.paperAlt; ctx.fill();
    ctx.strokeStyle = r.neutral; ctx.lineWidth = 2; ctx.stroke();
    const lp = pickLogo(r.paperAlt, P);
    if (lp) {
      drawFit(ctx, lp.img, 535, 550, 810 - pad * 2, 560 - pad * 2);
      ctx.save();
      ctx.setLineDash([10, 12]); ctx.strokeStyle = r.accent; ctx.lineWidth = 2;
      const w = 810 - pad * 2, h = 560 - pad * 2;
      ctx.strokeRect(535 - w / 2 - pad, 550 - h / 2 - pad, w + pad * 2, h + pad * 2);
      ctx.restore();
      pl.push(place('02-primary', 'Logo on light', r.paperAlt, lp.fg));
    }
    cap(ctx, P, 'ON LIGHT â€” PRIMARY', 535, 800, r.inkSoft);

    rr(ctx, 980, 270, 810, 560, 22); ctx.fillStyle = r.ink; ctx.fill();
    const dp = pickLogo(r.ink, P);
    if (dp) {
      drawFit(ctx, dp.img, 1385, 550, 810 - pad * 2, 560 - pad * 2);
      pl.push(place('02-primary', 'Logo on dark', r.ink, dp.fg));
    }
    cap(ctx, P, 'ON DARK â€” MONO LIGHT', 1385, 800, tint(r.ink, 0.55));

    const sizes = [
      { px: P.vars.minSizes ? P.vars.minSizes.print : 64, label: 'PRINT MIN' },
      { px: P.vars.minSizes ? P.vars.minSizes.screen : 32, label: 'SCREEN MIN' }
    ];
    sizes.forEach((s, i) => {
      const x = 400 + i * 300;
      ctx.fillStyle = r.primarySoft; rr(ctx, x, 880, 240, 60, 12); ctx.fill();
      if (lp) drawFit(ctx, lp.img, x + 120, 910, 190, 44);
      ctx.save();
      ctx.font = '700 12px ' + P.brand.fonts.mono;
      ctx.fillStyle = r.ink; ctx.textAlign = 'center';
      tracked(ctx, s.label + ' Â· ' + s.px + 'PX', x + 120, 954, 2, 'center');
      ctx.restore();
      pl.push(place('02-primary', 'Min-size ' + s.label.toLowerCase(), r.primarySoft, lp ? lp.fg : r.ink));
    });
    footer(ctx, P, 1);
    return { placements: pl, notes: [] };
  };

  SLIDES['03-versions'] = function (ctx, P) {
    const r = P.brand.roles, pl = [];
    const imgs = P.vars.images || {};
    ctx.fillStyle = r.paper; ctx.fillRect(0, 0, W, H);
    titleBlock(ctx, P, 'Logo â€” versions', 'Four essentials + supporting set');

    const tiles = [
      { key: 'primary',   label: 'Primary',     note: 'full lockup, most detailed', bg: r.paperAlt },
      { key: 'secondary', label: 'Secondary',   note: 'stacked lockup for tight spaces', bg: r.paperAlt },
      { key: 'submark',   label: 'Submark',     note: 'avatar / watermark / sticker', bg: r.paperAlt },
      { key: 'favicon48', label: 'Favicon',     note: '16â€“48 px mark, cropped for tabs', bg: r.paperAlt },
      { key: 'monoLight', label: 'Mono light',  note: 'all-white on dark backgrounds', bg: r.ink },
      { key: 'monoDark',  label: 'Mono dark',   note: 'all-dark on light backgrounds', bg: r.primarySoft },
      { key: 'oneColor',  label: 'One color',   note: 'single-color silhouette', bg: r.secondary },
      { key: 'clear',     label: 'Clear space', note: 'keep 25% padding around the mark', bg: r.paperAlt }
    ];
    const tw = 400, th = 330, gx = 33, gy = 30, x0 = 96, y0 = 240;
    tiles.forEach((t, i) => {
      const x = x0 + (i % 4) * (tw + gx), y = y0 + Math.floor(i / 4) * (th + gy);
      rr(ctx, x, y, tw, th, 18); ctx.fillStyle = t.bg; ctx.fill();
      ctx.strokeStyle = r.neutral; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.save(); rr(ctx, x, y, tw, th, 18); ctx.clip();
      if (t.key === 'clear' && imgs.primary) {
        const mm = 46;
        drawFit(ctx, imgs.primary, x + tw / 2, y + th / 2, tw - mm * 3, th - mm * 3);
        ctx.setLineDash([8, 8]); ctx.strokeStyle = r.accent; ctx.lineWidth = 2;
        ctx.strokeRect(x + mm, y + mm, tw - mm * 2, th - mm * 2);
      } else if (imgs[t.key]) {
        drawFit(ctx, imgs[t.key], x + tw / 2, y + th / 2, tw - 80, th - 80);
      }
      ctx.restore();
      const fgTile = U.readableInk(t.bg);
      // record the ink the LOGO is actually drawn in, so QA checks reality
      let inkFor;
      if (t.key === 'monoLight') inkFor = '#FFFFFF';
      else if (t.key === 'monoDark') inkFor = '#111318';
      else if (t.key === 'oneColor') inkFor = r.primary;
      else {
        const pick = pickLogo(t.bg, P);
        inkFor = pick ? pick.fg : r.ink;
      }
      ctx.font = '700 12px ' + P.brand.fonts.mono;
      ctx.fillStyle = fgTile;
      tracked(ctx, t.label.toUpperCase(), x + 20, y + th - 34, 2, 'left');
      ctx.font = '400 11.5px ' + P.brand.fonts.body;
      ctx.fillStyle = tint(t.bg, U.isLight(t.bg) ? 0.35 : -0.4);
      ctx.fillText(t.note, x + 20, y + th - 17);
      pl.push(place('03-versions', 'Tile: ' + t.label, t.bg, inkFor));
    });
    footer(ctx, P, 2);
    return { placements: pl, notes: P.vars.notes || [] };
  };

  SLIDES['04-palette'] = function (ctx, P) {
    const r = P.brand.roles, pl = [];
    ctx.fillStyle = r.paper; ctx.fillRect(0, 0, W, H);
    titleBlock(ctx, P, 'Color system', 'Roles, not hues');

    const cards = [
      { name: 'Primary',      hex: r.primary,     use: 'brand surfaces, cover' },
      { name: 'Primary dark', hex: r.primaryDark, use: 'depth, gradients' },
      { name: 'Secondary',    hex: r.secondary,   use: 'accents, buttons' },
      { name: 'Accent',       hex: r.accent,      use: 'rules, highlights' },
      { name: 'Ink',          hex: r.ink,         use: 'text, dark panels' },
      { name: 'Paper',        hex: r.paper,       use: 'backgrounds, cards' }
    ];
    const cw = 272, ch = 300, gap = 24, x0 = 96, y = 260;
    cards.forEach((c, i) => {
      const x = x0 + i * (cw + gap);
      const fgOn = U.readableInk(c.hex);
      rr(ctx, x, y, cw, ch, 18); ctx.fillStyle = c.hex; ctx.fill();
      ctx.strokeStyle = r.neutral; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = '700 12px ' + P.brand.fonts.mono;
      ctx.fillStyle = fgOn;
      tracked(ctx, c.name.toUpperCase(), x + 20, y + 40, 2, 'left');
      ctx.font = '400 14px ' + P.brand.fonts.body;
      ctx.fillText(c.hex.toUpperCase(), x + 20, y + 66);
      ctx.font = '400 12px ' + P.brand.fonts.body;
      ctx.fillStyle = tint(c.hex, U.isLight(c.hex) ? 0.35 : -0.05);
      wrapText(ctx, c.use, x + 20, y + 96, cw - 40, 18);
      const onPaper = U.contrastRatio(c.hex, r.paper) >= 4.5;
      const onInk = U.contrastRatio(c.hex, r.ink) >= 4.5;
      chip(ctx, P, (onPaper ? 'AA on paper' : 'large-only') + ' / ' + (onInk ? 'AA on ink' : 'large-only'), x + 20, y + ch - 44, fgOn);
      pl.push(place('04-palette', 'Swatch: ' + c.name, c.hex, fgOn, 'text'));
    });

    const stops = [r.primary, r.primaryDark, r.secondary, r.accent, r.accentSoft, r.neutral, r.paperAlt];
    stops.forEach((hex, i) => {
      const x = x0 + i * 180;
      ctx.fillStyle = hex; rr(ctx, x, 620, 164, 64, 12); ctx.fill();
      ctx.strokeStyle = r.neutral; ctx.stroke();
      ctx.font = '700 11px ' + P.brand.fonts.mono;
      ctx.fillStyle = r.ink;
      tracked(ctx, hex.toUpperCase(), x + 82, 714, 1, 'center');
    });
    footer(ctx, P, 3);
    return { placements: pl, notes: [] };
  };

  SLIDES['05-type'] = function (ctx, P) {
    const r = P.brand.roles, pl = [];
    ctx.fillStyle = r.paper; ctx.fillRect(0, 0, W, H);
    titleBlock(ctx, P, 'Typography', P.brand.fonts.note || 'One pair, used consistently');

    const rows = [
      { label: 'DISPLAY', size: P.brand.scale.display, font: P.brand.fonts.heading, sample: P.kit.name || 'Brand' },
      { label: 'H1',      size: P.brand.scale.h1,      font: P.brand.fonts.heading, sample: 'The quick brown fox jumps' },
      { label: 'H2',      size: P.brand.scale.h2,      font: P.brand.fonts.heading, sample: 'Chapter and section heads' },
      { label: 'BODY',    size: P.brand.scale.body,    font: P.brand.fonts.body,    sample: 'Body copy for bios, captions and longer descriptions.' },
      { label: 'LABEL',   size: P.brand.scale.small,   font: P.brand.fonts.mono,    sample: 'PRICES, TAGS, METADATA' }
    ];
    let y = 300;
    rows.forEach((row) => {
      ctx.font = '400 16px ' + P.brand.fonts.body;
      ctx.fillStyle = r.neutral;
      tracked(ctx, row.label, 96, y + 8, 3, 'left');
      ctx.font = (row.font === P.brand.fonts.mono ? '700 ' : '500 ') + row.size + 'px ' + row.font;
      ctx.fillStyle = r.ink;
      let sample = row.sample;
      while (ctx.measureText(sample).width > 1200 && sample.length > 6) sample = sample.slice(0, -2);
      ctx.fillText(sample, 300, y + 8);
      ctx.font = '400 12px ' + P.brand.fonts.mono;
      ctx.fillStyle = r.neutral;
      ctx.fillText(row.size + 'px', 1780, y + 8);
      y += row.size + 34;
      pl.push(place('05-type', row.label + ' text', r.paper, r.ink, 'text'));
    });

    rr(ctx, 96, 760, 1728, 190, 18); ctx.fillStyle = r.primarySoft; ctx.fill();
    ctx.font = '700 12px ' + P.brand.fonts.mono;
    ctx.fillStyle = r.primaryDark;
    tracked(ctx, 'AUTO PAIRING', 128, 808, 3, 'left');
    ctx.font = '400 17px ' + P.brand.fonts.body;
    ctx.fillStyle = r.ink;
    ctx.fillText('Heading: ' + P.brand.fonts.heading.split(',')[0].replace(/"/g, ''), 128, 850);
    ctx.fillText('Body: ' + P.brand.fonts.body.split(',')[0].replace(/"/g, '') + '  Â·  Mono: ' + P.brand.fonts.mono.split(',')[0].replace(/"/g, ''), 128, 882);
    ctx.fillText('Local fallbacks keep text legible even when the webfonts are unavailable.', 128, 914);
    pl.push(place('05-type', 'Pairing card text', r.primarySoft, r.ink, 'text'));
    footer(ctx, P, 4);
    return { placements: pl, notes: [] };
  };

  SLIDES['06-facebook'] = function (ctx, P) {
    const r = P.brand.roles, pl = [], c = P.kit.contacts || {};
    ctx.fillStyle = r.paperAlt; ctx.fillRect(0, 0, W, H);
    titleBlock(ctx, P, 'Social', 'Facebook page mockup');

    const x = 260, y = 250, w = 1400, h = 700;
    shadow(ctx, 34, 0, 18, 0.22);
    rr(ctx, x, y, w, h, 18); ctx.fillStyle = '#FFFFFF'; ctx.fill();
    noShadow(ctx);
    ctx.save(); rr(ctx, x, y, w, h, 18); ctx.clip();

    const g = ctx.createLinearGradient(x, y, x + w, y + 300);
    g.addColorStop(0, r.primary); g.addColorStop(1, r.primaryDark);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, 300);
    const coverInk = U.readableInk(r.primary);
    ctx.font = '700 15px ' + P.brand.fonts.mono;
    ctx.fillStyle = coverInk;
    tracked(ctx, (P.kit.name || 'BRAND').toUpperCase(), x + 48, y + 84, 4, 'left');
    pl.push(place('06-facebook', 'Cover band label', r.primary, coverInk, 'text'));

    const avatarBg = U.tint(r.primary, 0.25);
    const lg = pickLogo(avatarBg, P);
    ctx.save();
    ctx.beginPath(); ctx.arc(x + 108, y + 300, 96, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.restore();
    if (lg) {
      ctx.save();
      ctx.beginPath(); ctx.arc(x + 108, y + 300, 88, 0, Math.PI * 2); ctx.clip();
      drawFit(ctx, lg.img, x + 108, y + 300, 150, 150);
      ctx.restore();
      pl.push(place('06-facebook', 'FB avatar', avatarBg, lg.fg));
    }

    const name = P.kit.name || 'Brand Name';
    ctx.font = '500 40px ' + P.brand.fonts.heading;
    ctx.fillStyle = '#1B1D2A';
    ctx.fillText(name, x + 236, y + 300);
    ctx.beginPath(); ctx.arc(x + 236 + ctx.measureText(name).width + 30, y + 283, 13, 0, Math.PI * 2);
    ctx.fillStyle = r.primary; ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 13px ' + P.brand.fonts.mono;
    ctx.fillText('âœ“', x + 236 + ctx.measureText(name).width + 25, y + 289);
    ctx.font = '400 17px ' + P.brand.fonts.body;
    ctx.fillStyle = '#65676B';
    ctx.fillText(P.kit.fbCategory || 'Company Â· Local business', x + 236, y + 336);
    ctx.fillText('Â·Â·Â· followers Â· Â·Â·Â· reviews', x + 236, y + 366);
    pl.push(place('06-facebook', 'Page name', '#FFFFFF', '#1B1D2A', 'text'));

    const btnY = y + 408;
    button(ctx, P, 'Send Message', x + w - 620, btnY, 230, 52, r.primary, U.readableInk(r.primary));
    button(ctx, P, 'Call Now', x + w - 372, btnY, 160, 52, '#E4E6EB', '#1B1D2A');
    button(ctx, P, 'Get Directions', x + w - 196, btnY, 180, 52, '#E4E6EB', '#1B1D2A');
    pl.push(place('06-facebook', 'Primary button', r.primary, U.readableInk(r.primary), 'text'));

    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y + 484, w, 60);
    ['Home', 'Posts', 'Photos', 'About'].forEach((t, i) => {
      const tx = x + 96 + i * 170;
      ctx.font = (i === 0 ? '700' : '400') + ' 17px ' + P.brand.fonts.body;
      ctx.fillStyle = i === 0 ? r.primary : '#65676B';
      ctx.fillText(t, tx, y + 522);
      if (i === 0) { ctx.fillStyle = r.primary; ctx.fillRect(tx, y + 534, 52, 3); }
      pl.push(place('06-facebook', 'Tab ' + t, '#FFFFFF', i === 0 ? r.primary : '#65676B', 'text'));
    });
    ctx.strokeStyle = '#E4E6EB'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y + 544); ctx.lineTo(x + w, y + 544); ctx.stroke();

    const px = x + 96, py = y + 586;
    if (lg) drawFit(ctx, lg.img, px + 26, py + 26, 44, 44);
    ctx.font = '600 17px ' + P.brand.fonts.body;
    ctx.fillStyle = '#1B1D2A';
    ctx.fillText(name, px + 60, py + 20);
    ctx.font = '400 14px ' + P.brand.fonts.body;
    ctx.fillStyle = '#65676B';
    ctx.fillText('Sponsored Â· Just now', px + 60, py + 44);
    ctx.font = '400 16px ' + P.brand.fonts.body;
    ctx.fillStyle = '#1B1D2A';
    const post = P.kit.fbPost || P.kit.tagline || 'Safe, reliable rides â€” delivered to your door.';
    ctx.fillText(post, px, py + 92);
    rr(ctx, px, py + 110, 520, 150, 12);
    const pg = ctx.createLinearGradient(px, py, px + 520, py + 150);
    pg.addColorStop(0, r.primary); pg.addColorStop(1, r.primaryDark);
    ctx.fillStyle = pg; ctx.fill();
    if (P.vars.images.submark) {
      ctx.globalAlpha = 0.5;
      drawFit(ctx, P.vars.images.submark, px + 260, py + 185, 120, 90);
      ctx.globalAlpha = 1;
    }
    ctx.font = '700 13px ' + P.brand.fonts.mono;
    ctx.fillStyle = U.readableInk(r.primary);
    tracked(ctx, 'CALL TO MESSAGE', px + 260, py + 190, 3, 'center');
    ctx.font = '400 14px ' + P.brand.fonts.body;
    ctx.fillStyle = '#65676B';
    ctx.fillText('Like Â· Comment Â· Share', px, py + 290);
    ctx.restore();

    if (c.phone) {
      ctx.font = '700 13px ' + P.brand.fonts.mono;
      ctx.fillStyle = r.neutral;
      tracked(ctx, 'LIVE DETAILS FROM INTAKE: ' + String(c.phone).toUpperCase(), W / 2, H - 78, 2, 'center');
    }
    footer(ctx, P, 5);
    return { placements: pl, notes: [] };
  };

  SLIDES['07-instagram'] = function (ctx, P) {
    const r = P.brand.roles, pl = [], c = P.kit.contacts || {};
    ctx.fillStyle = r.paperAlt; ctx.fillRect(0, 0, W, H);
    titleBlock(ctx, P, 'Social', 'Instagram profile mockup');

    const x = 800, y = 130, w = 380, h = 820;
    shadow(ctx, 30, 0, 16, 0.22);
    rr(ctx, x, y, w, h, 46); ctx.fillStyle = '#FFFFFF'; ctx.fill();
    noShadow(ctx);
    ctx.save(); rr(ctx, x, y, w, h, 46); ctx.clip();

    ctx.textAlign = 'center';
    ctx.font = '600 17px ' + P.brand.fonts.body;
    ctx.fillStyle = '#1B1D2A';
    ctx.fillText(String(P.kit.instagram || P.kit.name || 'brand'), x + w / 2, y + 56);

    const ring = ctx.createLinearGradient(x + 40, y + 80, x + w - 40, y + 190);
    ring.addColorStop(0, r.accent); ring.addColorStop(1, r.secondary);
    ctx.fillStyle = ring;
    ctx.beginPath(); ctx.arc(x + w / 2, y + 152, 62, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(x + w / 2, y + 152, 56, 0, Math.PI * 2); ctx.fill();

    const avatarBg = U.tint(r.primary, 0.25);
    const lg = pickLogo(avatarBg, P);
    if (lg) {
      ctx.save();
      ctx.beginPath(); ctx.arc(x + w / 2, y + 152, 50, 0, Math.PI * 2); ctx.clip();
      drawFit(ctx, lg.img, x + w / 2, y + 152, 90, 90);
      ctx.restore();
      pl.push(place('07-instagram', 'IG avatar', avatarBg, lg.fg));
    }

    ['POSTS', 'FOLLOWERS', 'FOLLOWING'].forEach((s, i) => {
      const sx = x + 66 + i * ((w - 132) / 2);
      ctx.font = '700 20px ' + P.brand.fonts.heading;
      ctx.fillStyle = '#1B1D2A';
      ctx.fillText('Â·Â·Â·', sx, y + 268);
      ctx.font = '400 11px ' + P.brand.fonts.body;
      ctx.fillStyle = '#8E8E8E';
      ctx.fillText(s, sx, y + 290);
      pl.push(place('07-instagram', 'Stat ' + s.toLowerCase(), '#FFFFFF', '#1B1D2A', 'text'));
    });

    ctx.textAlign = 'left';
    ctx.font = '600 15px ' + P.brand.fonts.body;
    ctx.fillStyle = '#1B1D2A';
    ctx.fillText(P.kit.name || 'Brand', x + 30, y + 330);
    ctx.font = '400 12px ' + P.brand.fonts.body;
    ctx.fillStyle = '#8E8E8E';
    ctx.fillText(P.kit.fbCategory || 'Company Â· Local business', x + 30, y + 352);
    ctx.font = '400 12.5px ' + P.brand.fonts.body;
    ctx.fillStyle = '#262626';
    const bio = (P.kit.tagline || '') + (c.phone ? '\n' + c.phone : '') + (c.website ? '\n' + c.website : '');
    bio.split('\n').forEach((line, i) => ctx.fillText(line, x + 30, y + 380 + i * 20));
    pl.push(place('07-instagram', 'Bio', '#FFFFFF', '#262626', 'text'));

    button(ctx, P, 'Follow', x + w - 122, y + 446, 92, 34, r.accent, U.readableInk(r.accent));
    pl.push(place('07-instagram', 'Follow pill', r.accent, U.readableInk(r.accent), 'text'));

    ['Rates', 'Fleet', 'Book'].forEach((hl, i) => {
      const hx = x + 66 + i * ((w - 132) / 2);
      ctx.strokeStyle = '#DBDBDB'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(hx, y + 516, 30, 0, Math.PI * 2); ctx.stroke();
      if (P.vars.images.submark) drawFit(ctx, P.vars.images.submark, hx, y + 516, 34, 34);
      ctx.textAlign = 'center';
      ctx.font = '400 10px ' + P.brand.fonts.body;
      ctx.fillStyle = '#262626';
      ctx.fillText(hl, hx, y + 570);
      ctx.textAlign = 'left';
    });

    const gs = (w - 60) / 3;
    for (let i = 0; i < 9; i++) {
      const gx = x + 30 + (i % 3) * gs, gy = y + 590 + Math.floor(i / 3) * gs;
      const tileBg = i % 3 === 2 ? r.primary : (i % 3 === 1 ? r.accentSoft : '#EFEFEF');
      ctx.fillStyle = tileBg;
      ctx.fillRect(gx + 1.5, gy + 1.5, gs - 3, gs - 3);
      if (i % 3 !== 2 && P.vars.images.submark) {
        ctx.globalAlpha = 0.45;
        drawFit(ctx, P.vars.images.submark, gx + gs / 2, gy + gs / 2, gs * 0.5, gs * 0.5);
        ctx.globalAlpha = 1;
      }
      pl.push(place('07-instagram', 'Grid tile ' + (i + 1), tileBg, U.readableInk(tileBg)));
    }
    ctx.restore();

    ['1080 Ã— 1080 px grid tiles', '320 px avatar', 'Bio pulls real intake text'].forEach((n, i) => {
      const ny = 320 + i * 70;
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = r.neutral; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(560, ny); ctx.lineTo(790, ny + 20); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '400 15px ' + P.brand.fonts.body;
      ctx.fillStyle = r.inkSoft;
      ctx.fillText(n, 300, ny + 5);
    });
    footer(ctx, P, 6);
    return { placements: pl, notes: [] };
  };

  /* 08 â€” LinkedIn company page */
  SLIDES['08-linkedin'] = function (ctx, P) {
    const r = P.brand.roles, pl = [], c = P.kit.contacts || {};
    const pageBg = '#F3F2EF', card = '#FFFFFF', meta = '#5B5B5B';
    ctx.fillStyle = pageBg; ctx.fillRect(0, 0, W, H);
    titleBlock(ctx, P, 'Social', 'LinkedIn company page');

    const x = 210, y = 240, w = 1180, h = 730;
    shadow(ctx, 34, 0, 18, 0.18);
    rr(ctx, x, y, w, h, 14); ctx.fillStyle = card; ctx.fill();
    noShadow(ctx);
    ctx.save(); rr(ctx, x, y, w, h, 14); ctx.clip();

    // cover banner (1584 x 396 ratio â‰ˆ 4:1)
    const bw = w, bh = 240;
    const g = ctx.createLinearGradient(x, y, x + bw, y + bh);
    g.addColorStop(0, r.primary); g.addColorStop(1, r.primaryDark);
    ctx.fillStyle = g; ctx.fillRect(x, y, bw, bh);
    const coverInk = U.readableInk(r.primary);
    if (P.vars.images.monoLight) {
      ctx.globalAlpha = 0.16;
      drawFit(ctx, P.vars.images.monoLight, x + bw - 190, y + 110, 300, 220);
      ctx.globalAlpha = 1;
    }
    ctx.font = '700 14px ' + P.brand.fonts.mono;
    ctx.fillStyle = coverInk;
    tracked(ctx, (P.kit.name || 'COMPANY').toUpperCase(), x + 44, y + 70, 4, 'left');
    pl.push(place('08-linkedin', 'Cover banner', r.primary, coverInk, 'text'));

    // avatar
    const avatarBg = U.tint(r.primary, 0.25);
    const lg = pickLogo(avatarBg, P);
    ctx.save();
    ctx.beginPath(); ctx.arc(x + 116, y + bh, 86, 0, Math.PI * 2);
    ctx.fillStyle = card; ctx.fill();
    ctx.restore();
    if (lg) {
      ctx.save();
      ctx.beginPath(); ctx.arc(x + 116, y + bh, 78, 0, Math.PI * 2); ctx.clip();
      drawFit(ctx, lg.img, x + 116, y + bh, 140, 140);
      ctx.restore();
      pl.push(place('08-linkedin', 'Profile photo', avatarBg, lg.fg));
    }

    // name + headline
    const name = P.kit.name || 'Company';
    ctx.font = '500 42px ' + P.brand.fonts.heading;
    ctx.fillStyle = '#1A1A1A';
    ctx.fillText(name, x + 236, y + bh + 42);
    ctx.font = '400 17px ' + P.brand.fonts.body;
    ctx.fillStyle = '#1A1A1A';
    ctx.fillText(P.kit.fbCategory || 'Company Â· Local business', x + 236, y + bh + 74);
    ctx.font = '400 14.5px ' + P.brand.fonts.body;
    ctx.fillStyle = meta;
    ctx.fillText((c.website || 'yourwebsite.ph') + ' Â· ' + (c.address || 'Cebu City') + ' Â· Â·Â·Â· followers', x + 236, y + bh + 104);
    pl.push(place('08-linkedin', 'Company headline', card, '#1A1A1A', 'text'));

    // buttons
    const by = y + bh + 138;
    button(ctx, P, '+ Follow', x + 236, by, 130, 44, r.primary, U.readableInk(r.primary));
    button(ctx, P, 'Visit website', x + 380, by, 160, 44, card, r.primary);
    ctx.save();
    ctx.strokeStyle = r.primary; ctx.lineWidth = 1.5;
    rr(ctx, x + 554, by, 44, 44, 22); ctx.stroke();
    ctx.font = '700 18px ' + P.brand.fonts.mono;
    ctx.fillStyle = r.primary; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('â‹¯', x + 576, by + 23);
    ctx.restore();
    pl.push(place('08-linkedin', 'Follow button', r.primary, U.readableInk(r.primary), 'text'));

    // about
    const ay = y + bh + 232;
    ctx.font = '700 14px ' + P.brand.fonts.mono;
    ctx.fillStyle = '#1A1A1A';
    tracked(ctx, 'ABOUT', x + 44, ay, 2, 'left');
    ctx.font = '400 15.5px ' + P.brand.fonts.body;
    ctx.fillStyle = '#333333';
    const about = (P.kit.tagline ? P.kit.tagline + ' â€” ' : '') + 'we rent clean, helmet-included motorcycles to locals and visitors.';
    wrapText(ctx, about, x + 44, ay + 30, w - 88, 24);
    pl.push(place('08-linkedin', 'About copy', card, '#333333', 'text'));

    // preview post
    const py = ay + 120;
    ctx.fillStyle = card; ctx.fillRect(x + 44, py, w - 88, 130);
    ctx.strokeStyle = '#E3E1DC'; ctx.lineWidth = 1; ctx.strokeRect(x + 44, py, w - 88, 130);
    if (lg) drawFit(ctx, lg.img, x + 82, py + 34, 48, 48);
    ctx.font = '600 15px ' + P.brand.fonts.body;
    ctx.fillStyle = '#1A1A1A';
    ctx.fillText(name, x + 118, py + 30);
    ctx.font = '400 12px ' + P.brand.fonts.body;
    ctx.fillStyle = meta;
    ctx.fillText('1,234 followers Â· Promoted', x + 118, py + 52);
    ctx.font = '400 14px ' + P.brand.fonts.body;
    ctx.fillStyle = '#333333';
    ctx.fillText(P.kit.fbPost || P.kit.tagline || 'Book your ride today.', x + 44, py + 84);
    ctx.fillStyle = r.primarySoft;
    ctx.fillRect(x + 44, py + 96, w - 88, 2);
    ctx.restore();

    // annotations
    ['1584 Ã— 396 cover banner', '400 Ã— 400 profile photo', '1200 Ã— 627 promoted posts'].forEach((n, i) => {
      const ny = 330 + i * 70;
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = r.neutral; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(1420, ny); ctx.lineTo(1660, ny + 20); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '400 15px ' + P.brand.fonts.body;
      ctx.fillStyle = r.inkSoft;
      ctx.fillText(n, 1440, ny + 5);
    });
    footer(ctx, P, 7);
    return { placements: pl, notes: [] };
  };

  /* 09 â€” employee uniform system (replaces the single polo set) */
  SLIDES['09-uniform'] = function (ctx, P) {
    const r = P.brand.roles, pl = [];
    const fabric = P.kit.uniformColor || P.kit.poloColor || r.primary;
    ctx.fillStyle = r.paper; ctx.fillRect(0, 0, W, H);
    titleBlock(ctx, P, 'Uniform', 'Employee uniform system');

    const thread = U.isLight(fabric) ? '#111318' : '#FFFFFF';
    const threadImg = thread === '#111318' ? P.vars.images.monoDark : P.vars.images.monoLight;
    const hasThread = U.contrastRatio(thread, fabric) >= 3 && threadImg;
    const breastImg = hasThread ? threadImg : (pickLogo(fabric, P) || {}).img;

    /* crew shirt â€” front */
    (function () {
      const cx = 380, cy = 560, sw = 380;
      shadow(ctx, 26, 0, 14, 0.16);
      crewShirt(ctx, cx, cy, sw, fabric);
      noShadow(ctx);
      if (breastImg) {
        drawFit(ctx, breastImg, cx + sw * 0.16, cy - sw * 0.08, sw * 0.30, sw * 0.30);
        pl.push(place('09-uniform', 'Crew shirt front', fabric, thread));
      }
      ctx.lineWidth = 8;
      ctx.strokeStyle = U.contrastRatio(r.accent, fabric) >= 3 ? r.accent : U.readableInk(fabric);
      crewShirtPath(ctx, cx, cy, sw); ctx.stroke();
    })();

    /* crew shirt â€” back print */
    (function () {
      const cx = 950, cy = 560, sw = 380;
      shadow(ctx, 26, 0, 14, 0.16);
      crewShirt(ctx, cx, cy, sw, fabric);
      noShadow(ctx);
      if (breastImg) {
        drawFit(ctx, breastImg, cx, cy - sw * 0.02, sw * 0.50, sw * 0.50);
        pl.push(place('09-uniform', 'Crew shirt back print', fabric, thread));
      }
      ctx.lineWidth = 8;
      ctx.strokeStyle = U.contrastRatio(r.accent, fabric) >= 3 ? r.accent : U.readableInk(fabric);
      crewShirtPath(ctx, cx, cy, sw); ctx.stroke();
    })();

    /* cap */
    (function () {
      const cx = 1480, cy = 520, cw2 = 300;
      shadow(ctx, 22, 0, 12, 0.16);
      cap(ctx, cx, cy, cw2, fabric);
      noShadow(ctx);
      if (breastImg) {
        drawFit(ctx, breastImg, cx, cy - cw2 * 0.10, cw2 * 0.36, cw2 * 0.32);
        pl.push(place('09-uniform', 'Cap embroidery', fabric, thread));
      }
      ctx.lineWidth = 6;
      ctx.strokeStyle = U.contrastRatio(r.accent, fabric) >= 3 ? r.accent : U.readableInk(fabric);
      capPath(ctx, cx, cy, cw2); ctx.stroke();
    })();

    /* lanyard badge */
    (function () {
      const bx = 1560, by = 700, bw2 = 240, bh2 = 150;
      // lanyard strap
      ctx.strokeStyle = r.secondary; ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(bx + bw2 / 2 - 34, 560);
      ctx.lineTo(bx + bw2 / 2 - 14, by + 20);
      ctx.moveTo(bx + bw2 / 2 + 34, 560);
      ctx.lineTo(bx + bw2 / 2 + 14, by + 20);
      ctx.stroke();
      shadow(ctx, 16, 0, 8, 0.2);
      rr(ctx, bx, by, bw2, bh2, 14); ctx.fillStyle = r.paper; ctx.fill();
      noShadow(ctx);
      ctx.strokeStyle = r.neutral; ctx.lineWidth = 2; ctx.stroke();
      if (breastImg) drawFit(ctx, breastImg, bx + bw2 / 2, by + 52, 96, 60);
      ctx.font = '700 12px ' + P.brand.fonts.mono;
      ctx.fillStyle = r.ink;
      tracked(ctx, 'STAFF', bx + bw2 / 2, by + 108, 3, 'center');
      pl.push(place('09-uniform', 'ID badge', r.paper, thread));
    })();

    // labels
    const labels = [
      { x: 380, t: 'Crew shirt â€” front', s: 'embroidery 8â€“9 cm' },
      { x: 950, t: 'Crew shirt â€” back', s: 'print 22â€“25 cm' },
      { x: 1480, t: 'Cap', s: 'front panel embroidery' }
    ];
    labels.forEach((l) => {
      ctx.font = '700 12px ' + P.brand.fonts.mono;
      ctx.fillStyle = r.ink;
      tracked(ctx, l.t.toUpperCase(), l.x, 860, 2, 'center');
      ctx.font = '400 11.5px ' + P.brand.fonts.body;
      ctx.fillStyle = r.neutral;
      tracked(ctx, l.s, l.x, 884, 1, 'center');
    });
    ctx.font = '700 12px ' + P.brand.fonts.mono;
    ctx.fillStyle = r.ink;
    tracked(ctx, 'ID LANYARD', 1680, 884, 2, 'center');

    ctx.font = '400 15px ' + P.brand.fonts.body;
    ctx.fillStyle = r.inkSoft;
    ctx.fillText('Fabric ' + fabric.toUpperCase() + ' Â· thread ' + thread.toUpperCase() + ' â€” auto-picked so the mark always clears 3:1 on the garment.', 380, 960);
    footer(ctx, P, 8);
    return { placements: pl, notes: ['Thread color is auto-picked per fabric contrast (3:1 rule).'] };
  };

  SLIDES['10-cards'] = function (ctx, P) {
    const r = P.brand.roles, pl = [], c = P.kit.contacts || {};
    ctx.fillStyle = r.paperAlt; ctx.fillRect(0, 0, W, H);
    titleBlock(ctx, P, 'Stationery', 'Business card system');

    const cw = 1000, ch = 571; // 3.5 : 2
    ctx.save();
    ctx.translate(210, 300); ctx.rotate(-0.035);
    shadow(ctx, 30, 0, 18, 0.22);
    rr(ctx, 0, 0, cw, ch, 20); ctx.fillStyle = r.paper; ctx.fill();
    noShadow(ctx);
    ctx.strokeStyle = r.neutral; ctx.lineWidth = 2; ctx.stroke();
    const lg = pickLogo(r.paper, P);
    if (lg) { drawFit(ctx, lg.img, 240, 150, 300, 120); pl.push(place('09-cards', 'Card front logo', r.paper, lg.fg)); }
    ctx.font = '500 40px ' + P.brand.fonts.heading;
    ctx.fillStyle = r.ink;
    ctx.fillText(P.kit.name || 'Brand', 90, 250);
    ctx.font = '400 17px ' + P.brand.fonts.body;
    ctx.fillStyle = r.neutral;
    ctx.fillText(P.kit.tagline || '', 90, 286);
    [c.phone && 'phone  ' + c.phone, c.email && 'email  ' + c.email, c.website && 'web  ' + c.website]
      .filter(Boolean).forEach((line, i) => {
        ctx.font = '400 16px ' + P.brand.fonts.body;
        ctx.fillStyle = r.ink;
        ctx.fillText(line, 90, 350 + i * 34);
        pl.push(place('09-cards', 'Card contact ' + i, r.paper, r.ink, 'text'));
      });
    ctx.fillStyle = r.accent;
    ctx.fillRect(90, ch - 56, 70, 3);
    ctx.restore();

    ctx.save();
    ctx.translate(640, 400); ctx.rotate(0.028);
    shadow(ctx, 30, 0, 18, 0.22);
    rr(ctx, 0, 0, cw, ch, 20); ctx.fillStyle = r.primary; ctx.fill();
    noShadow(ctx);
    if (P.vars.images.monoLight) {
      drawFit(ctx, P.vars.images.monoLight, cw / 2, ch / 2 - 30, 340, 190);
      pl.push(place('09-cards', 'Card back logo', r.primary, '#FFFFFF'));
    }
    ctx.font = '700 13px ' + P.brand.fonts.mono;
    ctx.fillStyle = U.readableInk(r.primary);
    tracked(ctx, (P.kit.name || 'BRAND').toUpperCase(), cw / 2, ch - 74, 3, 'center');
    ctx.fillStyle = r.accent;
    ctx.fillRect(cw / 2 - 45, ch - 50, 90, 3);
    ctx.restore();

    ctx.font = '400 15px ' + P.brand.fonts.body;
    ctx.fillStyle = r.inkSoft;
    ctx.fillText('1050 Ã— 600 px Â· 300 dpi Â· ask the printer for CMYK on 350 gsm stock.', 210, 930);
    ctx.fillText('The back uses the mono-light logo for price-friendly one-colour printing.', 210, 960);
    footer(ctx, P, 9);
    return { placements: pl, notes: [] };
  };

  SLIDES['11-stickers'] = function (ctx, P) {
    const r = P.brand.roles, pl = [];
    ctx.fillStyle = r.paperAlt; ctx.fillRect(0, 0, W, H);
    titleBlock(ctx, P, 'Sticker system', 'Die-cut set');

    const label = P.kit.stickerLabel || 'Trusted service';
    const sm = P.vars.images.submark;

    // sheet
    ctx.save();
    shadow(ctx, 30, 0, 16, 0.2);
    rr(ctx, 140, 250, 1180, 660, 26); ctx.fillStyle = r.paper; ctx.fill();
    noShadow(ctx);
    ctx.restore();

    // round sticker
    ctx.save();
    shadow(ctx, 16, 0, 8, 0.22);
    ctx.beginPath(); ctx.arc(360, 470, 150, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.restore();
    if (sm) drawFit(ctx, sm, 360, 470, 210, 210);
    // stickers are printed full-colour artwork: use the weakest brand ink so
    // the gate still catches an invisible logo without blocking colour prints
    const weakest = ((P.health && P.health.palette) || []).slice()
      .sort((a, b) => U.contrastRatio(a.hex, '#FFFFFF') - U.contrastRatio(b.hex, '#FFFFFF'))[0];
    pl.push(place('10-stickers', 'Round sticker', '#FFFFFF', weakest ? weakest.hex : r.primary, 'decorative'));

    // die-cut blob
    ctx.save();
    shadow(ctx, 16, 0, 8, 0.22);
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.05) {
      const rad = 150 + Math.sin(a * 5) * 16;
      const bx = 720 + Math.cos(a) * rad, by = 470 + Math.sin(a) * rad;
      a === 0 ? ctx.moveTo(bx, by) : ctx.lineTo(bx, by);
    }
    ctx.closePath();
    ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.restore();
    if (sm) drawFit(ctx, sm, 720, 470, 220, 220);

    // bumper strip
    ctx.save();
    shadow(ctx, 16, 0, 8, 0.22);
    rr(ctx, 950, 340, 320, 260, 26); ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.restore();
    if (sm) drawFit(ctx, sm, 1110, 430, 180, 150);
    ctx.font = '700 13px ' + P.brand.fonts.mono;
    ctx.fillStyle = r.ink;
    tracked(ctx, String(P.kit.website || '').replace(/^https?:\/\//, '').toUpperCase(), 1110, 556, 2, 'center');

    // small rounds row
    for (let i = 0; i < 3; i++) {
      const sx = 320 + i * 160, sy = 780;
      ctx.save();
      shadow(ctx, 12, 0, 6, 0.2);
      ctx.beginPath(); ctx.arc(sx, sy, 64, 0, Math.PI * 2);
      ctx.fillStyle = ['#FFFFFF', r.primary, r.accent][i]; ctx.fill();
      ctx.restore();
      if (sm) {
        ctx.globalAlpha = i === 0 ? 1 : 0.92;
        drawFit(ctx, i === 0 ? sm : (i === 1 ? P.vars.images.monoLight : P.vars.images.oneColor), sx, sy, 96, 96);
        ctx.globalAlpha = 1;
      }
    }

    // label sticker
    ctx.save();
    shadow(ctx, 12, 0, 6, 0.2);
    rr(ctx, 840, 750, 420, 140, 18); ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.setLineDash([7, 6]); ctx.strokeStyle = r.neutral; ctx.lineWidth = 1.5;
    ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    ctx.font = '700 12px ' + P.brand.fonts.mono;
    ctx.fillStyle = r.primary;
    tracked(ctx, label.toUpperCase(), 1050, 800, 3, 'center');
    ctx.font = '400 11.5px ' + P.brand.fonts.body;
    ctx.fillStyle = r.neutral;
    tracked(ctx, (P.kit.phone || ''), 1050, 830, 1, 'center');
    pl.push(place('10-stickers', 'Label sticker', '#FFFFFF', r.primary, 'text'));

    // export note column
    ctx.font = '700 12px ' + P.brand.fonts.mono;
    ctx.fillStyle = r.ink;
    tracked(ctx, 'EXPORTS', 1400, 320, 3, 'left');
    ['die-cut.svg â€” cut-ready outline', 'round-sticker.png (2x)', 'bumper-strip.png', 'label-sticker.png'].forEach((t, i) => {
      ctx.font = '400 15px ' + P.brand.fonts.body;
      ctx.fillStyle = r.inkSoft;
      ctx.fillText(t, 1400, 360 + i * 34);
    });
    footer(ctx, P, 10);
    return { placements: pl, notes: [] };
  };

  SLIDES['14-thankyou'] = function (ctx, P) {
    const r = P.brand.roles, pl = [], c = P.kit.contacts || {};
    ctx.fillStyle = r.ink; ctx.fillRect(0, 0, W, H);
    const rg = ctx.createRadialGradient(W / 2, 300, 40, W / 2, 300, 700);
    rg.addColorStop(0, toRgba(r.primary, 0.55));
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);

    const pick = pickLogo(r.ink, P);
    if (pick) { drawFit(ctx, pick.img, W / 2, 380, 620, 340); pl.push(place('11-thankyou', 'Closing logo', r.ink, pick.fg)); }

    ctx.textAlign = 'center';
    ctx.font = '500 84px ' + P.brand.fonts.heading;
    ctx.fillStyle = r.paper;
    ctx.fillText('Thank you.', W / 2, 640);
    pl.push(place('11-thankyou', 'Closing headline', r.ink, r.paper, 'text'));

    ctx.font = '400 22px ' + P.brand.fonts.body;
    ctx.fillStyle = tint(r.paper, 0.3);
    ctx.fillText('Questions on any slide? We will walk you through every decision.', W / 2, 700);

    ctx.font = '400 19px ' + P.brand.fonts.body;
    [c.phone, c.email, c.website].filter(Boolean).forEach((line, i) => {
      ctx.fillStyle = tint(r.paper, 0.18);
      ctx.fillText(line, W / 2, 790 + i * 34);
      pl.push(place('11-thankyou', 'Contact ' + i, r.ink, tint(r.paper, 0.18), 'text'));
    });
    ctx.fillStyle = r.accent; ctx.fillRect(W / 2 - 60, 880, 120, 2);
    ctx.font = '700 13px ' + P.brand.fonts.mono;
    tracked(ctx, 'DESIGNED BY PRIME KREATIVES', W / 2, 925, 5, 'center');
    pl.push(place('11-thankyou', 'Studio credit', r.ink, r.accent, 'decorative'));
    footer(ctx, P, 13);
    return { placements: pl, notes: [] };
  };

  /* 12 — business store logo / storefront signage */
  SLIDES['12-storefront'] = function (ctx, P) {
    const r = P.brand.roles, pl = [], c = P.kit.contacts || {};
    const sky = U.mix(r.paper, '#FFFFFF', 0.35);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    titleBlock(ctx, P, 'Signage', 'Business store logo');

    /* ---- facade ---- */
    const fx = 180, fy = 300, fw = 1240, fh = 560;
    // wall
    ctx.fillStyle = U.mix(r.paper, r.ink, 0.12);
    ctx.fillRect(fx, fy, fw, fh);
    // fascia sign board
    const sgY = fy + 40, sgH = 170;
    shadow(ctx, 24, 0, 10, 0.18);
    rr(ctx, fx + 40, sgY, fw - 80, sgH, 10);
    ctx.fillStyle = r.primary; ctx.fill();
    noShadow(ctx);
    const signInk = U.readableInk(r.primary);
    const signPick = pickLogo(r.primary, P);
    if (signPick) {
      drawFit(ctx, signPick.img, fx + 200, sgY + sgH / 2, 260, sgH * 0.7);
      pl.push(place('12-storefront', 'Fascia sign', r.primary, signPick.fg));
    }
    ctx.font = '500 52px ' + P.brand.fonts.heading;
    ctx.fillStyle = signInk;
    ctx.fillText(P.kit.name || 'Brand', fx + 380, sgY + 106);
    ctx.font = '400 22px ' + P.brand.fonts.body;
    ctx.fillStyle = signInk;
    ctx.fillText(P.kit.tagline || '', fx + 380, sgY + 146);
    pl.push(place('12-storefront', 'Sign wordmark', r.primary, signInk, 'text'));

    // windows + door
    const winY = sgY + sgH + 40;
    const glass = U.mix('#CDE3EE', '#FFFFFF', 0.25);
    // left window
    rr(ctx, fx + 40, winY, 620, 250, 6); ctx.fillStyle = glass; ctx.fill();
    ctx.strokeStyle = U.mix(r.ink, glass, 0.55); ctx.lineWidth = 6; ctx.stroke();
    // door with hours decal
    rr(ctx, fx + 700, winY, 200, 250, 6); ctx.fillStyle = glass; ctx.fill();
    ctx.strokeStyle = U.mix(r.ink, glass, 0.55); ctx.lineWidth = 6; ctx.stroke();
    // window vinyl (logo etched on glass)
    if (signPick) {
      ctx.save();
      rr(ctx, fx + 40, winY, 620, 250, 6); ctx.clip();
      ctx.globalAlpha = 0.55;
      drawFit(ctx, signPick.img, fx + 350, winY + 125, 300, 220);
      ctx.globalAlpha = 1;
      ctx.restore();
      pl.push(place('12-storefront', 'Window vinyl', glass, signPick.fg));
    }
    // door decal: hours + phone
    ctx.font = '700 16px ' + P.brand.fonts.mono;
    ctx.fillStyle = U.readableInk(glass);
    tracked(ctx, 'OPEN 8AM – 8PM', fx + 800, winY + 190, 1, 'center');
    tracked(ctx, String(c.phone || '').toUpperCase(), fx + 800, winY + 216, 1, 'center');
    pl.push(place('12-storefront', 'Door decal', glass, U.readableInk(glass), 'text'));
    // sidewalk
    ctx.fillStyle = U.mix(r.ink, r.paper, 0.75);
    ctx.fillRect(fx, fy + fh - 26, fw, 26);

    /* ---- signage application list ---- */
    ctx.font = '700 12px ' + P.brand.fonts.mono;
    ctx.fillStyle = r.ink;
    tracked(ctx, 'SIGNAGE PACK', 1500, 340, 3, 'left');
    [
      ['Fascia board', 'lit box · 300 mm cap height'],
      ['Window vinyl', 'cut vinyl / etched film'],
      ['Door decal', 'hours + phone number'],
      ['Staff tee back print', 'matches the uniform slide']
    ].forEach((row, i) => {
      const ry = 384 + i * 86;
      rr(ctx, 1500, ry, 340, 66, 10);
      ctx.fillStyle = r.paper; ctx.fill();
      ctx.strokeStyle = r.neutral; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = r.primary;
      ctx.fillRect(1500, ry, 6, 66);
      ctx.font = '600 15px ' + P.brand.fonts.body;
      ctx.fillStyle = r.ink;
      ctx.fillText(row[0], 1524, ry + 28);
      ctx.font = '400 12px ' + P.brand.fonts.body;
      ctx.fillStyle = r.neutral;
      ctx.fillText(row[1], 1524, ry + 50);
    });

    // spec line
    ctx.font = '400 15px ' + P.brand.fonts.body;
    ctx.fillStyle = r.inkSoft;
    ctx.fillText('Ask the fabricator for a lit box with the full-color logo; monochrome fallback for the door decal.', fx, 910);
    footer(ctx, P, 11);
    return { placements: pl, notes: [] };
  };

  /* 13 — desktop wallpaper */
  SLIDES['13-wallpaper'] = function (ctx, P) {
    const r = P.brand.roles, pl = [];
    const bg = U.mix(r.ink, '#000000', 0.18);
    ctx.fillStyle = r.paperAlt; ctx.fillRect(0, 0, W, H);
    titleBlock(ctx, P, 'Screen', 'Desktop wallpaper');

    /* ---- wallpaper preview (16:9 screen) ---- */
    const sx = 120, sy = 250, sw = 1480, sh = 832; // ~16:9
    shadow(ctx, 40, 0, 20, 0.3);
    rr(ctx, sx, sy, sw, sh, 16); ctx.fillStyle = bg; ctx.fill();
    noShadow(ctx);
    ctx.save(); rr(ctx, sx, sy, sw, sh, 16); ctx.clip();
    // subtle pattern
    ctx.strokeStyle = toRgba(r.primary, 0.16); ctx.lineWidth = 1;
    for (let i = -sh; i < sw; i += 46) {
      ctx.beginPath(); ctx.moveTo(sx + i, sy); ctx.lineTo(sx + i + sh, sy + sh); ctx.stroke();
    }
    // logo + wordmark
    const pick = pickLogo(bg, P);
    if (pick) {
      drawFit(ctx, pick.img, sx + sw / 2, sy + sh / 2 - 60, sw * 0.30, sh * 0.44);
      pl.push(place('13-wallpaper', 'Wallpaper mark', bg, pick.fg));
    }
    ctx.textAlign = 'center';
    ctx.font = '500 62px ' + P.brand.fonts.heading;
    ctx.fillStyle = r.paper;
    ctx.fillText(P.kit.name || 'Brand', sx + sw / 2, sy + sh / 2 + 250);
    ctx.font = '700 14px ' + P.brand.fonts.mono;
    ctx.fillStyle = r.accent;
    tracked(ctx, (P.kit.tagline || '').toUpperCase(), sx + sw / 2, sy + sh / 2 + 300, 5, 'center');
    ctx.font = '400 16px ' + P.brand.fonts.body;
    ctx.fillStyle = tint(r.paper, 0.35);
    tracked(ctx, String(P.kit.website || '').replace(/^https?:\/\//, '').toUpperCase(), sx + sw / 2, sy + sh - 54, 4, 'center');
    ctx.textAlign = 'left';
    ctx.restore();

    /* ---- annotations ---- */
    ctx.font = '700 12px ' + P.brand.fonts.mono;
    ctx.fillStyle = r.ink;
    tracked(ctx, 'SCREEN EXPORTS', 1660, 330, 3, 'left');
    [['1920 × 1080', 'full HD'], ['2560 × 1440', 'retina QHD'], ['Mobile 1170 × 2532', 'optional lock screen']]
      .forEach((row, i) => {
        const ry = 372 + i * 78;
        rr(ctx, 1660, ry, 210, 60, 10);
        ctx.fillStyle = r.paper; ctx.fill();
        ctx.strokeStyle = r.neutral; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.font = '700 14px ' + P.brand.fonts.mono;
        ctx.fillStyle = r.primary;
        ctx.fillText(row[0], 1676, ry + 26);
        ctx.font = '400 11.5px ' + P.brand.fonts.body;
        ctx.fillStyle = r.neutral;
        ctx.fillText(row[1], 1676, ry + 46);
      });
    ctx.font = '400 15px ' + P.brand.fonts.body;
    ctx.fillStyle = r.inkSoft;
    ctx.fillText('The mark sits at 30% of frame width and clear of the taskbar zone so icons never cover it.', sx, 940);
    footer(ctx, P, 12);
    return { placements: pl, notes: [] };
  };

  /* Render one slide into a canvas; returns { placements, notes } */
  function renderSlide(canvas, id, P) {
    const ctx = canvas.getContext('2d');
    const fn = SLIDES[id] || SLIDES['01-cover'];
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    const res = fn(ctx, P) || { placements: [], notes: [] };
    ctx.restore();
    return res;
  }

  /* Render every slide (used by the studio view, QA sheet and exports) */
  function renderAll(P, onStep) {
    return ORDER.map((s, i) => {
      const canvas = U.makeCanvas(W, H);
      const r = renderSlide(canvas, s.id, P);
      if (onStep) onStep(s, i);
      return { ...s, index: i, canvas, ...r };
    });
  }

  return {
    ORDER, W, H, SLIDES, drawFit, tracked, rr, shadow, noShadow, button, cap, chip, pickLogo, shirt, shirtPath,
    render: renderSlide, renderAll
  };
})();
