# Web AOI And Tile-Selection Workflow Contract

## Purpose

Specify browser area-of-interest and tile-selection workflows before implementing geometry drawing, tile grids, clipping, download jobs, or hosted processing.

This completes P9.4. The key distinction is that the browser may capture AOI intent before the project can process every layer. Actual clipping, tile bundle generation, and custom downloads belong to P9.5 or later implementation phases.

## Relationship To Map Preview

AOI selection and map preview are related but not identical.

Rules:

- dataset-specific AOI validation requires known layer CRS and extent;
- generic AOI capture may be allowed before a layer has a preview artifact;
- browser map drawing should use a known map CRS and should not imply that the selected AOI is valid for every dataset;
- if a layer has `preview_ready` metadata, the AOI UI may show the layer preview as spatial context;
- if preview is unavailable, the UI may still collect AOI intent against a base map or standard grid, but must label layer-specific validation as pending.

Do not block all AOI planning on map preview readiness, but do not claim an AOI is processable until layer-specific validation has passed.

## AOI Selection Modes

Initial modes:

- drawn polygon or rectangle;
- bounding box entry;
- uploaded GeoJSON polygon or multipolygon;
- standard tile or grid-cell selection, once a grid definition exists.

Deferred modes:

- shapefile upload;
- KML/KMZ upload;
- multi-AOI batch upload;
- freehand drawing with automatic simplification;
- server-side dissolve or repair of complex geometry.

## Geometry Requirements

Accepted geometry should be normalized to GeoJSON-like objects for browser/service transfer.

Minimum requirements:

- geometry type: polygon, multipolygon, or bounding box;
- coordinate reference system: WGS84 longitude/latitude for browser submission unless a future API explicitly accepts alternatives;
- valid ring orientation is preferred, but validation should not depend on orientation alone;
- self-intersections should be rejected or marked repair-required;
- empty, zero-area, or line/point geometries should be rejected;
- geometries crossing unsupported domains should be marked out of bounds or needs review.

The browser should not silently repair geometry in a way that changes user intent. If simplification or repair is offered later, the UI must show that a transformation occurred.

## Bounds And Domain Validation

Initial domain validation should use a project-level allowed extent before layer-specific extents are available.

The allowed extent should be documented as an approximation for British Columbia or the recovered HectaresBC operating domain. Layer-specific validation should remain pending until preview or processing metadata provides authoritative per-layer bounds.

Validation states:

- `valid_intent`: geometry is syntactically valid and within the project-level allowed domain;
- `needs_layer_validation`: geometry is valid as user intent, but layer CRS/extent compatibility is unknown;
- `out_of_domain`: geometry is outside the allowed domain;
- `invalid_geometry`: geometry is malformed, empty, self-intersecting, unsupported, or too complex;
- `too_large`: geometry passes syntax checks but exceeds configured limits.

## Standard Tile Or Grid Selection

A standard grid should not be invented casually in UI code.

Before a tile/grid selector is offered, the project must define:

- grid CRS;
- grid origin;
- cell size or zoom/tile scheme;
- cell ID naming convention;
- project-level coverage extent;
- maximum selectable cell count;
- mapping between selected cells and AOI geometry;
- whether cells are for UI convenience only or are actual processing units.

If no grid is defined, the UI should expose drawn/uploaded AOI modes only and mark tile selection as unavailable.

## Initial AOI Intent Payload

The first browser/service contract should capture AOI intent without promising immediate processing.

Minimum fields:

- `dataset_id`;
- `selection_mode`: drawn_polygon, bbox, uploaded_geojson, or grid_cells;
- `geometry`, when geometry-based;
- `grid_id` and `cell_ids`, when grid-based;
- `input_crs`;
- `normalized_crs`;
- `area_estimate`;
- `bounds`;
- `validation_state`;
- `validation_messages`;
- `created_at`;
- `client_version` or app version when available.

This payload is an input to future download/request workflows, not a completed download request by itself.

## Limits

Initial limits should be conservative and configurable.

Limit categories:

- maximum polygon vertex count;
- maximum multipolygon part count;
- maximum bounding-box area;
- maximum project-level AOI area;
- maximum selected grid-cell count;
- maximum number of selected datasets per request;
- maximum estimated output size once P9.5 defines estimation.

Until real processing and cost estimates exist, limits should be framed as protective workflow limits, not scientific constraints.

## UI Responsibilities

The AOI UI should:

- show the selected dataset title and ID when launched from a dataset page;
- show whether preview context is available;
- let users draw or supply an AOI;
- validate syntax and project-level bounds immediately;
- show clear messages for pending layer-specific validation;
- show area, bounds, and tile count estimates when available;
- keep AOI state shareable only when it is small enough to encode safely in URL state or a server-side draft object exists;
- provide a path back to catalog/detail pages.

The AOI UI should not:

- run clipping;
- start a hosted job;
- retrieve raw payloads;
- expose credentials;
- imply that every selected layer can be processed;
- hide failed or pending validation behind generic form errors.

## Route Shape

Candidate route shape:

```text
/catalog/{dataset_id}/aoi
```

If multi-layer requests are added later, a separate route may be needed:

```text
/request/new
```

The dataset-specific route should preserve the dataset context. The multi-layer route should require explicit dataset selection and validation.

## Service/API Boundary

The AOI workflow may use:

- `HectaresBC().get(dataset_id)` for dataset identity and title;
- preview metadata when available for layer-specific bounds;
- a future project/domain extent definition;
- a future grid definition artifact;
- a geometry validation service or client-side validation library.

The AOI workflow must not:

- parse raw ZIP/TIFF payloads in browser code;
- call DataLad retrieval as part of default validation;
- require object-store credentials;
- create download artifacts before P9.5 defines request semantics.

## Failure And Pending States

Required states:

- dataset not found;
- AOI input empty;
- invalid geometry;
- unsupported geometry type;
- out of project domain;
- too many vertices;
- too many grid cells;
- layer extent unknown;
- preview unavailable;
- grid unavailable;
- validation service unavailable.

Pending states should be explicit. For example, `needs_layer_validation` is acceptable user feedback; silently treating unknown layer extent as valid is not.

## Testing Boundary

Default tests and smoke checks should not require:

- Arbutus or Chinook credentials;
- UBC CWL;
- DataLad network retrieval;
- raw ZIP/TIFF content;
- server-side clipping;
- hosted workers;
- an object store;
- an actual production tile grid.

Routine verification can test:

- geometry payload shape;
- project-level bounds validation with synthetic geometries;
- limit handling;
- route not-found and unavailable states;
- grid-unavailable state when no grid definition exists;
- integration with representative catalog records.

## Open Questions For P9.5 And P9.6

Questions for P9.5:

- Does an AOI intent become a download request directly, or does the user review it first?
- How should output size be estimated before processing?
- Which output formats are acceptable for first hosted download workflows?
- Can one AOI apply to multiple datasets with different CRS/extent readiness?

Questions for P9.6:

- Should AOI drafts be stored server-side?
- How long should draft AOIs persist?
- What authentication level is required before AOI drafts or download requests are saved?
- Where should grid definitions and derived AOI artifacts live?

## Implementation Deferrals

P9.4 does not implement:

- geometry drawing;
- file upload;
- tile/grid definitions;
- geometry validation code;
- clipping;
- job creation;
- download packaging;
- hosted persistence.

Those belong to later web implementation and download workflow phases.
