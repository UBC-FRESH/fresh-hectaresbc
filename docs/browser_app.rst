Browser Catalog, Map, And GIS Workspace
=======================================

The repository includes a static browser app under ``web/`` and an optional
FastAPI service under ``src/fresh_hectaresbc/web_service.py``. The static app
works without the service; the service adds live 1-ha tiles, the assistant, AOI
preflight, and clipped bundle jobs.

Generate the catalog and its lazy detail/index artifacts with:

.. code-block:: bash

   python scripts/generate_web_catalog.py
   python scripts/smoke_test_web_static_app.py
   node scripts/smoke_test_web_catalog_ui.js web/data/catalog.json
   python scripts/smoke_test_web_ui_browser.py
   python scripts/smoke_test_clip_aoi_browser.py
   python scripts/smoke_test_tray_browser.py
   python scripts/smoke_test_bundles_browser.py
   python scripts/smoke_test_identify_browser.py
   python scripts/smoke_test_workspace_browser.py
   python scripts/smoke_test_aoi_library_browser.py
   python scripts/smoke_test_admin_browser.py
   python scripts/smoke_test_discover_browser.py
   python scripts/smoke_test_saved_browse_browser.py
   python scripts/smoke_test_compare_browser.py
   python scripts/smoke_test_series_browser.py
   python scripts/smoke_test_accessibility_browser.py
   python scripts/smoke_test_map_export_browser.py
   python scripts/smoke_test_tours_browser.py
   python scripts/smoke_test_series_video_browser.py
   python scripts/smoke_test_series_contact_sheet_browser.py
   python scripts/check_web_performance_budgets.py
   python scripts/smoke_test_performance_browser.py

The generator writes four ignored artifacts:

.. code-block:: text

   web/data/catalog.json          full compatibility payload
   web/data/catalog.index.json    compact Browse/search rows
   web/data/catalog.details.json  full records, loaded on dataset open
   web/data/catalog.meta.json     counts and generation timestamp

Routes
------

.. code-block:: text

   /web/#/catalog
   /web/#/catalog?q=bull+trout
   /web/#/dataset/dl_adminunits_bcts
   /web/#/dataset/dl_adminunits_bcts/map
   /web/#/map
   /web/#/tours
   /web/#/compare?left=<dataset_id>&right=<dataset_id>
   /web/#/series?layers=<dataset_id_1>,<dataset_id_2>,<dataset_id_3>&speed=1000
   /web/#/bundles

Legacy hashes redirect automatically:

.. code-block:: text

   #dl_adminunits_bcts     -> #/dataset/dl_adminunits_bcts
   #map=dl_adminunits_bcts -> #/dataset/dl_adminunits_bcts/map

Browse has search, family/preview/verification/size facets, sorting,
pagination, preview thumbnails, and a contextual inspector. Search, filters,
sort, and pagination live in the hash so views are shareable. Dataset views
group metadata, provenance, known gaps, preview evidence, and copyable
Python/CLI usage commands. The map route includes layer visibility, opacity,
legend classes, OpenStreetMap/offline basemaps, fit-to-layer, and a static
fallback when WebGL or preview data is unavailable. **Download PNG** exports the
active map with the layer title, dataset ID, visible context layers, recovered
legend, date, and attribution. The export uses the rendered MapLibre canvas and
does not include the hidden control panel.

Performance Budgets
-------------------

Browser asset and catalog payload budgets are checked with:

.. code-block:: bash

   python scripts/check_web_performance_budgets.py
   python scripts/smoke_test_performance_browser.py

Current gzip budgets are 80 KB for `app.js`, 300 KB for the catalog index,
350 KB for lazy details, 20 KB for CSS, and 250 KB for vendored MapLibre.
Browser checks require catalog readiness under 5 s, fewer than 80 initial
requests, at most four high-resolution preview requests for a paused 17-frame
Series, and under 80 MB JS heap in headless Chromium.

Series uses lazy frame-source registration: the active frame plus the prefetched
next frame are loaded rather than every frame up front. Preview layer options and
detected year sequences are cached by preview-index identity.

Accessibility And Keyboard Behavior
-----------------------------------

- The header workspace links are navigation links with ``aria-current="page"``,
  not a faux tab widget.
- The skip link focuses the workspace content without changing the route hash.
- Tray, Clip, Discover, and Assistant panels move focus into the panel when
  opened and restore focus to their trigger when closed.
- Escape closes the help dialog, filter rail, and open side panels.
- Global single-key shortcuts are ignored while a panel or dialog is open.
- Map fit animations honor ``prefers-reduced-motion``; Compare and Series flicker
  start paused.
- App-owned mobile controls meet the 24×24 CSS-pixel target minimum.
- The mobile filter rail moves focus into the first available facet control and
  restores the Filters button on close.

Preview Data
------------

The browser first looks for the published DataLad-backed preview index:

.. code-block:: text

   external/fresh-hectaresbc-data/derived/web_map_previews/v1/index.json

That publication indexes 2,183 recovered records, with 2,163 source-derived
preview PNGs and 20 ``not_previewable`` records. Fetch missing payloads with
user-local Arbutus credentials:

.. code-block:: bash

   export PATH="$HOME/.local/bin:$PATH"
   source ~/.config/fresh-hectaresbc/arbutus_env.sh
   python scripts/fetch_web_previews.py

Published previews are compact 256 px images. Generate ignored 2048 px local
overrides and EPSG:3857 map overlays:

.. code-block:: bash

   python scripts/generate_highres_web_previews.py \
     --family data_layer --max-size 2048 --workers 8 \
     --local-archive-root /path/to/hectaresbc
   python scripts/reproject_map_previews.py --workers 8

The browser prefers ``web/data/map_previews_highres/v1/`` and
``web/data/map_previews_3857/`` when present. Native previews remain the list
thumbnails; reprojected overlays align with the Web-Mercator basemap.

Map And Raster Tiles
--------------------

With the optional service running with ``--archive-root``, MapLibre uses
on-demand raster tiles rendered from the recovered 100 m (1 ha) source
GeoTIFFs:

.. code-block:: text

   GET /api/tiles/{dataset_id}/metadata
   GET /api/tiles/{dataset_id}/{z}/{x}/{y}.png

Tiles are reprojected to EPSG:3857, colored with the recovered legend, and
cached under ``var/tile-cache/``. MapLibre requests only visible tiles while
panning and zooming. Source resolution is 1 ha, so zoom 13 is the practical
maximum; deeper zoom over-samples the same cells. Without the service the map
falls back to the static EPSG:3857 preview image.

The renderer has two fast paths:

- z0–8 tiles are cropped and resampled from the existing 2048 px EPSG:3857 map
  overlays;
- z9+ tiles read and warp the source raster. A bounded process cache reuses
  open source dataset handles and serializes reads per handle.

Optional COG derivatives can remove the first high-zoom source-open cost.
Generate them per layer:

.. code-block:: bash

   python scripts/build_tile_cog.py \
     --dataset-id dl_adminunits_bcts \
     --archive-root /path/to/hectaresbc \
     --output-root var/tile-cogs

The service prefers ``var/tile-cogs/<dataset_id>.tif`` when present and
reports the active source in tile metadata as ``source_raster: "cog"`` or
``"zip"``. The BCTS pilot COG is roughly 3.1 MB and reduces the first z9 tile
from roughly 0.8 s to 0.06 s locally. The tile cache is pruned by
``FRESH_HECTARESBC_TILE_CACHE_MAX_BYTES``; job and bundle retention are
configured separately.

``GET /api/stats`` reports process-lifetime tile requests, cache hit rate,
source mix (``cache``, ``overlay``, ``cog``, ``zip``), latency, and top
datasets without recording client identifiers.

Layer Tray And Map Context
--------------------------

The header tray collects previewable layers across Browse, Dataset, and Map.
The tray is stored in browser-local storage and holds at most six layers.
Rows, cards, dataset actions, and map actions expose an add control. The tray
drawer supports removal, reordering, clearing, and opening the map.

The first tray layer becomes the primary map layer. Up to three additional tray
layers render as context overlays with independent visibility and opacity
controls. Map routes encode the context list in the URL:

.. code-block:: text

   #/map?layers=dataset_id_1,dataset_id_2
   #/dataset/<dataset_id>/map?layers=dataset_id_1,dataset_id_2

Context layers use the same raster tile source when the service is available
and fall back to the static EPSG:3857 overlay otherwise.

Bundle History
--------------

The `#/bundles` route lists active and recent bundle jobs plus completed bundle
downloads. It shows job status/progress, AOI names and areas, layer counts,
failure counts, timestamps, download links, manifest links, cancellation, and
failed-layer retry. It refreshes active jobs while the route is open and
provides an explicit Refresh action.

Guided Tours
------------

The `#/tours` route provides five short, actionable examples: Browse/search,
Compare side-by-side/wipe/flicker, the 17-year pine-beetle Series, Clip with a
prefilled TSA 27 query, and spatial Discovery. Each card lists steps and links
directly into the relevant workspace.

Tour deep links use ordinary route state:

.. code-block:: text

   #/dataset/dl_adminunits_bcts/map?clip=timber+supply+area&clipName=TSA+27
   #/map?discover=view

The Clip link waits for the map, opens the drawer, and prefills the query and AOI
name without running the FEMIC lookup automatically. The Discovery link waits for
the map, opens Discover, and runs a current-view search. Both links remain
shareable; no server-side tour state is stored.

Compare Map Workspace
---------------------

The `#/compare?left=<dataset_id>&right=<dataset_id>` route provides synchronized
MapLibre panes for two previewable layers. Panning or zooming either pane updates
the other. The workspace includes left/right selectors, a swap action, shared
extent fitting, dataset labels, and a responsive stacked layout at narrow widths.
A **Side-by-side / Wipe / Flicker** toggle switches between split panes, an
overlaid wipe comparison with a draggable vertical divider (``mode=wipe``), and
auto-alternating flicker comparison (``mode=flicker``). Flicker includes pause/play
and fast/normal/slow speed controls and respects reduced-motion preferences.
Compare mode intentionally omits AOI/identify/Clip controls. **Download PNG**
exports the current split, wipe, or active flicker frame with dataset labels,
mode, date, and map attribution.

Flicker Series
--------------

The `#/series?layers=<ids>&speed=<ms>` route cycles through two to 30 previewable
layers in the supplied order. The tray's **Flicker series** action builds this
route from tray order. A single MapLibre map registers one raster source/layer
per frame and switches the visible layer, so pan/zoom, basemap position, and
browser resources stay stable across long sequences.

Controls include play/pause, previous/next frame, and fast/normal/slow speeds
(500/1000/2000 ms). Stepping pauses playback. The next frame is warmed at zero
opacity while the current frame is displayed, and the frame status shows
``loading…`` until the active source is ready. Reduced-motion preferences start
the series paused. **Download PNG** exports the active frame with its label,
dataset ID, frame number, date, and map attribution. **Export video** records one
complete playback cycle as a WebM with browser-native `canvas.captureStream` and
`MediaRecorder`; frames are held at the current Series speed, output width is
capped at 1280 px, and unsupported browsers receive a clear message. **Contact
sheet** exports every frame as one labeled grid PNG (up to four columns, 1600 px
wide) for reports and quick comparison. A missing-series state is shown when
fewer than two layers can be loaded.

The **Edit frames** disclosure adds, removes, reorders, and jumps between frames.
Every edit rewrites the `#/series` URL and restarts playback from frame one.
Series editing never changes the tray. The **Year sequences** panel detects
previewable dataset-ID families with at least three four-digit year suffixes,
sorts them by year, and opens the whole family with one click. Detection is a
heuristic based on dataset IDs, not metadata date fields.

Saved Searches And Favorites
----------------------------

The Browse saved rail stores named catalog views and favorite datasets in local
browser storage. Saving a search captures the current catalog hash, including
query, filters, sort, page, and page size. Favorites are toggled from result rows,
result cards, and dataset actions; the rail provides open/remove actions. No
server-side user state is created.

Spatial Layer Discovery
-----------------------

The map **Discover** panel finds previewable catalog layers whose bounds intersect
the current map view or Clip AOI. It runs entirely against the loaded preview
index, supports family and text filters, and can add individual or bulk results
to the tray. Results are explicitly a bounds test, not an exact polygon/raster
intersection.

Reusable AOI Library
--------------------

The Clip AOI drawer stores named AOIs and automatically remembers recent AOIs in
local browser storage. Boundary AOIs store their layer query and feature name and
are re-resolved when applied. Compact drawn AOIs store geometry directly; larger
geometries are omitted with a clear message. Each library row supports Apply and
Delete, and **Save current** adds the active AOI to the named library.

Saved And Shareable Workspaces
------------------------------

The tray drawer can save a named workspace in local browser storage and copy a
shareable map link. A workspace encodes:

- the primary map layer;
- tray/context layers;
- map center and zoom;
- a compact drawn AOI, or a FEMIC boundary query/name;
- selected Clip layers.

The encoded state is carried in the map route `w` query parameter:

.. code-block:: text

   #/dataset/<primary>/map?w=<encoded>
   #/map?w=<encoded>

Boundary AOIs are re-resolved when the workspace opens. Drawn AOI geometry is
included only when compact (2,000 coordinate numbers or fewer); otherwise it is
omitted with a clear message. Saved workspaces are local to the browser; no
account or server-side workspace storage is required.

Click-To-Identify
-----------------

The map Identify control enters a click-to-query mode. Clicking the primary
raster layer calls:

.. code-block:: text

   GET /api/tiles/{dataset_id}/identify?lon=...&lat=...

The response includes the raster value, legend class/label and color when
available, coordinates, source kind (``cog`` or ``zip``), and a status of
``ok``, ``nodata``, or ``outside``. The map shows a result card and a point
marker; the Identify control toggles the mode off.

Protected Admin Dashboard
-------------------------

The `#/admin` route (shown when the optional service is available) turns
`/api/stats?top=25` into an operational view:

- request, cache hit-rate, average/max latency, and error metrics;
- source-mix bars for cache, overlay, COG, and zip;
- tile COG count and dataset list;
- bundle-job status counts and recent-job table;
- top-dataset table with request counts, hit rates, latency, source mix, and COG
  status;
- a copyable `scripts/build_tile_cog.py` command for datasets without a COG.

The route is protected by the same Cloudflare Access policy as the app. The
dashboard does not execute builds or add user-specific analytics.

Optional Service, Assistant, And Clip AOI
-----------------------------------------

Run the service with:

.. code-block:: bash

   python scripts/run_web_service.py \
     --host 127.0.0.1 --port 8030 \
     --allow-agent \
     --archive-root /path/to/hectaresbc \
     --femic-src /path/to/femic/src

The service adds an OpenCode-backed assistant, catalog/layer search APIs, FEMIC
BC Data Catalogue AOI resolution, AOI area preflight, and clipped raster bundle
jobs. The static app remains usable when the service is off.

The map's **Clip AOI** drawer supports:

- resolving a FEMIC/BCDC boundary by layer query and feature name, with
  structured candidate names for ambiguous queries;
- drawing a rectangle with mouse or touch, with a mobile draw handoff;
- exact AOI area inspection through ``POST /api/aoi/inspect`` and a live
  area/limit meter;
- search across the previewable catalog with up to six selected layers;
- bundle job progress, current-layer status, cancellation, per-layer failure
  details, failed-layer retry, and recent bundle links.

AOI area is computed in EPSG:3005 and checked against
``--max-area-ha`` (default 10,000,000 ha) before submission. Bundle limits are
six layers and the configured area. The browser is prevented from submitting a
known-over-limit AOI; the service enforces the same limits for all clients.

Bundle preflight:

```text
POST /api/bundles/estimate
```

The Clip drawer's **Estimate** action returns advisory per-layer clipped pixel
dimensions, uncompressed output-size estimates, and rough processing duration.
It does not read or clip raster pixels, and it does not submit a job. The UI
clears estimates when the AOI or selected layers change.

Service endpoints:

.. code-block:: text

   GET  /api/health
   GET  /api/stats
   GET  /api/agent
   POST /api/agent/chat
   GET  /api/layers/search?q=
   GET  /api/layers/{dataset_id}
   GET  /api/tiles/{dataset_id}/metadata
   GET  /api/tiles/{dataset_id}/{z}/{x}/{y}.png
   GET  /api/tiles/{dataset_id}/identify?lon=&lat=
   POST /api/aoi/inspect
   POST /api/aoi/resolve
   GET  /api/aoi/search?q=
   POST /api/bundles/estimate
   POST /api/bundles
   POST /api/bundle-jobs
  GET  /api/bundle-jobs
   GET  /api/bundle-jobs/{job_id}
   POST /api/bundle-jobs/{job_id}/cancel
  POST /api/bundle-jobs/{job_id}/retry
   GET  /api/bundles
   GET  /api/bundles/{bundle_id}
   GET  /api/bundles/{bundle_id}/download

The synchronous ``POST /api/bundles`` endpoint remains for CLI/script clients.
The browser uses ``/api/bundle-jobs`` so long clips are not held open by one
request through the Cloudflare proxy. Jobs run one at a time, persist under
``var/bundles/jobs/``, and are marked ``interrupted`` after a service restart.
Bundle directories/ZIPs, temporary drawn-AOI files, and job records are pruned
by configurable count/age limits; see ``planning/agent_gis_bundles.md``.

Security And Verification
-------------------------

The assistant is opt-in with ``--allow-agent`` and has the service user's shell
permissions. The service binds loopback by default; a non-loopback demo bind
requires ``--allow-remote`` and should sit behind an authenticating proxy such
as Cloudflare Access/Zero Trust. The service does not implement user
authentication itself.

Default tests and smoke checks do not require UBC CWL, hosted workers, DataLad
network retrieval, raw ZIP content, Arbutus/Chinook credentials, or an object
store. Reading annexed preview PNG payloads from a cold checkout requires
DataLad/git-annex retrieval from the configured storage remote before the
browser can display those local files.
