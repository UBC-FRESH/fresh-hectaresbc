# Phase 3 Reproducible Ingestion Plan

## Purpose

Define the Phase 3 contract for designing and adding the first reproducible ingestion and validation workflows for recovered HectaresBC metadata.

This plan completes `P3.1` and governs child issues `P3.2` through `P3.4`.

## Source Boundary

Compact tracked inputs:

- `metadata/archive_inventory/zip_manifest.csv`
- `metadata/archive_inventory/archive_summary.json`
- `metadata/recovered_catalog/virtual_layer_records.csv`
- `metadata/recovered_catalog/data_layer_records.csv`
- `metadata/catalog_schema/dataset_identity_model.md`
- `metadata/catalog_schema/naming_and_provenance_conventions.md`
- `metadata/recovered_catalog/recovery_summary.md`
- `planning/phase3_ingestion_inputs.md`

Ignored local source:

```text
tmp/shared-data/hectaresbc
```

Rules:

- Keep the local source archive read-only.
- Do not bulk extract ZIP payloads.
- Do not commit TIFFs, ZIPs, temporary extraction directories, or large validation logs.
- Treat recovered metadata as evidence to validate, not final catalog truth.
- Preserve the Phase 2 distinction between source names, provisional IDs, and future canonical catalog names.

## P3.1 Tooling Decision

Use a staged tooling approach.

### Standard Library First

Use Python standard-library tooling for the first ingestion and metadata validation checks:

- `csv` for recovered catalog and manifest reads;
- `json` for JSON-in-CSV fields;
- `zipfile` for ZIP central-directory checks and targeted member reads;
- `xml.etree.ElementTree` for WMS/legend XML parse checks;
- `pathlib`, `collections`, and `argparse` for scripts;
- Markdown summaries for compact human-readable reports.

This is sufficient for:

- record counts;
- unique ID checks;
- joins between recovered records and `zip_manifest.csv`;
- JSON-in-CSV parseability;
- expected payload-member presence;
- targeted ZIP central-directory and metadata member reads.

### Targeted Geospatial Tooling Later In Phase 3

CRS, transform, dimensions, nodata, bounds, raster data type, and raster readability require geospatial tooling.

Preferred first target:

- `rasterio`, if available in the development environment.

Fallback options:

- GDAL command-line tools such as `gdalinfo`, if already installed;
- defer raster metadata extraction and document the missing dependency if neither is available.

Do not add a package manager, dependency lockfile, CI, or project-wide Python package scaffold just to inspect representative TIFFs. If Phase 3 validation needs a dependency, document the command and environment assumption first.

### Deferred Tooling

Defer these until later phases:

- DataLad/git-annex setup and special remotes;
- Arbutus S3 bucket operations;
- package scaffolding;
- Typer CLI commands;
- web app tooling;
- database-backed catalog services;
- broad raster conversion, tiling, or extraction workflows;
- full documentation build tooling.

## Planned Phase 3 Outputs

Likely tracked outputs:

```text
planning/phase3_reproducible_ingestion_plan.md
planning/ingestion_workflow_design.md
metadata/validation/
```

Candidate scripts:

```text
scripts/validate_recovered_catalog.py
scripts/inspect_representative_payloads.py
```

Candidate reports:

```text
metadata/validation/recovered_catalog_validation.md
metadata/validation/representative_payload_validation.md
```

If validation output becomes bulky, summarize counts and representative failures in Markdown and do not commit raw logs.

## Phase 3 Child Issue Contract

### P3.2: Rerunnable Ingestion Workflows

Design the workflow shape before adding broad implementation:

- define inputs and outputs;
- define validation-report locations;
- decide whether a normalized catalog should remain CSV or move to another compact format;
- define nested ZIP handling;
- define which metadata should be copied to the future DataLad data repo.

### P3.3: First Validation Checks

Add the first validation scripts and compact outputs:

- recovered record counts;
- unique `dataset_id` values;
- recovered record joins to `zip_manifest.csv`;
- JSON-in-CSV field parseability;
- expected data-layer and virtual-layer payload member checks;
- representative ZIP/source readability checks.

Raster checks may be partial if geospatial tooling is not available. Document that clearly instead of forcing a dependency scaffold.

### P3.4: Phase 3 Summary And Phase 4 Inputs

Summarize:

- validation commands and results;
- unresolved ingestion risks;
- recommended metadata copied to `fresh-hectaresbc-data`;
- representative payloads for cold-clone validation;
- concrete handoff into the DataLad-backed repository phase.

## Validation

Before closing a Phase 3 child issue, run checks appropriate to the changed surface:

```bash
git status --short
find metadata planning -type f -size +10M -print
git check-ignore -v tmp tmp/bootstrap.md tmp/shared-data
git diff --check
```

For machine-readable CSV/JSON outputs, run parser smoke checks with Python standard library.

