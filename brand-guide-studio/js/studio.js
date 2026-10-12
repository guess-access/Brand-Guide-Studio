/* ============================================================
   PK.studio Ã¢â‚¬â€ controller: intake Ã¢â€ â€™ logo check Ã¢â€ â€™ generate Ã¢â€ â€™ QA Ã¢â€ â€™ export
   ============================================================ */
window.PK = window.PK || {};
PK.studio = (function () {
  'use strict';
  const U = PK.util;

  const state = {
    kit: null,
    health: null,
    brand: null,
    vars: { images: {}, notes: [] },
    slides: [],
    qa: null,
    override: false,
    stage: 1,
    unlocked: { 1: true, 2: false, 3: false, 4: false, 5: false },
    viewerIndex: 0
  };

  /* seeded client so the pipeline is demoable without uploads */
  const MWE_SEED = {
    id: 'mwe-motor-rental',
    name: 'MWE Motor Rental',
    tagline: 'Ride safe. Ride MWE.',
    fbCategory: 'Company Ã‚Â· Motorcycle rental',
    poloColor: '#0F294C',
    uniformColor: '#0F294C',
    stickerLabel: 'Helmet Included',
    fbPost: 'Clean bikes, helmets included Ã¢â‚¬â€ delivered to your door.',
    colors: { primary: '#0F294C', secondary: '#B88917', accent: '#E39F0E', ink: '#1B1D2A', paper: '#F4F1EA' },
    contacts: {
      phone: '+63 917 842 5560',
      email: 'book@mwemotorrental.ph',
      website: 'mwemotorrental.ph',
      address: 'Cebu City, Philippines',
      facebook: 'facebook.com/mwemotorrental',
      instagram: '@mwemotorrental'
    },
    fonts: { heading: '"Fraunces", Georgia, serif', body: '"Work Sans", system-ui, sans-serif', mono: '"Space Mono", ui-monospace, monospace' },
    fontsStyle: 'editorial',
    toggles: { fb: true, ig: true, linkedin: true, uniform: true, cards: true, stickers: true, store: true, wallpaper: true },
    logo: null
  };

  function blankKit(name) {
    const base = JSON.parse(JSON.stringify(MWE_SEED));
    base.id = null;
    base.name = name || '';
    base.tagline = '';
    base.contacts = { phone: '', email: '', website: '', address: '', facebook: '', instagram: '' };
    base.logo = null;
    base.uniformColor = '#1D1F34';
    return base;
  }

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------------- stage navigation ---------------- */
  function goStage(n) {
    state.stage = n;
    $$('.stage').forEach((el) => el.classList.toggle('active', +el.dataset.stage === n));
    $$('.stage-btn').forEach((b) => {
      const s = +b.dataset.stage;
      b.classList.toggle('active', s === n);
      b.classList.toggle('done', s < n && state.unlocked[s + 1]);
      b.classList.toggle('locked', !state.unlocked[s]);
    });
    $('#stageLabel').textContent = 'STAGE ' + n + ' / 5';
    if (n === 3) renderViewer();
    if (n === 4) renderQA();
  }

  function refreshGates() {
    const list = PK.intake.checks(state.kit, state.health);
    state.unlocked[2] = list.filter((c) => c.required && !c.ok).length === 0 && !!(state.kit.logo && state.kit.logo.dataURL);
    state.unlocked[3] = !!state.health && state.health.reachable;
    state.unlocked[4] = state.slides.length > 0;
    state.unlocked[5] = state.unlocked[4] && (state.qa ? state.qa.ready : false) || state.override;
    return list;
  }

  /* ---------------- intake binding ---------------- */
  const TEXT_FIELDS = ['name', 'tagline', 'fbCategory', 'uniformColor', 'stickerLabel', 'fbPost'];
  const CONTACT_FIELDS = ['phone', 'email', 'website', 'address', 'facebook', 'instagram'];
  const COLOR_FIELDS = ['primary', 'secondary', 'accent', 'ink', 'paper'];
  const TOGGLES = ['fb', 'ig', 'linkedin', 'uniform', 'cards', 'stickers', 'store', 'wallpaper'];

  function bindIntake() {
    TEXT_FIELDS.forEach((f) => {
      const el = document.getElementById('f-' + f);
      if (!el) return;
      el.addEventListener('input', () => {
        state.kit[f] = el.value;
        refreshStatus();
      });
    });
    CONTACT_FIELDS.forEach((f) => {
      const el = document.getElementById('c-' + f);
      if (!el) return;
      el.addEventListener('input', () => {
        state.kit.contacts[f] = el.value;
        refreshStatus();
      });
    });
    COLOR_FIELDS.forEach((f) => {
      const hex = document.getElementById('col-' + f);
      const picker = document.getElementById('pick-' + f);
      if (!hex) return;
      hex.addEventListener('input', () => {
        state.kit.colors[f] = hex.value;
        if (picker) picker.value = hex.value;
        refreshStatus();
      });
      if (picker) picker.addEventListener('input', () => {
        state.kit.colors[f] = picker.value;
        hex.value = picker.value;
        refreshStatus();
      });
    });
    const fs = document.getElementById('f-fontsStyle');
    if (fs) fs.addEventListener('change', () => { state.kit.fontsStyle = fs.value; refreshStatus(); });
    TOGGLES.forEach((t) => {
      const el = document.getElementById('t-' + t);
      if (!el) return;
      el.addEventListener('change', () => { state.kit.toggles[t] = el.checked; refreshStatus(); });
    });
  }

  function fillForm() {
    const k = state.kit;
    TEXT_FIELDS.forEach((f) => { const el = document.getElementById('f-' + f); if (el) el.value = k[f] || ''; });
    CONTACT_FIELDS.forEach((f) => { const el = document.getElementById('c-' + f); if (el) el.value = (k.contacts || {})[f] || ''; });
    COLOR_FIELDS.forEach((f) => {
      const hex = document.getElementById('col-' + f), pick = document.getElementById('pick-' + f);
      if (hex && k.colors[f]) hex.value = k.colors[f];
      if (pick && k.colors[f]) pick.value = k.colors[f];
    });
    const fs = document.getElementById('f-fontsStyle');
    if (fs) fs.value = k.fontsStyle || 'editorial';
    TOGGLES.forEach((t) => {
      const el = document.getElementById('t-' + t);
      if (el) el.checked = !!(k.toggles || {})[t];
    });
  }

  /* ---------------- status / validation list ---------------- */
  function refreshStatus() {
    const list = refreshGates();
    const box = $('#intakeChecks');
    box.innerHTML = '';
    let blocking = 0;
    list.forEach((c) => {
      const warn = c.level === 'warn' || (!c.ok && !c.required);
      if (c.required && !c.ok) blocking++;
      const row = U.el('div', 'check-row');
      row.innerHTML =
        '<span class="check-ico ' + (c.ok ? 'check-ok' : (warn ? 'check-warn' : 'check-err')) + '">' +
        (c.ok ? 'Ã¢Å“â€œ' : warn ? '!' : 'Ã¢Å“â€¢') + '</span>' +
        '<div><b>' + U.escapeHtml(c.label) + (c.required ? ' <span style="color:var(--amber)">required</span>' : '') + '</b>' +
        (c.msg ? '<p>' + U.escapeHtml(c.msg) + '</p>' : '') + '</div>';
      box.appendChild(row);
    });
    $('#clientName').textContent = state.kit.name || 'Untitled client';
    $('#gateMsg').textContent = blocking
      ? blocking + ' required field' + (blocking > 1 ? 's' : '') + ' still missing'
      : 'Pre-flight passed Ã¢â‚¬â€ logo stage unlocked';
    $('#gateMsg').className = 'badge ' + (blocking ? 'bad' : 'ok');
    $$('.stage-btn').forEach((b) => {
      const s = +b.dataset.stage;
      b.classList.toggle('locked', !state.unlocked[s]);
    });
  }

  /* ---------------- logo intake ---------------- */
  function bindLogo() {
    const dz = $('#dropzone'), input = $('#logoFile');
    dz.addEventListener('click', () => input.click());
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('over'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault(); dz.classList.remove('over');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleLogoFile(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', () => { if (input.files[0]) handleLogoFile(input.files[0]); });
    $('#demoLogo').addEventListener('click', useDemoLogo);
    $('#removeBg').addEventListener('click', removeLogoBackground);
  }

  function setLogoFromDataURL(name, dataURL, svgText) {
    state.kit.logo = { name, dataURL, svgText: svgText || null };
  }

  async function handleLogoFile(file) {
    const isSvg = /\.svg$/i.test(file.name) || file.type === 'image/svg+xml';
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result;
      if (isSvg) {
        const text = String(result);
        setLogoFromDataURL(file.name, null, text);
        state.kit.logo.dataURL = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
      } else {
        setLogoFromDataURL(file.name, String(result), null);
      }
      toast('Logo received Ã¢â‚¬â€ running health check');
      await runHealth();
    };
    if (isSvg) reader.readAsText(file); else reader.readAsDataURL(file);
  }

  function useDemoLogo() {
    const c = U.makeCanvas(1000, 1000);
    const ctx = c.getContext('2d');
    // flat-color demo mark (transparent background) to exercise the whole pipeline
    ctx.fillStyle = '#E39F0E';
    ctx.beginPath(); ctx.arc(500, 430, 210, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0F294C';
    ctx.font = '700 260px Georgia, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('M', 500, 445);
    ctx.fillStyle = '#0F294C';
    ctx.fillRect(300, 700, 400, 42);
    setLogoFromDataURL('demo-mark.png', c.toDataURL('image/png'), null);
    toast('Demo logo generated Ã¢â‚¬â€ health check running');
    runHealth();
  }

  async function runHealth() {
    if (!state.kit.logo || !state.kit.logo.dataURL) return;
    const meta = { kind: state.kit.logo.svgText ? 'svg' : 'raster', svgText: state.kit.logo.svgText };
    try {
      const img = await PK.logoHealth.loadImage(state.kit.logo.dataURL);
      state.health = PK.logoHealth.analyze(img, meta);
    } catch (e) {
      state.health = { reachable: false, issues: ['Could not decode the logo file.'], confidence: 0 };
    }
    renderHealth();
    await rebuildVariants();
    refreshStatus();
  }

  function removeLogoBackground() {
    if (!state.kit.logo || !state.kit.logo.dataURL || !state.health || !state.health.flatBackground) return;
    PK.logoHealth.loadImage(state.kit.logo.dataURL).then((img) => {
      const tol = parseInt($('#bgTol').value, 10) || 26;
      const c = PK.logoHealth.removeFlatBackground(img, tol);
      setLogoFromDataURL('bg-removed.png', c.toDataURL('image/png'), null);
      toast('Flat background removed');
      runHealth();
    });
  }

  function renderHealth() {
    const h = state.health, box = $('#healthReport');
    box.innerHTML = '';
    if (!h) return;
    const meter = U.el('div');
    meter.innerHTML = '<div class="meter"><i style="width:' + h.confidence + '%"></i></div>' +
      '<span class="badge ' + (h.needsManualFix ? 'warn' : 'ok') + '">confidence ' + h.confidence + '/100</span> ' +
      '<span class="badge">' + (h.width || '?') + ' Ãƒâ€” ' + (h.height || '?') + ' px</span> ' +
      (h.hasAlpha ? '<span class="badge ok">transparent</span>' : (h.flatBackground ? '<span class="badge warn">flat ' + h.flatBgHex + ' bg</span>' : '<span class="badge">opaque</span>')) +
      (h.gradientSuspicion != null ? '<span class="badge">gradient suspicion ' + h.gradientSuspicion + '%</span>' : '');
    box.appendChild(meter);
    (h.issues || []).forEach((msg) => {
      const row = U.el('div', 'check-row');
      row.innerHTML = '<span class="check-ico check-warn">!</span><div><p>' + U.escapeHtml(msg) + '</p></div>';
      box.appendChild(row);
    });
    (h.palette || []).forEach((p) => {
      const row = U.el('div', 'swatch');
      row.innerHTML = '<i style="background:' + p.hex + '"></i><span>' + p.hex.toUpperCase() +
        ' Ã¢â‚¬â€ ' + Math.round(p.share * 100) + '% of pixels' + (p.s > 0.35 ? ' Ã‚Â· saturated' : '') + '</span>';
      box.appendChild(row);
    });
    $('#removeBg').disabled = !(h.flatBackground);
  }

  /* ---------------- variations ---------------- */
  async function rebuildVariants() {
    if (!state.kit.logo || !state.kit.logo.dataURL) return;
    const built = await PK.variations.build(state.kit, state.health, state.kit.logo.svgText);
    const load = (src) => src ? PK.logoHealth.loadImage(src) : Promise.resolve(null);
    const keys = ['primary', 'secondary', 'submark', 'monoLight', 'monoDark', 'oneColor'];
    const imgs = {};
    await Promise.all(keys.map(async (k) => { imgs[k] = await load(built[k]); }));
    imgs.favicon = {};
    await Promise.all(Object.keys(built.favicon || {}).map(async (px) => {
      imgs.favicon[px] = await load(built.favicon[px]);
    }));
    state.vars.images = imgs;
    state.vars.urls = built;
    state.vars.notes = built.notes || [];
    state.vars.minSizes = built.minSizes;
    renderVariations();
  }

  function renderVariations() {
    const box = $('#variationGrid');
    box.innerHTML = '';
    const urls = state.vars.urls || {};
    const tiles = [
      ['primary', 'Primary', 'full lockup'],
      ['secondary', 'Secondary', 'stacked'],
      ['submark', 'Submark', 'avatar / sticker'],
      ['monoLight', 'Mono light', 'on dark'],
      ['monoDark', 'Mono dark', 'on light'],
      ['oneColor', 'One color', 'single ink']
    ];
    tiles.forEach(([key, label, note]) => {
      const t = U.el('div', 'tile');
      const dark = key === 'monoLight';
      t.innerHTML = '<div class="img" style="background:' + (dark ? '#1B1D2A' : '#F4F1EA') + '">' +
        (urls[key] ? '<img src="' + urls[key] + '" alt="' + label + '"/>' : '<span style="font-size:11px;color:#888">not available</span>') +
        '</div><div class="cap">' + label + '<small>' + note + '</small></div>';
      box.appendChild(t);
    });
    (state.vars.notes || []).forEach((n) => {
      const row = U.el('div', 'check-row');
      row.innerHTML = '<span class="check-ico check-warn">!</span><div><p>' + U.escapeHtml(n) + '</p></div>';
      box.appendChild(row);
    });
  }

  /* ---------------- generate ---------------- */
  function buildP() {
    if (!state.brand) state.brand = PK.brandSystem.build(state.kit, state.health);
    return { kit: state.kit, brand: state.brand, health: state.health, vars: state.vars };
  }

  async function generate() {
    if (!state.unlocked[3]) { toast('Finish the logo stage first'); return; }
    state.brand = PK.brandSystem.build(state.kit, state.health);
    await rebuildVariants();
    await U.ensureFonts();

    const P = buildP();
    const order = PK.slides.ORDER;
    state.slides = [];
    $('#genProgress').style.width = '0%';
    const step = (i) => {
      if (i >= order.length) {
        state.viewerIndex = 0;
        state.unlocked[4] = true;
        refreshGates();
        renderViewer();
        runQA();
        goStage(4);
        toast('Deck rendered Ã¢â‚¬â€ QA gate passed before export is enabled');
        return;
      }
      const s = order[i];
      const canvas = U.makeCanvas(PK.slides.W, PK.slides.H);
      const res = PK.slides.render(canvas, s.id, P);
      state.slides.push({ ...s, index: i, canvas, ...res });
      $('#genProgress').style.width = Math.round(((i + 1) / order.length) * 100) + '%';
      setTimeout(() => step(i + 1), 30);
    };
    step(0);
  }

  function renderViewer() {
    const box = $('#viewer');
    box.innerHTML = '';
    const s = state.slides[state.viewerIndex];
    if (!s) { box.innerHTML = '<p style="color:rgba(244,241,234,.6)">No deck yet Ã¢â‚¬â€ press Generate.</p>'; return; }
    const img = U.el('img');
    img.src = s.canvas.toDataURL('image/jpeg', 0.92);
    img.style.cssText = 'width:100%;border-radius:14px;border:1px solid var(--line)';
    box.appendChild(img);
    const label = U.el('p');
    label.style.cssText = 'margin-top:10px;font-family:Space Mono,monospace;font-size:11px;color:var(--sand)';
    label.textContent = String(state.viewerIndex + 1).padStart(2, '0') + ' Ã‚Â· ' + s.title + ' Ã‚Â· ' + s.file;
    box.appendChild(label);
    $('#prevSlide').disabled = state.viewerIndex === 0;
    $('#nextSlide').disabled = state.viewerIndex >= state.slides.length - 1;
    const strip = $('#slideStrip');
    strip.innerHTML = '';
    state.slides.forEach((sl, i) => {
      const b = U.el('button', 'mini-btn' + (i === state.viewerIndex ? ' gold' : ''));
      b.textContent = String(i + 1).padStart(2, '0');
      b.title = sl.title;
      b.addEventListener('click', () => { state.viewerIndex = i; renderViewer(); });
      strip.appendChild(b);
    });
  }

  /* ---------------- QA ---------------- */
  function runQA() {
    state.qa = PK.qa.run(buildP(), state.slides);
    state.unlocked[5] = state.qa.ready || state.override;
    renderQA();
    refreshGates();
    return state.qa;
  }

  function renderQA() {
    const q = state.qa;
    const box = $('#qaSummary'), list = $('#qaList'), grid = $('#qaGrid');
    box.innerHTML = ''; list.innerHTML = ''; grid.innerHTML = '';
    if (!q) return;
    box.innerHTML =
      '<span class="badge ' + (q.ready ? 'ok' : 'bad') + '">' + (q.ready ? 'ready to export' : 'blocked') + '</span> ' +
      '<span class="badge">' + q.placementCount + ' placements checked</span> ' +
      '<span class="badge ' + (q.blockers.length ? 'bad' : 'ok') + '">' + q.blockers.length + ' blocking</span> ' +
      '<span class="badge ' + (q.warnings.length ? 'warn' : 'ok') + '">' + q.warnings.length + ' warnings</span>';

    [...q.blockers.map((m) => ({ m, lv: 'err' })), ...q.warnings.map((m) => ({ m, lv: 'warn' }))].forEach(({ m, lv }) => {
      const row = U.el('div', 'check-row');
      row.innerHTML = '<span class="check-ico ' + (lv === 'err' ? 'check-err' : 'check-warn') + '">' +
        (lv === 'err' ? 'Ã¢Å“â€¢' : '!') + '</span><div><p>' + U.escapeHtml(m) + '</p></div>';
      list.appendChild(row);
    });

    state.slides.forEach((s) => {
      const st = (q.bySlide[s.id] || { status: 'ok', issues: [] });
      const cell = U.el('div', 'qa-thumb');
      cell.innerHTML = '<span class="tag">' + String(s.index + 1).padStart(2, '0') + ' ' + U.escapeHtml(s.title) + '</span>' +
        '<span class="st ' + st.status + '"></span>';
      const img = U.el('img');
      img.src = s.canvas.toDataURL('image/jpeg', 0.6);
      cell.appendChild(img);
      if (st.issues.length) {
        const p = U.el('p');
        p.style.cssText = 'font-size:11px;color:rgba(240,167,156,.9);padding:8px 10px';
        p.textContent = st.issues[0];
        cell.appendChild(p);
      }
      grid.appendChild(cell);
    });

    $('#exportGate').disabled = !q.ready && !state.override;
    $('#exportGate').textContent = q.ready ? 'Export section unlocked' : 'Blocked Ã¢â‚¬â€ fix issues or override below';
  }

  /* ---------------- registry ---------------- */
  function renderRegistry() {
    const box = $('#registry');
    box.innerHTML = '';
    PK.store.list().forEach((c) => {
      const row = U.el('div', 'registry-item');
      row.innerHTML = '<div class="meta"><b>' + U.escapeHtml(c.name) + '</b><span>' +
        (c.updated ? new Date(c.updated).toLocaleString() : '') + '</span></div>';
      const load = U.el('button', 'mini-btn', 'Load');
      load.addEventListener('click', () => loadClient(c.id));
      const del = U.el('button', 'mini-btn', 'Ã¢Å“â€¢');
      del.title = 'Delete';
      del.addEventListener('click', () => { PK.store.remove(c.id); renderRegistry(); });
      row.appendChild(load); row.appendChild(del);
      box.appendChild(row);
    });
  }

  function saveClient(silent) {
    if (!state.kit.name) { toast('Name the client first'); return false; }
    if (!state.kit.id) state.kit.id = PK.store.newId(state.kit.name);
    PK.store.save(state.kit);
    renderRegistry();
    if (!silent) toast('Brand kit saved for ' + state.kit.name);
    return true;
  }

  function loadClient(id) {
    const kit = PK.store.get(id);
    if (!kit) return;
    state.kit = JSON.parse(JSON.stringify(kit));
    fillForm();
    refreshStatus();
    if (state.kit.logo && state.kit.logo.dataURL) { toast('Re-running health check and variants'); runHealth(); }
    else { state.health = null; renderHealth(); }
    state.slides = []; state.qa = null;
    state.unlocked[4] = false; state.unlocked[5] = false;
    toast('Loaded ' + state.kit.name);
  }

  function bindRegistry() {
    $('#newClient').addEventListener('click', () => {
      state.kit = blankKit('');
      state.health = null; state.slides = []; state.qa = null;
      state.unlocked = { 1: true, 2: false, 3: false, 4: false, 5: false };
      fillForm(); renderHealth(); refreshStatus(); goStage(1);
    });
    $('#saveClient').addEventListener('click', () => saveClient());
    $('#exportKit').addEventListener('click', () => {
      saveClient(true);
      U.downloadText(U.slug(state.kit.name) + '.brandkit.json', PK.store.exportJSON(state.kit), 'application/json');
      toast('Brand kit exported');
    });
    $('#importKit').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          state.kit = PK.store.importJSON(String(r.result));
          fillForm(); refreshStatus(); renderRegistry();
          if (state.kit.logo && state.kit.logo.dataURL) runHealth();
          toast('Imported ' + state.kit.name);
        } catch (err) { toast('Import failed: ' + err.message); }
      };
      r.readAsText(f);
    });
    $('#seedMwe').addEventListener('click', () => {
      if (!PK.store.get('mwe-motor-rental')) PK.store.save(JSON.parse(JSON.stringify(MWE_SEED)));
      loadClient('mwe-motor-rental');
    });
  }

  /* ---------------- export actions ---------------- */
  function bindExport() {
    const guard = () => {
      if (!state.slides.length) { toast('Generate the deck first'); return false; }
      if (!state.qa || (!state.qa.ready && !state.override)) { toast('QA gate is blocking export'); return false; }
      return true;
    };

    $('#expPdf').addEventListener('click', () => {
      if (!guard()) return;
      saveClient(true);
      PK.export.exportPDF(state.slides, U.slug(state.kit.name) + '/' + U.slug(state.kit.name) + '-brand-deck.pdf');
      counts.push(state.kit.name + '-brand-deck.pdf');
      toast('PDF deck exported');
    });
    $('#expPptx').addEventListener('click', async () => {
      if (!guard()) return;
      try {
        await PK.export.exportPPTX(state.slides, U.slug(state.kit.name) + "/" + U.slug(state.kit.name) + "-brand-deck.pptx");
        toast('PPTX exported');
      } catch (e) { toast(e.message); }
    });
    $('#expPng').addEventListener('click', async () => {
      if (!guard()) return;
      toast('Downloading slides Ã¢â‚¬â€ allow multiple downloads');
      await PK.export.exportPNGs(state.slides);
      toast('PNG sequence exported');
    });
    $('#expSocial').addEventListener('click', () => {
      if (!guard()) return;
      PK.export.exportSocial(buildP());
      toast('Social-size pack exported');
    });
    $('#expSticker').addEventListener('click', () => {
      if (!guard()) return;
      PK.export.exportStickerSVG(buildP());
      toast('Die-cut SVG exported');
    });
    $('#expReview').addEventListener('click', () => {
      if (!state.slides.length) { toast('Generate the deck first'); return; }
      saveClient(true);
      PK.review.exportReview(buildP(), state.qa || { ready: false, blockers: [], warnings: [], placementCount: 0 }, state.slides);
      counts.push('review.html');
      toast('Review package exported Ã¢â‚¬â€ send that one file to the client');
    });
    $('#expManifest').addEventListener('click', () => {
      if (!state.slides.length) { toast('Generate the deck first'); return; }
      PK.export.exportManifest(buildP(), state.qa, counts);
      toast('Manifest exported');
    });
    $('#overrideQA').addEventListener('change', (e) => {
      state.override = e.target.checked;
      state.unlocked[5] = (state.qa && state.qa.ready) || state.override;
      refreshGates();
      renderQA();
    });
    $('#importApproval').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const a = PK.review.importApproval(String(r.result));
          state.kit.approval = a;
          saveClient(true);
          toast('Approval imported: ' + a.decision + ' by ' + (a.client || 'client'));
        } catch (err) { toast('Not an approval file: ' + err.message); }
      };
      r.readAsText(f);
    });
  }

  const counts = [];

  /* ---------------- boot ---------------- */
  function boot() {
    state.kit = blankKit('');
    bindIntake(); bindLogo(); bindRegistry(); bindExport();
    $('#btnGenerate').addEventListener('click', generate);
    $('#prevSlide').addEventListener('click', () => { state.viewerIndex = Math.max(0, state.viewerIndex - 1); renderViewer(); });
    $('#nextSlide').addEventListener('click', () => { state.viewerIndex = Math.min(state.slides.length - 1, state.viewerIndex + 1); renderViewer(); });
    $('#btnRefreshQa').addEventListener('click', runQA);
    $$('.stage-btn').forEach((b) => b.addEventListener('click', () => {
      const n = +b.dataset.stage;
      if (state.unlocked[n]) goStage(n);
      else toast('Finish the previous stage first');
    }));
    fillForm(); renderHealth(); renderRegistry(); refreshStatus(); goStage(1);
    U.ensureFonts();
  }

  return { boot, state, goStage, save: saveClient, seedMwe: () => loadClient('mwe-motor-rental') };
})();

document.addEventListener('DOMContentLoaded', () => PK.studio.boot());
