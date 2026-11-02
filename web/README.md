# Browser Catalog App

The browser app is a static, dependency-free application shell over the generated
catalog. It has three surfaces:

- **Browse** — search, facets, sortable results, pagination, and a contextual
  inspector.
- **Dataset** — metadata, provenance, known gaps, preview status, and copyable
  Python/CLI commands.
- **Map** — a MapLibre workspace with the published preview image as an overlay,
  layer visibility/opacity, legend, and an offline basemap fallback.

The app does not require a Node build step. `web/catalog.js`, `web/map.js`, and
`web/app.js` are classic scripts; MapLibre is vendored under `web/vendor/` and
loaded only on the map route.

## Generate The Catalog

From an activated development environment:

```bash
python scripts/generate_web_catalog.py
```

The generator writes four ignored artifacts under `web/data/`:

| Artifact | Purpose |
| --- | --- |
| `catalog.json` | Compatibility payload with every full record |
| `catalog.index.json` | Compact rows used by Browse (search, facets, list) |
| `catalog.details.json` | Full records loaded lazily when a dataset opens |
| `catalog.meta.json` | Counts and generation timestamp for the app header |

`catalog.index.json` is about 2.6 MB raw and about 230 KB gzip; the app loads it
on boot. `catalog.details.json` is loaded only when a dataset route opens.

## Serve The App

```bash
python scripts/serve_web_app.py --host 127.0.0.1 --port 8023
```

Then open:

```text
http://localhost:8023/web/
```

The project server:

- redirects `/` to the proxy-relative `web/` path;
- serves only `web/` plus the published preview artifact tree;
- disables directory listings;
- gzips JSON, HTML, CSS, and JavaScript when the browser accepts it;
- sets conservative `Cache-Control` and security headers.

In a JupyterHub/code-server proxy, use the corresponding proxied `/web/` URL.

## Routes

```text
#/catalog
#/catalog?q=bull+trout&family=virtual_layer&preview=available&sort=title&page=1
#/map
#/dataset/dl_adminunits_bcts
#/dataset/dl_adminunits_bcts/map
```

`#/map` opens the map workspace with a useful default preview layer (BCTS
Operating Areas when available). The Map tab is enabled directly from Browse,
and the map's "Preview layers" link opens the catalog filtered to preview-ready
records.

Search, family, preview availability, verification, size bucket, sort, page, and
page size are encoded in the hash. Opening a dataset preserves the browse
context; the breadcrumb returns to the exact previous result set.

Legacy routes redirect automatically:

```text
#dl_adminunits_bcts   -> #/dataset/dl_adminunits_bcts
#map=dl_adminunits_bcts -> #/dataset/dl_adminunits_bcts/map
```

## Preview Index And Map

The app first looks for the published DataLad-backed preview index:

```text
external/fresh-hectaresbc-data/derived/web_map_previews/v1/index.json
```

If it is not reachable, it falls back to local ignored development artifacts:

```text
web/data/map_previews/manifest.json
```

The index and per-layer manifests are Git-tracked, but the preview PNG payloads
are annexed. Fetch them from the Arbutus remote after sourcing user-local
credentials:

```bash
export PATH="$HOME/.local/bin:$PATH"
source ~/.config/fresh-hectaresbc/arbutus_env.sh
python scripts/fetch_web_previews.py
```

Use `--dataset-id dl_adminunits_bcts` to fetch one preview while developing.
The catalog still renders when neither the index nor the payloads are available.
When the index is present but an image is missing, the map shows an explicit
"preview image missing locally" banner rather than a blank canvas.

The published previews are 256 px and look soft on a full-screen map. Generate
ignored 2048 px local overrides from the recovered source archive:

```bash
python scripts/generate_highres_web_previews.py \
  --family data_layer --max-size 2048 --workers 8 \
  --local-archive-root /path/to/hectaresbc
```

The app prefers `data/map_previews_highres/v1/index.json` when it exists and
falls back to the published 256 px previews for layers without an override.
Use `--dataset-id` for selected layers or `--reindex-only` after an interrupted
run.

Native previews are in the source CRS (typically EPSG:3005). Reproject the map
overlays to Web Mercator so they align with the OpenStreetMap basemap:

```bash
python scripts/reproject_map_previews.py --workers 8
```

The output is ignored `web/data/map_previews_3857/`; the map route uses it,
while native previews remain the list thumbnails.

To make the entire library sharp, generate 2048 px overrides for the remaining
virtual layers and then reproject only the new maps:

```bash
python scripts/generate_highres_web_previews.py \
  --family virtual_layer --max-size 2048 --workers 32 \
  --local-archive-root /path/to/hectaresbc
python scripts/reproject_map_previews.py --workers 32
```

The reprojection pass is incremental: existing `map.png` files and index
entries are preserved. A dataset with a usable
`wgs84_bounds` and `preview.png` opens in MapLibre with an OpenStreetMap basemap
and an "Offline" basemap option. Preview images without bounds fall back to a
static lightbox; `not_previewable` records show an explanatory status panel.

The map route lazy-loads `web/vendor/maplibre-gl.js` and
`web/vendor/maplibre-gl.css`. Browse never loads MapLibre.

## Optional Service And Assistant

The static app also runs under the optional FastAPI service:

```bash
python scripts/run_web_service.py \
  --host 127.0.0.1 --port 8030 \
  --allow-agent \
  --archive-root /path/to/hectaresbc \
  --femic-src /path/to/femic/src
```

The service adds the "Ask" assistant panel, catalog/layer search APIs, FEMIC
BCDC AOI resolution, and clipped multi-layer bundle downloads. The assistant is
opt-in (`--allow-agent`) and the service is loopback-only unless
`--allow-remote` is supplied for a protected deployment. See
`planning/agent_gis_bundles.md`.

## Verification

```bash
python scripts/smoke_test_web_static_app.py
node scripts/smoke_test_web_catalog_ui.js web/data/catalog.json
python scripts/smoke_test_web_ui_browser.py
```

The browser smoke check uses Playwright/Chromium when available and exits with a
`skipped` message when it is not installed. It checks desktop, tablet, and mobile
layouts, search-to-inspector navigation, dataset metadata, map loading or
fallback, legacy routes, keyboard focus, and horizontal overflow.

Default verification does not require Arbutus/Chinook credentials, UBC CWL,
DataLad network retrieval, raw ZIP content, a hosted worker, or object-store
access. A cold checkout without the data submodule will show the catalog and
metadata, but preview thumbnails and map overlays will be unavailable until the
published preview index is reachable.
