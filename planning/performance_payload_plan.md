# Phase 36: Performance And Payload Audit

Parent issue: #267

## Goal

Measure browser payload and runtime cost, fix the largest avoidable costs, and add
regression budgets so future features do not silently re-inflate the app.

## Measured Baseline

Asset sizes:

| Asset | Raw | Gzip |
| --- | ---: | ---: |
| `web/app.js` | 252.0 KB | 50.9 KB |
| `web/catalog.js` | 22.1 KB | 5.1 KB |
| `web/map.js` | 27.7 KB | 6.1 KB |
| `web/styles.css` | 72.2 KB | 10.7 KB |
| `web/index.html` | 8.1 KB | 2.3 KB |
| MapLibre vendor JS | 784.3 KB | 206.0 KB |
| `catalog.index.json` | 2,595.4 KB | 221.6 KB |
| `catalog.details.json` | 5,088.1 KB | 264.7 KB |

Static Playwright baseline at 1440×900:

- Catalog: ~1.4 s ready, 49 requests, ~23 MB JS heap.
- Tours: ~1.2 s, 13 requests, ~25 MB heap.
- Map: ~1.7 s, 35 requests, ~22 MB heap.
- 3-frame Series: ~1.1 s, 57 requests, ~17 MB heap.
- 17-frame Series: ~1.2 s, 98 requests, ~28 MB heap.

## Largest Findings

### Series Loaded Every Frame Source Up Front

The Series style registered one source/layer for every frame. In the static
fallback this caused all 17 high-resolution preview overlays to download even
though only the active frame was visible.

**Fix:** register the initial frame in the style, then add a frame's source/layer
lazily when it becomes active or is prefetched.

Expected result:

- only active + prefetched frame sources are fetched;
- first-cycle memory and network cost scale with visited frames, not total frames;
- existing prefetch/readiness behavior is retained.

### Repeated Catalog Option/Sequence Construction

Compare selectors, Series editor options, and Tour sequence detection rebuilt the
full preview-layer option list and/or year-group list on every render.

**Fix:** cache both by `state.previewIndex` identity.

## Post-Fix Measurements

On the static localhost harness after lazy sources and caching:

- 17-frame Series: **2 high-resolution preview requests** (active + prefetched
  next), **~17.4 MB** JS heap after pausing;
- catalog ready: **~0.3–0.5 s** in headless Chromium;
- all asset gzip budgets pass.

## Budgets

Asset budgets:

- `app.js` gzip ≤ 80 KB;
- `catalog.index.json` gzip ≤ 300 KB;
- `catalog.details.json` gzip ≤ 350 KB;
- `styles.css` gzip ≤ 20 KB;
- vendored MapLibre gzip ≤ 250 KB.

Browser budgets:

- catalog-ready within 5 s on localhost;
- 17-frame Series after 3 s must issue at most 4 preview-layer image requests;
- 17-frame Series JS heap below 80 MB in headless Chromium;
- catalog initial requests below 80.

Budgets are regression guards, not user-facing promises.

## Verification

- Add `scripts/check_web_performance_budgets.py` for asset sizes.
- Add `scripts/smoke_test_performance_browser.py` for ready time, request counts,
  Series lazy loading, and heap.
- Re-run Series, Series video, accessibility, Tours, Compare, and Map export
  smokes.
- Sphinx `-W`.
- Public Series/tours checks after deploy.

## Non-Goals

- Code splitting or bundling.
- Rewriting the static catalog into an API.
- Service Worker/offline storage.
- Reducing preview image quality.
- Changing user-facing routes or visual design.
