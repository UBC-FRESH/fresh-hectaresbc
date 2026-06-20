# Browser Catalog App

Generate the browser catalog and source-derived BCTS map-preview artifacts from the activated repo-local `.venv`:

```bash
python scripts/generate_web_catalog.py
python scripts/generate_map_preview_artifacts.py --dataset-id dl_adminunits_bcts
```

The preview generator reads the real BCTS raster from `data_layers/adminunits_bcts.zip!bcts.tiff`, using DataLad annex content when present or the ignored local archive fallback at `tmp/shared-data/hectaresbc/data_layers/adminunits_bcts.zip`. It writes reproducible ignored outputs under `web/data/map_previews/`, including `manifest.json` and `dl_adminunits_bcts/preview.png`.

Current preview coverage is intentionally narrow. The browser renderer can display additional raster PNG preview artifacts, but `scripts/generate_map_preview_artifacts.py` is currently configured only for `dl_adminunits_bcts`. Other layers need explicit source-readability audits and per-layer generator configuration before they will have real preview artifacts. The next expansion step is to audit a small batch of data-layer ZIPs for readable rasters/vectors, CRS, bounds, nodata/category metadata, and useful visual signal, then add them to the generator one at a time with tests.

Run the browser app smoke checks:

```bash
python scripts/smoke_test_web_static_app.py
python scripts/smoke_test_map_preview_artifacts.py
node scripts/smoke_test_web_catalog_ui.js web/data/catalog.json
node scripts/smoke_test_web_app_dom.js web/data/catalog.json
```

Serve the static app locally:

```bash
python -m http.server --directory web 8000
```

Then open:

```text
http://localhost:8000/
```

Representative detail views use stable hash routes:

```text
http://localhost:8000/#dl_adminunits_bcts
http://localhost:8000/#vl_virtualspecies_bulltroutsalvelinusconfluentus_1135
```

Representative map preview routes use `#map=<dataset_id>`:

```text
http://localhost:8000/#map=dl_adminunits_bcts
http://localhost:8000/#map=vl_virtualspecies_bulltroutsalvelinusconfluentus_1135
```

The `dl_adminunits_bcts` route loads and renders the generated source-derived PNG preview artifact from `web/data/map_previews/dl_adminunits_bcts/preview.png` over an offline minimalist basemap context. The layer panel includes visibility and opacity controls, real CRS and bounds metadata, legend classes, preview derivation metadata, basemap status, and a link back to the recovered catalog detail route. This is a real source-derived raster preview, not the Phase 11 fixture geometry, but it is still a single static overlay image rather than a tile service or pan/zoom GIS renderer. The app shell and catalog artifact do not require Arbutus/Chinook credentials, UBC CWL, hosted workers, object-store access, or external map tiles. Source-derived preview generation requires local access to the relevant recovered ZIP payload through the DataLad submodule or ignored local archive fallback.
