# Representative Payload Validation

## Inputs

- Source root: `tmp/shared-data/hectaresbc`
- Data-layer records: `metadata/recovered_catalog/data_layer_records.csv`
- Virtual-layer records: `metadata/recovered_catalog/virtual_layer_records.csv`

## Environment

- rasterio: available 1.5.0

## Summary

- Representative payloads inspected: 6
- Fully passed representative checks: 6

## Results

| Purpose | Source ZIP | ZIP | Metadata | Raster | CRS | Dimensions | Nested ZIPs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| typical data layer with category metadata | `data_layers/adminunits_bcts.zip` | ok | ok | ok | `EPSG:3005` | 17216x15744 | `[]` |
| typical data layer with value metadata | `data_layers/climatedecade_ahm.zip` | ok | ok | ok | `EPSG:3005` | 17216x15744 | `[]` |
| data layer with nested ZIP member | `data_layers/climatercp452050_tmaxsp.zip` | ok | ok | ok | `EPSG:3005` | 17216x15744 | `["tmaxsp.zip"]` |
| large data-layer ZIP | `data_layers/water_distancetocoast.zip` | ok | ok | ok | `EPSG:3005` | 17216x15744 | `[]` |
| typical virtual layer | `virtual_layers/virtualecocomm.alaskanmountainheatherdwarfshrublandharrimanellastellerianadwarfshrubland.425.zip` | ok | ok | ok | `EPSG:3005` | 17216x15744 | `[]` |
| large virtual layer | `virtual_layers/virtualspecies.bulltroutsalvelinusconfluentus.1135.zip` | ok | ok | ok | `EPSG:3005` | 17216x15744 | `[]` |

## Notes

- TIFF members were inspected through temporary files under ignored `tmp/` and deleted after reading.
- Nested ZIP members are reported but not extracted.
- These are representative checks only; they do not replace full archive CRC or full raster readability validation.

## Command

```bash
python scripts/inspect_representative_payloads.py
```
