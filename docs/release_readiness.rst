Release Readiness
=================

This page is the current release and handoff entry point for the browser,
service, and data-access workflows. It summarizes implemented behavior and points
to the detailed guides. Historical phase-by-phase detail lives in
``ROADMAP.md`` and ``CHANGE_LOG.md``.

Current Surfaces
----------------

Python API and CLI
  Catalog lookup/search/filtering, dataset resolution, local content status,
  backend diagnostics, and dry-run fetch planning.

Browse
  Search, family/preview/verification/size facets, sorting, pagination, preview
  thumbnails, saved searches, favorites, and a contextual dataset inspector.

Dataset
  Metadata, provenance, known gaps, preview evidence, copyable Python/CLI
  commands, JSON download, and map entry.

Map
  MapLibre workspace with on-demand 1-ha tiles or static EPSG:3857 preview
  fallback, context layers, basemaps, legend, identify, AOI draw/resolve, Clip,
  spatial discovery, and labeled PNG export.

Compare
  Two synchronized panes with Side-by-side, Wipe, and Flicker modes plus labeled
  PNG export.

Series
  Two to 30 frames on one synchronized map, lazy frame sources, next-frame
  prefetch/loading feedback, in-place frame editing, year-sequence detection,
  active-frame PNG, all-frame contact sheet, and full-cycle WebM.

Tours
  Five guided paths into Browse, Compare, Series, Clip, and Discovery, including
  prefilled Clip and auto-open Discovery deep links.

Clip and Bundles
  FEMIC boundary resolution or drawn AOI, exact area preflight, bundle-output
  estimation, six-layer/area limits, queued jobs, progress/cancel/retry, ZIP
  downloads, and retention.

Admin
  Protected service statistics, source mix, latency, COG coverage, storage
  usage, retention settings, and manual pruning of expired outputs.

Route Map
---------

.. code-block:: text

   #/catalog
   #/catalog?q=<query>&family=<family>&preview=<state>&sort=<sort>&page=<n>
   #/dataset/<dataset_id>
   #/dataset/<dataset_id>/map
   #/map
   #/map?layers=<ids>&w=<workspace>&discover=view
   #/dataset/<dataset_id>/map?clip=<query>&clipName=<name>
   #/tours
   #/compare?left=<id>&right=<id>&mode=split|wipe|flicker
   #/series?layers=<ids>&speed=500|1000|2000
   #/bundles
   #/admin

Legacy ``#<dataset_id>`` and ``#map=<dataset_id>`` routes redirect.

Prerequisites
-------------

- Python 3.12 development environment.
- Initialized DataLad submodule for catalog/preview metadata and source access.
- Optional preview payloads for static map fallback.
- Optional FastAPI service for live tiles, Identify, Clip, bundles, Assistant, and
  Admin.
- Optional recovered archive root for tile/clip/COG work.
- Optional FEMIC source for boundary resolution.
- Vendored MapLibre is tracked under ``web/vendor/``; no frontend build step is
  required.

Local Quickstart
----------------

.. code-block:: bash

   bash scripts/setup_dev_venv.sh
   source .venv/bin/activate
   git submodule update --init --recursive external/fresh-hectaresbc-data
   python scripts/generate_web_catalog.py
   python scripts/serve_web_app.py --host 127.0.0.1 --port 8023

Open ``http://127.0.0.1:8023/web/``.

For live tiles and Clip, run the service:

.. code-block:: bash

   FRESH_HECTARESBC_ARCHIVE_ROOT=/path/to/hectaresbc \
   FRESH_HECTARESBC_FEMIC_SRC=/path/to/femic/src \
   python scripts/run_web_service.py --host 127.0.0.1 --port 8030

Optional generated data:

.. code-block:: bash

   python scripts/fetch_web_previews.py
   python scripts/generate_highres_web_previews.py
   python scripts/reproject_map_previews.py --workers 8
   python scripts/build_tile_cog.py --preset core-admin --dry-run
   python scripts/build_tile_cog.py --preset core-admin \
     --archive-root /path/to/hectaresbc --output-root var/tile-cogs

Demo Operations
---------------

The separate demo clone and templates are documented in ``HANDOFF.md`` and
``deploy/README.md``. The protected public origin is:

.. code-block:: text

   https://fresh-hectaresbc.01101.dev

Cloudflare Access/Globus authentication is external to the app. The service does
not implement accounts. For automated public checks, use an Access service token
or authenticated cookie; never commit credentials or session cookies.

Verification
------------

Run the complete local release checks:

.. code-block:: bash

   bash scripts/run_release_checks.sh

Or run focused checks:

.. code-block:: bash

   python scripts/check_web_performance_budgets.py
   python scripts/smoke_test_web_static_app.py
   node scripts/smoke_test_web_catalog_ui.js web/data/catalog.json
   python -m pytest tests/test_build_tile_cog_preset.py \
     tests/test_agent_gis.py tests/test_web_catalog_ui.py
   python scripts/smoke_test_accessibility_browser.py
   python scripts/smoke_test_cold_checkout_browser.py
   python scripts/smoke_test_admin_browser.py
   python scripts/smoke_test_tours_browser.py
   python scripts/smoke_test_compare_browser.py
   python scripts/smoke_test_series_browser.py
   python scripts/smoke_test_series_video_browser.py
   python scripts/smoke_test_series_contact_sheet_browser.py
   python scripts/smoke_test_map_export_browser.py
   python scripts/smoke_test_performance_browser.py
   python -m sphinx -b html -W --keep-going docs docs/_build/html

Performance And Quality Budgets
-------------------------------

- ``app.js`` gzip ≤ 80 KB;
- catalog index gzip ≤ 300 KB;
- lazy details gzip ≤ 350 KB;
- CSS gzip ≤ 20 KB;
- vendored MapLibre gzip ≤ 250 KB;
- catalog-ready under 5 s locally;
- under 80 initial catalog requests;
- paused 17-frame Series loads at most four preview images;
- under 80 MB JS heap in headless Chromium.

Accessibility baseline:

- route-safe skip link;
- ``aria-current`` workspace navigation;
- dialog semantics and focus handoff/restore for side panels;
- overlay shortcut isolation;
- 24×24 px app-owned mobile controls;
- reduced-motion behavior for map fits and flicker Series/Compare.

Security And Data Boundaries
----------------------------

- Large payloads remain in ``UBC-FRESH/fresh-hectaresbc-data``, not this repo.
- Generated catalog, preview, tile-cache, COG, bundle, and AOI files are ignored.
- Service authentication is delegated to Cloudflare Access/Globus.
- Credentials and browser sessions are never committed.
- Clip jobs are local service state and expire through configured retention.
- Browser workspaces, saved searches, favorites, AOI library, and tray use local
  browser storage only.

Known Limits
------------

- The map is a raster-focused workspace, not a general-purpose GIS editor.
- The service is demo-scale: six Clip layers and a bounded AOI area.
- Boundary resolution depends on FEMIC/BCDC availability.
- Year-sequence discovery is a dataset-ID heuristic, not metadata date mining.
- COG coverage is curated, not archive-wide.
- Static export is PNG/WebM; there is no PDF or GeoTIFF report writer.
- No user accounts or server-side per-user persistence.
- Cold checkout without preview payloads shows explicit fallback states.

Release Checklist
-----------------

- [ ] Submodule initialized and catalog generated.
- [ ] Asset and browser performance budgets pass.
- [ ] Targeted Python tests pass.
- [ ] Accessibility, cold-checkout, admin, tours, compare, Series, video,
      contact-sheet, map-export, and performance smokes pass.
- [ ] Sphinx ``-W`` passes and GitHub Pages deploys.
- [ ] Demo clone updated and service restarted.
- [ ] ``/api/health`` reports expected archive, preview, COG, and service state.
- [ ] Protected-origin checks pass.
- [ ] ``HANDOFF.md`` points to the current merge, PR, demo PID, and known limits.
