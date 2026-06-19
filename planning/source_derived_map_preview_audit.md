# Source-Derived Map Preview Audit

This note records the P12.1 audit for replacing the Phase 11 fixture preview with a real source-derived browser map preview.

## Target Layer

The first real preview target is:

```text
dataset_id: dl_adminunits_bcts
title: BCTS Operating Areas
source ZIP: data_layers/adminunits_bcts.zip
internal raster: bcts.tiff
```

This target is preferred over `dl_water_cwb_canals` because it is visibly non-empty at coarse preview resolution and has a compact categorical legend. A coarse sample of `dl_water_cwb_canals` was all zero, making it a poor first proof of useful map viewing.

## Source Path Precedence

The preview generator should try source ZIPs in this order:

1. `external/fresh-hectaresbc-data/raw/hectaresbc_2022_export/data_layers/adminunits_bcts.zip`
2. `tmp/shared-data/hectaresbc/data_layers/adminunits_bcts.zip`

The `external/` path is the public DataLad/submodule route. The `tmp/` path is a local ignored development fallback. Generated public metadata must record only stable project-relative source identifiers such as `data_layers/adminunits_bcts.zip`, `raw/hectaresbc_2022_export/data_layers/adminunits_bcts.zip`, and `bcts.tiff`; it must not serialize local absolute paths or ignored source-root paths.

At audit time, the `external/` file is an annex symlink whose target is not materialized in this checkout, while the ignored `tmp/` source ZIP is present and readable.

## Raster Readability

Rasterio can read the real TIFF directly from the ZIP using:

```text
zip://tmp/shared-data/hectaresbc/data_layers/adminunits_bcts.zip!bcts.tiff
```

Measured raster properties:

| Field | Value |
| --- | --- |
| Driver | `GTiff` |
| Width | `17216` |
| Height | `15744` |
| Bands | `1` |
| CRS | `EPSG:3005` |
| Native bounds | `(159587.5, 173787.5, 1881187.5, 1748187.5)` |
| WGS84 bounds | `(-141.0962892349142, 45.9344383046823, -110.19483972116899, 60.71688156515922)` |
| dtype | `int16` |
| nodata | `-9999.0` |
| sampled values | `1` through `12` |

The native bounds are in BC Albers. The browser preview manifest should include both native `EPSG:3005` bounds and WGS84 bounds for browser map fitting.

## Legend Metadata

`bcts.wms.xml` provides 12 categorical classes and RGB colors:

| Value | Label | RGB |
| --- | --- | --- |
| `1` | TBA (Babine) | `131,171,38` |
| `2` | TCC (Cariboo-Chilcotin) | `46,68,158` |
| `3` | TCH (Chinnok) | `237,71,74` |
| `4` | TKA (Kamloops) | `48,171,171` |
| `5` | TKO (Kootenay) | `171,39,131` |
| `6` | TOC (Okanagan-Columbia) | `145,91,19` |
| `7` | TPG (Prince George) | `50,199,112` |
| `8` | TPL (Peace-Liard) | `121,54,201` |
| `9` | TSG (Strait of Georgia) | `73,139,196` |
| `10` | TSK (Skeena) | `158,63,84` |
| `11` | TSN (Stuart-Nechako) | `78,199,48` |
| `12` | TST (Seaward-tlasta) | `230,230,0` |

The source ZIP also includes `bcts.metadata.csv`, `bcts.metadata.html`, `bcts.wms.xml`, and category metadata HTML files for each TSO class.

## Implementation Inputs

P12.2 should generate a single PNG/RGBA overlay from `bcts.tiff` by downsampling the categorical raster and coloring values from `bcts.wms.xml`.

The manifest should use:

```text
artifact_kind: raster_png
artifact_status: source_derived_preview
artifact_path: dl_adminunits_bcts/preview.png
source_zip_path: data_layers/adminunits_bcts.zip
raw_relative_path: raw/hectaresbc_2022_export/data_layers/adminunits_bcts.zip
internal_raster_path: bcts.tiff
crs: EPSG:3005
```

The generator should fail with a clear message if neither source ZIP path is present/materialized.
