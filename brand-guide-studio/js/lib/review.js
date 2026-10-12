/* ============================================================
   PK.review — self-contained shareable review package
   Suggest. #5/#6: the deliverable the client actually opens.
   One HTML file with all slides embedded, comment boxes, and an
   approve/decline gate that produces an email-able certificate.
   ============================================================ */
window.PK = window.PK || {};
PK.review = (function () {
  'use strict';
  const U = PK.util;

  function buildHTML(P, qa, slides) {
    const r = P.brand.roles, k = P.kit;
    const slideHTML = slides.map((s, i) => `
      <section class="slide" id="s${i}">
        <div class="shead">
          <span class="snum">${String(i + 1).padStart(2, '0')}</span>
          <b>${U.escapeHtml(s.title)}</b>
          <span class="sfile">${U.escapeHtml(s.file)}</span>
        </div>
        <img src="${s.canvas.toDataURL('image/jpeg', 0.9)}" alt="${U.escapeHtml(s.title)}" loading="lazy"/>
        <div class="comment">
          <label>Comment on this slide</label>
          <textarea data-slide="${i}" placeholder="Optional — e.g. make the polo blue darker"></textarea>
        </div>
      </section>`).join('\n');

    const qaHTML = `
      <div class="qa ${qa.ready ? 'ok' : 'blocked'}">
        <b>QA gate: ${qa.ready ? 'PASSED' : 'CHANGES NEEDED'}</b>
        <span>${qa.placementCount} color placements checked · ${qa.blockers.length} blocking · ${qa.warnings.length} warnings</span>
      </div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${U.escapeHtml(k.name)} — Brand Deck for Review</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500&family=Work+Sans:wght@400;500;600&family=Space+Mono&display=swap" rel="stylesheet">
<style>
  :root{--primary:${r.primary};--ink:${r.ink};--paper:${r.paper};--accent:${r.accent};}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Work Sans',system-ui,sans-serif;background:${r.ink};color:${r.paper};line-height:1.5}
  header{padding:52px 24px 40px;text-align:center;background:linear-gradient(180deg,${r.primaryDark},${r.ink})}
  header h1{font-family:'Fraunces',Georgia,serif;font-weight:500;font-size:clamp(28px,5vw,46px)}
  header p{color:rgba(244,241,234,.7);margin-top:10px;font-size:15px}
  .qa{display:inline-flex;gap:12px;align-items:center;margin-top:20px;padding:9px 20px;border-radius:99px;
    font-family:'Space Mono',monospace;font-size:11px;letter-spacing:.06em}
  .qa.ok{border:1px solid rgba(63,164,106,.6);color:#9fe0bd}
  .qa.blocked{border:1px solid rgba(200,75,60,.6);color:#f0a79c}
  .wrap{max-width:1060px;margin:0 auto;padding:34px 20px 120px}
  .slide{background:rgba(244,241,234,.05);border:1px solid rgba(221,181,104,.2);border-radius:16px;
    overflow:hidden;margin-bottom:26px}
  .shead{display:flex;align-items:center;gap:12px;padding:13px 18px;border-bottom:1px solid rgba(221,181,104,.16)}
  .snum{font-family:'Space Mono',monospace;color:#DDB568;font-size:12px}
  .shead b{font-size:14.5px}
  .sfile{margin-left:auto;font-family:'Space Mono',monospace;font-size:10.5px;opacity:.55}
  .slide img{width:100%;display:block}
  .comment{padding:12px 18px 16px}
  .comment label{display:block;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.14em;
    text-transform:uppercase;color:#DDB568;margin-bottom:6px}
  .comment textarea{width:100%;min-height:54px;resize:vertical;border-radius:10px;padding:10px 12px;
    border:1px solid rgba(221,181,104,.25);background:rgba(27,29,42,.6);color:${r.paper};font-family:inherit;font-size:13.5px}
  .approve-bar{position:fixed;left:0;right:0;bottom:0;display:flex;gap:14px;justify-content:center;
    padding:14px;background:rgba(15,41,76,.92);border-top:1px solid rgba(221,181,104,.25);backdrop-filter:blur(8px)}
  button{cursor:pointer;border:none;border-radius:99px;padding:13px 26px;font-family:'Space Mono',monospace;
    font-size:11.5px;letter-spacing:.08em;text-transform:uppercase}
  .yes{background:${r.accent};color:${r.ink};font-weight:700}
  .no{background:transparent;border:1px solid rgba(240,167,156,.6);color:#f0a79c}
  footer{text-align:center;padding:30px 20px 90px;font-size:13px;color:rgba(244,241,234,.55)}
  .note{font-size:12.5px;color:rgba(244,241,234,.6);margin-top:10px;text-align:center}
</style>
</head>
<body>
<header>
  <h1>${U.escapeHtml(k.name)}</h1>
  <p>${U.escapeHtml(k.tagline || 'Brand system & mockup deck')} — prepared by Prime Kreatives</p>
  ${qaHTML}
</header>
<div class="wrap">
  <p class="note">Slide ${slides.length} · review each page, add comments where you want changes, then approve or request revisions below.</p>
  ${slideHTML}
</div>
<footer>
  ${U.escapeHtml(k.contacts && k.contacts.phone || '')} · ${U.escapeHtml(k.contacts && k.contacts.email || '')} · ${U.escapeHtml(k.contacts && k.contacts.website || '')}
</footer>
<div class="approve-bar">
  <button class="yes" id="approveBtn">Approve this deck</button>
  <button class="no" id="reviseBtn">Request revisions</button>
</div>
<script>
(function(){
  function comments(){
    var out = {};
    document.querySelectorAll('textarea[data-slide]').forEach(function(t){
      if (t.value.trim()) out[t.getAttribute('data-slide')] = t.value.trim();
    });
    return out;
  }
  function certificate(decision){
    return {
      format: 'pk-approval', version: 1,
      client: ${JSON.stringify(k.name || '')},
      decision: decision,
      comments: comments(),
      slides: ${slides.length},
      signedAt: new Date().toISOString(),
      note: 'Email this file back to Prime Kreatives — the studio imports it to unlock final delivery.'
    };
  }
  function deliver(decision){
    var blob = new Blob([JSON.stringify(certificate(decision), null, 2)], {type:'application/json'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = ${JSON.stringify(U.slug(k.name))} + (decision === 'approved' ? '-approved.json' : '-revisions.json');
    document.body.appendChild(a); a.click();
    document.body.innerHTML = '<header style="padding:120px 24px;text-align:center"><h1>' +
      (decision === 'approved' ? 'Thank you — approval saved.' : 'Revisions sent.') +
      '</h1><p style="margin-top:14px;color:rgba(244,241,234,.7)">Your signed file has been downloaded. Send it back to Prime Kreatives to release the final package.</p></header>';
  }
  document.getElementById('approveBtn').addEventListener('click', function(){
    if (confirm('Approve the deck exactly as shown?')) deliver('approved');
  });
  document.getElementById('reviseBtn').addEventListener('click', function(){
    if (confirm('Send the comments on this page as revision requests?')) deliver('revisions');
  });
})();
<\/script>
</body>
</html>`;
  }

  function exportReview(P, qa, slides) {
    const html = buildHTML(P, qa, slides);
    U.downloadText(U.slug(P.kit.name) + '/review.html', html, 'text/html');
    return html;
  }

  /* Import the client's signed certificate back into the studio */
  function importApproval(text) {
    const data = JSON.parse(text);
    if (data.format !== 'pk-approval') throw new Error('Not a Prime Kreatives approval file.');
    return {
      client: data.client,
      decision: data.decision,
      comments: data.comments || {},
      signedAt: data.signedAt
    };
  }

  return { buildHTML, exportReview, importApproval };
})();
