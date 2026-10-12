/* ============================================================
   PK.intake — mandatory pre-flight validation
   Suggest. #1: nothing renders until every gate is green.
   ============================================================ */
window.PK = window.PK || {};
PK.intake = (function () {
  'use strict';
  const U = PK.util;
  const PH = PK.placeholder;

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const URL_RE = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/[^\s]*)?$/i;
  const PHONE_RE = /^[+0-9][\d\s().-]{6,}$/;

  function checks(kit, health) {
    const list = [];
    const ph = PH.scanKit(kit);
    const block = (f) => ph.find((p) => p.field === f && p.level === 'block');

    /* --- identity --- */
    list.push({
      key: 'name', label: 'Client / brand name', required: true,
      ok: !!kit.name && kit.name.trim().length >= 2 && !block('Client name'),
      msg: !kit.name ? 'Required — the deck cover, footer and file names use it.'
        : block('Client name') ? 'Looks like template text: ' + block('Client name').label
        : kit.name.trim().length < 2 ? 'Use at least 2 characters.' : null
    });
    list.push({
      key: 'tagline', label: 'Tagline', required: false,
      ok: true,
      msg: !kit.tagline ? 'Optional — appears on the cover slide.' : null,
      level: 'ok'
    });

    /* --- logo --- */
    const logo = kit.logo && kit.logo.dataURL;
    list.push({
      key: 'logo', label: 'Logo file', required: true,
      ok: !!logo,
      msg: !logo ? 'Upload a PNG/SVG/JPG logo or generate the demo mark.'
        : null
    });
    list.push({
      key: 'logo-health', label: 'Logo health check', required: true,
      ok: !health || !!health.reachable,
      msg: !logo ? 'Cannot check until a logo is uploaded.'
        : health && health.needsManualFix ? 'Needs manual touch: ' + health.issues[0]
        : health ? 'Passed — confidence ' + health.confidence + '/100.' : null,
      level: !logo ? 'error' : health && health.needsManualFix ? 'warn' : 'ok'
    });

    /* --- palette --- */
    const colors = kit.colors || {};
    const colorCount = ['primary', 'secondary', 'accent'].filter((k) => U.isValidHex(colors[k])).length;
    const dup = colors.primary && colors.secondary &&
      colors.primary.toLowerCase() === colors.secondary.toLowerCase();
    list.push({
      key: 'palette', label: 'Brand colors', required: true,
      ok: colorCount >= 2 && !dup,
      msg: colorCount < 2 ? 'At least primary + secondary hex colors are required.'
        : dup ? 'Primary and secondary are identical — pick a distinct pair.' : null
    });
    const inkOk = U.isValidHex(colors.ink) && U.isValidHex(colors.paper);
    list.push({
      key: 'roles', label: 'Ink / paper roles', required: false,
      ok: inkOk,
      level: inkOk ? 'ok' : 'warn',
      msg: inkOk ? null : 'Default ink/paper will be used for text swaps.'
    });

    /* --- contacts (only what the toggled mockups actually need) --- */
    const t = kit.toggles || {};
    if (t.fb || t.cards) {
      list.push({
        key: 'contacts', label: 'Contact details', required: true,
        ok: true,
        msg: null
      });
      ['phone', 'email'].forEach((k) => {
        const v = kit.contacts[k];
        const b = block(k === 'phone' ? 'Phone' : 'Email');
        let ok = !!v, msg = 'Required for Facebook page + business cards.';
        if (v && !b) {
          if (k === 'phone' && !PHONE_RE.test(v)) { ok = false; msg = 'Phone format looks invalid (digits, spaces, +).'; }
          if (k === 'email' && !EMAIL_RE.test(v)) { ok = false; msg = 'Email format looks invalid.'; }
        } else if (b) { ok = false; msg = 'Looks like template data: ' + b.label; }
        list.push({ key: 'contacts.' + k, label: k.toUpperCase(), required: true, ok, msg });
      });
    }

    /* --- polo --- */
    if (t.uniform) {
      const pc = kit.uniformColor;
      list.push({
        key: 'uniform-color', label: 'Uniform color', required: true,
        ok: !!pc,
        msg: !pc ? 'Choose the uniform fabric color — it decides the thread color for the embroidery.' : null
      });
    }

    /* --- fonts --- */
    const f = kit.fonts || {};
    list.push({
      key: 'fonts', label: 'Typography pair', required: false,
      ok: !!f.heading && !!f.body,
      level: f.heading && f.body ? 'ok' : 'warn',
      msg: f.heading && f.body ? null : 'Auto pairing will be applied from the brand system.'
    });

    /* --- placeholder scan (whole kit) --- */
    const phBlock = ph.filter((p) => p.level === 'block');
    const phWarn = ph.filter((p) => p.level === 'warn');
    list.push({
      key: 'placeholders', label: 'Placeholder detector', required: true,
      ok: phBlock.length === 0,
      warn: phWarn.length > 0,
      msg: phBlock.length
        ? 'Blocking export — replace: ' + phBlock.map((p) => p.label).join(', ')
        : phWarn.length
          ? 'Verify these look real: ' + phWarn.map((p) => p.label).join(', ')
          : 'No sample data found in any field.'
    });

    return list;
  }

  return { checks, EMAIL_RE, URL_RE, PHONE_RE };
})();
