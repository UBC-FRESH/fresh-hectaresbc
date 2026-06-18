# Root Metadata And Control Files

## Purpose

Summarize the compact root-level HectaresBC metadata/control files and cross-check them against the generated ZIP manifest.

## Inputs

- Source root: `tmp/shared-data/hectaresbc`
- ZIP manifest: `metadata/archive_inventory/zip_manifest.csv`
- Root files inspected:
  - `data_layers.txt`
  - `virtual_layers.txt`
  - `virtual_layers_metadata_all.csv`

## Listing Files

| File | Parsed Rows | Parse Failures | Unique Filenames |
| --- | ---: | ---: | ---: |
| `data_layers.txt` | 418 | 0 | 418 |
| `virtual_layers.txt` | 1765 | 0 | 1765 |

## Listing To Manifest Checks

| Check | Listing Count | Manifest Count | Missing From Manifest | Missing From Listing |
| --- | ---: | ---: | ---: | ---: |
| data layers | 418 | 418 | 0 | 0 |
| virtual layers | 1765 | 1765 | 0 | 0 |

## Virtual Layer Metadata CSV

- Row count: 1765
- Column count: 17
- Columns:
  - `layer_id`
  - `filename`
  - `hkey`
  - `layer_name`
  - `query`
  - `hkey_query`
  - `date_created`
  - `tablename`
  - `ischanged`
  - `columnname`
  - `priority`
  - `columnindex`
  - `element_subnational_id`
  - `ecolcomm`
  - `bclist`
  - `sara`
  - `endemics`

### CSV To Manifest Check

| CSV Filename Count | Manifest Virtual ZIP Count | Missing From Manifest | Missing From CSV |
| ---: | ---: | ---: | ---: |
| 1765 | 1765 | 0 | 0 |

### Field Value Signals

`tablename` values:

- `habc.virtual_data`: 1765

`columnname` values:

- `species`: 1162
- `ecocomm`: 603

`priority` values:

- `2`: 828
- `3`: 364
- `1`: 343
- `4`: 130
- `5`: 39
- `-1`: 24
- `6`: 21
- `[blank]`: 12
- `-2`: 3
- `-3`: 1

Boolean/listing flag columns:

`ischanged`:
- `f`: 1765

`ecolcomm`:
- `0`: 1451
- `1`: 314

`bclist`:
- `1`: 934
- `0`: 831

`sara`:
- `0`: 1576
- `1`: 189

`endemics`:
- `0`: 1720
- `1`: 45

## Duplicate Checks

- Duplicate `filename` values: 0
- Duplicate `layer_id` values: 0

## Catalog-Relevant Fields For Phase 2

- `layer_id`: stable-looking virtual layer numeric identifier.
- `filename`: direct join key to virtual layer ZIP payloads.
- `hkey`: hierarchical/category key that may help reconstruct the catalog tree.
- `layer_name`: human-readable title candidate.
- `query`: SQL-like source rule definition for virtual layers.
- `hkey_query`: human-readable/hierarchical query expression.
- `date_created`: original virtual layer creation timestamp.
- `tablename`, `columnname`, `columnindex`: source table/field hints.
- `element_subnational_id`, `ecolcomm`, `bclist`, `sara`, `endemics`: biodiversity/status fields.

## Notes

- The root listing files appear to be generated directory indexes with filename, timestamp, and display size.
- `virtual_layers_metadata_all.csv` is the strongest root-level source for virtual layer catalog/provenance recovery.
- Data-layer catalog metadata likely needs to be recovered from per-ZIP metadata files in a later phase.
