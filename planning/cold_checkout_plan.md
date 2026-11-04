# Phase 38: Offline And Cold-Checkout QA

Parent issue: #279

## Goal

Prove that a fresh checkout without generated catalog artifacts, preview indexes,
preview images, or the optional service still behaves predictably and tells the
user how to recover.

## Cold States

### 1. Missing Generated Catalog

Block all `web/data/catalog.*` requests.

Expected:

- catalog-unavailable state;
- clear message;
- `python3 scripts/generate_web_catalog.py` guidance;
- Retry action works when the files become available;
- header does not keep spinning.

### 2. Missing Preview Index

Block published, local, high-res, and EPSG:3857 preview indexes.

Expected:

- Browse still renders catalog records;
- header says preview index unavailable;
- preview filters are explained rather than silently broken;
- `#/map` shows "No map layer available" with maintainer commands;
- Tours renders cards and marks the pine-beetle sequence unavailable;
- Series shows its missing-series state.

### 3. Missing Preview Images

Keep the preview indexes but abort `data/map_previews_3857/**` map images.

Expected:

- map route still renders its shell;
- a visible missing-preview banner appears or a static fallback remains;
- no uncaught JavaScript error.

### 4. No Optional Service

Serve the static app with `/api/**` returning 404.

Expected:

- Browse and static previews remain usable;
- Clip/Identify stay hidden;
- Tour Clip card explains that Clip requires the service;
- no assistant or admin controls appear.

## Fixes

Only fix behavior that fails these expectations. Likely candidates:

- improve error-state heading/focus semantics;
- ensure missing-preview banners are visible and not duplicated;
- ensure tours/series fallbacks do not link to broken preview routes.

## Verification

- Add `scripts/smoke_test_cold_checkout_browser.py` covering all four states.
- Existing static, tours, Series, accessibility, performance, and export smokes
  stay green.
- Sphinx `-W`.

## Non-Goals

- Bundling generated catalog or preview payloads into Git.
- Offline service workers or PWA caching.
- Changing the data repository.
- Making Clip work without the service.
