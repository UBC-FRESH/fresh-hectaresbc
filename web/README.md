# Browser Catalog App

Generate the browser catalog artifact:

```bash
python3 scripts/generate_web_catalog.py
```

Run the catalog UI logic smoke check:

```bash
node scripts/smoke_test_web_catalog_ui.js web/data/catalog.json
```

Serve the static app locally:

```bash
python3 -m http.server --directory web 8000
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

The app shell and catalog artifact do not require raw HectaresBC payloads, DataLad network retrieval, Arbutus/Chinook credentials, UBC CWL, hosted workers, or object-store access.
