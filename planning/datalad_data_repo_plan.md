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
4. Move or mirror validated HectaresBC payloads into the data repo under `raw/hectaresbc_2022_export/`, preserving the rescued export layout below that prefix.
5. Add compact metadata/manifests under `metadata/archive_inventory/`.
6. Add the data repo as a submodule under `external/fresh-hectaresbc-data`.
7. Document clone, submodule initialization, and `datalad get` workflows.
8. Validate cold-clone retrieval of representative payloads.

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
      hectaresbc_download_layers.ipynb
  metadata/
    archive_inventory/
  derived/
```

The raw export layout should be preserved exactly below `raw/hectaresbc_2022_export/`. Canonical or derived layouts should be introduced later only with explicit provenance mappings.

See `metadata/archive_inventory/data_repo_layout_recommendation.md`.

## Current Status

- `UBC-FRESH/fresh-hectaresbc-data` exists as an empty public GitHub repository.
- The data repo has not yet been initialized as a DataLad dataset.
- The main repo has not yet added an `external/` submodule.
- Phase 1 archive reconnaissance is active and has produced compact inventory outputs.
