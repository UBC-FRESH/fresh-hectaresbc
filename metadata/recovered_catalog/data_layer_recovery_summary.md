# Data Layer Recovery Summary

## Purpose

Summarize compact data-layer catalog recovery from root listings, the ZIP manifest, and data-layer ZIP metadata members.

## Inputs

- Source root: `tmp/shared-data/hectaresbc`
- ZIP manifest: `metadata/archive_inventory/zip_manifest.csv`
- Root listing: `tmp/shared-data/hectaresbc/data_layers.txt`

## Output

- Records: `metadata/recovered_catalog/data_layer_records.csv`

## Counts

- Manifest data-layer rows: 418
- Recovered records: 418
- Unique source filenames: 418
- Filenames with root listing rows: 418
- Missing from root listing: 0

## Verification Status

- `metadata_recovered`: 418

## ZIP Read Status

- `ok`: 418

## WMS XML Parse Status

- `ok`: 418

## Category CSV Presence

- `absent`: 314
- `present`: 104

## Known Gaps

- No known record-level gaps detected by the recovery script.

## Metadata Mismatches

- No metadata consistency mismatches detected.

## Nested ZIP Members

- `data_layers/climatercp452050_tmaxsp.zip` contains ["tmaxsp.zip"]
- `data_layers/siteproductivity_dr.zip` contains ["dr.tiff.zip"]

## Notes

- Primary grid metadata is selected from the root-level HTML member matching the raster stem when available.
- Layer metadata is selected from the root-level HTML member matching the manifest name prefix when available.
- `.wms.xml` files are treated as legend/value styling metadata, not authoritative WMS service capabilities.
- CRS and spatial extent are intentionally blank because the inspected HTML and WMS XML metadata did not provide authoritative CRS or bounds.
- `dataset_id` values are provisional and follow the P2.1 identity-model rule.

## Command

```bash
python scripts/recover_data_layer_records.py
```
