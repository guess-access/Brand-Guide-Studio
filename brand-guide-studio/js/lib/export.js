/* ============================================================
   PK.export — PDF / PPTX / PNG / social sizes / sticker SVG
   Suggest. #6: real deliverables, deterministic filenames.
   The PDF writer is dependency-free (DCTDecode JPEG embeds).
   ============================================================ */
window.PK = window.PK || {};
PK.export = (function () {
  'use strict';
  const U = PK.util;

  function savePNG(canvas, filename) {
    canvas.toBlob((b) => U.downloadBlob(filename, b), 'image/png');
  }
  function saveDataURL(filename, dataURL) {
    U.downloadDataURL(filename, dataURL);
  }
  function saveText(filename, text, mime) {
    U.downloadText(filename, text, mime || 'text/plain');
  }

  /* ---------------- minimal PDF writer ---------------- */
  function lat1(bytes) { // latin1 -> Uint8Array
    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) out[i] = bytes.charCodeAt(i) & 0xff;
    return out;
  }

  function toRgba(hex, a) {
    const c = U.hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }

  function exportPDF(slides, filename, opts) {
    opts = opts || {};
    const PW = 960, PH = 540;
    const bodies = [];
    const add = (body) => { bodies.push(body); return bodies.length; };

    add('<< /Type /Catalog /Pages 2 0 R >>');      // 1
    add('');                                        // 2 = pages (patched later)
    const kids = [];
    slides.forEach((s, i) => {
      const jpeg = s.canvas.toDataURL('image/jpeg', 0.92);
      const bin = atob(jpeg.split(',')[1]);
      const imgNum = add(
        '<< /Type /XObject /Subtype /Image /Width ' + s.canvas.width +
        ' /Height ' + s.canvas.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8' +
        ' /Filter /DCTDecode /Length ' + bin.length + ' >>\nstream\n' + bin + '\nendstream');
      const content = 'q\n' + PW + ' 0 0 ' + PH + ' 0 0 cm\n/Im0 Do\nQ';
      const contentNum = add('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream');
      const pageNum = add(
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH +
        '] /Resources << /XObject << /Im0 ' + imgNum + ' 0 R >> >> /Contents ' + contentNum + ' 0 R >>');
      kids.push(pageNum + ' 0 R');
      if (opts.onProgress) opts.onProgress(i + 1, slides.length);
    });
    bodies[1] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + kids.length + ' >>';

    let pdf = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
    const offsets = [];
    bodies.forEach((body, i) => {
      offsets.push(pdf.length);
      pdf += (i + 1) + ' 0 obj\n' + body + '\nendobj\n';
    });
    const xref = pdf.length;
    pdf += 'xref\n0 ' + (bodies.length + 1) + '\n0000000000 65535 f \n';
    offsets.forEach((o) => { pdf += String(o).padStart(10, '0') + ' 00000 n \n'; });
    pdf += 'trailer\n<< /Size ' + (bodies.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';

    U.downloadBlob(filename, new Blob([lat1(pdf)], { type: 'application/pdf' }));
    return true;
  }

  /* ---------------- PNG sequence ---------------- */
  function exportPNGs(slides, onStep) {
    return new Promise((resolve) => {
      let i = 0;
      const step = () => {
        if (i >= slides.length) return resolve(slides.length);
        savePNG(slides[i].canvas, slides[i].file);
        if (onStep) onStep(i + 1, slides.length);
        i++;
        setTimeout(step, 320); // pace downloads so the browser accepts them
      };
      step();
    });
  }

  /* ---------------- PPTX (optional CDN lib) ---------------- */
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }

  async function exportPPTX(slides, filename, opts) {
    opts = opts || {};
    if (!window.PptxGenJS) {
      try {
        await loadScript('https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js');
      } catch (e) {
        throw new Error('PPTX needs internet (CDN). Use the PDF export when offline.');
      }
    }
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    slides.forEach((s, i) => {
      const slide = pptx.addSlide();
      slide.addImage({ data: s.canvas.toDataURL('image/jpeg', 0.92), x: 0, y: 0, w: '100%', h: '100%' });
      if (opts.onProgress) opts.onProgress(i + 1, slides.length);
    });
    await pptx.writeFile({ fileName: filename });
    return true;
  }

  /* ---------------- social-size pack ---------------- */
  /* shared wallpaper composition (also used by slide 13) */
  function drawWallpaper(ctx, sw, sh, P) {
    const r = P.brand.roles, k = P.kit;
    const bg = U.mix(r.ink, '#000000', 0.18);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, sw, sh);
    ctx.strokeStyle = toRgba(r.primary, 0.16); ctx.lineWidth = 1;
    for (let i = -sh; i < sw; i += Math.round(sh / 14)) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + sh, sh); ctx.stroke();
    }
    const pick = PK.slides.pickLogo(bg, P);
    if (pick) PK.slides.drawFit(ctx, pick.img, sw / 2, sh / 2 - sh * 0.04, sw * 0.28, sh * 0.40);
    ctx.textAlign = 'center';
    ctx.font = '500 ' + Math.round(sh * 0.058) + 'px ' + P.brand.fonts.heading;
    ctx.fillStyle = r.paper;
    ctx.fillText(k.name || 'Brand', sw / 2, sh / 2 + sh * 0.22);
    ctx.font = '700 ' + Math.round(sw * 0.0075) + 'px ' + P.brand.fonts.mono;
    ctx.fillStyle = r.accent;
    PK.slides.tracked(ctx, (k.tagline || '').toUpperCase(), sw / 2, sh / 2 + sh * 0.28, Math.round(sw * 0.0025), 'center');
    ctx.font = '400 ' + Math.round(sw * 0.008) + 'px ' + P.brand.fonts.body;
    ctx.fillStyle = U.tint(r.paper, 0.35);
    PK.slides.tracked(ctx, String(k.website || '').replace(/^https?:\/\//, '').toUpperCase(), sw / 2, sh - sh * 0.06, Math.round(sw * 0.002), 'center');
    ctx.textAlign = 'left';
  }

  function exportSocial(P, prefix) {
    const r = P.brand.roles, k = P.kit;
    const slug = U.slug(k.name);
    const made = [];
    const pick = PK.slides.pickLogo(r.primary, P);
    const coverInk = U.readableInk(r.primary);

    // Facebook cover 1640x856
    (function () {
      const c = U.makeCanvas(1640, 856), ctx = c.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 1640, 856);
      g.addColorStop(0, r.primary); g.addColorStop(1, r.primaryDark);
      ctx.fillStyle = g; ctx.fillRect(0, 0, 1640, 856);
      if (pick) PK.slides.drawFit(ctx, pick.img, 820, 340, 620, 380);
      ctx.textAlign = 'center';
      ctx.font = '500 78px ' + P.brand.fonts.heading;
      ctx.fillStyle = r.paper;
      ctx.fillText(k.name || 'Brand', 820, 660);
      if (k.tagline) {
        ctx.font = '400 30px ' + P.brand.fonts.body;
        ctx.fillStyle = U.tint(r.paper, 0.25);
        ctx.fillText(k.tagline, 820, 720);
      }
      savePNG(c, slug + '/social/facebook-cover-1640x856.png');
      made.push('facebook-cover-1640x856.png');
    })();

    // Instagram square 1080
    (function () {
      const c = U.makeCanvas(1080, 1080), ctx = c.getContext('2d');
      ctx.fillStyle = r.paper; ctx.fillRect(0, 0, 1080, 1080);
      const lp = PK.slides.pickLogo(r.paper, P);
      if (lp) PK.slides.drawFit(ctx, lp.img, 540, 470, 620, 620);
      ctx.textAlign = 'center';
      ctx.font = '500 64px ' + P.brand.fonts.heading;
      ctx.fillStyle = r.ink;
      ctx.fillText(k.name || 'Brand', 540, 900);
      if (k.tagline) {
        ctx.font = '400 30px ' + P.brand.fonts.body;
        ctx.fillStyle = r.neutral;
        ctx.fillText(k.tagline, 540, 956);
      }
      savePNG(c, slug + '/social/instagram-post-1080x1080.png');
      made.push('instagram-post-1080x1080.png');
    })();

    // Instagram profile 320
    (function () {
      const c = U.makeCanvas(320, 320), ctx = c.getContext('2d');
      ctx.fillStyle = r.primary; ctx.fillRect(0, 0, 320, 320);
      const mp = PK.slides.pickLogo(r.primary, P);
      if (mp) PK.slides.drawFit(ctx, mp.img, 160, 160, 230, 230);
      savePNG(c, slug + '/social/instagram-profile-320.png');
      made.push('instagram-profile-320.png');
    })();

    // LinkedIn banner 1584x396 (4:1)
    (function () {
      const c = U.makeCanvas(1584, 396), ctx = c.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 1584, 396);
      g.addColorStop(0, r.primary); g.addColorStop(1, r.primaryDark);
      ctx.fillStyle = g; ctx.fillRect(0, 0, 1584, 396);
      if (pick) PK.slides.drawFit(ctx, pick.img, 300, 198, 380, 300);
      ctx.textAlign = 'left';
      ctx.font = '500 64px ' + P.brand.fonts.heading;
      ctx.fillStyle = coverInk;
      ctx.fillText(k.name || 'Company', 560, 180);
      if (k.tagline) {
        ctx.font = '400 26px ' + P.brand.fonts.body;
        ctx.fillStyle = coverInk;
        ctx.fillText(k.tagline, 560, 228);
      }
      savePNG(c, slug + '/social/linkedin-cover-1584x396.png');
      made.push('linkedin-cover-1584x396.png');
    })();

    // LinkedIn promoted post 1200x627
    (function () {
      const c = U.makeCanvas(1200, 627), ctx = c.getContext('2d');
      ctx.fillStyle = r.paper; ctx.fillRect(0, 0, 1200, 627);
      const lp = PK.slides.pickLogo(r.paper, P);
      if (lp) PK.slides.drawFit(ctx, lp.img, 360, 313, 460, 460);
      ctx.textAlign = 'left';
      ctx.font = '500 56px ' + P.brand.fonts.heading;
      ctx.fillStyle = r.ink;
      ctx.fillText(k.name || 'Company', 660, 250);
      ctx.font = '400 26px ' + P.brand.fonts.body;
      ctx.fillStyle = r.neutral;
      const post = k.fbPost || k.tagline || '';
      let yy = 300;
      post.split(' ').reduce((line, wd) => {
        const t = line ? line + ' ' + wd : wd;
        if (ctx.measureText(t).width > 440 && line) { ctx.fillText(line, 660, yy); yy += 36; return wd; }
        return t;
      }, '');
      ctx.fillStyle = r.primary;
      ctx.fillRect(660, yy + 30, 200, 4);
      savePNG(c, slug + '/social/linkedin-post-1200x627.png');
      made.push('linkedin-post-1200x627.png');
    })();

    // LinkedIn profile photo 400
    (function () {
      const c = U.makeCanvas(400, 400), ctx = c.getContext('2d');
      ctx.fillStyle = r.primary; ctx.fillRect(0, 0, 400, 400);
      const mp = PK.slides.pickLogo(r.primary, P);
      if (mp) PK.slides.drawFit(ctx, mp.img, 200, 200, 300, 300);
      savePNG(c, slug + '/social/linkedin-profile-400.png');
      made.push('linkedin-profile-400.png');
    })();

    // favicon set
    (function () {
      const fav = (P.vars.images || {}).favicon || {};
      Object.keys(fav).forEach((px) => {
        saveDataURL(slug + '/favicon/favicon-' + px + '.png', fav[px]);
        made.push('favicon-' + px + '.png');
      });
    })();

    // desktop wallpapers
    [[1920, 1080], [2560, 1440]].forEach(([w2, h2]) => {
      const c = U.makeCanvas(w2, h2), ctx = c.getContext('2d');
      drawWallpaper(ctx, w2, h2, P);
      savePNG(c, slug + '/screen/wallpaper-' + w2 + 'x' + h2 + '.png');
      made.push('wallpaper-' + w2 + 'x' + h2 + '.png');
    });

    return made;
  }

  /* ---------------- sticker die-cut SVG ---------------- */
  function exportStickerSVG(P) {
    const r = P.brand.roles, k = P.kit;
    const sm = (P.vars.images || {}).submark;
    const ring = Math.round(320);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="640" height="640" viewBox="0 0 640 640">
  <title>${U.escapeHtml(k.name || 'Brand')} — die-cut sticker</title>
  <defs>
    <filter id="halo" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="6" result="b"/>
      <feFlood flood-color="#FFFFFF" flood-opacity="1" result="c"/>
      <feComposite in="c" in2="b" operator="in" result="w"/>
      <feComposite in="SourceGraphic" in2="w" operator="over"/>
    </filter>
  </defs>
  <g filter="url(#halo)">
    ${sm ? `<image x="160" y="160" width="320" height="320" xlink:href="${sm}" preserveAspectRatio="xMidYMid meet"/>` : `<circle cx="320" cy="320" r="${ring}" fill="${r.primary}"/>`}
  </g>
  <circle cx="320" cy="320" r="${ring}" fill="none" stroke="#FFFFFF" stroke-width="14" stroke-opacity="0.9"/>
</svg>
`;
    saveText(U.slug(k.name) + '/stickers/die-cut.svg', svg, 'image/svg+xml');
    return 'die-cut.svg';
  }

  /* ---------------- manifest ---------------- */
  function exportManifest(P, qa, counts) {
    const manifest = {
      client: P.kit.name,
      generatedAt: new Date().toISOString(),
      brand: P.brand.roles,
      fonts: P.brand.fonts,
      logo: {
        file: P.kit.logo && P.kit.logo.name,
        width: P.health && P.health.width,
        height: P.health && P.health.height,
        confidence: P.health && P.health.confidence,
        needsManualFix: !!(P.health && P.health.needsManualFix)
      },
      slides: PK.slides.ORDER.map((s) => s.file),
      qa: {
        ready: qa.ready,
        blockers: qa.blockers,
        warnings: qa.warnings,
        placementsChecked: qa.placementCount
      },
      files: counts || []
    };
    saveText(U.slug(P.kit.name) + '/manifest.json', JSON.stringify(manifest, null, 2), 'application/json');
    return manifest;
  }

  return { savePNG, saveDataURL, saveText, exportPDF, exportPNGs, exportPPTX, exportSocial, exportStickerSVG, exportManifest };
})();
