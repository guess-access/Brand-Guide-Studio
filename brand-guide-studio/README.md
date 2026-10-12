# Prime Kreatives — Brand Guide Studio

Rebuild of the chat-based "Brand Mockup Studio" as a **runnable pipeline** instead of ad-hoc scripts in a conversation. Zero install, zero build step: HTML + vanilla JS + Canvas.

```
prime-kreatives/brand-guide-studio/
├─ index.html            Studio (intake → logo check → generate → QA gate → export)
├─ css/studio.css        Prime Kreatives navy/gold panels, F4F1EA paper
├─ js/
│  ├─ studio.js          Controller: 5-stage state machine + registry
│  └─ lib/
│     ├─ util.js         Color math (WCAG contrast), canvas + download helpers
│     ├─ store.js        Per-client brand-kit registry (localStorage + JSON)
│     ├─ placeholder.js  Sample-data detector (blocks export)
│     ├─ intake.js       Pre-flight validation gates
│     ├─ logo-health.js  Resolution / transparency / gradient checks + flat-bg remover
│     ├─ variations.js   Logo variation engine (primary → favicon)
│     ├─ brand-system.js Color roles + auto font pairing + type scale
│     ├─ slides.js       14 deterministic slide templates (1920×1080)
│     ├─ qa.js           QA gate: contrast, legibility, placeholders, completeness
│     ├─ export.js       PDF (dependency-free), PPTX, PNG, social + screen sizes, sticker SVG
│     └─ review.js       Self-contained client review page + approval certificate
├─ clients/mwe-motor-rental.brandkit.json    Sample kit
└─ serve.ps1            Optional local server
```

## The 14 slides

Cover · Primary logo · Logo versions · Color palette · Typography · Facebook page · Instagram profile · LinkedIn company page · **Employee uniform** (crew shirt front/back, cap, ID lanyard) · Business cards · Stickers · **Storefront signage** · **Desktop wallpaper** · Thank-you.

## What it fixes (vs. the shared chat)

| Old failure | New pipeline |
| --- | --- |
| Logo didn't attach → whole turn lost | Stage 1 intake gate blocks generate until logo + fields are green |
| Gray logo background fixed by hand in chat | Health report flags flat background, one-click flood-fill removal with tolerance |
| "Black logo on light" export bug fixed after render | Every placement records bg+fg; QA gate checks WCAG contrast *before* export (logo ≥3:1, text ≥4.5:1) |
| Yellow logo on white polo spotted by eye | Thread/fabric colors picked by the same contrast rule, per garment |
| Fake followers / ₱500/day placeholders shipped | Placeholder detector blocks export on obvious sample data (TBD, example.com, 555 numbers, "your company") |
| Deck rebuilt by re-prompting | Brand kits live in a registry — re-run any client in one click, export/import as `.brandkit.json` |
| Bugs fixed ad hoc in chat (indentation, halo, color) | Fixed once in `slides.js` / `export.js` templates — no regression path |
| "I haven't opened or tested it yet" | Stage 4 renders all slides + thumbnail sheet with per-slide pass/fail before export unlocks |
| Logo versions requested from articles | Variation engine auto-derives primary / secondary(stacked) / submark / favicon set / mono light+dark / one-color + clear-space & min-size rules |

## Run

```powershell
cd prime-kreatives\brand-guide-studio
powershell -File serve.ps1      # or just open index.html
```

1. **Intake** — fill brand, contacts, colors, uniform color, toggles. Live validation; export button stays locked until green.
2. **Logo check** — drop PNG/SVG/JPG (or *Generate demo logo*), review the confidence report, remove flat backgrounds if flagged.
3. **Generate** — one button renders all 14 slides.
4. **QA gate** — contrast/legibility/placeholder verdict + slide thumbnails. Override is possible but logged in the manifest.
5. **Export** — PDF deck, PPTX, PNG sequence, social + screen pack (FB 1640×856, IG 1080²/320, LinkedIn 1584×396 banner / 1200×627 post / 400 photo, wallpapers 1920×1080 + 2560×1440, favicons), die-cut sticker SVG, manifest, and the one-file client review package.

## Delivering to a client

1. Export the review package → send **one** HTML file.
2. Client opens it, adds per-slide comments, clicks **Approve** or **Request revisions** → gets `…-approved.json` / `…-revisions.json`.
3. Import that certificate in stage 5; the kit records the decision. Export the final PDF/PPTX.

## Notes & limits

- **PPTX** loads PptxGenJS from a CDN on first use — needs internet; PDF/PNG/SVG/review are offline-safe.
- **Fonts** load from Google Fonts when online; every font stack has a local fallback so slides never render blank.
- **Recolor** works on flat logos. Photo/gradient logos are flagged in the health report and mono variants are skipped with a "manual fix" note rather than silently corrupted.
- Everything runs client-side: brand kits stay in the browser's localStorage; export `.brandkit.json` to move a client between machines.
- File layout is deterministic (`<client>/<asset>/<file>`), so repeated runs overwrite cleanly instead of scattering attachments.
