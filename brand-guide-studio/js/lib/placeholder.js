/* ============================================================
   PK.placeholder — sample-data detector (runs BEFORE rendering)
   Blocks the "fake followers / 0917 000 0000 / example.com" leak.
   ============================================================ */
window.PK = window.PK || {};
PK.placeholder = (function () {
  'use strict';

  /* Hard blockers — obviously sample data */
  const BLOCK = [
    { re: /\bTBD\b/i, label: '"TBD"' },
    { re: /lorem ipsum/i, label: '"lorem ipsum"' },
    { re: /\bX{3,}\b/, label: 'XXX placeholder' },
    { re: /your (company|brand|business|name|logo)/i, label: '"your company/brand" template text' },
    { re: /example\.(com|org|net)/i, label: 'example.com domain' },
    { re: /\bjohn doe\b/i, label: '"John Doe" sample name' },
    { re: /\bacme (corp|inc)?\b/i, label: '"Acme" sample brand' },
    { re: /\b123 ?[- ]?(main|fake|test)\b/i, label: 'sample street address' },
    { re: /\bsample (text|business|client|name)\b/i, label: 'sample copy' }
  ];

  /* Soft warnings — plausible but commonly forgotten */
  const WARN = [
    { re: /0\d{2}[ -]?\d{3}[ -]?0000\b/, label: 'phone ending in 0000 (looks fabricated)' },
    { re: /\b\d{3}[ -]555[ -]\d{4}\b/, label: 'phone with 555 segment' },
    { re: /\b555[-.\s]?\d{4}\b/, label: '"555" fake phone number' },
    { re: /\(?0?12[\)]?[ -]?345[ -]?6789/, label: '"012 345 6789" fake phone' },
    { re: /^(info|hello|contact)@(your|yourcompany)\./i, label: 'generic template email' },
    { re: /\b(yourhand|username)\b/i, label: 'unreplaced @username token' },
    { re: /\?[^\s]*=X{2,}/i, label: 'unreplaced variable' }
  ];

  function scanValue(fieldLabel, value) {
    if (!value) return [];
    const out = [];
    const s = String(value);
    BLOCK.forEach((p) => { if (p.re.test(s)) out.push({ field: fieldLabel, value: s, level: 'block', label: p.label }); });
    WARN.forEach((p) => { if (p.re.test(s)) out.push({ field: fieldLabel, value: s, level: 'warn', label: p.label }); });
    return out;
  }

  /* Scan the whole kit, returns [{field,label,value,level}] */
  function scanKit(kit) {
    const fields = [
      ['Client name', kit.name],
      ['Tagline', kit.tagline],
      ['Phone', kit.contacts && kit.contacts.phone],
      ['Email', kit.contacts && kit.contacts.email],
      ['Website', kit.contacts && kit.contacts.website],
      ['Address', kit.contacts && kit.contacts.address],
      ['Facebook', kit.contacts && kit.contacts.facebook],
      ['Instagram', kit.contacts && kit.contacts.instagram],
      ['Polo label', kit.poloLabel],
      ['Sticker label', kit.stickerLabel]
    ];
    const out = [];
    fields.forEach(([label, v]) => out.push(...scanValue(label, v)));
    // rates like ₱500/day usually signal invented copy
    const all = fields.map(([, v]) => String(v || '')).join(' ');
    if (/[₱$]?\s?\d[\d,]*\s?(per\sday|\/day|a day|day)/i.test(all))
      out.push({ field: 'Contacts', value: 'rate', level: 'warn', label: 'rate/day figure — confirm it is real' });
    return out;
  }

  return { scanValue, scanKit, BLOCK, WARN };
})();
