# Web Catalog And Metadata Browser Contract

## Purpose

Specify the first browser catalog and metadata surface in enough detail to drive implementation without choosing the full web stack yet.

This completes P9.2. Later implementation should treat the existing `fresh_hectaresbc` package as the source of truth for catalog loading, lookup, search, filtering, path resolution, and diagnostic semantics.

## First Surface

The first browser surface should be the catalog browser, not a landing page.

The user should arrive at a searchable catalog view, then open dataset detail pages from that view. Map preview, AOI selection, and custom download workflows should be visible only as disabled, planned, or route-forward actions until P9.3 through P9.5 specify them.

## Catalog Landing View

The catalog landing view should support:

- keyword search across the same source-backed fields used by `Catalog.search()`;
- family filtering for `data_layer` and `virtual_layer`;
- optional filters for verification status, known gaps, uncertainty notes, payload format signals, and preview-readiness signals;
- compact result rows that can be scanned quickly;
- direct links to stable dataset detail routes;
- a visible total count and filtered count;
- no raw data retrieval as part of page load.

Initial result count should be safe to render for all 2,183 recovered records, but the UI should still support pagination or virtualized scrolling so later catalog growth does not force a redesign.

## Compact Result Fields

Each result row should show:

- title: `title_candidate`, falling back to `source_stem`;
- dataset ID: `dataset_id`;
- family: `source_family`;
- source path: `source_zip_path`;
- size: `manifest_size_bytes`, rendered as human-readable bytes when present;
- verification: `verification_status`;
- warning indicator when `known_gaps` is non-empty;
- uncertainty indicator when `uncertainty_notes` is non-empty;
- format/preview hints derived from fields such as `format_signals`, `raster_member_paths`, and `wms_member_paths`.

Rows should not expose very long virtual-layer SQL/HKEY query text inline. Long text belongs on the detail page behind a disclosure or code-style block.

## Search, Filter, And Sort Controls

Initial controls:

- search text input;
- family segmented control: all, data layers, virtual layers;
- verification status selector;
- warning/uncertainty toggles;
- preview candidate toggle, based on raster or WMS metadata presence;
- page size selector or equivalent pagination control.

Initial sort options:

- relevance when a search query is active;
- title ascending;
- dataset ID ascending;
- source family then title;
- size descending, with missing sizes sorted last.

The browser should keep search and filter state in the URL query string so catalog views are shareable and reloadable.

## Dataset Detail Route

Stable route shape:

```text
/catalog/{dataset_id}
```

The route should return a not-found state for unknown dataset IDs without leaking stack traces or backend details.

## Dataset Detail Sections

The dataset detail page should group fields into readable sections.

Summary:

- `title_candidate`;
- `dataset_id`;
- `source_family`;
- `source_zip_path`;
- `manifest_size_bytes`;
- `verification_status`.

Recovered metadata:

- data-layer fields such as `parent_layer_title`, `fixed_layer_name`, `fixed_grid_name`, `description`, `coverage`, `creator`, `publisher`, `rights`, `units`, `lineage`, `license_or_use_constraints`, `crs`, and `spatial_extent`;
- virtual-layer fields such as `original_layer_id`, `hkey`, `layer_name`, `date_created`, `source_table`, `source_column`, `priority`, `element_subnational_id`, and `status_flags`.

Payload contents:

- `payload_members`;
- `payload_member_count`;
- `metadata_member_paths`;
- `raster_member_paths`;
- `wms_member_paths`;
- data-layer metadata counts such as `category_metadata_count`, `value_metadata_count`, `wms_entry_count`, and `category_csv_row_count`.

Provenance:

- `manifest_row_source`;
- `root_listing_source`;
- `root_metadata_source` when present;
- `zip_metadata_source`;
- `recovery_sources`;
- `recovery_method`;
- `recovered_at`;
- `zip_read_status`;
- `manifest_zip_status`;
- `zip_metadata_read_status` when present.

Warnings and uncertainty:

- `known_gaps`;
- `metadata_mismatches` or `zip_metadata_mismatches`;
- `uncertainty_notes`.

Long source definitions:

- `query`;
- `hkey_query`.

Long source definitions should be visually separated from ordinary prose, preserve line wrapping, and be collapsed by default if they are large.

## Provenance And Uncertainty Display

The browser must not present recovered metadata as more authoritative than it is.

Display rules:

- show `verification_status` near the page title;
- show warning and uncertainty callouts when `known_gaps` or `uncertainty_notes` are non-empty;
- label source paths as recovered source evidence, not as current authoritative government service endpoints;
- distinguish recovered title candidates from verified official titles;
- show missing CRS or spatial extent as unknown rather than blank when those fields are absent.

## Actions And Cross-Links

Catalog/detail pages may include these actions:

- copy dataset ID;
- copy source ZIP path;
- copy Python snippet using `HectaresBC().get("{dataset_id}")`;
- copy CLI commands such as `fresh-hectaresbc catalog show {dataset_id}` and `fresh-hectaresbc fetch {dataset_id} --dry-run`;
- link to map preview route when P9.3 defines support;
- link to AOI/download routes only when P9.4 and P9.5 define those workflows.

Actions must not trigger raw payload retrieval by default.

## Service/API Requirements

The browser may be backed by either:

- a static precomputed catalog JSON artifact generated from the package catalog; or
- a thin HTTP service that calls `fresh_hectaresbc.HectaresBC`.

Regardless of implementation, behavior should remain aligned with the package:

- exact dataset lookup should match `HectaresBC().get()`;
- keyword search should match or explicitly document differences from `HectaresBC().search()`;
- structured filters should use existing `Catalog.filter()` semantics where possible;
- serialized records should preserve recovered source field names;
- no browser code should parse the recovered CSVs independently.

If a static catalog JSON artifact is used, it should be generated by a tracked script and verified against package-loaded catalog counts.

## Page States

Required states:

- loading;
- empty catalog, treated as setup/configuration failure;
- no search results;
- dataset not found;
- malformed filter or route parameter;
- service unavailable;
- package/catalog version mismatch, if a service layer exposes version data.

State messages should tell users what happened and what they can do next, without exposing secrets, local paths containing private user details, or credential configuration.

## Accessibility And Usability

Catalog rows should be usable with keyboard navigation and screen readers.

Minimum expectations:

- semantic table or list structure for results;
- labels for all search/filter controls;
- stable focus behavior when opening detail pages;
- no information conveyed only through color;
- text should remain readable on narrow screens;
- long identifiers and paths should wrap without breaking layout.

## Default Verification Boundary

Default tests and smoke checks for the catalog browser should not require:

- Arbutus or Chinook credentials;
- UBC CWL;
- DataLad network retrieval;
- raw HectaresBC ZIP content;
- a running object store;
- a hosted worker or job queue.

Tests should use:

- packaged compact catalog metadata;
- representative data-layer and virtual-layer records;
- simulated service unavailable/not-found states;
- static artifact validation if static JSON is introduced.

## Implementation Deferrals

P9.2 does not implement:

- frontend framework selection;
- map rendering;
- AOI drawing;
- tile selection;
- download job creation;
- authentication;
- production hosting.

Those belong to P9.3 through P9.6 or later implementation phases.
