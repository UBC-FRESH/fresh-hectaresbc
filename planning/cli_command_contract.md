# Typer CLI Command Contract

## Purpose

Define the initial Phase 7 command-line contract before CLI implementation begins.

This completes P7.1. It is intentionally concrete: later Phase 7 tasks should implement these command names, option names, output rules, exit codes, and safety rules instead of reopening broad CLI design.

## Principles

- The CLI is a thin wrapper over `fresh_hectaresbc.HectaresBC`.
- Command handlers must not reimplement catalog loading, search, resolution, status, diagnostics, or fetch logic.
- Default tests must not require Arbutus credentials, network retrieval, or bulk data downloads.
- Real retrieval is allowed only through the core API fetch path and only for the explicit dataset requested.
- Output must not include secret-bearing environment values, credential names, or local credential file contents.

## Command Tree

Initial executable:

```text
fresh-hectaresbc
```

Initial commands:

```text
fresh-hectaresbc catalog search QUERY
fresh-hectaresbc catalog show DATASET_ID
fresh-hectaresbc catalog list
fresh-hectaresbc data path DATASET_ID
fresh-hectaresbc data status DATASET_ID
fresh-hectaresbc diagnostics
fresh-hectaresbc fetch DATASET_ID
```

Deferred commands:

```text
fresh-hectaresbc cache drop
fresh-hectaresbc fetch-many
fresh-hectaresbc catalog schema
fresh-hectaresbc configure
```

These deferred commands should not be added in Phase 7 unless a later child issue explicitly changes scope.

## Shared Options

Every command that instantiates `HectaresBC` should support:

| Option | Meaning |
| --- | --- |
| `--metadata-root PATH` | Override recovered catalog metadata root. |
| `--data-repo-path PATH` | Override linked data repository path. |

Commands with structured output should support:

| Option | Values | Default |
| --- | --- | --- |
| `--format` | `table`, `text`, `json` as applicable | command-specific |

Output format rules:

- list-like commands default to `table`;
- single-record/status/fetch commands default to `text`;
- JSON output must be stable enough for tests and downstream scripts;
- filesystem paths in JSON must be strings;
- booleans and integers in JSON must remain typed values.

## Catalog Commands

### `catalog search QUERY`

Core API call:

```python
HectaresBC(...).search(query, family=family, limit=limit)
```

Options:

| Option | Meaning | Default |
| --- | --- | --- |
| `--family [data_layer|virtual_layer]` | Restrict search to one source family. | none |
| `--limit INTEGER` | Maximum results to display. | `20` |
| `--format [table|json]` | Output format. | `table` |

Default table columns:

```text
dataset_id  source_family  title_candidate  source_zip_path
```

Exit behavior:

- `0`: query is valid, including zero matches;
- `2`: invalid or empty query.

### `catalog show DATASET_ID`

Core API call:

```python
HectaresBC(...).get(dataset_id)
```

Options:

| Option | Meaning | Default |
| --- | --- | --- |
| `--format [text|json]` | Output format. | `text` |

Default text fields:

```text
dataset_id
source_family
title_candidate
source_zip_path
source_filename
manifest_size_bytes
verification_status
known_gaps
uncertainty_notes
```

JSON output should serialize `DatasetRecord.to_dict()`.

Exit behavior:

- `0`: record found;
- `3`: dataset ID not found.

### `catalog list`

Core API call:

```python
HectaresBC(...).filter(...)
```

Options:

| Option | Meaning | Default |
| --- | --- | --- |
| `--family [data_layer|virtual_layer]` | Filter by source family. | none |
| `--dataset-id-prefix TEXT` | Filter by dataset ID prefix. | none |
| `--source-path-prefix TEXT` | Filter by source ZIP path prefix. | none |
| `--name-prefix TEXT` | Filter by source/display name prefix. | none |
| `--virtual-layer-id TEXT` | Filter by recovered virtual-layer ID. | none |
| `--limit INTEGER` | Maximum rows to display. | `50` |
| `--format [table|json]` | Output format. | `table` |

Default table columns match `catalog search`.

Exit behavior:

- `0`: filters are valid, including zero matches;
- `2`: invalid filter values.

## Data Path And Status Commands

### `data path DATASET_ID`

Core API call:

```python
HectaresBC(...).resolve(dataset_id)
```

Options:

| Option | Meaning | Default |
| --- | --- | --- |
| `--format [text|json]` | Output format. | `text` |

Default text output should include:

```text
dataset_id
source_zip_path
raw_relative_path
absolute_path
```

Exit behavior:

- `0`: dataset resolved;
- `3`: dataset ID not found.

### `data status DATASET_ID`

Core API call:

```python
HectaresBC(...).content_status(dataset_id)
```

Options:

| Option | Meaning | Default |
| --- | --- | --- |
| `--format [text|json]` | Output format. | `text` |

Default text output should include:

```text
dataset_id
status
local_path
submodule_initialized
path_metadata_exists
content_present
message
```

Exit behavior:

- `0`: status is `present` or `missing_content`;
- `3`: dataset ID not found;
- `4`: status is `missing_submodule` or `missing_path`.

`missing_content` is not an error because annex placeholders are expected in cold clones.

## Diagnostics And Fetch Commands

### `diagnostics`

Core API call:

```python
HectaresBC(...).diagnostics()
```

Options:

| Option | Meaning | Default |
| --- | --- | --- |
| `--format [table|json]` | Output format. | `table` |

Default table columns:

```text
check  status  message
```

Exit behavior:

- `0`: all checks are `ok`, or only credential-dependent checks are not ready;
- `4`: one or more checks report `backend_unavailable` or `not_initialized`;
- `5`: one or more checks report `backend_error`.

Credential-dependent readiness should be visible but should not fail diagnostics by default unless it prevents the inspected operation.

### `fetch DATASET_ID`

Core API call:

```python
HectaresBC(...).fetch(dataset_id, dry_run=dry_run, force=force)
```

Options:

| Option | Meaning | Default |
| --- | --- | --- |
| `--dry-run` | Plan retrieval without running `datalad get`. | `False` |
| `--force` | Attempt retrieval even if content is already present. | `False` |
| `--format [text|json]` | Output format. | `text` |

Default text output should include:

```text
dataset_id
status
backend
local_path
message
command_summary
verification_performed
```

Exit behavior:

- `0`: status is `ok`, `already_present`, or `dry_run`;
- `3`: dataset ID not found;
- `4`: status is `not_initialized`, `backend_unavailable`, or `credentials_required`;
- `5`: status is `backend_error` or `validation_error`;
- `6`: status is `unsupported`.

## Exit Codes

| Code | Meaning |
| --- | --- |
| `0` | Success, including valid empty result lists and dry-run fetch plans. |
| `1` | Unexpected application error. |
| `2` | CLI usage error, invalid option, invalid query, or invalid filter. |
| `3` | Dataset ID not found. |
| `4` | Local setup or backend readiness problem. |
| `5` | Backend command or validation failure. |
| `6` | Unsupported operation. |

Typer may use code `2` for parser errors; command handlers should use the same code for semantic validation failures such as empty search queries.

## Secret-Safety Rules

CLI output must not include:

- AWS or Arbutus credential values;
- secret-bearing environment variable names;
- local credential file contents;
- shell fragments that source credential files;
- full inherited environment dumps.

Allowed output:

- backend name such as `datalad`;
- special remote name such as `arbutus-s3`;
- non-secret command summaries such as `datalad get raw/hectaresbc_2022_export/data_layers/adminunits_bcts.zip`;
- remediation that says credentials may be required, without naming secret variables or printing values.

CLI tests should include assertions that diagnostics and fetch output do not contain common AWS/Arbutus secret field names.

## Minimum Test Matrix

P7.2 scaffold tests:

- import CLI app;
- render top-level `--help`;
- render subcommand help;
- execute through Typer `CliRunner` without credentials.

P7.3 catalog tests:

- `catalog search "bull trout" --limit 1`;
- `catalog show dl_adminunits_bcts`;
- `catalog list --family virtual_layer --limit 2`;
- JSON output parses;
- missing dataset exits with code `3`.

P7.4 path/status tests:

- `data path dl_adminunits_bcts`;
- `data status dl_adminunits_bcts`;
- missing submodule simulated with `--data-repo-path`;
- missing dataset exits with code `3`;
- JSON output parses.

P7.5 diagnostics/fetch tests:

- `diagnostics`;
- `diagnostics --format json`;
- `fetch dl_adminunits_bcts --dry-run`;
- missing submodule fetch exits with code `4`;
- diagnostics/fetch output is secret-safe;
- default tests do not run non-dry-run network retrieval.

P7.6 closeout tests:

- editable install;
- `fresh-hectaresbc --help`;
- full pytest suite;
- representative CLI smoke commands recorded in PR or issue comments;
- issue checklist audit clean before parent closeout.
