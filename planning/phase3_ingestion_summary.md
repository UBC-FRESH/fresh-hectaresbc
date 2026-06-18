# Phase 3 Ingestion Summary

## Purpose

Summarize Phase 3 reproducible ingestion design results and identify concrete inputs for the future DataLad-backed data repository phase.

## Commands And Results

### Recovered Catalog Validation

Command:

```bash
python scripts/validate_recovered_catalog.py
```

Output:

```text
metadata/validation/recovered_catalog_validation.md
```

Result:

- Checks passed: 14
- Checks failed: 0
- Data-layer records: 418
- Virtual-layer records: 1,765
- Combined recovered records: 2,183
- Duplicate `dataset_id` values: 0
- Missing manifest joins: 0
- JSON-in-CSV parse failures: 0
- Known virtual-layer `conflict_detected` count preserved: 12
- Data-layer CRS and extent fields remain blank pending raster-derived metadata decisions.

### Representative Payload Validation

Command:

```bash
python scripts/inspect_representative_payloads.py
```

Output:

```text
metadata/validation/representative_payload_validation.md
```

Result:

- Representative payloads inspected: 6
- Fully passed representative checks: 6
- Raster inspection tool: `rasterio 1.5.0`
- Representative raster CRS: `EPSG:3005`
- Representative raster dimensions: `17216x15744`
- Nested ZIP detection worked without extraction.

## Representative Payloads For Phase 4

Use this set for early DataLad cold-clone and annex retrieval validation:

| Purpose | Source ZIP |
| --- | --- |
| typical data layer with category metadata | `data_layers/adminunits_bcts.zip` |
| typical data layer with value metadata | `data_layers/climatedecade_ahm.zip` |
| data layer with nested ZIP member | `data_layers/climatercp452050_tmaxsp.zip` |
| large data-layer ZIP | `data_layers/water_distancetocoast.zip` |
| typical virtual layer | `virtual_layers/virtualecocomm.alaskanmountainheatherdwarfshrublandharrimanellastellerianadwarfshrubland.425.zip` |
| large virtual layer | `virtual_layers/virtualspecies.bulltroutsalvelinusconfluentus.1135.zip` |

This set is small enough for repeated validation but covers the known payload families and edge cases discovered so far.

## Metadata Recommended For Data Repository Copy

When Phase 4 initializes `UBC-FRESH/fresh-hectaresbc-data`, copy or mirror these compact metadata files as plain Git-tracked metadata:

- `metadata/archive_inventory/archive_summary.json`
- `metadata/archive_inventory/zip_manifest.csv`
- `metadata/archive_inventory/root_metadata_files.md`
- `metadata/archive_inventory/zip_payload_families.md`
- `metadata/archive_inventory/data_repo_layout_recommendation.md`
- `metadata/recovered_catalog/README.md`
- `metadata/recovered_catalog/virtual_layer_records.csv`
- `metadata/recovered_catalog/virtual_layer_recovery_summary.md`
- `metadata/recovered_catalog/data_layer_records.csv`
- `metadata/recovered_catalog/data_layer_recovery_summary.md`
- `metadata/recovered_catalog/recovery_summary.md`
- `metadata/validation/README.md`
- `metadata/validation/recovered_catalog_validation.md`
- `metadata/validation/representative_payload_validation.md`
- `metadata/catalog_schema/dataset_identity_model.md`
- `metadata/catalog_schema/naming_and_provenance_conventions.md`

Do not copy scripts as data-repository payload unless Phase 4 explicitly decides the data repo should carry validation tooling. The main repo should remain the source of workflow code.

## Unresolved Ingestion Risks

- Full ZIP CRC validation has still not been run across all payloads.
- Representative raster inspection passed, but full raster readability across all 2,183 ZIPs has not been attempted.
- CRS and extent are known for representative rasters only; recovered catalog fields remain blank until a broader raster-metadata extraction contract exists.
- Nested ZIP payloads are detected but not unpacked; extraction policy remains deferred.
- License and use-constraint interpretation remains incomplete and should not be treated as legally reviewed.
- Virtual-layer query semantics remain unvalidated because the original source database context is not available.
- Final catalog storage format is still deferred; recovered CSVs remain evidence records, not final API objects.

## Phase 4 Handoff

Phase 4 should begin by defining the data repository contract around:

- raw archive preservation under `raw/hectaresbc_2022_export/`;
- plain Git tracking for compact metadata listed above;
- annex tracking for ZIP payloads;
- representative payload retrieval validation using the six ZIPs listed here;
- Arbutus S3 special-remote setup using user-local credentials from `~/.config/fresh-hectaresbc/arbutus_env.sh`;
- cold-clone validation that initializes the submodule and retrieves representative annexed payloads.

Phase 4 should not rely on the main repo's ignored `tmp/shared-data/hectaresbc` path once the DataLad data repository exists, except as the local import source during initialization.

