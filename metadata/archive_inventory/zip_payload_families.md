# ZIP Payload Families And Integrity Signals

## Purpose

Classify HectaresBC ZIP payload families using the compact ZIP manifest and representative ZIP central-directory entry lists. No payload files were extracted.

## Inputs

- Source root: `tmp/shared-data/hectaresbc`
- ZIP manifest: `metadata/archive_inventory/zip_manifest.csv`

## Family Summary

| Family | ZIPs | ZIP Status OK | Has TIFF | Has WMS XML | Has Category Metadata | Has Value Metadata | Metadata Entries Present |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| data layers | 418 | 418 | 418 | 418 | 104 | 319 | 418 |
| virtual layers | 1765 | 1765 | 1765 | 0 | 0 | 0 | 1765 |

## Size Signals

| Family | Compressed Total | Uncompressed Entry Total |
| --- | ---: | ---: |
| data layers | 14.2 GB | 235.6 GB |
| virtual layers | 2.2 GB | 891.3 GB |

## Data-Layer Entry Patterns

| Count | Entry extension pattern |
| ---: | --- |
| 304 | `{"html": 4, "tiff": 1, "xml": 1}` |
| 9 | `{"csv": 1, "html": 9, "tiff": 1, "xml": 1}` |
| 8 | `{"csv": 1, "html": 4, "tiff": 1, "xml": 1}` |
| 6 | `{"csv": 1, "html": 7, "tiff": 1, "xml": 1}` |
| 5 | `{"csv": 1, "html": 16, "tiff": 1, "xml": 1}` |
| 5 | `{"csv": 1, "html": 10, "tiff": 1, "xml": 1}` |
| 4 | `{"csv": 1, "html": 14, "tiff": 1, "xml": 1}` |
| 4 | `{"html": 6, "tiff": 1, "xml": 1}` |
| 3 | `{"html": 5, "tiff": 1, "xml": 1}` |
| 3 | `{"csv": 1, "html": 8, "tiff": 1, "xml": 1}` |
| 3 | `{"csv": 1, "html": 11, "tiff": 1, "xml": 1}` |
| 3 | `{"csv": 1, "html": 5, "tiff": 1, "xml": 1}` |

## Virtual-Layer Entry Patterns

| Count | Entry extension pattern |
| ---: | --- |
| 1765 | `{"tiff": 1, "txt": 1}` |

## Representative Data-Layer ZIPs

### typical data layer with value metadata

- ZIP: `data_layers/climatedecade_ahm.zip`
- Compressed size: 50.9 MB
- Entry files/directories: 6 files, 1 directories
- Entry extension counts: `{"html": 4, "tiff": 1, "xml": 1}`
- Metadata entries: 5

Representative central-directory entries:

```text
ahm.metadata.html
ahm.tiff
ahm.wms.xml
value_metadata/
value_metadata/ahm.metadata.html
value_metadata/ahmavg.metadata.html
climatedecade.metadata.html
```

### data layer with category metadata

- ZIP: `data_layers/adminunits_bcts.zip`
- Compressed size: 1.0 MB
- Entry files/directories: 18 files, 2 directories
- Entry extension counts: `{"csv": 1, "html": 15, "tiff": 1, "xml": 1}`
- Metadata entries: 18

Representative central-directory entries:

```text
bcts.metadata.csv
bcts.metadata.html
bcts.tiff
bcts.wms.xml
category_metadata/
category_metadata/tso/
category_metadata/tso/tba.metadata.html
category_metadata/tso/tcc.metadata.html
category_metadata/tso/tch.metadata.html
category_metadata/tso/tka.metadata.html
category_metadata/tso/tko.metadata.html
category_metadata/tso/toc.metadata.html
category_metadata/tso/tpg.metadata.html
category_metadata/tso/tpl.metadata.html
category_metadata/tso/tsg.metadata.html
category_metadata/tso/tsk.metadata.html
category_metadata/tso/tsn.metadata.html
category_metadata/tso/tst.metadata.html
category_metadata/tso.metadata.html
adminunits.metadata.html
```

### data layer with nested ZIP entry

- ZIP: `data_layers/climatercp452050_tmaxsp.zip`
- Compressed size: 89.5 MB
- Entry files/directories: 7 files, 1 directories
- Entry extension counts: `{"html": 4, "tiff": 1, "xml": 1, "zip": 1}`
- Metadata entries: 5

Representative central-directory entries:

```text
tmaxsp.metadata.html
tmaxsp.tiff
tmaxsp.wms.xml
tmaxsp.zip
value_metadata/
value_metadata/tmaxsp.metadata.html
value_metadata/tmaxspavg.metadata.html
climatercp452050.metadata.html
```

### largest compressed ZIP

- ZIP: `data_layers/water_distancetocoast.zip`
- Compressed size: 633.6 MB
- Entry files/directories: 8 files, 1 directories
- Entry extension counts: `{"html": 6, "tiff": 1, "xml": 1}`
- Metadata entries: 7

Representative central-directory entries:

```text
distancetocoast.metadata.html
distancetocoast.tiff
distancetocoast.wms.xml
value_metadata/
value_metadata/distancetocoast.metadata.html
value_metadata/distancetocoastavg.metadata.html
value_metadata/distancetocoastmax.metadata.html
value_metadata/distancetocoastmin.metadata.html
water.metadata.html
```

## Representative Virtual-Layer ZIPs

### typical virtual layer

- ZIP: `virtual_layers/virtualecocomm.alaskanmountainheatherdwarfshrublandharrimanellastellerianadwarfshrubland.425.zip`
- Compressed size: 1.6 MB
- Entry files/directories: 2 files, 0 directories
- Entry extension counts: `{"tiff": 1, "txt": 1}`
- Metadata entries: 1

Representative central-directory entries:

```text
virtualecocomm.alaskanmountainheatherdwarfshrublandharrimanellastellerianadwarfshrubland.425.tiff
metadata.txt
```

### largest virtual layer

- ZIP: `virtual_layers/virtualspecies.bulltroutsalvelinusconfluentus.1135.zip`
- Compressed size: 10.7 MB
- Entry files/directories: 2 files, 0 directories
- Entry extension counts: `{"tiff": 1, "txt": 1}`
- Metadata entries: 1

Representative central-directory entries:

```text
virtualspecies.bulltroutsalvelinusconfluentus.1135.tiff
metadata.txt
```

## Notable Signals

- Data-layer ZIPs with nested ZIP entries: 2
  - Examples:
    - `data_layers/climatercp452050_tmaxsp.zip`
    - `data_layers/siteproductivity_dr.zip`
- ZIP rows with no metadata-like entries: 0
- All ZIPs in the manifest opened successfully with Python `zipfile.ZipFile`.

## Integrity Signals For Phase 1

Low-cost checks appropriate for Phase 1:

- central directory opens successfully (`zip_status = ok`);
- expected entry families are present for each ZIP family;
- every data-layer ZIP has at least one TIFF and one WMS XML entry;
- every virtual-layer ZIP has one TIFF and one TXT metadata entry;
- listing files and metadata CSV row counts match manifest filenames;
- manifest row count matches archive ZIP count.

Deferred or optional checks:

- full CRC validation using `ZipFile.testzip()` reads each compressed payload and should be run deliberately, likely in the DataLad/data-repository lane or as a targeted integrity audit;
- TIFF readability, CRS inspection, and raster statistics require geospatial tooling and belong after Phase 1;
- HTML/XML metadata parsing belongs in Phase 2 or later metadata recovery work.
