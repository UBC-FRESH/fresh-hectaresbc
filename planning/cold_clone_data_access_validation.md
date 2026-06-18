# Cold-Clone Data Access Validation

## Purpose

Record the Phase 4 cold-clone validation workflow for the main `fresh-hectaresbc` repository, its `external/fresh-hectaresbc-data` submodule, and the Arbutus-backed DataLad/git-annex special remote.

This validates P4.5.

## Prerequisites

- `git`
- `datalad`
- `git-annex`
- user-local Arbutus credentials at `~/.config/fresh-hectaresbc/arbutus_env.sh`

The credential file is private local state. It is required until the project decides whether anonymous object-store reads are supported.

## Commands

Clone the main repo and initialize the data submodule:

```bash
export PATH="$HOME/.local/bin:$PATH"
git clone --branch feature/p4-datalad-data-repo https://github.com/UBC-FRESH/fresh-hectaresbc.git /tmp/fresh-hectaresbc-p45-coldclone
cd /tmp/fresh-hectaresbc-p45-coldclone
git submodule update --init --recursive external/fresh-hectaresbc-data
```

Enable the Arbutus special remote inside the data submodule:

```bash
cd external/fresh-hectaresbc-data
source ~/.config/fresh-hectaresbc/arbutus_env.sh
git annex init
git annex enableremote arbutus-s3
```

Retrieve the representative HectaresBC ZIP payloads:

```bash
datalad get \
  raw/hectaresbc_2022_export/data_layers/adminunits_bcts.zip \
  raw/hectaresbc_2022_export/data_layers/climatedecade_ahm.zip \
  raw/hectaresbc_2022_export/data_layers/climatercp452050_tmaxsp.zip \
  raw/hectaresbc_2022_export/data_layers/water_distancetocoast.zip \
  raw/hectaresbc_2022_export/virtual_layers/virtualecocomm.alaskanmountainheatherdwarfshrublandharrimanellastellerianadwarfshrubland.425.zip \
  raw/hectaresbc_2022_export/virtual_layers/virtualspecies.bulltroutsalvelinusconfluentus.1135.zip
```

Validate checksums:

```bash
sha256sum \
  raw/hectaresbc_2022_export/data_layers/adminunits_bcts.zip \
  raw/hectaresbc_2022_export/data_layers/climatedecade_ahm.zip \
  raw/hectaresbc_2022_export/data_layers/climatercp452050_tmaxsp.zip \
  raw/hectaresbc_2022_export/data_layers/water_distancetocoast.zip \
  raw/hectaresbc_2022_export/virtual_layers/virtualecocomm.alaskanmountainheatherdwarfshrublandharrimanellastellerianadwarfshrubland.425.zip \
  raw/hectaresbc_2022_export/virtual_layers/virtualspecies.bulltroutsalvelinusconfluentus.1135.zip
```

Expected hashes are recorded in:

```text
external/fresh-hectaresbc-data/metadata/validation/representative_payloads.md
```

## Expected Submodule State

The main repo should store only a submodule gitlink:

```bash
git ls-files -s external/fresh-hectaresbc-data
```

Expected mode:

```text
160000
```

## Known Failure Modes

- `git-annex: not found`: ensure the git-annex binary is installed and on `PATH`.
- `access to 1 dataset sibling arbutus-s3 not auto-enabled`: run `git annex enableremote arbutus-s3` after sourcing credentials.
- S3 authentication or signature errors: confirm `~/.config/fresh-hectaresbc/arbutus_env.sh` exports the current Arbutus access key, secret key, region, and endpoint.
- Submodule path missing: run `git submodule update --init --recursive external/fresh-hectaresbc-data` from the main repo.
- Annexed file remains a symlink or reports no available content: confirm `arbutus-s3` is enabled and `git annex whereis <path>` lists the remote.

## Validation Result

Phase 4 validation retrieved all six representative ZIP payloads from `arbutus-s3` in a fresh clone, with checksum matches against `metadata/validation/representative_payloads.md` in the data submodule.
