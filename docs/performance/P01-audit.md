# P01 — Performance audit (2026-11-29)

Scope: static source inspection of public pages on main; no production gameplay changes.
## Observed baseline
- home.html: 112035 UTF-8 bytes, 23 inline style blocks, 7 inline script blocks, 10 literal img tags, 4 lazy img tags.
- guide.html: 148617 bytes, 9 inline style blocks, 3 inline script blocks; public posts fetched with getDocsFromServer on page load.
- hall.html: 47220 bytes, 11 inline style blocks; 5 literal img tags, none explicitly lazy.
- hall-data.js: 57093 JS string characters; full collection loaded by home and hall.
- home-career.js: uses cached career for display, then server-only metadata read and core part reads in batches of 10, with a validated maximum of 200 parts. Potential signed-in landing latency; do not weaken revision integrity.
- firebase-config.js: daily visitor write starts immediately on eligible public pages; dynamic imports Firebase app and Firestore before write.
- public-header.js: replaces header DOM, installs click/resize/pointer listeners.
- index.html: connector returned empty content (also with explicit line range). Code search returned no matches. Main game source not verified; this is not evidence that deployed index is empty.
## Priorities
P02: defer noncritical public startup tasks, preserve authentication and daily visit deduplication. Do not defer hero/LCP asset.
P03: split public preview data and detailed guide code after dependency audit.
P04–06: consolidate CSS with visual regression checks, defer below-fold images, check CDN cache headers.
P07–09: profile authenticated career reads, keep authoritative save and transaction integrity; never replace purchase/reward/enhancement writes with unsafe debounce.
P10–18: inspect actual game source before changing rendering, card lists, simulation, listeners and memory.
P19–20: production desktop/tablet/mobile public-page performance and regression tests.
## Required runtime baseline before claims of speedup
Cold and warm loads, browser network waterfall, LCP, INP, CLS, JS long tasks, signed-in and signed-out page loads, Firebase read/write counts, card inventories 100/1000/3000, batch opening, ten-match simulation, and 3-hour session. Record device/browser/network, commit, median and p75 where appropriate. No actual runtime measurements yet. Target LCP <=2.5s, INP <=200ms, CLS <=0.1; other targets are project goals, not measured outcomes.
