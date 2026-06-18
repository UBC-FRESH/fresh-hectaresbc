# HectaresBC Data Repository Contract

## Purpose

Define the public contract for the future `UBC-FRESH/fresh-hectaresbc-data` DataLad/git-annex repository before moving, annexing, or linking large HectaresBC payloads.

This document completes `P4.1`.

## Repository Roles

### Main Repository

```text
UBC-FRESH/fresh-hectaresbc
```

Role:

- code;
- documentation;
- planning contracts;
- compact metadata;
- catalog schema and validation scripts;
- reproducible workflow definitions;
- Git submodule pointer to the data repository.

The main repository must not store raw HectaresBC ZIP payloads, extracted rasters, temporary validation payloads, credentials, or bulky generated logs.

### Data Repository

```text
UBC-FRESH/fresh-hectaresbc-data
```

Role:

- DataLad/git-annex dataset;
- raw HectaresBC payload ZIPs;
- root archive control/metadata files;
- compact metadata mirrored from the main repository when useful for data access;
- non-secret DataLad/git-annex metadata required for retrieval;
- public documentation for clone, `datalad get`, and validation workflows.

### Object Storage Remote

The first planned storage remote is a DataLad/git-annex S3 special remote backed by a new DRAC Arbutus object-storage bucket.

The special remote may store annexed object content. It must not store credentials in committed repository configuration.

User-local credential file:

```text
~/.config/fresh-hectaresbc/arbutus_env.sh
```

Rules:

- do not commit credentials;
- do not print credentials in terminal output intended for issue/PR logs;
- source user-local credentials only when configuring or operating the remote;
- commit only non-secret special-remote metadata.

### Local `tmp/` Archive

Local source path:

```text
tmp/shared-data/hectaresbc
```

Role:

- ignored local import source;
- read-only source material for validation and DataLad import;
- not part of the public repository state.

## Intended Submodule Path

This repository links the data repository at:

```text
external/fresh-hectaresbc-data
```

Only the submodule pointer and public documentation belong in this repository. Annexed payloads belong in `fresh-hectaresbc-data`.

Bootstrap commands:

```bash
git submodule update --init --recursive external/fresh-hectaresbc-data
```

On-demand retrieval happens inside the submodule:

```bash
export PATH="$HOME/.local/bin:$PATH"
source ~/.config/fresh-hectaresbc/arbutus_env.sh
cd external/fresh-hectaresbc-data
git annex enableremote arbutus-s3
datalad get metadata/validation/arbutus_s3_smoke_test.bin
```

## Data Repository Layout

Initial target layout:

```text
fresh-hectaresbc-data/
  README.md
  raw/
    hectaresbc_2022_export/
      data_layers/
      virtual_layers/
      data_layers.txt
      virtual_layers.txt
      virtual_layers_metadata_all.csv
  metadata/
    archive_inventory/
    recovered_catalog/
    validation/
    catalog_schema/
  derived/
    README.md
```

Raw payload layout should preserve the rescued archive below `raw/hectaresbc_2022_export/`.

Do not include:

- `hectaresbc_download_layers.ipynb`;
- `.ipynb_checkpoints/`;
- local secret files;
- local temporary validation payloads.

## Tracking Rules

### Annexed Payloads

Annex with git-annex/DataLad:

- raw ZIP payloads under `raw/hectaresbc_2022_export/data_layers/`;
- raw ZIP payloads under `raw/hectaresbc_2022_export/virtual_layers/`;
- any future large derived products.

### Plain Git Metadata

Track as normal Git files where small:

- `README.md`;
- DataLad configuration that is safe to publish;
- root control files if they remain compact:
  - `data_layers.txt`;
  - `virtual_layers.txt`;
  - `virtual_layers_metadata_all.csv`;
- compact metadata copied or mirrored from this main repository.

### Metadata To Mirror From Main Repo

Candidate metadata for `fresh-hectaresbc-data/metadata/`:

- `metadata/archive_inventory/archive_summary.json`;
- `metadata/archive_inventory/zip_manifest.csv`;
- `metadata/archive_inventory/root_metadata_files.md`;
- `metadata/archive_inventory/zip_payload_families.md`;
- `metadata/archive_inventory/data_repo_layout_recommendation.md`;
- `metadata/recovered_catalog/README.md`;
- `metadata/recovered_catalog/virtual_layer_records.csv`;
- `metadata/recovered_catalog/virtual_layer_recovery_summary.md`;
- `metadata/recovered_catalog/data_layer_records.csv`;
- `metadata/recovered_catalog/data_layer_recovery_summary.md`;
- `metadata/recovered_catalog/recovery_summary.md`;
- `metadata/validation/README.md`;
- `metadata/validation/recovered_catalog_validation.md`;
- `metadata/validation/representative_payload_validation.md`;
- `metadata/catalog_schema/dataset_identity_model.md`;
- `metadata/catalog_schema/naming_and_provenance_conventions.md`.

Main-repo scripts should remain authoritative workflow code unless Phase 4 explicitly decides to copy validation tooling into the data repository.

## Representative Retrieval Payloads

Use these six ZIPs for first cold-clone and annex retrieval validation:

| Purpose | Source ZIP |
| --- | --- |
| typical data layer with category metadata | `data_layers/adminunits_bcts.zip` |
| typical data layer with value metadata | `data_layers/climatedecade_ahm.zip` |
| data layer with nested ZIP member | `data_layers/climatercp452050_tmaxsp.zip` |
| large data-layer ZIP | `data_layers/water_distancetocoast.zip` |
| typical virtual layer | `virtual_layers/virtualecocomm.alaskanmountainheatherdwarfshrublandharrimanellastellerianadwarfshrubland.425.zip` |
| large virtual layer | `virtual_layers/virtualspecies.bulltroutsalvelinusconfluentus.1135.zip` |

These cover known payload families and edge cases without requiring full archive retrieval.

## Validation Contract

Before Phase 4 closes:

1. `fresh-hectaresbc-data` must be initialized as a DataLad dataset.
2. Raw ZIP payloads must be annexed rather than committed directly to Git.
3. The Arbutus S3 special remote must be configured without committed secrets.
4. Representative payloads must be uploaded to and retrievable from the special remote.
5. This main repository must link the data repository as a submodule under `external/fresh-hectaresbc-data`.
6. A clean clone must be able to initialize the submodule and retrieve representative annexed payloads with documented commands.

## Deferred Decisions

- Whether anonymous read access is enabled for the object store.
- Whether UBC ARC Chinook becomes a mirror or replacement storage backend.
- Whether future normalized or derived data products live in the same DataLad dataset.
- Whether validation scripts are copied into the data repository or run only from the main repository.
