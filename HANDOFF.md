# Agent Handoff

Date: 2026-11-02
Branch: `feature/p19-web-ui-upgrade`
Draft PR: https://github.com/UBC-FRESH/fresh-hectaresbc/pull/140
Latest code commit at handoff: `a0f1abd`

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
- `scripts/generate_highres_web_previews.py` generates/clips 2048 px overrides
  from the recovered source archive and can reindex partial runs.
- `scripts/fetch_web_previews.py` fetches the published preview PNG payloads
  from the Arbutus DataLad remote.
- Preview PNGs are rendered in native CRS (usually EPSG:3005 / BC Albers).
  `scripts/reproject_map_previews.py` writes ignored EPSG:3857 map overlays
  under `web/data/map_previews_3857/`; the map route uses those so overlays
  align with the Web-Mercator basemap. Native previews remain thumbnails.
- Full-library sharpness: generate 2048 px overrides for the remaining virtual
  layers, then reproject only the new maps:
  ```bash
  python scripts/generate_highres_web_previews.py \
    --family virtual_layer --max-size 2048 --workers 32 \
    --local-archive-root /path/to/hectaresbc
  python scripts/reproject_map_previews.py --workers 32
  ```
  The reproject pass is incremental: it skips existing `map.png` files and
  preserves their index entries.

### Agent Service And GIS Bundles (P20)

- Optional FastAPI service: `src/fresh_hectaresbc/web_service.py`
- Start script: `scripts/run_web_service.py`
- Demo wrapper: `scripts/start_demo_service.sh`
- Browser "Ask" assistant panel:
  - UI help and catalog context
  - catalog/layer search
  - FEMIC AOI resolution
  - clipped raster bundle creation and download links
- FEMIC bridge: `src/fresh_hectaresbc/femic_bridge.py`
  - resolves BC Data Catalogue boundary packages
  - materializes WFS features through FEMIC
  - matches named/numeric features (e.g. TSA 27 -> Revelstoke TSA)
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
log: /tmp/hbc-demo-service.log
```

The service is currently running. If it stops, restart with:

```bash
cd /srv/shared-data/gep/ws4/fresh-hectaresbc-demo
FRESH_HECTARESBC_ARCHIVE_ROOT=/srv/shared-data/gep/fresh-hectaresbc/hectaresbc \
FRESH_HECTARESBC_FEMIC_SRC=/srv/shared-data/gep/ws4/femic/src \
PORT=8030 \
FRESH_HECTARESBC_PUBLIC_URL=https://fresh-hectaresbc.01101.dev \
bash scripts/start_demo_service.sh
```

Demo data materialized in the clone:

- generated catalog artifacts
- 2,163 published preview PNGs (copied as regular files for the demo)
- 399 local 2048 px preview overrides (~393 MB)
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
python scripts/smoke_test_web_static_app.py
node scripts/smoke_test_web_catalog_ui.js web/data/catalog.json
python scripts/smoke_test_web_ui_browser.py
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

- Web/agent tests: 13 passed.
- Browser smoke: desktop/tablet/mobile, search, facets, inspector, dataset,
  `#/map`, map fallback, legacy routes, keyboard.
- Sphinx `-W`: passed.
- TSA 27 resolved to Revelstoke TSA (758,443 ha).
- BCTS + BEC clipped bundle produced (1.27 MB ZIP) and downloaded.
- Assistant used the tool CLI and returned the real bundle download link.
- Demo app, preview index, high-res index, map, and assistant chat checked.

The full Python suite still has environment-dependent failures unrelated to
this work, mainly missing raw DataLad/archive payloads for older preview and
resolution tests. Use the web/agent test command above for this feature set.

## Next Steps

1. Confirm the cloudflared route and Cloudflare Access/Globus OAuth policy for
   `fresh-hectaresbc.01101.dev`.
2. Decide whether to activate the P19/P20 GitHub issue tree or keep PR #140 as
   the tracking surface.
3. Mark PR #140 ready for review and merge after the demo is verified through
   the public hostname.
4. If more layers should be sharp, continue generating 2048 px overrides with
   `scripts/generate_highres_web_previews.py --family data_layer ...` and
   `--reindex-only` after interrupted runs.
5. If the demo clone is recreated, re-materialize previews and high-res
   overrides; they are generated/ignored data, not tracked.
