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

The app shell, catalog artifact, and initial map-preview fixture do not require raw HectaresBC payloads, DataLad network retrieval, Arbutus/Chinook credentials, UBC CWL, hosted workers, or object-store access. The generated GeoJSON preview is a labelled UI fixture pending derivation from recovered payload content, not recovered HectaresBC geometry.
