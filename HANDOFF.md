# Agent Handoff

Date: 2026-11-03
Status: P19/P20/P21/P22/P23/P24 complete; no active implementation branch or open issues/PRs.
Branch: `main`
Latest feature merge: `a667b35`
Latest merged PR: #190 (Phase 24 admin dashboard); Phase 23: #184
Demo host: `https://fresh-hectaresbc.01101.dev`
Foundation: #140 (P19/P20 browser UI and agent GIS assistant)

## What Is Implemented

### Browser UI (P19)

- `web/` is now a responsive Browse / Dataset / Map application shell.
- Browse has search, family/preview/verification/size facets, sorting,
  pagination, URL state, preview thumbnails, and a contextual inspector.
- Dataset routes group metadata, provenance, known gaps, preview evidence, and
  copyable Python/CLI commands.
- Map routes use MapLibre with a searchable change-layer control, visibility,
  opacity, legend, OSM/offline basemaps, fit-to-layer, and static fallbacks.
- `#/map` opens BCTS Operating Areas by default.
- Legacy `#<dataset_id>` and `#map=<dataset_id>` routes redirect.
- Catalog artifacts:
  - `web/data/catalog.index.json` (compact browse rows)
  - `web/data/catalog.details.json` (lazy full records)
  - `web/data/catalog.meta.json`
  - `web/data/catalog.json` (compatibility)
- Published previews are 256 px. Local high-resolution overrides live under
  ignored `web/data/map_previews_highres/v1/` and are preferred when present.
- `scripts/generate_highres_web_previews.py` generates 2048 px overrides from
  the recovered source archive and can reindex partial runs.
- `scripts/fetch_web_previews.py` fetches the published preview PNG payloads
  from the Arbutus DataLad remote.
- Preview PNGs are rendered in native CRS (usually EPSG:3005 / BC Albers).
  `scripts/reproject_map_previews.py` writes ignored EPSG:3857 map overlays
  under `web/data/map_previews_3857/`; the map route uses those so overlays
  align with the Web-Mercator basemap. Native previews remain thumbnails.
- Full library is complete in the current checkout: **2,183 previewable
  records**, 2,183 high-resolution previews (~537 MB), and 2,183 EPSG:3857
  map overlays (~934 MB). The 19 sparse pine-beetle rasters that the published
  batch marked `not_previewable_empty_preview` were recovered by fixing WMS
  range-legend parsing and adding a palette fallback.
- Regeneration commands:
  ```bash
  python scripts/generate_highres_web_previews.py \
    --family virtual_layer --max-size 2048 --workers 32 \
    --local-archive-root /path/to/hectaresbc
  python scripts/reproject_map_previews.py --workers 32
  ```
  The reproject pass is incremental: it skips existing `map.png` files and
  preserves their index entries.
- The map now prefers **on-demand 1-ha raster tiles** when the service runs with
  `--archive-root`:
  - `GET /api/tiles/{dataset_id}/metadata`
  - `GET /api/tiles/{dataset_id}/{z}/{x}/{y}.png`
  Tiles are rendered from the source 100 m BC Albers GeoTIFFs with rasterio
  `WarpedVRT`, colored with the recovered legend, and cached under
  `var/tile-cache/`. MapLibre uses a raster tile source, so pan/zoom fetches
  only visible tiles. Max useful zoom is 13 (1-ha cells); deeper zoom
  over-samples. Without the service the app falls back to the static 3857
  preview image.
- Low-zoom tile fast path: z0–8 tiles are cropped/resampled from the existing
  2048 px EPSG:3857 map overlays; z9+ still reads/warps the source raster.
  Catalog/manifest/source-path lookups are process-cached. Cold BCTS tile
  timings improved from ~8.7 s at z6 to ~0.13 s, ~3.2 s at z7 to ~0.06 s, and
  ~1.7 s at z8 to ~0.05 s; warm tiles are ~3 ms. Through the protected public
  host, cold z6/z7/z8 were ~0.21/0.12/0.11 s.
- High-zoom source handles are now reused (bounded cache with per-handle
  locking). After the initial metadata/source open, z9–11 tile reads dropped to
  roughly 15–30 ms locally; the first z9 read after metadata was ~0.8 s. Through
  the protected public host, the first z9 tile was ~0.87 s and subsequent
  z9/z10/z11 tiles were ~0.05–0.08 s.
- Optional COG derivatives are supported. `scripts/build_tile_cog.py` writes a
  compressed, tiled GeoTIFF with overviews under `var/tile-cogs/`; the tile
  service prefers it when present (`source_raster` in metadata). A BCTS pilot
  is ~3.1 MB, takes ~32 s to build, and reduces the first z9 read from ~0.8 s to
  ~0.06 s locally (~0.12 s through the public host).
- Clip AOI drawer now calculates exact AOI area through `/api/aoi/inspect`
  before submission, shows a live limit meter, and disables bundle preparation
  when the AOI exceeds the configured limit.
- `/api/stats` reports process-lifetime tile requests, cache hit rate, source
  mix (cache/overlay/COG/zip), latency, and top datasets. Use it to prioritize
  COG conversion for layers that are actually viewed.
- A persistent header layer tray collects previewable layers across routes.
  The first tray layer becomes the primary map layer; up to three additional
  layers render as context overlays with visibility/opacity controls.
- `#/bundles` lists active/recent jobs and completed bundles with progress,
  cancellation, failed-layer retry, downloads, manifests, and refresh.
- The map Identify control reads the primary raster value, legend label, color,
  coordinates, and source kind at a clicked point; nodata/outside states are handled.
- Workspaces encode primary/tray layers, map view, AOI, and Clip selections into
  a shareable map URL; named workspaces save in local browser storage.
- The Clip drawer keeps a local AOI library with named and recent AOIs, including
  boundary-query restore and compact drawn geometry.
- `#/admin` shows protected service statistics, top datasets, source mix, COG
  coverage, job counts, and copyable COG-build commands.
- The map Discover panel finds previewable layers intersecting the current view
  or AOI and adds results to the tray.

### Agent Service And GIS Bundles (P20)

- Optional FastAPI service: `src/fresh_hectaresbc/web_service.py`
- Start script: `scripts/run_web_service.py`
- Demo wrapper: `scripts/start_demo_service.sh`
- Browser "Ask" assistant panel:
  - UI help and catalog context
  - catalog/layer search
  - FEMIC AOI resolution
  - clipped raster bundle creation and download links
- Browser **Clip AOI** drawer on the map workspace:
  - resolve a FEMIC/BCDC boundary by layer query and feature name, with
    structured candidate choices for ambiguous queries
  - draw a rectangle on the map with mouse or touch; mobile panel hands off to
    the map while drawing
  - search all 2,183 previewable layers, select up to six, and submit the exact
    AOI geometry
  - run bundle preparation as a queued job with progress polling, current-layer
    status, a progress bar, best-effort cancellation, per-layer failure details,
    failed-layer retry, and recent bundles
  - automated browser smoke coverage mocks the API and checks job progress,
    partial failures, failed-layer retry, and cancellation
  - enabled only when `/api/health` reports a running service
- Bundle jobs run one at a time in a single worker, persist under
  `var/bundles/jobs/`, and are marked `interrupted` after a service restart.
  Terminal job records are pruned on startup and after each finished job
  (100 records / 30 days by default; configurable).
  Completed bundle directories/ZIPs are pruned by count/age (50 / 30 days) and
  temporary drawn-AOI files by age/count (7 days / 500) on the same schedule.
  The synchronous `/api/bundles` endpoint remains for CLI/script clients.
- FEMIC bridge: `src/fresh_hectaresbc/femic_bridge.py`
  - resolves BC Data Catalogue boundary packages
  - materializes WFS features through FEMIC
  - matches named/numeric features (e.g. TSA 27 -> Revelstoke TSA)
  - returns `candidate_options` with human-readable names for the UI
- The bundle API accepts either a FEMIC `aoi_query`/`aoi_name` or a validated
  GeoJSON Polygon/MultiPolygon in `aoi_geometry`; geometry is written under
  `var/bundles/aoi/` and clipped through the same pipeline.
- `GET /api/aoi/search?q=` exposes boundary-package search.
- Clipping: `src/fresh_hectaresbc/clip.py`
  - windowed reads, AOI reprojection/masking, preserves CRS/dtype/nodata
- Bundles: `src/fresh_hectaresbc/bundle.py`
  - AOI + clipped GeoTIFFs + manifest + README + ZIP
  - limits: 6 layers, 10,000,000 ha
- Agent tools CLI: `scripts/agent_tools.py`
  - `search-layers`
  - `search-aoi`
  - `resolve-aoi`
  - `prepare-bundle`
  - `list-bundles`

## Current Local Demo

Separate clone:

```text
/srv/shared-data/gep/ws4/fresh-hectaresbc-demo
```

Service:

```text
port: 8030
bind: 0.0.0.0
origin: http://10.232.253.210:8030
public URL: https://fresh-hectaresbc.01101.dev
log: /srv/shared-data/gep/ws4/fresh-hectaresbc-demo/var/demo-service.log
```

The service is currently running. For detached management:

```bash
cd /srv/shared-data/gep/ws4/fresh-hectaresbc-demo
export FRESH_HECTARESBC_ARCHIVE_ROOT=/srv/shared-data/gep/fresh-hectaresbc/hectaresbc
export FRESH_HECTARESBC_FEMIC_SRC=/srv/shared-data/gep/ws4/femic/src
export PORT=8030
export FRESH_HECTARESBC_PUBLIC_URL=https://fresh-hectaresbc.01101.dev
bash scripts/demo_ctl.sh start
bash scripts/demo_ctl.sh status
bash scripts/demo_ctl.sh logs
```

Or run it in the foreground:

```bash
FRESH_HECTARESBC_ARCHIVE_ROOT=/srv/shared-data/gep/fresh-hectaresbc/hectaresbc \
FRESH_HECTARESBC_FEMIC_SRC=/srv/shared-data/gep/ws4/femic/src \
PORT=8030 \
FRESH_HECTARESBC_PUBLIC_URL=https://fresh-hectaresbc.01101.dev \
bash scripts/start_demo_service.sh
```

Production/demo templates:

- `deploy/fresh-hectaresbc-demo.service`
- `deploy/fresh-hectaresbc-demo.env.example`
- `deploy/cloudflared-ingress.example.yml`
- `deploy/README.md`

Verify a local or public origin (does not start an agent chat or create a
bundle):

```bash
python scripts/check_demo_service.py --base-url http://127.0.0.1:8030
python scripts/check_demo_service.py --base-url https://fresh-hectaresbc.01101.dev
```

The public host is protected by Cloudflare Access. Unauthenticated requests
redirect to the Globus login and the checker reports that state. For automated
public checks, supply a Cloudflare Access service token via
`CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`, or an authenticated cookie
via `--cookie`.

Demo data materialized in the clone:

- generated catalog artifacts
- 2,163 published preview PNGs (copied as regular files for the demo)
- 2,183 local 2048 px preview overrides (~537 MB)
- 2,183 EPSG:3857 map overlays (~934 MB)
- writable `var/bundles/`

The demo clone has uncommitted generated/ignored data and copied preview files.
Do not reset it without checking that data first.

## External Routing / Access

The cloudflared tunnel, DNS, Cloudflare Access/Zero Trust application, and
Globus OAuth policy constrained to UBC CWL are **not configured by this repo**.
They are expected to be configured like `fhops.01101.dev` and `ws4.01101.dev`.

Required origin target:

```text
http://10.232.253.210:8030
```

or `http://127.0.0.1:8030` if the tunnel runs in the same network namespace.

Critical: the assistant is enabled (`--allow-agent`) and has the service user's
shell permissions. Keep the entire `fresh-hectaresbc.01101.dev` hostname behind
Cloudflare Access before exposing it. The service strips common AWS/Globus
credential variables from the agent environment, but it is not a sandbox.

The app is at `/web/`; the API is at `/api/`. `/` redirects to `web/`.

## Key Commands

Install / develop:

```bash
cd /srv/shared-data/gep/ws4/fresh-hectaresbc
source .venv/bin/activate
python scripts/generate_web_catalog.py
python scripts/reproject_map_previews.py --workers 8
python scripts/build_tile_cog.py --dataset-id dl_adminunits_bcts \
  --archive-root /path/to/hectaresbc --output-root var/tile-cogs
python scripts/smoke_test_web_static_app.py
node scripts/smoke_test_web_catalog_ui.js web/data/catalog.json
python scripts/smoke_test_web_ui_browser.py
python scripts/smoke_test_clip_aoi_browser.py
```

Web/agent tests:

```bash
PYTHONPATH=src:. python -m pytest \
  tests/test_agent_gis.py \
  tests/test_web_catalog_generator.py \
  tests/test_web_app_server.py \
  tests/test_web_catalog_ui.py -q
```

Docs:

```bash
python -m sphinx -b html -W --keep-going docs docs/_build/html
```

Agent tools:

```bash
python scripts/agent_tools.py search-layers --query "old growth" --limit 10
python scripts/agent_tools.py search-aoi --query "timber supply area boundary"
python scripts/agent_tools.py resolve-aoi \
  --query "timber supply area boundary" --name "TSA 27"
python scripts/agent_tools.py prepare-bundle \
  --aoi-query "timber supply area boundary" --aoi-name "TSA 27" \
  --layer-id dl_adminunits_bcts --layer-id dl_bec_becv10
python scripts/agent_tools.py list-bundles
```

## Verified At Handoff

- Web/agent tests: 12 passed in `tests/test_agent_gis.py`, including a drawn
  GeoJSON bundle, candidate-name extraction, job-history pruning, bundle-output
  retention, and the low-zoom overlay tile path.
- Browser smoke: desktop/tablet/mobile, search, facets, inspector, dataset,
  `#/map`, map fallback, legacy routes, keyboard.
- Clip AOI browser smoke: mocked API job progress, partial failure details,
  failed-layer retry body, and cancellation.
- Sphinx `-W`: passed (recheck after documentation edits).
- TSA 27 resolved to Revelstoke TSA (758,443 ha).
- BCTS + BEC clipped bundle produced (1.27 MB ZIP) and downloaded.
- Assistant used the tool CLI and returned the real bundle download link.
- Clip AOI drawer exercised locally and through
  `https://fresh-hectaresbc.01101.dev`: boundary candidate resolution, mouse
  draw, touch draw, 1–6 layer selection, async bundle progress, cancellation,
  per-layer failure display, failed-layer retry, bundle creation, ZIP download,
  and recent-bundle links.
- Public protected check with the saved CWL session: 13/13.
- Public bundle download returned a valid `application/zip`.

The full Python suite still has environment-dependent failures unrelated to
this work, mainly missing raw DataLad/archive payloads for older preview and
resolution tests. Use the web/agent test command above for this feature set.

## Final Closeout

- P19, P20, P21, P22, P23, and P24 are complete; no active implementation branch remains.
- No open GitHub issues or pull requests at closeout.
- Final protected public verification and browser smoke checks passed.
- Sphinx sources refreshed for tiles, COGs, stats, Clip AOI preflight, jobs, and retention.
- GitHub Pages deploy succeeded; https://ubc-fresh.github.io/fresh-hectaresbc/ matches main.
- Phase 21 added the layer tray, multi-layer map context, bundle/job history, and click-to-identify.
- Phase 22 added encoded shareable workspaces and named local workspace saves.
- Phase 23 added a reusable named/recent AOI library in the Clip drawer.
- Phase 24 added a protected admin statistics dashboard.
- Remaining items below are optional follow-ups, not blockers.

## Optional Follow-Ups

1. Keep the Cloudflare Access/Globus OAuth policy restricted to UBC CWL.
2. Extend optional COG derivatives to more most-viewed layers using
   `scripts/build_tile_cog.py`; BCTS is the current pilot.
3. If more layers should be sharp, continue generating 2048 px overrides with
   `scripts/generate_highres_web_previews.py --family data_layer ...` and
   `--reindex-only` after interrupted runs.
4. If the demo clone is recreated, re-materialize previews and high-res
   overrides; they are generated/ignored data, not tracked.
