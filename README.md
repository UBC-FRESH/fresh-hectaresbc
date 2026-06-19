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

The first Python package scaffold is available for local development. It currently provides the public `HectaresBC` entrypoint; catalog lookup, path resolution, and DataLad-backed retrieval are being implemented in the remaining Phase 6 issues.

Install the package in editable mode:

```bash
python3 -m pip install -e . --no-deps
```

Smoke-test the import:

```bash
python3 -c "from fresh_hectaresbc import HectaresBC; print(HectaresBC().__class__.__name__)"
```

Run the current test suite:

```bash
python3 -m pytest
```

## DataLad Retrieval

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
