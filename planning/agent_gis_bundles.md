# Agent GIS Assistant, AOI Clipping, And Demo Deployment

Date: 2026-11-02
Status: implemented in the P19 browser/agent service
Related: `planning/web_ui_upgrade_plan.md`, `planning/web_map_preview_workflow_contract.md`

## Purpose

Add an optional assistant to the browser app that can:

- explain the catalog and map UI;
- search the recovered HectaresBC raster library;
- resolve BC Data Catalogue boundary layers into AOIs (TSA, administrative
  regions, and similar WFS-backed boundaries) through FEMIC;
- clip one or more recovered rasters to that AOI;
- package the clipped GeoTIFFs, AOI, and manifest into a downloadable ZIP;
- list recent bundles.

The web app remains static-first. The service is an optional wrapper for the
assistant, AOI resolution, bundle creation, and the same static files.

## Service

Entry point:

```bash
python scripts/run_web_service.py \
  --host 127.0.0.1 --port 8030 \
  --allow-agent \
  --archive-root /path/to/hectaresbc \
  --femic-src /path/to/femic/src
```

Non-loopback binds require `--allow-remote`. The demo deployment is intended to
sit behind Cloudflare Access (Zero Trust + Globus OAuth constrained to UBC CWL).
The service does not implement user authentication itself.

Endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Service, catalog, preview, archive, bundle, and agent status |
| GET | `/api/agent` | Whether the assistant is enabled, available, and which model it uses |
| POST | `/api/agent/chat` | One assistant turn through `opencode run --format json --auto` |
| GET | `/api/layers/search?q=` | Catalog search for the assistant/UI |
| GET | `/api/layers/{dataset_id}` | One catalog record |
| GET | `/api/tiles/{dataset_id}/metadata` | Tile bounds, min/max zoom, source resolution, legend |
| GET | `/api/tiles/{dataset_id}/{z}/{x}/{y}.png` | On-demand Web-Mercator raster tile from the 1 ha source |
| POST | `/api/aoi/resolve` | Resolve a named FEMIC/BCDC boundary to a GeoJSON AOI |
| GET | `/api/aoi/search?q=` | Search boundary packages before resolution |
| POST | `/api/bundles` | Clip selected rasters to an AOI and create a ZIP (synchronous) |
| POST | `/api/bundle-jobs` | Queue a bundle job and return its job ID |
| GET | `/api/bundle-jobs/{id}` | Job status, progress, stage, and result |
| POST | `/api/bundle-jobs/{id}/cancel` | Request best-effort cancellation between layers |
| GET | `/api/bundles` | Recent bundle summaries |
| GET | `/api/bundles/{id}` | Bundle manifest |
| GET | `/api/bundles/{id}/download` | Bundle ZIP |

Static surfaces:

- `/web/` — the existing browser app;
- `/external/fresh-hectaresbc-data/derived/web_map_previews/v1/` — published
  preview index, manifests, and PNGs;
- `/` — redirects to `web/`.

## FEMIC Boundary Resolution

`src/fresh_hectaresbc/femic_bridge.py` uses FEMIC for BC Data Catalogue
resolution and WFS materialization:

1. `femic.bcdc_catalog.resolve_bcdc_candidates()` finds boundary packages and
   WFS-capable resources.
2. Candidate packages are ranked for boundary intent (TSA, regional district,
   management area) so a query such as `TSA 27` does not select an unrelated
   management-area layer.
3. `femic.bcdc_fetch._fetch_wfs_payload_paged()` materializes the selected WFS
   features. This is FEMIC's paged/tiled WFS helper.
4. Boundary features are matched by name and, where possible, exact numeric
   properties (`TSA_NUMBER=27`). Generic names return `needs_name` or
   `ambiguous` candidate lists instead of guessing.
5. The union is written as a WGS84 GeoJSON AOI with EPSG:3005 and WGS84 bounds,
   area, package/resource provenance, and a metadata JSON file.

## Zoomable Raster Tiles

The source HectaresBC rasters are 100 m (1 ha) BC Albers GeoTIFFs, usually
internally tiled 64×64. When `--archive-root` is configured, the service renders
256 px Web-Mercator tiles on demand:

- compute the requested XYZ tile bounds in EPSG:3857;
- open the source TIFF through `zip://` with rasterio;
- use a `WarpedVRT` to read/reproject the visible window into a 256×256 tile;
- apply the recovered exact/range legend classes and nodata handling;
- cache the PNG under `var/tile-cache/`.

MapLibre uses a `raster` source with that tile URL, so only visible tiles are
fetched while panning/zooming. Maximum zoom is derived from source resolution:
13 for 1-ha data (deeper zoom over-samples the same cells). Without the service,
the app falls back to the static EPSG:3857 preview image.

## Raster Clipping

`src/fresh_hectaresbc/clip.py`:

- looks up the catalog record and its raster member(s);
- resolves the raw ZIP from the DataLad data repository, or from
  `--archive-root` when the annex content is not materialized;
- extracts the TIFF to a temporary file;
- reprojects the AOI to the raster CRS;
- reads only the AOI window (not the full 17k × 15k raster);
- masks to the AOI geometry, preserves dtype/nodata, crops to the valid mask;
- writes a tiled, deflate-compressed GeoTIFF.

`src/fresh_hectaresbc/bundle.py`:

- resolves the AOI (FEMIC query/name) or accepts a browser-drawn GeoJSON
  geometry;
- validates layer IDs and limits;
- clips each layer into `layers/<dataset_id>.tif`;
- writes `aoi.geojson`, `manifest.json`, and `README.txt`;
- zips the bundle and returns a download URL.

Demo limits: 6 layers, 10,000,000 ha AOI. The service rejects unknown dataset
IDs and path-like bundle IDs. Clients never provide AOI filesystem paths. The
web API accepts either `aoi_query`/`aoi_name` or a GeoJSON
`Polygon`/`MultiPolygon` in `aoi_geometry`; geometry is validated, written under
`var/bundles/aoi/`, and reprojected by the bundle pipeline. Coordinate counts
are bounded to keep requests reasonable.

## Browser Clip And Bundle Panel

The map workspace exposes a **Clip AOI** drawer (`.clip-panel` in
`web/index.html`, `web/app.js`, `web/styles.css`):

- resolve a FEMIC/BCDC boundary by layer query and feature name;
- choose from structured candidate names when a query is ambiguous;
- draw a rectangle on the map (mouse or touch), with a mobile-friendly
  full-screen handoff while drawing;
- filter and multi-select up to six previewable layers (40 visible results at a
  time, search across all 2,183);
- show the AOI outline on the map and submit its exact GeoJSON geometry;
- run bundle preparation through `/api/bundle-jobs`, poll progress, show the
  current layer and a progress bar, and request cancellation between layers;
- show bundle status, layer count, ZIP size, download link, and recent bundles.

The panel is only enabled when `/api/health` reports a running service. Map
drawing waits for MapLibre style load, handles large TSA geometries without
spread-operator stack overflows, and restores the AOI overlay after a map
re-render. The synchronous `/api/bundles` endpoint remains for CLI and script
clients; the browser uses the job API so long clips are not held open by one
request through the Cloudflare proxy.

Jobs run one at a time in a single worker, are persisted under
`var/bundles/jobs/`, and are marked `interrupted` if the service restarts while
they are queued or running. Cancellation is best-effort: it is checked before
AOI clipping, between layers, and before packaging; a layer already being
clipped finishes before the job stops.

## Assistant Tools

The agent uses `scripts/agent_tools.py`, which prints JSON:

```bash
python scripts/agent_tools.py search-layers --query "old growth" --limit 10
python scripts/agent_tools.py search-aoi --query "timber supply area boundary"
python scripts/agent_tools.py resolve-aoi --query "timber supply area boundary" --name "TSA 27"
python scripts/agent_tools.py prepare-bundle \
  --aoi-query "timber supply area boundary" --aoi-name "TSA 27" \
  --layer-id dl_adminunits_bcts --layer-id dl_bec_becv10
python scripts/agent_tools.py list-bundles
```

`resolve-aoi` omits the full geometry by default; add `--include-geometry` only
when needed.

The service prompt includes a UI guide, current browser context (route, selected
dataset, filters, visible results, map layer), these tool commands, and the
layer/area limits. The assistant is opt-in with `--allow-agent`; it runs the
installed OpenCode CLI with the service user's permissions.

## Security And Operations

- Assistant off by default. It has shell access when enabled.
- Service binds loopback by default; remote binds require `--allow-remote`.
- Authentication is delegated to the Cloudflare Access/Zero Trust proxy.
- No credentials are delivered to the browser; the agent uses the CLI's own
  provider authentication. Do not print credentials in replies. The agent
  environment strips common AWS/Globus credential variables, but it still has
  the service user's shell permissions; keep the service behind an
  authenticating proxy.
- Bundle outputs live under `var/bundles/` (ignored) and are served by ID.
- Bundle IDs are validated; download paths cannot escape the bundle root.
- Bundle jobs are serialized through one worker and persisted under
  `var/bundles/jobs/`; cancellation is checked between clipping steps.
- Browser-drawn AOI geometry is validated as a finite Polygon/MultiPolygon,
  bounded in coordinate count, and written under `var/bundles/aoi/`; no
  client-supplied filesystem paths are accepted.
- Limits are enforced before clipping; AOI area and layer count are bounded.
- `GET /api/health` reports catalog, preview, archive, bundle, and agent state.

## Demo Deployment

The demo clone is intended to run on a free local port and be published through
a cloudflared tunnel at `fresh-hectaresbc.01101.dev`, protected by Cloudflare
Zero Trust + Globus OAuth constrained to UBC CWL, following the WS4/FHOPS
pattern. The tunnel, DNS, Access application, and Globus identity provider are
configured outside this repository.

The service can be started with:

```bash
python scripts/run_web_service.py \
  --host 0.0.0.0 --port 8030 --allow-remote --allow-agent \
  --archive-root /path/to/hectaresbc \
  --femic-src /path/to/femic/src \
  --bundle-root var/bundles \
  --public-url https://fresh-hectaresbc.01101.dev
```

or via the demo wrapper:

```bash
export FRESH_HECTARESBC_ARCHIVE_ROOT=/path/to/hectaresbc
export FRESH_HECTARESBC_FEMIC_SRC=/path/to/femic/src
export PORT=8030
bash scripts/start_demo_service.sh
```

The origin URL for the tunnel is `http://<host>:8030`. The app is at `/web/`;
the API is at `/api/`. The demo clone should include the generated catalog,
preview index/PNGs, high-resolution overrides, and a writable `var/bundles/`
directory.
