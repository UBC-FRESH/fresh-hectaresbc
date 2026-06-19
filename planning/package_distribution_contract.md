# Package Distribution Contract

## Purpose

Define the Phase 8 package distribution rules before changing package data, build artifacts, or install smoke workflows.

This completes P8.1. It is a contract for the first locally buildable/installable `fresh-hectaresbc` package. It does not publish the package to PyPI.

## User Workflows

The package must support these local workflows:

```bash
python3 -m pip install fresh-hectaresbc
python3 -m pip install -e .
fresh-hectaresbc --help
```

The actual public PyPI release is deferred. During Phase 8, `pip install fresh-hectaresbc` means the package layout and metadata should be ready for that future workflow, while validation uses local wheel artifacts.

Installed users should be able to:

- import `fresh_hectaresbc`;
- instantiate `HectaresBC`;
- query the recovered catalog with Python API calls;
- run `fresh-hectaresbc` CLI catalog commands;
- inspect expected data paths and backend diagnostics;
- run dry-run fetch checks.

Default installed-package smoke tests must not require:

- Arbutus credentials;
- DataLad network retrieval;
- local annex content;
- the private source archive under `tmp/`;
- the main repository source checkout.

## Package Contents

The wheel may include:

- Python source under `src/fresh_hectaresbc/`;
- Typer CLI entrypoint metadata;
- compact public recovered catalog metadata needed for installed catalog lookup/search/filter behavior;
- small package metadata files required by Python packaging.

The wheel must not include:

- raw HectaresBC ZIP payloads;
- `tmp/`;
- local credential files;
- `.git/` or DataLad/git-annex storage;
- `external/fresh-hectaresbc-data` payload content;
- Python caches, build caches, or local virtual environments;
- private bootstrap notes.

## Compact Catalog Metadata

Installed catalog operations require these compact public metadata files:

```text
data_layer_records.csv
virtual_layer_records.csv
```

The package should include them under a package-internal resource path, proposed as:

```text
src/fresh_hectaresbc/package_data/recovered_catalog/
```

Source checkout precedence:

1. explicit `metadata_root` passed to `HectaresBC` or `Catalog`;
2. repository-root `metadata/recovered_catalog/` when discoverable;
3. package-internal recovered catalog resources.

This preserves development behavior while making wheel installs useful outside a source checkout.

## External Data Repository

Large payloads remain external. The package does not auto-clone or embed `fresh-hectaresbc-data`.

Default path resolution may continue to prefer:

```text
external/fresh-hectaresbc-data
```

Installed users who are not in the source checkout should pass an explicit data repository path where needed:

```python
HectaresBC(data_repo_path="/path/to/fresh-hectaresbc-data")
```

The CLI should continue to expose `--data-repo-path` for commands that inspect status or fetch.

## Dependencies

Runtime dependencies:

- `typer`, because the installed package includes the CLI entrypoint.

Development/test dependencies:

- `pytest`.

Build validation dependency:

- `build`, used locally as `python -m build`.

Phase 8 should avoid adding geospatial, DataLad, pandas, or cloud SDK dependencies to the runtime package unless a concrete issue changes scope.

DataLad/git-annex remain external backend tools. The package can diagnose their availability but should not require them for catalog-only operations.

## Version And Release Policy

The package may stay at version `0.0.0` during Phase 8 unless a release issue is opened.

Phase 8 does not:

- publish to PyPI;
- tag a release;
- decide long-term semantic versioning;
- define CI release automation.

Those decisions belong to later packaging/release hardening.

## Validation Requirements

Phase 8 implementation must prove:

- editable install works;
- local wheel builds;
- local source distribution builds;
- wheel artifact includes package code, CLI entrypoint metadata, and compact catalog metadata;
- wheel artifact excludes forbidden files and bulky data;
- clean wheel install outside the source checkout can query the catalog;
- clean wheel install can run representative CLI commands;
- default smoke tests avoid credentials and network retrieval.
