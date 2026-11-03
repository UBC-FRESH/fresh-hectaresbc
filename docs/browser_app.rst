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
fallback when WebGL or preview data is unavailable.

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
   POST /api/aoi/inspect
   POST /api/aoi/resolve
   GET  /api/aoi/search?q=
   POST /api/bundles
   POST /api/bundle-jobs
+  GET  /api/bundle-jobs
   GET  /api/bundle-jobs/{job_id}
   POST /api/bundle-jobs/{job_id}/cancel
+  POST /api/bundle-jobs/{job_id}/retry
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
