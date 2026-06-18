# Recovered Catalog Validation

## Inputs

- ZIP manifest: `metadata/archive_inventory/zip_manifest.csv`
- Data-layer records: `metadata/recovered_catalog/data_layer_records.csv`
- Virtual-layer records: `metadata/recovered_catalog/virtual_layer_records.csv`

## Summary

- Checks passed: 14
- Checks failed: 0

## Checks

| Check | Status | Detail |
| --- | --- | --- |
| data-layer record count | PASS | observed 418, expected 418 |
| virtual-layer record count | PASS | observed 1765, expected 1765 |
| combined record count | PASS | observed 2183, expected 2183 |
| unique data-layer dataset IDs | PASS | duplicate count: 0 |
| unique virtual-layer dataset IDs | PASS | duplicate count: 0 |
| recovered records join to ZIP manifest | PASS | missing manifest joins: 0 |
| data-layer source_family values | PASS | errors: 0 |
| virtual-layer source_family values | PASS | errors: 0 |
| data-layer JSON-in-CSV fields parse | PASS | parsed 7106; failures: 0 |
| virtual-layer JSON-in-CSV fields parse | PASS | parsed 14120; failures: 0 |
| data-layer expected payload members | PASS | records without raster and WMS members: 0 |
| virtual-layer expected payload members | PASS | records without raster and metadata.txt members: 0 |
| virtual-layer priority conflicts remain visible | PASS | conflict_detected count: 12, expected 12 |
| data-layer CRS and extent remain blank | PASS | records with CRS/extent filled before raster inspection: 0 |
## Command

```bash
python scripts/validate_recovered_catalog.py
```
