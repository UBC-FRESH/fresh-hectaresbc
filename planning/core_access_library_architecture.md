# Core Access Library Architecture

## Purpose

Define the Phase 6 architecture contract for the first `fresh-hectaresbc` Python access library.

This completes P6.1. It does not implement the library yet. It defines the shared concepts, boundaries, and invariants that P6.2 through P6.4 should use when specifying catalog search, retrieval/cache behavior, and backend adapters.

## Starting Point

Phase 5 changed the project from an archive-recovery exercise into a published-data access problem:

- the main repository links the data repository at `external/fresh-hectaresbc-data`;
- the data repository preserves raw ZIP payloads under `raw/hectaresbc_2022_export/`;
- all 2,183 expected raw ZIP payloads are annexed and available from `arbutus-s3`;
- compact recovered catalog metadata is available in both this repository and the data repository;
- retrieval has been validated from a cold clone using DataLad/git-annex.

The core library should build on that published state. It should not rely on the private local source archive under `tmp/shared-data/hectaresbc`.

## Design Goal

Provide one shared Python layer for:

- catalog discovery;
- metadata lookup;
- dataset resolution;
- retrieval/cache orchestration;
- backend diagnostics.

The Typer CLI and any future browser service should call this shared layer instead of implementing their own catalog or retrieval logic.

## Non-Goals For Phase 6

Phase 6 should not:

- build the Typer CLI;
- build the browser app;
- publish the package to PyPI;
- normalize or rename raw payloads;
- unpack all ZIPs;
- extract rasters into a derived data product;
- implement AOI clipping, tiling, or queued download jobs;
- require users to understand DataLad/git-annex internals;
- assume anonymous object-store reads exist until that is validated.

## Source Inputs

The first library contract may read these compact tracked files:

```text
metadata/recovered_catalog/data_layer_records.csv
metadata/recovered_catalog/virtual_layer_records.csv
metadata/archive_inventory/zip_manifest.csv
metadata/catalog_schema/dataset_identity_model.md
metadata/catalog_schema/naming_and_provenance_conventions.md
```

When running with the data submodule available, equivalent mirrored metadata may be read from:

```text
external/fresh-hectaresbc-data/metadata/
```

Raw payload resolution should target:

```text
external/fresh-hectaresbc-data/raw/hectaresbc_2022_export/
```

## Core Concepts

### Catalog

The catalog is the in-memory view of recovered metadata records.

Responsibilities:

- load data-layer and virtual-layer records;
- expose stable lookup by `dataset_id`;
- expose family-aware iteration;
- preserve source-backed fields without silently rewriting them;
- carry provenance and uncertainty fields through public results.

Deferred:

- final storage format beyond current CSV inputs;
- full-text search index;
- curated public titles or slugs;
- schema migration framework.

### Dataset Reference

A dataset reference identifies one recovered raw payload record.

Minimum fields:

- `dataset_id`;
- `source_family`;
- `source_zip_path`;
- `source_filename`;
- `title_candidate`;
- `verification_status`;
- `manifest_size_bytes`;
- `known_gaps`;
- `uncertainty_notes`.

Rules:

- `dataset_id` remains provisional but is the first lookup key.
- `source_zip_path` remains the first payload resolution key.
- Raw source filenames and ZIP member paths are evidence and must not be normalized away.

### Dataset Detail

Dataset detail is the richer metadata view returned after lookup.

It should include the dataset reference fields plus:

- family-specific recovered fields;
- payload member paths;
- metadata source fields;
- provenance fields;
- metadata mismatch fields when present.

The first implementation may expose detail as a typed dataclass plus a raw mapping for fields not yet promoted into typed attributes.

### Resolver

The resolver maps a dataset reference to repository-relative and filesystem paths.

Responsibilities:

- locate the data repository submodule;
- map `source_zip_path` to `raw/hectaresbc_2022_export/<source_zip_path>`;
- report whether the annex file is present locally, missing locally, or unavailable because the data repo is not initialized;
- avoid fetching content unless explicitly asked.

### Retriever

The retriever requests local availability for one or more datasets.

Responsibilities:

- call backend adapters for content retrieval;
- return structured results for success, already-present, missing-submodule, missing-backend, auth failure, and backend command failure;
- avoid printing secrets;
- expose enough diagnostics for CLI and service callers.

The retriever should not expose DataLad command syntax as the user-facing API.

### Backend Adapter

A backend adapter encapsulates one data-access mechanism.

Initial backend:

- DataLad/git-annex using the linked data repository and the `arbutus-s3` special remote.

Potential later backends:

- direct S3-compatible object access if public URLs or signed URLs are made available;
- local filesystem mirror;
- alternate DataLad sibling such as Chinook if configured.

Adapters should be selected by capability and configuration, not by hard-coded project machine paths.

### Diagnostics

Diagnostics should explain backend readiness without mutating data by default.

Examples:

- data submodule exists;
- data submodule is initialized;
- `git-annex` is on `PATH`;
- DataLad is importable or command-available;
- `arbutus-s3` is configured;
- a sample annexed file reports remote availability;
- credential-dependent checks were skipped, passed, or failed.

## Proposed Package Shape

The first code scaffold should stay small:

```text
src/fresh_hectaresbc/
  __init__.py
  catalog.py
  models.py
  paths.py
  retrieval.py
  backends/
    __init__.py
    datalad.py
```

Suggested responsibilities:

| Module | Responsibility |
| --- | --- |
| `models.py` | dataclasses or typed records for dataset references, details, resolved paths, retrieval results, and diagnostics |
| `catalog.py` | load and query recovered catalog metadata |
| `paths.py` | find repository roots and resolve data-repo paths |
| `retrieval.py` | user-facing retrieval orchestration over backend adapters |
| `backends/datalad.py` | DataLad/git-annex command adapter and diagnostics |

This package shape is provisional. P6.2 through P6.4 may adjust it before implementation if the API contracts require a different split.

## Public API Direction

P6 should converge on a small public API like:

```python
from fresh_hectaresbc import HectaresBC

hbc = HectaresBC()
matches = hbc.search("caribou")
record = hbc.get("vl_virtualspecies_bulltroutsalvelinusconfluentus_1135")
result = hbc.fetch(record.dataset_id)
```

That example is illustrative, not final. P6.2 should define catalog methods. P6.3 should define retrieval/cache methods. P6.4 should define backend configuration and diagnostics.

P6.2 catalog query decisions are recorded in `planning/catalog_query_api.md`. P6.3 retrieval/cache decisions are recorded in `planning/retrieval_cache_api.md`. P6.4 backend abstraction decisions are recorded in `planning/backend_abstraction.md`.

## Configuration Direction

The library should work from a normal source checkout without global configuration when only catalog metadata is needed.

Retrieval may need configuration:

- data repository path;
- backend selection;
- whether credential-dependent checks are allowed;
- optional environment file path for local development workflows.

Default data repository path:

```text
external/fresh-hectaresbc-data
```

Default raw prefix inside the data repository:

```text
raw/hectaresbc_2022_export
```

Do not bake private absolute paths or secret-bearing environment values into code.

## Error And Result Model

Prefer structured result objects over unhandled subprocess output.

Minimum result categories:

- `ok`;
- `not_found`;
- `ambiguous`;
- `not_initialized`;
- `backend_unavailable`;
- `credentials_required`;
- `backend_error`;
- `validation_error`.

CLI commands can later render these into human-readable messages. Web services can convert them into API responses.

## Verification Expectations

P6.2 should verify catalog behavior against the tracked recovered catalog CSVs:

- 418 data-layer records load;
- 1,765 virtual-layer records load;
- `dataset_id` values are unique;
- lookups preserve `source_zip_path`.

P6.3 should verify retrieval contracts without requiring full data downloads:

- resolve representative dataset IDs to raw ZIP paths;
- detect initialized versus missing data submodule;
- optionally fetch a small sample only when credentials and backend are available.

P6.4 should verify backend diagnostics:

- `git-annex` missing from `PATH` yields a structured diagnostic;
- missing `arbutus-s3` remote yields a structured diagnostic;
- successful backend readiness does not print credential values.

## Open Questions For Later P6 Tasks

- Should the first catalog implementation read only main-repo metadata, data-repo metadata, or prefer one with fallback to the other?
- Should record detail expose raw CSV field names directly, or a curated subset plus an `extras` mapping?
- Should retrieval results return filesystem paths only, or include backend provenance and annex key information?
- How should cache location be represented if retrieval happens outside a source checkout in a future installed package?
- Do we need a lightweight generated catalog artifact before package distribution, or are CSV readers enough for the first release?
