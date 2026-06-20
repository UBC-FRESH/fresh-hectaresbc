# Phase 16 Full Preview Publication Closeout

Date: 2026-06-20

## Summary

Phase 16 compiled, published, and connected source-derived browser preview
artifacts for the recovered HectaresBC catalog.

- Main repo branch: `feature/p16-full-layer-preview-publication`
- Main repo preview publication commit: `187ea58`
- Main repo browser consumption commit: `0efbf11`
- Main repo safe server commit: `dc509b7`
- Data repo final preview publication commit: `c4903168`
- Data repo artifact root: `derived/web_map_previews/v1/`
- Catalog records indexed: 2,183
- Preview PNG artifacts generated: 2,163
- Records marked `not_previewable`: 20
- Preview PNG storage: DataLad/git-annex, copied to `arbutus-s3`

## Browser Consumption

The browser app now prefers the published preview index:

```text
external/fresh-hectaresbc-data/derived/web_map_previews/v1/index.json
```

Per-layer manifests are fetched lazily from the same artifact root. Preview PNG
URLs are resolved relative to the published DataLad preview root. The ignored
local `web/data/map_previews/manifest.json` remains a fallback and a source for
the current NRS administrative basemap/reference artifact.

The static app should be served with:

```bash
python scripts/serve_web_app.py --host 0.0.0.0 --port 8023
```

The generic repo-root `python -m http.server` command must not be used for this
workflow because it exposes a directory listing at `/`. The project server
redirects `/` to `/web/`, serves only `/web/` and the published preview artifact
tree, and disables directory listings.

## Live Server Checks

The safe server was checked on port `8023`:

- `/` returns `302` to `/web/`.
- `/web/` serves the browser shell.
- `/web/data/catalog.json` serves the generated catalog.
- `/external/fresh-hectaresbc-data/derived/web_map_previews/v1/index.json`
  serves the published preview index.
- Representative BCTS and Bull Trout preview PNGs return `200` and valid PNG
  signatures.
- `/.git/`, `/.venv/`, `/tmp/`, `/README.md`, and
  `/external/fresh-hectaresbc-data/raw/` return `404`.

Representative browser routes:

```text
/web/#map=dl_adminunits_bcts
/web/#map=vl_virtualspecies_bulltroutsalvelinusconfluentus_1135
/web/#map=dl_pinebeetle_pinekill1999
```

## Verification

Final closeout commands:

```bash
.venv/bin/python scripts/generate_web_catalog.py
.venv/bin/python -m py_compile scripts/serve_web_app.py scripts/generate_layer_preview_batch.py
node --check web/app.js
node --check scripts/smoke_test_web_app_dom.js
.venv/bin/python scripts/smoke_test_web_static_app.py
node scripts/smoke_test_web_catalog_ui.js web/data/catalog.json
node scripts/smoke_test_web_app_dom.js web/data/catalog.json
.venv/bin/python -m pytest tests/test_web_app_server.py tests/test_web_catalog_generator.py tests/test_web_catalog_ui.py
.venv/bin/python -m pytest
git diff --check
```

Results:

- Static web app smoke passed.
- Catalog UI smoke passed.
- Browser DOM smoke passed against the published preview index.
- Focused web pytest passed: 5 tests.
- Full pytest passed: 62 tests.
- `git diff --check` passed.

## Remaining Scope

Phase 16 publishes single static preview PNGs, not tile pyramids, COG services,
interactive GIS pan/zoom rendering, AOI clipping, or download job processing.
Those remain future phases.
