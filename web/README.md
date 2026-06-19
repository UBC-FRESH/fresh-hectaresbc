# Browser Catalog App

Generate the browser catalog artifact:

```bash
python3 scripts/generate_web_catalog.py
```

Serve the static app locally:

```bash
python3 -m http.server --directory web 8000
```

Then open:

```text
http://localhost:8000/
```

The app shell and catalog artifact do not require raw HectaresBC payloads, DataLad network retrieval, Arbutus/Chinook credentials, UBC CWL, hosted workers, or object-store access.
