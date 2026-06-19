# Backend Abstraction Contract

## Purpose

Define the Phase 6 backend abstraction for the future `fresh-hectaresbc` Python access library.

This completes P6.4. It defines how retrieval and diagnostics should interact with DataLad/git-annex now, while leaving room for direct S3-compatible object-store backends later.

## Design Principle

Backends are implementation mechanisms. User-facing API, CLI, and web workflows should speak in catalog records, dataset IDs, local paths, retrieval results, and diagnostics.

Do not expose DataLad/git-annex commands as the public API.

## Backend Interface Shape

The first implementation should define a small adapter interface with methods equivalent to:

```python
class BackendAdapter:
    name: str

    def diagnostics(self) -> BackendDiagnostics: ...
    def content_status(self, resolved_path: ResolvedDatasetPath) -> ContentStatus: ...
    def fetch(self, resolved_path: ResolvedDatasetPath, *, force: bool = False) -> FetchResult: ...
    def drop(self, resolved_path: ResolvedDatasetPath) -> FetchResult: ...
```

`drop` may raise or return `unsupported` until the project is ready to expose cache eviction.

The interface should accept resolved dataset paths, not raw `dataset_id` strings. Catalog lookup and path resolution belong above the backend layer.

## DataLad/Git-Annex Backend

Initial backend name:

```text
datalad
```

Initial data repository path:

```text
external/fresh-hectaresbc-data
```

Initial special remote:

```text
arbutus-s3
```

The DataLad backend may use command-line tools before a Python API dependency is justified.

Allowed command responsibilities:

- check `git-annex` availability;
- check `datalad` availability;
- inspect whether the data repository exists and is a Git repository;
- inspect whether `arbutus-s3` is configured;
- inspect whether a resolved annex file has local content;
- retrieve a resolved path;
- optionally drop a resolved path.

Command use should be contained in the backend adapter. Other layers should receive structured results only.

## Command Execution Rules

Command execution must:

- run with an explicit working directory;
- use argument lists rather than shell-string interpolation where possible;
- capture stdout/stderr into structured diagnostics;
- redact or avoid returning environment values;
- set clear timeout behavior when implementation reaches code;
- distinguish command-not-found from command-failed;
- avoid recursive/broad operations unless requested by a higher-level API contract.

The first implementation should not source credential files inside shell strings. If environment loading is supported, it should be explicit and should not echo secret-bearing values.

## Diagnostics Contract

`diagnostics()` should be non-mutating by default.

Suggested diagnostic checks:

| Check | Success Meaning | Failure Category |
| --- | --- | --- |
| `git_annex_available` | `git-annex` executable is on `PATH`. | `backend_unavailable` |
| `datalad_available` | `datalad` executable or import is available. | `backend_unavailable` |
| `data_repo_exists` | configured data repo path exists. | `not_initialized` |
| `data_repo_is_git_repo` | data repo path is a Git checkout. | `not_initialized` |
| `special_remote_configured` | `arbutus-s3` is known to git-annex. | `credentials_required` or `backend_unavailable` |
| `sample_whereis_available` | optional sample path reports backend availability. | `backend_error` |

Diagnostics should report:

- status;
- backend name;
- check name;
- brief message;
- non-secret command summary;
- remediation hint where useful.

Diagnostics should not report:

- access keys;
- secret keys;
- full inherited environment;
- command transcripts containing credential values.

## DataLad Backend Operations

### `content_status`

Should distinguish:

- path not present in worktree;
- path present but annex content missing;
- path present with local content;
- backend cannot determine state.

Possible implementation signals:

- filesystem path exists;
- path is symlink or annex pointer;
- `git annex find --in here <path>`;
- `git annex whereis <path>`.

### `fetch`

Should retrieve only the resolved path or explicit list of paths.

Possible command:

```bash
datalad get <resolved-raw-path>
```

or, if DataLad proves fragile for the installed package case:

```bash
git annex get <resolved-raw-path>
```

The backend result should not expose that choice to callers except as backend diagnostics.

### `drop`

If implemented:

```bash
git annex drop <resolved-raw-path>
```

Before allowing this, the backend should confirm remote availability and restrict operations to the configured raw data prefix.

## S3-Compatible Object Store Direction

Direct object-store access is a future backend direction, not a Phase 6 implementation requirement.

Potential backend names:

```text
s3
arbutus-s3-direct
chinook-s3-direct
```

A direct object-store backend would need:

- object key mapping from annex keys or manifest paths;
- endpoint/region/bucket configuration;
- authentication or anonymous-read policy;
- checksum validation strategy;
- local cache path policy;
- parity checks against DataLad/git-annex availability.

Do not implement direct S3 reads until the object key contract and public-read/authentication model are explicit.

## Backend Selection

Initial selection rule:

1. Use an explicitly configured backend if supplied.
2. Otherwise use the DataLad backend when running from a source checkout with initialized submodule.
3. Otherwise return structured diagnostics explaining required setup.

Do not silently fall back to a backend with weaker validation behavior.

## Credential Boundaries

Credential-dependent operations are backend concerns, but credential policy is a core safety rule.

Rules:

- catalog operations never require credentials;
- path resolution never requires credentials;
- DataLad diagnostics can run partially without credentials;
- retrieval may require credentials while `arbutus-s3` remains credential-gated;
- credentials must be loaded only by explicit caller choice;
- credential values must not be included in result objects, exceptions, logs, issue comments, or PR text.

Expected local development credential file:

```text
~/.config/fresh-hectaresbc/arbutus_env.sh
```

The backend contract should allow the CLI to provide ergonomic wrapping later without making implicit secret loading part of the core library.

## Result Types

Backend methods should return structured model objects compatible with `planning/retrieval_cache_api.md`.

Minimum shared fields:

- `backend`;
- `status`;
- `dataset_id`;
- `path`;
- `message`;
- `diagnostics`;
- `command_summary`;
- `verification_performed`;
- `secret_safe`.

`secret_safe` should default to `true` only when the result has been constructed from intentionally non-secret fields.

## Verification Expectations

Future implementation should include backend tests/checks equivalent to:

```text
DataLad backend diagnostics reports git-annex available when on PATH
DataLad backend diagnostics returns backend_unavailable when git-annex is absent from PATH
missing data repo path returns not_initialized
configured data repo path resolves external/fresh-hectaresbc-data
content_status on known annexed ZIP returns present or missing_content, not a raw symlink-only success
fetch dry-run path does not call backend retrieval
fetch with credentials retrieves or reports already_present for a small representative ZIP
backend result objects do not contain AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY values
```

The test suite should be able to run most backend diagnostics without credentials. Credentialed retrieval checks should be opt-in.

## Deferred Decisions

- Whether to use DataLad's Python API, command-line DataLad, command-line git-annex, or a hybrid.
- Whether anonymous Arbutus reads will become available.
- Whether Chinook becomes a mirror, replacement, or additional backend.
- Whether direct S3 object keys should be derived from git-annex keys or published through a separate manifest.
- Whether retrieval should support extracted ZIP members, generated previews, or derived products.
- Whether the installed package should auto-clone the data repository or require an existing checkout.
