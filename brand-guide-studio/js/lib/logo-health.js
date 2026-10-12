/* ============================================================
   PK.logoHealth — upload checks + color extraction + flat-bg removal
   Suggest. #1: confidence-scored health gate before generation.
   Fixes the two historic failures: gray-background logos and
   "the uploads folder is empty" (missing file).
   ============================================================ */
window.PK = window.PK || {};
PK.logoHealth = (function () {
  'use strict';
  const U = PK.util;
  const MIN_DIM = 512;      // recommended for print reuse
  const ABSOLUTE_MIN = 128; // hard fail

  /* ---------- image loading ---------- */
  function loadImage(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('Could not decode image.'));
      img.src = src;
    });
  }

  function toCanvas(img, maxDim) {
    const w = Math.max(1, img.naturalWidth || img.width || 1);
    const h = Math.max(1, img.naturalHeight || img.height || 1);
    const c = U.makeCanvas(w, h);
    c.getContext('2d').drawImage(img, 0, 0);
    return c;
  }

  /* ---------- analysis ---------- */
  function analyze(img, meta) {
    const issues = [];
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    let hasAlpha = false, opaqueCount = 0, total = 0;
    let flatBgHex = null, flatBgShare = 0;
    let distinctColors = 0, sampled = 0;
    let nearWhiteShare = 0, nearBlackShare = 0;
    let satSum = 0;

    const c = toCanvas(img, 1200);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    let data;
    try { data = ctx.getImageData(0, 0, c.width, c.height).data; }
    catch (e) { return { reachable: false, issues: ['Browser blocked pixel access for this file.'], confidence: 0 }; }

    const counts = new Map();
    const step = Math.max(1, Math.floor((c.width * c.height) / 60000));
    const seen = new Set();

    for (let y = 0; y < c.height; y += step) {
      for (let x = 0; x < c.width; x += step) {
        const i = (y * c.width + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        total++;
        if (a > 8) opaqueCount++;
        if (a < 250) hasAlpha = true;
        if (a > 200) {
          const hex = U.rgbToHex(r, g, b);
          counts.set(hex, (counts.get(hex) || 0) + 1);
          if (a > 250) {
            if (r > 246 && g > 246 && b > 246) nearWhiteShare++;
            if (r < 12 && g < 12 && b < 12) nearBlackShare++;
            const p = U.parseColor(hex);
            satSum += U.rgbToHsl(hex).s;
            const key = (r >> 4) + ',' + (g >> 4) + ',' + (b >> 4);
            seen.add(key);
          }
        }
      }
    }
    sampled = total;
    distinctColors = seen.size;
    flatBgShare = opaqueCount / total;

    /* dominant color (possible flat background) */
    let best = 0;
    counts.forEach((n, hex) => { if (n > best) { best = n; flatBgHex = hex; } });
    flatBgShare = opaqueCount ? best / opaqueCount : 0;

    /* gradient / photo suspicion */
    const satAvg = opaqueCount ? satSum / opaqueCount : 0;
    const uniqueRatio = distinctColors / (sampled * 1.6);
    const flatBackground = !hasAlpha && flatBgShare > 0.55;
    const gradientSuspicion = Math.min(1, uniqueRatio * 1.6 + satAvg * 0.9);
    const isPhotographic = !hasAlpha && flatBgShare > 0.25 && gradientSuspicion > 0.5;

    /* --- scoring --- */
    let confidence = 0;
    if (hasAlpha) confidence += 30;                       // true transparency is ideal
    if (w >= MIN_DIM && h >= MIN_DIM) confidence += 22;
    else if (w >= ABSOLUTE_MIN && h >= ABSOLUTE_MIN) confidence += 10;
    if (!isPhotographic) confidence += 25;
    if (flatBackground) confidence += 23;                 // removable flat bg is fine
    if (distinctColors > 0 && distinctColors < 512) confidence += 0; else confidence += 0;
    confidence = Math.min(100, Math.round(confidence));

    /* --- issues --- */
    if (w < ABSOLUTE_MIN || h < ABSOLUTE_MIN)
      issues.push(`Resolution too low (${w}x${h}); ${ABSOLUTE_MIN}px minimum.`);
    else if (w < MIN_DIM || h < MIN_DIM)
      issues.push(`Under ${MIN_DIM}px (${w}x${h}); may blur in print.`);

    if (flatBackground)
      issues.push(`Flat ${flatBgHex} background covers ~${Math.round(flatBgShare * 100)}% — remove it before use.`);
    if (isPhotographic)
      issues.push('Logo looks like a photo/gradient — recolor and mono variants need a manual touch.');
    if ((meta || {}).kind === 'svg' && /gradient|linearGradient|radialGradient/i.test(meta.svgText || ''))
      issues.push('SVG uses gradients — mono/one-color recolor needs a manual touch.');

    /* extracted colors (by area share) */
    const palette = [];
    counts.forEach((n, hex) => {
      if (n / opaqueCount < 0.012) return;
      const hsl = U.rgbToHsl(hex);
      palette.push({ hex, share: n / opaqueCount, s: hsl.s, l: hsl.l });
    });
    palette.sort((a, b) => b.share - a.share);
    const distinct = [];
    palette.forEach((p) => {
      if (distinct.some((q) => U.contrastRatio(q.hex, p.hex) < 1.045)) return;
      distinct.push(p);
      if (distinct.length >= 5) return;
    });

    return {
      reachable: true,
      width: w, height: h,
      hasAlpha,
      flatBackground, flatBgHex, flatBgShare: Math.round(flatBgShare * 100),
      gradientSuspicion: Math.round(gradientSuspicion * 100),
      isPhotographic,
      distinctColorCount: distinctColors,
      palette: distinct,
      confidence,
      needsManualFix: isPhotographic || w < ABSOLUTE_MIN || h < ABSOLUTE_MIN,
      issues,
      sampleCanvas: c
    };
  }

  /* ---------- flat background removal (edge flood fill) ----------
     BFS seeds = border ring. A pixel clears if its RGB is within
     `tol` of the cleared neighbor it spread from. Preserves alpha. */
  function removeFlatBackground(img, tolerance) {
    const tol = typeof tolerance === 'number' ? tolerance : 26;
    const c = toCanvas(img, 1200);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const { width: w, height: h } = c;
    const img0 = ctx.getImageData(0, 0, w, h);
    const d = img0.data;
    const idx = (x, y) => (y * w + x) * 4;
    const visited = new Uint8Array(w * h);
    const queue = [];

    const dist = (i, j) =>
      Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]);

    const push = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const p = y * w + x;
      if (visited[p]) return;
      visited[p] = 1;
      queue.push(p);
    };

    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }

    for (let qi = 0; qi < queue.length; qi++) {
      const p = queue[qi];
      const x = p % w, y = (p - x) / w;
      const i = p * 4;
      if (d[i + 3] < 8) continue;
      // edge pixel → seed, clear it
      const onBorder = (x === 0 || y === 0 || x === w - 1 || y === h - 1);
      if (!onBorder) {
        // spread test: similar to the neighbor we came from (right/down preference,
        // falls back to left/up recalled from the queue order is fine because BFS
        // reaches this pixel from at least one cleared neighbor)
        let similar = false;
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const jp = ny * w + nx;
          if (visited[jp] && d[jp * 4 + 3] === 0 && dist(i, jp * 4) <= tol) { similar = true; break; }
        }
        if (!similar) continue; // keep: part of the mark
      }
      d[i + 3] = 0;
      push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
    }

    ctx.putImageData(img0, 0, 0);
    return c;
  }

  /* ---------- ink bounding box ---------- */
  function inkBox(canvas) {
    const ctx = canvas.getContext('2d');
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const a = d[(y * canvas.width + x) * 4 + 3];
        if (a > 16) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return { x: 0, y: 0, w: canvas.width, h: canvas.height };
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  return { analyze, loadImage, toCanvas, removeFlatBackground, inkBox, MIN_DIM, ABSOLUTE_MIN };
})();
