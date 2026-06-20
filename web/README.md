# Browser Catalog App

Generate the browser catalog and map-preview artifacts from the activated repo-local `.venv`:

```bash
python scripts/generate_web_catalog.py
python scripts/generate_map_preview_artifacts.py
```

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

The `dl_adminunits_bcts` route loads and renders the generated source-derived PNG preview artifact from `web/data/map_previews/dl_adminunits_bcts/preview.png`. The layer panel includes visibility and opacity controls, real CRS and bounds metadata, legend classes, preview derivation metadata, and a link back to the recovered catalog detail route. The app shell and catalog artifact do not require Arbutus/Chinook credentials, UBC CWL, hosted workers, or object-store access. Source-derived preview generation requires local access to the relevant recovered ZIP payload through the DataLad submodule or ignored local archive fallback.
