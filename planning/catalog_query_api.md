# Catalog Query API Contract

## Purpose

Define the Phase 6 catalog query API shape for the future `fresh-hectaresbc` Python access library.

This completes P6.2. It builds on `planning/core_access_library_architecture.md` and defines what the first catalog layer should expose before retrieval, CLI, package distribution, or browser work begins.

## Source Catalog Inputs

The first catalog implementation should use the compact recovered catalog CSVs:

```text
metadata/recovered_catalog/data_layer_records.csv
metadata/recovered_catalog/virtual_layer_records.csv
```

The implementation may also use `metadata/archive_inventory/zip_manifest.csv` for cross-checks and size/path fields, but it should not require raw ZIP payload content for catalog-only operations.

When both main-repo and data-repo metadata are available, the default precedence should be:

1. main-repo `metadata/` files when running from a source checkout;
2. mirrored data-repo `external/fresh-hectaresbc-data/metadata/` files when explicitly configured or when main-repo metadata is unavailable.

The catalog API should make the source metadata root explicit in diagnostics so callers can tell which files were loaded.

## Required Record Coverage

The first implementation must be able to load:

- 418 data-layer records;
- 1,765 virtual-layer records;
- 2,183 total records;
- unique `dataset_id` values across both families.

The catalog should fail loudly with structured diagnostics if required input files are missing, unreadable, or have incompatible headers.

## Public Catalog Object

Suggested construction:

```python
from fresh_hectaresbc import HectaresBC
from fresh_hectaresbc.catalog import Catalog

hbc = HectaresBC()
catalog = hbc.catalog

catalog = Catalog.from_default_paths()
catalog = Catalog.from_metadata_root("metadata")
```

`HectaresBC` can become the convenience facade later. `Catalog` should remain directly usable for tests, scripts, and service code.

## Core Methods

### `Catalog.get(dataset_id)`

Return exactly one dataset detail by `dataset_id`.

Behavior:

- returns a dataset detail object when found;
- raises or returns a structured `not_found` result when absent;
- never performs fuzzy matching;
- never fetches data content.

### `Catalog.exists(dataset_id)`

Return `True` or `False` for exact `dataset_id` presence.

This is a convenience method for CLI validation and service request checks.

### `Catalog.iter_records(...)`

Iterate records with optional filters.

Initial filters:

- `family`: `data_layer`, `virtual_layer`, or omitted;
- `verification_status`;
- `has_known_gaps`: boolean;
- `has_uncertainty`: boolean.

Iteration should use deterministic ordering:

1. `source_family`;
2. `dataset_id`.

### `Catalog.search(query, ...)`

Search human-readable and source-backed text fields.

Initial searchable fields:

- `dataset_id`;
- `source_filename`;
- `source_stem`;
- `title_candidate`;
- data-layer `parent_layer_title`;
- data-layer `fixed_layer_name`;
- data-layer `fixed_grid_name`;
- data-layer `description`;
- data-layer `coverage`;
- data-layer `lineage`;
- virtual-layer `layer_name`;
- virtual-layer `hkey`;
- virtual-layer `source_table`;
- virtual-layer `source_column`;
- virtual-layer `query`;
- virtual-layer `hkey_query`.

Initial search semantics:

- case-insensitive substring matching;
- whitespace-trimmed query;
- empty query returns a validation error unless `allow_empty=True`;
- no stemming, synonym expansion, spatial search, or ranking model in the first implementation.

Deterministic result ordering:

1. exact `dataset_id` match;
2. exact source filename or stem match;
3. title/layer-name substring match;
4. other field substring match;
5. `source_family`;
6. `dataset_id`.

### `Catalog.filter(...)`

Return a list or iterable of dataset references matching structured filters.

Initial filters:

- `family`;
- `dataset_id_prefix`;
- `source_path_prefix`;
- `name_prefix`;
- `virtual_layer_id`;
- `has_category_metadata`;
- `has_value_metadata`;
- `has_wms_xml`;
- `has_tiff`;
- `verification_status`;
- `zip_read_status`;
- `min_size_bytes`;
- `max_size_bytes`.

Filters not applicable to a family should not invent values. For example, `virtual_layer_id` is meaningful for virtual layers and should simply not match data layers unless a later task defines cross-family semantics.

## Result Shapes

### Dataset Reference

Lightweight search and filter results should expose:

| Field | Source | Notes |
| --- | --- | --- |
| `dataset_id` | recovered catalog | Exact lookup key. |
| `source_family` | recovered catalog | `data_layer` or `virtual_layer`. |
| `source_zip_path` | recovered catalog | Relative raw archive ZIP path. |
| `source_filename` | recovered catalog | Original source filename. |
| `title_candidate` | recovered catalog | Source-backed display candidate. |
| `manifest_size_bytes` | recovered catalog or manifest | Integer when present. |
| `verification_status` | recovered catalog | Preserve source validation state. |
| `known_gaps` | recovered catalog | Preserve without interpretation. |
| `uncertainty_notes` | recovered catalog | Preserve without interpretation. |

### Dataset Detail

Detailed lookup should include:

- all dataset reference fields;
- `payload_members`;
- `metadata_member_paths`;
- `raster_member_paths`;
- family-specific fields from the recovered catalog;
- provenance fields;
- mismatch and uncertainty fields;
- an `extras` mapping for fields not promoted to typed attributes.

The detail object should be serializable to a plain dictionary without losing source field names.

## Error Behavior

The catalog layer should use structured errors/results that later CLI and web layers can render.

Minimum catalog error categories:

- `metadata_root_missing`;
- `catalog_file_missing`;
- `catalog_header_invalid`;
- `dataset_not_found`;
- `dataset_id_duplicate`;
- `query_invalid`;
- `filter_invalid`.

Catalog-only operations should not emit DataLad/git-annex errors because they should not touch data retrieval.

## Source Preservation Rules

The catalog API must preserve Phase 2 naming and provenance rules:

- do not rename `dataset_id`;
- do not rewrite `source_filename`;
- do not rewrite `source_zip_path`;
- do not infer authoritative titles from filenames;
- do not hide `known_gaps`, `metadata_mismatches`, or `uncertainty_notes`;
- do not merge data-layer and virtual-layer records into one semantic object unless a later catalog migration defines that mapping.

## Minimal Implementation Direction

The first implementation can be standard-library-first:

- `csv.DictReader` for recovered catalog files;
- `dataclasses` for references, details, query results, and diagnostics;
- no pandas dependency unless later query needs justify it;
- no SQLite/search index until query volume or API requirements justify it.

This keeps catalog behavior easy to test from a clean checkout.

## Verification Expectations

Future P6 implementation should include checks equivalent to:

```text
load data_layer_records.csv -> 418 records
load virtual_layer_records.csv -> 1,765 records
combined catalog -> 2,183 records
dataset_id values -> unique
get("dl_adminunits_bcts") -> source_zip_path == "data_layers/adminunits_bcts.zip"
get("vl_virtualspecies_bulltroutsalvelinusconfluentus_1135") -> source_family == "virtual_layer"
search("bull trout") -> includes vl_virtualspecies_bulltroutsalvelinusconfluentus_1135
filter(family="data_layer", has_category_metadata=True) -> non-empty
filter(family="virtual_layer", virtual_layer_id="1135") -> one expected record
```

These checks should run without source ZIP payloads and without Arbutus credentials.

## Deferred Decisions

- Whether catalog records become JSON Lines, SQLite, Parquet, or generated Python package data.
- Whether `dataset_id` is final enough for public API stability.
- Whether to expose source query fields through public APIs by default or require an explicit detail view.
- Whether search should support tokenization, ranking, facets, or spatial filtering.
- Whether category/value metadata inside data-layer ZIPs should become first-class catalog subrecords.
- Whether virtual-layer `query` and `hkey_query` should be parsed after source database semantics are understood.
