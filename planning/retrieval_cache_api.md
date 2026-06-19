# Retrieval And Cache API Contract

## Purpose

Define the Phase 6 retrieval and cache API shape for the future `fresh-hectaresbc` Python access library.

This completes P6.3. It builds on:

- `planning/core_access_library_architecture.md`;
- `planning/catalog_query_api.md`;
- the Phase 5 DataLad/git-annex publication and retrieval validation.

Backend adapter details are defined separately in `planning/backend_abstraction.md`.

The API should let callers request HectaresBC datasets by catalog identity and receive structured retrieval/cache results. Normal users should not need to know DataLad/git-annex command syntax.

## Retrieval Model

The first retrieval target is the raw ZIP payload for a catalog record.

Resolution path:

```text
dataset_id
  -> catalog record source_zip_path
  -> external/fresh-hectaresbc-data/raw/hectaresbc_2022_export/<source_zip_path>
  -> local annex content in the data submodule worktree
```

The data submodule worktree is the first cache. If a ZIP has been retrieved by git-annex/DataLad, its local filesystem path is the cache hit.

No separate package cache should be introduced in Phase 6 unless a later task proves that source-checkout and installed-package workflows cannot share this model.

## Public API Direction

Suggested facade methods:

```python
hbc.fetch("dl_adminunits_bcts")
hbc.fetch_many(["dl_adminunits_bcts", "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135"])
hbc.local_path("dl_adminunits_bcts")
hbc.content_status("dl_adminunits_bcts")
hbc.drop("dl_adminunits_bcts")
```

Equivalent lower-level service:

```python
retriever.fetch(dataset_ref)
retriever.fetch_many(dataset_refs)
retriever.resolve(dataset_ref)
retriever.content_status(dataset_ref)
retriever.drop(dataset_ref)
```

`drop` is optional for the first implementation. If implemented, it must be conservative and clearly documented because it removes local content while preserving annex metadata.

## Dataset Resolution

`resolve(dataset)` should:

- accept `dataset_id`, dataset reference, or dataset detail;
- use the catalog for `dataset_id` inputs;
- map `source_zip_path` into the data repository raw prefix;
- return a structured resolved path object;
- not fetch content;
- report whether the submodule path exists and whether the expected annex path exists.

Suggested resolved path fields:

| Field | Meaning |
| --- | --- |
| `dataset_id` | Catalog dataset ID. |
| `source_zip_path` | Raw source path from recovered catalog. |
| `data_repo_path` | Filesystem path to the data repository. |
| `raw_relative_path` | Path under `raw/hectaresbc_2022_export/`. |
| `absolute_path` | Filesystem path to the annexed file in the worktree. |
| `submodule_initialized` | Whether the data repo checkout exists. |
| `annex_path_exists` | Whether the expected path exists in the worktree. |
| `content_present` | Whether file content is locally present, when known. |

## Fetch Semantics

`fetch(dataset, *, backend=None, force=False, dry_run=False)` should:

- resolve the dataset through the catalog;
- check local content status;
- return immediately with `already_present` when content is already available and `force=False`;
- call the selected backend adapter only when content is missing and `dry_run=False`;
- return a structured result with local path, status, backend used, and diagnostics;
- never print credentials or secret-bearing environment values.

`fetch_many(datasets, ...)` should:

- preserve input order in results;
- continue after per-dataset failures by default;
- include aggregate counts for `ok`, `already_present`, and failures;
- optionally support `stop_on_error=True`.

## Cache Status Semantics

`content_status(dataset)` should distinguish:

- catalog record not found;
- data submodule missing;
- expected annex path missing;
- annex symlink exists but content is not present;
- local content present;
- backend state unknown because git-annex/DataLad is unavailable.

The API should not treat a symlink path as equivalent to local content unless the backend confirms content availability or a normal file is present.

Suggested status values:

- `present`;
- `missing_content`;
- `missing_path`;
- `missing_submodule`;
- `unknown`;
- `error`.

## Fetch Result Categories

Fetch results should use structured categories:

- `ok`: content was retrieved successfully;
- `already_present`: content was already local;
- `dry_run`: operation was planned but not executed;
- `dataset_not_found`: catalog lookup failed;
- `not_initialized`: data submodule is missing or not initialized;
- `backend_unavailable`: required backend tools are unavailable;
- `credentials_required`: backend needs credentials that are absent or not enabled;
- `backend_error`: backend command failed;
- `validation_error`: retrieved content failed a local integrity check;
- `unsupported`: requested operation is not supported by the configured backend.

These categories should be stable enough for CLI exit-code mapping and future web API responses.

## Credentials And Environment

Catalog and path-resolution operations must not require credentials.

Retrieval may require credentials while `arbutus-s3` reads are credential-gated. The core API should:

- allow callers to pass an explicit backend configuration;
- allow a local development environment file path such as `~/.config/fresh-hectaresbc/arbutus_env.sh`;
- avoid sourcing environment files implicitly unless the user or caller opts in;
- never return, log, or print credential values.

For CLI ergonomics later, the CLI can choose to auto-load the conventional environment file after warning/documenting the behavior. The core library should keep that decision explicit.

## Integrity Checks

After retrieval, the first backend can rely on git-annex key verification. The API should preserve space for explicit verification results:

- backend-reported checksum status;
- expected annex key or digest when available;
- local file size;
- manifest size;
- mismatch diagnostics.

The first implementation does not need to compute SHA-256 manually for every fetch if git-annex already verifies content, but it should expose whether verification was performed by the backend.

## Drop Semantics

`drop(dataset)` is optional in the first implementation.

If defined, it should:

- remove local content only through a backend adapter;
- preserve annex metadata;
- refuse to operate on paths outside the resolved data repository raw prefix;
- return structured results;
- make it clear that remote availability must remain intact.

The CLI should not expose broad recursive drop behavior until the result model and safeguards are tested.

## User-Facing Examples

Catalog lookup plus fetch:

```python
hbc = HectaresBC()
record = hbc.catalog.get("dl_adminunits_bcts")
result = hbc.fetch(record.dataset_id)
if result.status in {"ok", "already_present"}:
    print(result.local_path)
```

Dry run:

```python
plan = hbc.fetch("vl_virtualspecies_bulltroutsalvelinusconfluentus_1135", dry_run=True)
assert plan.status == "dry_run"
```

Status without credentials:

```python
status = hbc.content_status("dl_adminunits_bcts")
```

## Verification Expectations

Future implementation should include checks equivalent to:

```text
resolve("dl_adminunits_bcts") -> raw path data_layers/adminunits_bcts.zip
resolve("vl_virtualspecies_bulltroutsalvelinusconfluentus_1135") -> raw path virtual_layers/virtualspecies.bulltroutsalvelinusconfluentus.1135.zip
content_status(...) does not require Arbutus credentials
missing submodule -> status missing_submodule or not_initialized
missing dataset_id -> dataset_not_found
dry_run fetch -> no content retrieval attempted
fetch small validated sample with credentials -> ok or already_present
fetch result never includes secret-bearing environment values
```

The default verification path should avoid full archive downloads.

## Deferred Decisions

- Whether installed-package workflows use a cloned data repository, a user cache directory, or direct object-store access.
- Whether anonymous public object-store reads will become the default backend.
- Whether the API should support retrieving extracted ZIP members directly.
- Whether checksums should be recomputed by the library or delegated to backend adapters.
- Whether cache eviction/drop should be part of the first CLI release.
- Whether future AOI clipping workflows fetch raw ZIPs first or operate through service-side derived products.
