/* ============================================================
   PK.brandSystem — typography + full color roles
   Suggest. #7: complete role set instead of "two main colors".
   ============================================================ */
window.PK = window.PK || {};
PK.brandSystem = (function () {
  'use strict';
  const U = PK.util;

  /* Auto pairing from a logo-style class (license-safe Google fonts,
     with local fallbacks baked into util.FONTS when offline). */
  const PAIRS = {
    editorial: { heading: '"Fraunces", Georgia, serif', body: '"Work Sans", system-ui, sans-serif', mono: '"Space Mono", ui-monospace, monospace', note: 'Editorial — warm serif headlines, confident grotesque body.' },
    modern:    { heading: '"Archivo", Arial, sans-serif',     body: '"Archivo", Arial, sans-serif',     mono: '"Space Mono", ui-monospace, monospace', note: 'Modern — tight geometric sans for tech brands.' },
    bold:      { heading: '"Oswald", Impact, sans-serif',      body: '"Work Sans", system-ui, sans-serif', mono: '"Space Mono", ui-monospace, monospace', note: 'Bold — condensed display for signage-forward brands.' },
    friendly:  { heading: '"Nunito", Verdana, sans-serif',     body: '"Nunito", Verdana, sans-serif',   mono: '"Space Mono", ui-monospace, monospace', note: 'Friendly — rounded sans for community brands.' }
  };

  function pair(style) { return PAIRS[style] || PAIRS.editorial; }

  function build(kit, health) {
    const c = kit.colors || {};
    const palette = (health && health.palette) || [];

    /* pick smart defaults from extracted colors when kit is sparse */
    let primary = U.isValidHex(c.primary) ? c.primary : (palette.find((p) => p.s > 0.35 && p.l < 0.6) || { hex: '#0F294C' }).hex;
    let secondary = U.isValidHex(c.secondary) ? c.secondary : (palette.find((p) => p.hex !== primary && p.s > 0.3) || { hex: '#B88917' }).hex;
    let accent = U.isValidHex(c.accent) ? c.accent : (palette.find((p) => p.s > 0.55 && p.hex !== primary && p.hex !== secondary) || { hex: '#E39F0E' }).hex;
    let ink = U.isValidHex(c.ink) ? c.ink : (U.isLight(primary) ? '#1B1D2A' : primary);
    let paper = U.isValidHex(c.paper) ? c.paper : (U.isLight(ink) ? '#14121A' : '#F4F1EA');

    const roles = {
      primary,
      primaryDark: U.shade(primary, 0.34),
      primarySoft: U.tint(primary, 0.86),
      secondary,
      secondaryDark: U.shade(secondary, 0.34),
      accent,
      accentSoft: U.tint(accent, 0.82),
      ink,
      inkSoft: U.tint(ink, 0.22),
      inkInverse: U.isLight(paper) ? ink : paper,
      paper,
      paperAlt: U.shade(paper, 0.07),
      neutral: U.mix(ink, paper, 0.5)
    };

    /* a few compatibility aliases */
    roles.navy = roles.primary;
    roles.gold = roles.secondary;
    roles.sand = roles.accent;

    const fonts = kit.fonts && kit.fonts.heading ? kit.fonts : pair(kit.fontStyle || 'editorial');

    /* 1920-base type scale (slide canvases are 1920x1080) */
    const scale = {
      display: 92, h1: 54, h2: 38, h3: 27, body: 21, small: 16.5, label: 13
    };

    /* contrast matrix for the palette slide + QA */
    const names = ['primary', 'primaryDark', 'secondary', 'accent', 'ink', 'paper'];
    const matrix = {};
    names.forEach((a) => { matrix[a] = {}; names.forEach((b) => { matrix[a][b] = +U.contrastRatio(roles[a], roles[b]).toFixed(2); }); });

    return { roles, fonts, scale, matrix, contrast: { body: 4.5, logo: 3 } };
  }

  /* choose the logo variant that stays readable on a background — by rule,
     which is what keeps the "black logo on light" bug from ever rendering */
  function pickVariantForBg(brand, vars, bgHex) {
    const bgOnLight = U.isLight(bgHex);
    const candidates = [
      { key: 'primary', url: vars.primary, kind: 'primary' },
      { key: 'monoDark', url: vars.monoDark, kind: 'mono-dark' },
      { key: 'monoLight', url: vars.monoLight, kind: 'mono-light' },
      { key: 'oneColor', url: vars.oneColor, kind: 'one-color' }
    ].filter((c) => c.url);

    /* effective contrast we must respect: primary logo covered by alpha heuristics;
       mono variants are solid so we know their fg exactly. */
    const solid = [
      { key: 'monoDark', url: vars.monoDark, fg: '#111318' },
      { key: 'monoLight', url: vars.monoLight, fg: '#FFFFFF' }
    ].filter((c) => c.url);
    if (solid.length) {
      solid.sort((a, b) => U.contrastRatio(b.fg, bgHex) - U.contrastRatio(a.fg, bgHex));
      const best = solid[0];
      if (U.contrastRatio(best.fg, bgHex) >= 3) return { ...best, ratio: U.contrastRatio(best.fg, bgHex) };
    }
    const fallback = bgOnLight ? { key: 'monoDark', url: vars.monoDark, fg: '#111318' } : { key: 'monoLight', url: vars.monoLight, fg: '#FFFFFF' };
    return { ...fallback, ratio: fallback.url ? U.contrastRatio(fallback.fg, bgHex) : 0 };
  }

  return { build, pair, pickVariantForBg };
})();
