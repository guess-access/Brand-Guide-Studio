/* ============================================================
   PK.qa — automated QA gate before anything is client-facing
   Suggest. #3: contrast math, small-size legibility, placeholder
   detection, and full-slide render checks. Export is blocked
   until this passes (or is explicitly overridden).
   ============================================================ */
window.PK = window.PK || {};
PK.qa = (function () {
  'use strict';
  const U = PK.util;
  const PH = PK.placeholder;

  const LIMITS = { logo: 3.0, text: 4.5, deco: 2.0 };
  const perSlide = (slides) => {
    const out = {};
    slides.forEach((s) => { out[s.id] = { status: 'ok', issues: [] }; });
    return out;
  };

  function run(P, slides) {
    const blockers = [], warnings = [], fixes = [];
    const bySlide = perSlide(slides);

    const flag = (slide, level, msg) => {
      if (bySlide[slide]) {
        bySlide[slide].issues.push(msg);
        bySlide[slide].status = level === 'block' ? 'bad' : 'warn';
      }
      (level === 'block' ? blockers : warnings).push(slide + ' — ' + msg);
    };

    /* 1. contrast audit across every recorded placement */
    let placementCount = 0;
    slides.forEach((s) => {
      (s.placements || []).forEach((p) => {
        placementCount++;
        const need = LIMITS[p.kind] || LIMITS.logo;
        const ratio = U.contrastRatio(p.bg, p.fg);
        if (ratio < need) {
          flag(s.id, p.kind === 'logo' ? 'block' : 'warn',
            p.label + ': ' + p.kind + ' contrast ' + ratio.toFixed(2) + ':1 < ' + need + ':1 (' +
            p.fg + ' on ' + p.bg + ')');
        }
      });
    });

    /* 2. small-size legibility (favicon / submark) */
    const imgs = P.vars.images || {};
    [16, 32].forEach((px) => {
      if (!imgs.submark) return;
      try {
        const c = U.makeCanvas(px, px);
        const ctx = c.getContext('2d');
        ctx.drawImage(imgs.submark, 0, 0, px, px);
        const d = ctx.getImageData(0, 0, px, px).data;
        let ink = 0; const seen = new Set();
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] > 40) {
            ink++;
            seen.add((d[i] >> 5) + ',' + (d[i + 1] >> 5) + ',' + (d[i + 2] >> 5));
          }
        }
        const coverage = ink / (px * px);
        if (coverage < 0.03) flag('03-versions', 'warn', 'Submark nearly invisible at ' + px + 'px (coverage ' + (coverage * 100).toFixed(1) + '%).');
        if (seen.size < 2) flag('03-versions', 'warn', 'Submark reads as a single blob at ' + px + 'px — simplify for favicon use.');
      } catch (e) { /* pixel access blocked — skip silently */ }
    });

    /* 3. missing variants */
    ['primary', 'secondary', 'submark', 'monoDark', 'monoLight'].forEach((k) => {
      if (!imgs[k]) flag('03-versions', 'warn', 'Missing ' + k + ' variant (gradient or photo logo?).');
    });

    /* 4. placeholder sweep on the final kit */
    const ph = PH.scanKit(P.kit);
    ph.forEach((f) => flag('02-primary', f.level === 'block' ? 'block' : 'warn',
      'Placeholder in ' + f.field + ' (' + f.label + '): "' + String(f.value).slice(0, 40) + '"'));

    /* 5. completeness */
    if (slides.length !== PK.slides.ORDER.length)
      flag('01-cover', 'block', 'Only ' + slides.length + ' of ' + PK.slides.ORDER.length + ' slides rendered.');

    /* 6. health carry-over */
    if (P.health && P.health.needsManualFix)
      (P.health.issues || []).forEach((m) => flag('03-versions', 'warn', 'Logo health: ' + m));

    const ready = blockers.length === 0;
    return { ready, blockers, warnings, fixes, bySlide, placementCount };
  }

  return { run, LIMITS };
})();
