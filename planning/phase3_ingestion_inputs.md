# Phase 3 Ingestion Inputs

## Purpose

Identify concrete inputs and boundaries for Phase 3 reproducible ingestion design, based on Phase 1 archive reconnaissance and Phase 2 metadata/provenance recovery.

## Inputs Ready For Phase 3

Compact tracked inputs:

- `metadata/archive_inventory/zip_manifest.csv`
- `metadata/archive_inventory/archive_summary.json`
- `metadata/recovered_catalog/virtual_layer_records.csv`
- `metadata/recovered_catalog/data_layer_records.csv`
- `metadata/catalog_schema/dataset_identity_model.md`
- `metadata/catalog_schema/naming_and_provenance_conventions.md`

Ignored local raw source:

```text
tmp/shared-data/hectaresbc
```

Future DataLad raw source:

```text
external/fresh-hectaresbc-data/raw/hectaresbc_2022_export
```

## Recommended Phase 3 Workflow Boundaries

Phase 3 should design small, rerunnable ingestion workflows before any package, CLI, web app, or DataLad publication work depends on them.

Recommended first workflow boundaries:

1. Metadata validation: validate recovered CSV shape, record counts, unique IDs, JSON-in-CSV fields, and joins to `zip_manifest.csv`.
2. Source payload validation: run targeted ZIP CRC checks and raster readability checks on representative payloads.
3. Geospatial metadata extraction: inspect representative TIFFs for CRS, transform, dimensions, nodata, bounds, and data type.
4. Catalog materialization: decide whether a normalized catalog should be CSV, JSON Lines, SQLite, Parquet, or another format.
5. Nested ZIP handling: define whether nested ZIP members are preserved as raw payload members, unpacked into derived paths, or treated as special cases.
6. DataLad handoff: define which compact metadata should be copied into `fresh-hectaresbc-data` when Phase 4 begins.

## Initial Validation Checks

Minimum checks to design in Phase 3:

- expected total recovered records: 2,183;
- expected data-layer records: 418;
- expected virtual-layer records: 1,765;
- no duplicate `dataset_id` values within each recovered CSV;
- every recovered `source_zip_path` joins to `metadata/archive_inventory/zip_manifest.csv`;
- every data-layer record has at least one raster member and one WMS XML member;
- every virtual-layer record has one raster member and one `metadata.txt` member;
- known virtual-layer priority conflicts remain visible as `conflict_detected`;
- data-layer CRS and spatial extent remain blank until geospatial inspection fills them.

## Deferred Until After Phase 3 Design

Do not begin these until Phase 3 has a validation and ingestion contract:

- final Python package scaffold;
- Typer CLI commands;
- web app catalog views;
- canonical public IDs or slugs;
- broad raster extraction or conversion;
- DataLad special-remote publication;
- public documentation that presents recovered metadata as authoritative.

## Phase 4 Dependency Notes

Phase 4 DataLad work should consume Phase 3 decisions for:

- raw payload layout;
- compact metadata copied into the data repo;
- text-vs-annex tracking rules;
- representative payloads for cold-clone retrieval validation;
- Arbutus S3 special-remote validation payloads.

