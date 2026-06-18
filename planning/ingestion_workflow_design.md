# Ingestion Workflow Design

## Purpose

Define compact, rerunnable ingestion workflows for recovered HectaresBC metadata and source payload evidence.

This document completes `P3.2` and governs the first implementation work in `P3.3`.

## Design Constraints

- Keep raw archive payloads read-only.
- Do not bulk extract ZIP payloads.
- Do not commit TIFFs, ZIPs, temporary extraction directories, or large logs.
- Use Python standard-library tooling for metadata validation first.
- Add geospatial tooling only for targeted raster inspection, and document availability clearly.
- Preserve Phase 2 source-backed metadata and provisional identifiers until a later canonical catalog design exists.

## Workflow 1: Recovered Catalog Validation

### Inputs

- `metadata/archive_inventory/zip_manifest.csv`
- `metadata/recovered_catalog/virtual_layer_records.csv`
- `metadata/recovered_catalog/data_layer_records.csv`
- `metadata/catalog_schema/dataset_identity_model.md`
- `metadata/catalog_schema/naming_and_provenance_conventions.md`

### Candidate Command

```bash
python scripts/validate_recovered_catalog.py
```

### Checks

- expected data-layer record count: 418;
- expected virtual-layer record count: 1,765;
- expected combined record count: 2,183;
- unique `dataset_id` values within each recovered CSV;
- every recovered `source_zip_path` joins to `zip_manifest.csv`;
- every data-layer record has `source_family = data_layer`;
- every virtual-layer record has `source_family = virtual_layer`;
- JSON-in-CSV fields parse successfully;
- expected data-layer payload members are present in record fields;
- expected virtual-layer payload members are present in record fields;
- known virtual-layer priority conflicts remain visible as `conflict_detected`;
- data-layer `crs` and `spatial_extent` remain blank until geospatial inspection fills them.

### Output

```text
metadata/validation/recovered_catalog_validation.md
```

The report should summarize:

- input file paths;
- check counts;
- pass/fail status by check;
- any failing record IDs or source paths;
- command used to regenerate the report.

If failures are numerous, cap examples in the tracked report and avoid committing bulky full logs.

## Workflow 2: Representative Source Payload Inspection

### Inputs

Compact metadata inputs:

- `metadata/archive_inventory/zip_manifest.csv`
- `metadata/recovered_catalog/data_layer_records.csv`
- `metadata/recovered_catalog/virtual_layer_records.csv`

Ignored local raw source:

```text
tmp/shared-data/hectaresbc
```

### Candidate Command

```bash
python scripts/inspect_representative_payloads.py
```

### Representative Payload Set

Use a deliberately small set that covers known archive patterns:

| Purpose | Source ZIP |
| --- | --- |
| typical data layer with category metadata | `data_layers/adminunits_bcts.zip` |
| typical data layer with value metadata | `data_layers/climatedecade_ahm.zip` |
| data layer with nested ZIP member | `data_layers/climatercp452050_tmaxsp.zip` |
| large data-layer ZIP | `data_layers/water_distancetocoast.zip` |
| typical virtual layer | `virtual_layers/virtualecocomm.alaskanmountainheatherdwarfshrublandharrimanellastellerianadwarfshrubland.425.zip` |
| large virtual layer | `virtual_layers/virtualspecies.bulltroutsalvelinusconfluentus.1135.zip` |

### Checks

Standard-library checks:

- source ZIP exists under `tmp/shared-data/hectaresbc`;
- ZIP central directory opens;
- expected metadata members can be read;
- expected raster member path exists in the ZIP;
- WMS XML or `metadata.txt` parses for representative records;
- nested ZIP members are detected and reported without extraction.

Targeted geospatial checks:

- if `rasterio` is available, inspect representative TIFF metadata through `zipfile` extraction to a temporary ignored location or direct virtual file access if practical;
- if `rasterio` is unavailable but `gdalinfo` is available, inspect a temporary extracted representative TIFF in an ignored temporary location;
- if neither is available, report that raster geospatial inspection is deferred.

Do not commit temporary extracted rasters.

### Output

```text
metadata/validation/representative_payload_validation.md
```

The report should summarize:

- source ZIPs inspected;
- metadata members read;
- ZIP read status;
- nested ZIP detection;
- raster inspection method used or reason deferred;
- representative CRS/extent/dimension results only when tool-supported.

## Workflow 3: Catalog Materialization Decision

Phase 3 should not replace the recovered CSVs with a final catalog yet.

Decision for Phase 3:

- keep recovered catalog records as CSV;
- use Markdown validation reports for review;
- defer normalized catalog materialization until validation checks and representative raster inspection are complete.

Rationale:

- CSV is already compact and reviewable;
- Phase 2 record fields are still evidence-oriented, not final API objects;
- CRS, extent, nested ZIP handling, and license interpretation are unresolved;
- package and CLI design should not depend on a premature catalog storage choice.

Candidate future formats:

- JSON Lines for nested structures and validation-friendly records;
- SQLite for local query and CLI prototypes;
- Parquet if analytics workflows need columnar performance.

Do not choose one until Phase 3 validation results show the actual query and integrity needs.

## Nested ZIP Handling

Phase 3 should preserve nested ZIP members as source payload evidence and not extract them automatically.

Known nested ZIP members:

- `data_layers/climatercp452050_tmaxsp.zip`: `tmaxsp.zip`
- `data_layers/siteproductivity_dr.zip`: `dr.tiff.zip`

Rules:

- keep nested ZIP paths in recovered metadata;
- include nested ZIP detection in validation reports;
- do not unpack nested ZIP members during routine validation;
- defer extraction policy to a later ingestion or DataLad contract;
- if a nested member is inspected, write any temporary files only under ignored `tmp/`.

## DataLad Data Repository Handoff

Phase 4 should be able to copy or mirror these compact metadata files into `fresh-hectaresbc-data` as plain Git-tracked metadata:

- `metadata/archive_inventory/archive_summary.json`
- `metadata/archive_inventory/zip_manifest.csv`
- `metadata/archive_inventory/root_metadata_files.md`
- `metadata/archive_inventory/zip_payload_families.md`
- `metadata/recovered_catalog/virtual_layer_records.csv`
- `metadata/recovered_catalog/data_layer_records.csv`
- `metadata/recovered_catalog/recovery_summary.md`
- `metadata/catalog_schema/dataset_identity_model.md`
- `metadata/catalog_schema/naming_and_provenance_conventions.md`

The raw archive payloads should remain under the planned DataLad raw prefix:

```text
raw/hectaresbc_2022_export/
```

## P3.3 Implementation Boundary

P3.3 should add scripts and compact validation reports, not a package stack.

Expected files:

```text
scripts/validate_recovered_catalog.py
scripts/inspect_representative_payloads.py
metadata/validation/README.md
metadata/validation/recovered_catalog_validation.md
metadata/validation/representative_payload_validation.md
```

If representative raster inspection cannot be completed because `rasterio` or GDAL is unavailable, the report should say so explicitly and still pass the standard-library validation checks.

