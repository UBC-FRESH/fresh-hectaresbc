# Phase 2 Recovery Summary

## Purpose

Summarize Phase 2 metadata and provenance recovery results for the rescued HectaresBC archive.

This summary is a handoff from metadata recovery into Phase 3 reproducible ingestion design. It is not a final public catalog.

## Inputs

Primary source root:

```text
tmp/shared-data/hectaresbc
```

Tracked Phase 1 inputs:

- `metadata/archive_inventory/archive_summary.json`
- `metadata/archive_inventory/zip_manifest.csv`
- `metadata/archive_inventory/root_metadata_files.md`
- `metadata/archive_inventory/zip_payload_families.md`

Phase 2 schema and convention contracts:

- `metadata/catalog_schema/dataset_identity_model.md`
- `metadata/catalog_schema/naming_and_provenance_conventions.md`

## Recovered Outputs

| Output | Records | Purpose |
| --- | ---: | --- |
| `metadata/recovered_catalog/virtual_layer_records.csv` | 1,765 | Compact virtual-layer records from root metadata, root listings, ZIP metadata text, and ZIP manifest evidence. |
| `metadata/recovered_catalog/data_layer_records.csv` | 418 | Compact data-layer records from root listings, ZIP metadata HTML/CSV/XML members, raster/WMS member evidence, and ZIP manifest evidence. |

Total recovered dataset-like records: 2,183.

## Virtual Layer Recovery

Evidence sources:

- `tmp/shared-data/hectaresbc/virtual_layers.txt`
- `tmp/shared-data/hectaresbc/virtual_layers_metadata_all.csv`
- `metadata/archive_inventory/zip_manifest.csv`
- `metadata.txt` inside each virtual-layer ZIP

Results:

- Root metadata rows: 1,765
- Recovered records: 1,765
- Filenames with root listing rows: 1,765
- Filenames with manifest rows: 1,765
- ZIP read status `ok`: 1,765
- ZIP metadata read status `ok`: 1,765
- Verification status `metadata_recovered`: 1,753
- Verification status `conflict_detected`: 12

The only detected source conflict pattern is a priority mismatch where the root CSV priority is blank and the ZIP `metadata.txt` priority is `0`.

Virtual-layer query fields are preserved as source text. The source database context and executable semantics have not been validated.

## Data Layer Recovery

Evidence sources:

- `tmp/shared-data/hectaresbc/data_layers.txt`
- `metadata/archive_inventory/zip_manifest.csv`
- root-level metadata HTML members inside data-layer ZIPs
- root-level metadata CSV members inside category-style data-layer ZIPs
- WMS XML members inside data-layer ZIPs
- raster member paths inside data-layer ZIPs

Results:

- Manifest data-layer rows: 418
- Recovered records: 418
- Filenames with root listing rows: 418
- ZIP read status `ok`: 418
- WMS XML parse status `ok`: 418
- Verification status `metadata_recovered`: 418
- Category CSV metadata present: 104
- Category CSV metadata absent: 314
- Nested ZIP members detected: 2

Nested ZIP members:

- `data_layers/climatercp452050_tmaxsp.zip` contains `tmaxsp.zip`
- `data_layers/siteproductivity_dr.zip` contains `dr.tiff.zip`

Data-layer `.wms.xml` files were treated as legend/value styling metadata, not as authoritative WMS service capabilities. CRS and spatial extent remain blank because the inspected HTML and WMS XML metadata did not provide authoritative CRS or bounds.

## Metadata Contracts Established

Phase 2 established conservative contracts for:

- provisional `dataset_id` values;
- source filename and source stem preservation;
- source-backed title candidates;
- provenance citation fields;
- verification status values;
- known gap, mismatch, and uncertainty fields;
- allowed, blocked, and deferred normalization.

The most important rule is that Phase 2 records preserve evidence. They do not assign final catalog slugs, canonical public titles, CRS, extent, licensing, or semantic grouping when the source metadata does not support those values.

## Known Gaps And Risks

- CRS and spatial extent still require geospatial inspection of raster payloads.
- Full ZIP CRC validation has not been run because it reads all compressed payloads and should be scheduled deliberately.
- Raster readability has not been validated with geospatial tooling.
- Data-layer licensing and use constraints are only captured when source HTML exposed relevant text; they have not been legally reviewed.
- Virtual-layer query semantics require source database context that is not recovered in Phase 2.
- Nested ZIP members require explicit Phase 3 handling.
- Provisional IDs may be replaced later by canonical public IDs, but any replacement needs an explicit mapping.
- The recovered CSV format is acceptable for Phase 2 review but may not be the final catalog storage format.

## Phase 3 Handoff

Phase 3 should design reproducible ingestion around the recovered evidence, not around final package or web-app assumptions.

Recommended first ingestion boundaries:

1. Keep raw archive payloads read-only under `tmp/shared-data/hectaresbc` or future `raw/hectaresbc_2022_export/`.
2. Treat `zip_manifest.csv`, `virtual_layer_records.csv`, and `data_layer_records.csv` as the first compact ingestion inputs.
3. Add validation scripts for record counts, unique IDs, source filename joins, JSON-in-CSV parseability, and expected verification statuses.
4. Add deliberate raster-inspection checks for representative payloads before committing to geospatial dependencies.
5. Define how nested ZIP members should be represented before any extraction workflow is automated.
6. Decide whether the next machine-readable catalog should remain CSV or move to JSON Lines, SQLite, Parquet, or another format.

## Regeneration Commands

```bash
python scripts/recover_virtual_layer_records.py
python scripts/recover_data_layer_records.py
```

