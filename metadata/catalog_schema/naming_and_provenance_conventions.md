# Naming And Provenance Conventions

## Purpose

Define conservative naming, identifier, provenance, and uncertainty conventions for recovered HectaresBC catalog records before any broad normalization or canonical catalog generation.

These conventions apply to the Phase 2 recovered catalog outputs:

- `metadata/recovered_catalog/virtual_layer_records.csv`
- `metadata/recovered_catalog/data_layer_records.csv`

They do not finalize the public API, CLI, web app, or DataLad data-repository catalog schema.

## Naming Layers

Keep these names distinct:

| Name Type | Field | Meaning | Stability |
| --- | --- | --- | --- |
| Source filename | `source_filename` | Original ZIP filename exactly as recovered. | Immutable source evidence. |
| Source stem | `source_stem` | Original ZIP filename without extension. | Immutable source evidence. |
| Provisional dataset ID | `dataset_id` | Project-generated deterministic identifier for Phase 2 records. | Stable within Phase 2, but may be migrated later. |
| Title candidate | `title_candidate` | Best source-backed human-readable title available in recovered metadata. | Source-backed but not final authority. |
| Parent layer title | `parent_layer_title` | Data-layer grouping title when available from layer metadata HTML. | Source-backed grouping hint. |
| Future canonical title | Deferred | Curated public catalog title. | Not assigned in Phase 2. |
| Future canonical slug | Deferred | Public API/CLI/web slug. | Not assigned in Phase 2. |

Do not collapse these fields into one name. A filename, display title, source grid name, and future catalog slug can legitimately differ.

## Provisional Dataset ID Rules

Use deterministic IDs so Phase 2 records can be joined and reviewed before final catalog design.

Rules:

1. Prefix data-layer IDs with `dl_`.
2. Prefix virtual-layer IDs with `vl_`.
3. Derive the ID base from the original ZIP stem.
4. Lowercase ASCII letters and digits.
5. Replace runs of non-alphanumeric characters with a single underscore.
6. Trim leading and trailing underscores.
7. Preserve `source_filename` in every record so IDs can be migrated later.
8. If this rule creates a duplicate, do not silently append a suffix. Mark the record `conflict_detected` or `needs_review`.

Examples:

| Source Filename | Provisional ID |
| --- | --- |
| `adminunits_bcts.zip` | `dl_adminunits_bcts` |
| `climatedecade_ahm.zip` | `dl_climatedecade_ahm` |
| `virtualspecies.lichenleiodermasorediatum.27.zip` | `vl_virtualspecies_lichenleiodermasorediatum_27` |

## Display Name Rules

Use source-backed title candidates only.

For virtual layers:

1. Prefer `virtual_layers_metadata_all.csv:layer_name`.
2. Preserve the original spelling, capitalization, punctuation, and scientific names.
3. Do not split or rewrite species/common names.

For data layers:

1. Prefer the primary grid metadata HTML `meta name="gui_grid_name"` value.
2. If unavailable, use the primary grid metadata `<h1>` text.
3. Preserve the parent/group title separately as `parent_layer_title`.
4. Do not merge parent and grid titles into a new title unless a later catalog-design step documents the rule.

Do not infer authoritative titles from filenames when source metadata provides a title.

## Source Name Handling

Source names are evidence, not presentation polish.

Preserve these exactly when present:

- `source_filename`
- `source_stem`
- `fixed_layer_name`
- `fixed_grid_name`
- `hkey`
- `original_layer_id`
- `source_table`
- `source_column`
- ZIP member paths

Allowed cleanup is limited to parser mechanics:

- trimming newline characters around parsed fields;
- decoding text as UTF-8 with replacement for invalid bytes;
- normalizing repeated whitespace in extracted HTML body text;
- representing lists as JSON strings inside CSV fields.

Do not silently rename files, rewrite HectaresBC keys, correct spelling, change case, or normalize scientific names in recovered source fields.

## Provenance Citation Fields

Every recovered record should include enough provenance to reconstruct how it was made.

Required provenance fields:

| Field | Purpose |
| --- | --- |
| `recovery_sources` | JSON list of source files used by the recovery script. |
| `manifest_row_source` | Manifest row reference keyed by ZIP path. |
| `root_listing_source` | Root listing row reference keyed by source filename, when available. |
| `root_metadata_source` | Root metadata row reference for virtual layers, when available. |
| `zip_metadata_source` | Primary ZIP metadata member used for source-backed title/metadata. |
| `recovery_method` | Script or command that generated the record. |
| `recovered_at` | Date the record was generated. |

Recommended source reference format:

```text
relative/or/repo/path:record-key
```

Examples:

```text
metadata/archive_inventory/zip_manifest.csv:data_layers/adminunits_bcts.zip
tmp/shared-data/hectaresbc/data_layers.txt:adminunits_bcts.zip
tmp/shared-data/hectaresbc/virtual_layers_metadata_all.csv:virtualspecies.lichenleiodermasorediatum.27.zip
data_layers/adminunits_bcts.zip:bcts.metadata.html
```

Line numbers are not required for generated CSV provenance because the stable join key is the source filename or ZIP path.

## Verification Status Rules

Use these values consistently:

| Status | Meaning |
| --- | --- |
| `manifest_only` | Record exists only from manifest/listing evidence; no metadata member was recovered. |
| `metadata_recovered` | Expected manifest/listing/ZIP metadata evidence was found and no conflicts were detected. |
| `metadata_partial` | Some expected metadata evidence is missing, but no direct conflict was detected. |
| `conflict_detected` | Two or more source-backed values disagree, or a generated ID collision was detected. |
| `needs_review` | The record is structurally present but requires human review before it should be used as catalog truth. |

Do not upgrade a record from `metadata_partial`, `conflict_detected`, or `needs_review` by guessing missing values.

## Uncertainty Rules

Use `known_gaps`, `metadata_mismatches`, and `uncertainty_notes` differently:

| Field | Use |
| --- | --- |
| `known_gaps` | Machine-checkable missing evidence such as missing metadata files or missing manifest rows. |
| `metadata_mismatches` | Machine-checkable source conflicts such as field disagreements. |
| `uncertainty_notes` | Human-readable interpretation warnings, deferred checks, or non-machine-readable caveats. |

Examples of valid uncertainty notes:

- Source query is preserved as text only; source database semantics are not validated.
- CRS and spatial extent are not populated because recovered metadata did not provide authoritative CRS or bounds.
- ZIP contains nested ZIP payload members.

## Allowed Normalization In Phase 2

Allowed:

- deterministic `dataset_id` generation;
- normalized whitespace in extracted HTML text;
- JSON serialization of list-valued CSV fields;
- counts and samples for very large metadata member lists;
- direct mapping from source fields into explicitly named recovered fields.

## Blocked Normalization In Phase 2

Blocked unless a later roadmap task explicitly changes the contract:

- renaming source files or ZIP member paths;
- unpacking payloads into canonical paths;
- changing source keys such as `hkey`, `fixed_layer_name`, or `fixed_grid_name`;
- inferring CRS, spatial extent, license, or steward from filenames;
- rewriting species, ecosystem, administrative, or climate names;
- deduplicating records by semantic similarity;
- merging data-layer and virtual-layer records into one public catalog object;
- assigning final API, CLI, web, or DataLad catalog slugs.

## Deferred Normalization Decisions

Defer these to Phase 3 or later:

- final machine-readable catalog schema;
- canonical public IDs and migration plan from provisional IDs;
- grouping rules for parent layers, grids, categories, and virtual layers;
- CRS and extent extraction using geospatial tooling;
- license/use-constraint review against original source metadata;
- treatment of nested ZIP payload members;
- whether recovered catalog records should become CSV, JSON Lines, SQLite, Parquet, or another format.

## Migration Rule

If future phases replace provisional IDs or display names, add an explicit mapping table rather than rewriting history in place.

The mapping should include:

- old `dataset_id`;
- new identifier;
- `source_filename`;
- reason for change;
- date of migration;
- script or issue that performed the migration.

