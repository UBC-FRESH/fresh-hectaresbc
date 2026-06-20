# Browser Catalog App

Generate the browser catalog from the activated repo-local `.venv`:

```bash
python scripts/generate_web_catalog.py
```

The browser first looks for the published full-preview index at:

```text
external/fresh-hectaresbc-data/derived/web_map_previews/v1/index.json
```

That DataLad-backed preview publication currently indexes 2,183 recovered records, with 2,163 source-derived preview PNGs and 20 `not_previewable` records. Per-layer PNG payloads are annexed in the data submodule and published to `arbutus-s3`; compact `index.json` and per-layer `manifest.json` files are Git-tracked in the data repository.

The browser also keeps the older local preview artifact fallback:

```bash
python scripts/generate_map_preview_artifacts.py --dataset-id dl_adminunits_bcts
```

That fallback writes ignored outputs under `web/data/map_previews/`, including `manifest.json`, `dl_adminunits_bcts/preview.png`, and `context/bc_admin_reference.png`. The browser uses that local manifest when the published DataLad preview index is not reachable, and it can use the local NRS administrative basemap/reference image as map context while rendering published per-layer previews.

Run the browser app smoke checks:

```bash
python scripts/smoke_test_web_static_app.py
python scripts/smoke_test_map_preview_artifacts.py
node scripts/smoke_test_web_catalog_ui.js web/data/catalog.json
node scripts/smoke_test_web_app_dom.js web/data/catalog.json
```

Serve the static app from the repository root when using the published DataLad preview artifacts:

```bash
python -m http.server 8023
```

Then open:

```text
http://localhost:8023/web/
```

In the JupyterHub/code-server proxy environment, use the corresponding proxied `/web/` URL, for example:

```text
https://fresh01.01101.dev/jupyterhub11/user/gep/codeserver/proxy/8023/web/#map=dl_adminunits_bcts
```

Serving only the `web/` directory still works for catalog browsing and for the ignored local `web/data/map_previews/` fallback, but it cannot read sibling paths under `external/fresh-hectaresbc-data/`.

Representative detail views use stable hash routes:

```text
http://localhost:8023/web/#dl_adminunits_bcts
http://localhost:8023/web/#vl_virtualspecies_bulltroutsalvelinusconfluentus_1135
```

Representative map preview routes use `#map=<dataset_id>`:

```text
http://localhost:8023/web/#map=dl_adminunits_bcts
http://localhost:8023/web/#map=vl_virtualspecies_bulltroutsalvelinusconfluentus_1135
http://localhost:8023/web/#map=dl_pinebeetle_pinekill1999
```

The `dl_adminunits_bcts` and Bull Trout routes load source-derived PNG previews through the published DataLad preview index. The `dl_pinebeetle_pinekill1999` route exercises a published `not_previewable` state. The layer panel includes visibility and opacity controls, real CRS and bounds metadata, legend classes when available, preview derivation metadata, artifact source metadata, basemap source metadata, and a link back to the recovered catalog detail route. Opening `#map=<dataset_id>` directly also synchronizes the visible catalog result and dataset detail, so manual search is not required.

These are real source-derived raster previews, not the Phase 11 fixture geometry, but they are still single static overlay images rather than a tile service or pan/zoom GIS renderer. The app shell and catalog artifact do not require UBC CWL, hosted workers, or external map tiles. Reading annexed preview PNG payloads from a cold checkout requires DataLad/git-annex retrieval from the configured storage remote before the browser can display those local files.
