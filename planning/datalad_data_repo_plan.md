# DataLad Data Repository Plan

## Purpose

Plan the future large-data repository architecture for the HectaresBC archive.

The HectaresBC payload is expected to include many large geospatial files. The main `fresh-hectaresbc` repository must stay lightweight and public, so the data payload should not be committed here with plain Git/GitHub.

## Planned Repository Split

Main repository:

```text
UBC-FRESH/fresh-hectaresbc
```

Role:

- code
- documentation
- planning notes
- compact inventories
- metadata schemas
- reproducible workflow definitions
- submodule pointer to the data repository

Data repository:

```text
UBC-FRESH/fresh-hectaresbc-data
```

Role:

- DataLad/git-annex dataset
- large HectaresBC data payloads
- data-repository metadata required for annex retrieval
- storage-remote configuration that does not expose credentials

Expected future submodule path:

```text
external/fresh-hectaresbc-data
```

## Reference Pattern

Use the FEMIC `external/` pattern as the reference design:

- a separate public data repository is configured as a DataLad dataset;
- the main repo links that dataset as a Git submodule;
- large payloads are annexed and stored in an object-storage remote;
- the main repo carries only the submodule pointer and instructions;
- cold-clone validation proves that the data can be retrieved from a fresh checkout.

## Planned Work

1. Define the data repository contract.
2. Initialize `UBC-FRESH/fresh-hectaresbc-data` as a DataLad/git-annex dataset.
3. Choose and configure the storage remote for annexed payloads.
4. Move or mirror validated HectaresBC payloads into the data repo under `raw/hectaresbc_2022_export/`, preserving the rescued data payload layout below that prefix.
5. Add compact metadata/manifests under `metadata/archive_inventory/`.
6. Exclude disposable local acquisition tooling such as `hectaresbc_download_layers.ipynb` and `.ipynb_checkpoints/`.
7. Add the data repo as a submodule under `external/fresh-hectaresbc-data`.
8. Document clone, submodule initialization, and `datalad get` workflows.
9. Validate cold-clone retrieval of representative payloads.

## Open Questions

- What object storage remote should hold annexed payloads?
- Which compact metadata should live in the main repo versus the data repo?
- Should the DataLad dataset preserve the rescued archive layout exactly, or introduce a cleaned canonical layout with explicit provenance mappings?
- Which files should use `text2git`-style tracking instead of annexing?
- What minimum representative payload should be used for cold-clone validation?

## Current Layout Recommendation

Phase 1 recommends a hybrid layout:

```text
fresh-hectaresbc-data/
  raw/
    hectaresbc_2022_export/
      data_layers/
      virtual_layers/
      data_layers.txt
      virtual_layers.txt
      virtual_layers_metadata_all.csv
  metadata/
    archive_inventory/
  derived/
```

The raw data payload and root control/metadata files should be preserved below `raw/hectaresbc_2022_export/`. Canonical or derived layouts should be introduced later only with explicit provenance mappings.

Do not include `hectaresbc_download_layers.ipynb` or `.ipynb_checkpoints/` in the future public data repository. The notebook was disposable 2022 acquisition tooling for a server that is no longer online, not a reproducible distribution artifact.

See `metadata/archive_inventory/data_repo_layout_recommendation.md`.

## Current Status

- `UBC-FRESH/fresh-hectaresbc-data` exists as a public GitHub repository with default branch `main`.
- The data repo has been initialized as a DataLad/git-annex dataset, with `main` and `git-annex` branches pushed to GitHub.
- The initial data-repo scaffold includes `raw/hectaresbc_2022_export/`, `metadata/`, `derived/`, `docs/annex_policy.md`, and `.gitattributes` rules for plain-Git metadata versus annexed ZIP and large non-text files.
- The data repo has an Arbutus-backed S3 special remote named `arbutus-s3`, pointing to bucket `fresh-hectaresbc-data` with `embedcreds=no`.
- Clean-clone retrieval of `metadata/validation/arbutus_s3_smoke_test.bin` from `arbutus-s3` has been validated with DataLad.
- The main repo links the data repo as a Git submodule at `external/fresh-hectaresbc-data`.
- The six representative HectaresBC ZIP payloads are annexed in the data repo, uploaded to `arbutus-s3`, and validated from a fresh main-repo clone.
- Phase 1 archive reconnaissance produced compact inventory outputs and a layout recommendation.
- Phase 4 storage planning now expects a DataLad/git-annex S3 special remote backed by a new Arbutus object-storage bucket, with user-local credentials kept outside the repo under `~/.config/fresh-hectaresbc/`.
- Phase 3 validation identified six representative ZIP payloads for early cold-clone and annex retrieval checks. See `planning/phase3_ingestion_summary.md`.

## Phase 3 Handoff Inputs

Phase 4 should copy or mirror compact archive inventory, recovered catalog, schema, and validation metadata from the main repo into `fresh-hectaresbc-data` as plain Git-tracked metadata where useful.

Recommended representative payloads for first retrieval validation:

- `data_layers/adminunits_bcts.zip`
- `data_layers/climatedecade_ahm.zip`
- `data_layers/climatercp452050_tmaxsp.zip`
- `data_layers/water_distancetocoast.zip`
- `virtual_layers/virtualecocomm.alaskanmountainheatherdwarfshrublandharrimanellastellerianadwarfshrubland.425.zip`
- `virtual_layers/virtualspecies.bulltroutsalvelinusconfluentus.1135.zip`

## Arbutus Credential And Special-Remote Pattern

The planned Arbutus S3 special remote must use user-local credentials, following the FEMIC pattern.

Credentials should live outside the repository:

```text
~/.config/fresh-hectaresbc/arbutus_env.sh
```

Optional package-specific DataLad environment setup may live at:

```text
~/.config/fresh-hectaresbc/datalad-env.sh
```

The repository should document the template and workflow, but never commit credentials or secret-bearing generated files. See `planning/arbutus_s3_special_remote_plan.md`.
