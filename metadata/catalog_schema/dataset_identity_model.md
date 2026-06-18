# Dataset Identity Model

## Purpose

Define the minimal dataset identity and provenance fields for recovered HectaresBC catalog records.

This is an early Phase 2 contract, not a final catalog schema. It is designed to keep extraction work reproducible, conservative, and auditable while the archive metadata is still being interpreted.

## Record Scope

One record should describe one recoverable HectaresBC dataset-like object:

- a data-layer ZIP listed in `data_layers.txt`; or
- a virtual-layer ZIP listed in `virtual_layers.txt` and described by `virtual_layers_metadata_all.csv`.

Records should not describe derived products, unpacked rasters, normalized filenames, or future web/API catalog entities unless those are explicitly mapped back to recovered source records.

## Required Identity Fields

| Field | Required | Description |
| --- | --- | --- |
| `dataset_id` | yes | Provisional stable identifier assigned by this project. Must be deterministic from source evidence and documented conventions. |
| `source_family` | yes | `data_layer` or `virtual_layer`. |
| `source_zip_path` | yes | Path to the original ZIP relative to `tmp/shared-data/hectaresbc` or future `raw/hectaresbc_2022_export/`. |
| `source_filename` | yes | Original ZIP filename exactly as listed in the archive. |
| `source_stem` | yes | Original filename without extension, preserving source spelling and separators. |
| `payload_members` | yes | Metadata-bearing member paths inside the ZIP that support the record. |
| `title_candidate` | no | Best source-backed human-readable title, when present. |
| `title_source` | no | Field or file that supplied `title_candidate`. |

## Source-Specific Fields

### Virtual Layers

Virtual-layer records should preserve root CSV fields when present:

| Field | Description |
| --- | --- |
| `original_layer_id` | Value from `virtual_layers_metadata_all.csv:layer_id`. |
| `hkey` | Value from `virtual_layers_metadata_all.csv:hkey`. |
| `layer_name` | Value from `virtual_layers_metadata_all.csv:layer_name`. |
| `query` | Value from `virtual_layers_metadata_all.csv:query`. |
| `hkey_query` | Value from `virtual_layers_metadata_all.csv:hkey_query`. |
| `date_created` | Value from `virtual_layers_metadata_all.csv:date_created`. |
| `source_table` | Value from `virtual_layers_metadata_all.csv:tablename`. |
| `source_column` | Value from `virtual_layers_metadata_all.csv:columnname`. |
| `source_column_index` | Value from `virtual_layers_metadata_all.csv:columnindex`. |
| `status_flags` | Compact representation of `ecolcomm`, `bclist`, `sara`, `endemics`, and related source fields. |

Do not interpret `query` or `hkey_query` as executable SQL until a later validation step defines the source database context.

### Data Layers

Data-layer records should preserve metadata directly found in data-layer ZIP members:

| Field | Description |
| --- | --- |
| `metadata_member_paths` | HTML, CSV, XML, TXT, or other metadata-like members that support the record. |
| `raster_member_paths` | TIFF or other raster payload members observed in the ZIP. |
| `wms_member_paths` | WMS XML members observed in the ZIP. |
| `format_signals` | Source-backed payload format signals such as `tiff` or `wms_xml`. |
| `crs` | CRS only when directly found in metadata or a later geospatial inspection step. |
| `spatial_extent` | Extent only when directly found in metadata or a later geospatial inspection step. |
| `lineage` | Lineage text only when directly found in source metadata. |
| `license_or_use_constraints` | Use constraints only when directly found in source metadata. |

## Provenance Fields

| Field | Required | Description |
| --- | --- | --- |
| `recovery_sources` | yes | Files and fields used to construct the record. |
| `manifest_row_source` | yes | Reference to the `zip_manifest.csv` row or equivalent manifest evidence. |
| `root_listing_source` | no | `data_layers.txt` or `virtual_layers.txt` row evidence when used. |
| `root_metadata_source` | no | `virtual_layers_metadata_all.csv` row evidence when used. |
| `zip_metadata_source` | no | ZIP member paths and parsed fields used as metadata evidence. |
| `recovery_method` | yes | Script, command, or manual note that produced the record. |
| `recovered_at` | yes | Date when the record was generated or updated. |

## Verification Fields

| Field | Required | Description |
| --- | --- | --- |
| `verification_status` | yes | One of `manifest_only`, `metadata_recovered`, `metadata_partial`, `conflict_detected`, or `needs_review`. |
| `known_gaps` | yes | Missing evidence that matters for interpretation or access. |
| `uncertainty_notes` | yes | Plain-language notes for ambiguity, conflicting evidence, or inferred-but-unverified values. |

## Null And Unknown Values

Use explicit empty values instead of placeholders:

- blank string for empty source fields;
- `null` in JSON for unknown values;
- empty CSV field for unknown values;
- `[]` for list fields with no observed values.

Do not use values such as `unknown`, `n/a`, `none`, `tbd`, or `0` unless those exact strings or values appear in the source data and are preserved as source values.

## Do-Not-Guess Fields

The following fields must not be inferred from filenames alone:

- CRS;
- spatial extent;
- license or use constraints;
- data owner or steward;
- source database semantics;
- biological or ecological interpretation;
- authoritative display title;
- canonical dataset grouping.

Filename-derived hints may be recorded in a clearly labelled `uncertainty_notes` entry, but they should not populate authoritative metadata fields.

## Provisional Identifier Rules

Until naming conventions are finalized in `P2.4`, `dataset_id` values should be provisional and deterministic:

- prefix with `dl_` for data layers and `vl_` for virtual layers;
- derive the base from the original ZIP stem;
- lowercase ASCII letters and digits;
- replace runs of non-alphanumeric characters with a single underscore;
- trim leading and trailing underscores;
- preserve a mapping to `source_filename` so IDs can be changed later with an explicit migration.

If this rule produces a duplicate, do not silently append a suffix. Record the conflict and set `verification_status` to `conflict_detected` or `needs_review`.

## Deferred Schema Decisions

- Final machine-readable schema format.
- Whether catalog records should be CSV, JSON Lines, Parquet, SQLite, or another format.
- Whether IDs should be based on HectaresBC source IDs, filenames, hashes, or curated slugs.
- How to version corrected metadata when recovered metadata conflicts with source archive contents.
- How to represent derived products and AOI-specific outputs.

