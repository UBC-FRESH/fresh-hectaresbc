# fresh-hectaresbc

Recovering, inventorying, documenting, and modernizing the archived HectaresBC geospatial data collection.

## Data Repository

Large HectaresBC payloads are not stored directly in this repository. They live in the DataLad/git-annex data repository:

```text
UBC-FRESH/fresh-hectaresbc-data
```

This repository links that dataset as a Git submodule at:

```text
external/fresh-hectaresbc-data
```

Clone with submodules:

```bash
git clone --recurse-submodules https://github.com/UBC-FRESH/fresh-hectaresbc.git
cd fresh-hectaresbc
```

Or initialize the data submodule after cloning:

```bash
git submodule update --init --recursive external/fresh-hectaresbc-data
```

The submodule checkout contains Git and git-annex metadata only. Annexed file content is retrieved on demand from configured storage remotes.

## Published Data Status

The recovered HectaresBC ZIP payload set has been published through the DataLad data repository:

- raw ZIP payloads: 2,183
- data-layer ZIPs: 418
- virtual-layer ZIPs: 1,765
- published ZIP bytes: 17,531,591,717
- storage remote: `arbutus-s3`

Phase 5 validation reports are tracked in the data submodule:

- `external/fresh-hectaresbc-data/metadata/validation/full_annex_import.md`
- `external/fresh-hectaresbc-data/metadata/validation/full_publication_whereis.md`
- `external/fresh-hectaresbc-data/metadata/validation/full_zip_inventory_coverage.md`
- `external/fresh-hectaresbc-data/metadata/validation/full_publication_retrieval_sampling.md`

## Python API Development

The first Python API is available for local development. It currently provides the public `HectaresBC` entrypoint, recovered-catalog lookup/search/filtering, dataset path resolution, local content-status checks, backend diagnostics, and DataLad-backed fetch result objects.

Create and activate the repo-local development environment:

```bash
bash scripts/setup_dev_venv.sh
source .venv/bin/activate
```

The setup script creates `.venv/`, installs the package in editable mode with `.[dev]`, and smoke-checks package import, pytest, and Python-side DataLad availability. The `.venv/` directory is ignored and must not be committed.

Smoke-test the import:

```bash
python -c "from fresh_hectaresbc import HectaresBC; print(HectaresBC().__class__.__name__)"
```

Run the current test suite:

```bash
python -m pytest
```

Build and inspect local distribution artifacts:

```bash
rm -rf dist/
python -m build
python scripts/inspect_distribution_artifacts.py dist
python scripts/smoke_test_wheel_install.py dist
```

Smoke-test the CLI:

```bash
fresh-hectaresbc --help
fresh-hectaresbc --version
```

Query the catalog from the CLI:

```bash
fresh-hectaresbc catalog search "bull trout" --limit 1
fresh-hectaresbc catalog show dl_adminunits_bcts
fresh-hectaresbc catalog list --family virtual_layer --limit 2
```

Inspect local data paths and content status:

```bash
fresh-hectaresbc data path dl_adminunits_bcts
fresh-hectaresbc data status dl_adminunits_bcts
```

Inspect backend readiness and plan a fetch without retrieving content:

```bash
fresh-hectaresbc diagnostics
fresh-hectaresbc fetch dl_adminunits_bcts --dry-run
```

Real non-dry-run fetches delegate to DataLad/git-annex and may require local Arbutus credential setup.

Load and query the recovered catalog:

```python
from fresh_hectaresbc import HectaresBC

hbc = HectaresBC()
record = hbc.get("dl_adminunits_bcts")
matches = hbc.search("bull trout", limit=5)
virtual_layers = hbc.filter(family="virtual_layer")
```

Resolve a catalog record to the linked data repository and inspect local content status without fetching:

```python
resolved = hbc.resolve("dl_adminunits_bcts")
status = hbc.content_status("dl_adminunits_bcts")

print(resolved.raw_relative_path)
print(status.status)
```

Inspect backend readiness and plan retrieval without fetching content:

```python
diagnostics = hbc.diagnostics()
plan = hbc.fetch("dl_adminunits_bcts", dry_run=True)

print([(item.check, item.status) for item in diagnostics])
print(plan.status)
```

Run the fuller Python API quickstart:

```bash
python examples/python_api_quickstart.py
```

Run the CLI quickstart:

```bash
bash examples/cli_quickstart.sh
```

In a source checkout, the catalog API reads compact tracked metadata from:

```text
metadata/recovered_catalog/data_layer_records.csv
metadata/recovered_catalog/virtual_layer_records.csv
```

Installed packages fall back to bundled copies of those compact CSVs under:

```text
fresh_hectaresbc/package_data/recovered_catalog/
```

Catalog operations do not read bulky ZIP payloads, require the data submodule contents, or require Arbutus credentials. Resolution and status operations inspect only local filesystem metadata under `external/fresh-hectaresbc-data`; they do not retrieve annex content. Dry-run fetches validate the planned DataLad operation without network retrieval.

## Browser Catalog Development

Generate the static browser catalog artifact from the Python package API and the
source-derived BCTS map preview artifact from recovered payload content:

```bash
python scripts/generate_web_catalog.py
python scripts/generate_map_preview_artifacts.py --dataset-id dl_adminunits_bcts
python scripts/smoke_test_web_static_app.py
python scripts/smoke_test_map_preview_artifacts.py
node scripts/smoke_test_web_catalog_ui.js web/data/catalog.json
node scripts/smoke_test_web_app_dom.js web/data/catalog.json
```

The map-preview generator reads the real BCTS raster from:

```text
data_layers/adminunits_bcts.zip!bcts.tiff
```

It resolves that ZIP from the DataLad submodule when annex content is present,
or from the ignored local archive fallback:

```text
tmp/shared-data/hectaresbc/data_layers/adminunits_bcts.zip
```

The generated browser files are ignored because they are reproducible outputs:

```text
web/data/catalog.json
web/data/map_previews/manifest.json
web/data/map_previews/dl_adminunits_bcts/preview.png
```

The preview artifact manifest records `EPSG:3005`, native and WGS84 bounds,
source ZIP and internal TIFF/WMS paths, raster dimensions, nodata, 12
legend/classes, and derivation status. Use `--max-size 256` for faster local
smoke iterations; the default maximum preview dimension is 768 pixels.

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

The `dl_adminunits_bcts` route loads and renders the generated source-derived PNG preview artifact from `web/data/map_previews/dl_adminunits_bcts/preview.png`. The layer panel includes visibility and opacity controls, real CRS and bounds metadata, legend classes, preview derivation metadata, and a link back to the recovered catalog detail route. This is a real source-derived raster preview, not the Phase 11 fixture geometry, but it is still a single static overlay image rather than a tile service or pan/zoom GIS renderer. Browser catalog development does not require Arbutus/Chinook credentials, UBC CWL, hosted workers, or object-store access. Source-derived preview generation requires local access to the relevant recovered ZIP payload through the DataLad submodule or ignored local archive fallback. Node is still a system prerequisite for the browser smoke scripts; it is not installed by the Python `.venv` setup. In restricted environments that cannot bind a loopback socket, `scripts/smoke_test_web_static_app.py` still validates static assets and catalog content and reports the HTTP serving check as skipped.

## DataLad Retrieval

The development extra installs Python-side DataLad support through `datalad[full]`. Real retrieval may still require the external `git-annex` binary, initialized submodules, configured storage remotes, and user-local credentials.

To retrieve annexed data from the Arbutus-backed special remote, source local credentials first:

```bash
export PATH="$HOME/.local/bin:$PATH"
source ~/.config/fresh-hectaresbc/arbutus_env.sh
cd external/fresh-hectaresbc-data
git annex enableremote arbutus-s3
```

Retrieve any published payload by raw archive path:

```bash
datalad get raw/hectaresbc_2022_export/data_layers/adminunits_bcts.zip
```

Retrieve the validated Phase 5 cold-clone sample set:

```bash
datalad get \
  raw/hectaresbc_2022_export/data_layers/adminunits_bcts.zip \
  raw/hectaresbc_2022_export/data_layers/climatedecade_ahm.zip \
  raw/hectaresbc_2022_export/data_layers/climatercp452050_tmaxsp.zip \
  raw/hectaresbc_2022_export/data_layers/water_distancetocoast.zip \
  raw/hectaresbc_2022_export/virtual_layers/virtualecocomm.alaskanmountainheatherdwarfshrublandharrimanellastellerianadwarfshrubland.425.zip \
  raw/hectaresbc_2022_export/virtual_layers/virtualspecies.bulltroutsalvelinusconfluentus.1135.zip \
  raw/hectaresbc_2022_export/data_layers/topography_rhsp.zip \
  raw/hectaresbc_2022_export/data_layers/mgtdes_landreserves.zip \
  raw/hectaresbc_2022_export/virtual_layers/virtualspecies.yellowwarblerdendroicapetechia.1119.zip \
  raw/hectaresbc_2022_export/virtual_layers/virtualecocomm.sitkasedgepeatmossescarexsitchensissphagnumspp.464.zip
```

Credentials are user-local and must not be committed. See `planning/arbutus_s3_special_remote_plan.md`, `planning/cold_clone_data_access_validation.md`, and `external/fresh-hectaresbc-data/docs/arbutus_s3_remote.md`.
