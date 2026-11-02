# Browser UI Review And Upgrade Plan

Date: 2026-11-02
Status: implemented on `feature/p19-web-ui-upgrade`; verification and issue activation pending
Scope: the static browser app under `web/` (catalog, dataset detail, map preview)
Reviewed revision: `11326ab` (`main`)
Reference implementations:

- `UBC-FRESH/ws4`, Phase 18 web front end (`ws4/web/`, `notes/design/ws4-web-frontend.md`)
- `UBC-FRESH/fhops`, Phase 12 web application (`src/fhops/web/`, `notes/web_ui_expansion_plan.md`)

Related contracts:

- `planning/web_app_product_access_contract.md`
- `planning/web_catalog_metadata_browser_contract.md`
- `planning/web_map_preview_workflow_contract.md`
- `planning/full_layer_preview_artifact_contract.md`
- `planning/web_hosting_deployment_plan.md`

## 1. Executive Summary

The current browser app is functional, honest about recovered data quality, and
already has stable deep links. It is not yet an application. It is a
document-style page with four stacked sections: summary, results, detail, and
map.

The most serious problems are structural, not cosmetic:

1. Every route renders the same vertical stack. Opening a dataset leaves the
   detail panel roughly 4,700 px below the viewport at 1440 x 900 with 50
   results; the map is roughly 4,900 px down.
2. Opening a dataset destroys the browse context. `syncRouteState()` overwrites
   the search query with the dataset ID and resets family, sort, and page size,
   so the user's filtered result set is replaced by one row.
3. The default result page shows 50 records out of 2,183 with no next/previous
   control. Selecting "All" renders 2,183 rows in one pass.
4. At 390 px and 768 px the page is 838 px wide. The 820 px minimum table width
   escapes its scroll container because the grid item has no `min-width: 0`.
5. The catalog JSON is 6.0 MB raw and the project server sends it without
   compression or cache headers. The same payload gzips to about 279 KB.
6. The results "Preview" column reports source format signals (`TIFF`,
   `TIFF + WMS`), not whether a published preview artifact exists, even though
   the published index contains 2,163 preview artifacts (plus 20
   not-previewable records).

Recommended direction: keep the static-first, no-build philosophy, but replace
the page layout with a WS4/FHOPS-style application shell adapted to a read-only
data catalog. The target is a three-pane browse workspace (filters, results,
inspector), a dedicated dataset route, and a real map workspace using MapLibre
with the current static image as a fallback.

Do not copy the parts of WS4/FHOPS that exist for simulation runs: FastAPI in
the request path, SSE telemetry, skins, the assistant, or solver panels. Borrow
the shell, the density, the state discipline, the map interaction, and the
accessibility rules.

## 2. Method And Evidence

The review used:

- a fresh clone of `UBC-FRESH/fresh-hectaresbc`;
- `python3 scripts/generate_web_catalog.py` to generate the real 2,183-record
  catalog;
- `python3 scripts/serve_web_app.py` on a loopback port;
- Playwright/Chromium screenshots at 1440 x 900, 768 x 1024, and 390 x 844;
- DOM measurements for scroll width, section offsets, row count, and transfer
  size;
- source review of `web/index.html`, `web/styles.css`, `web/app.js`,
  `web/catalog.js`, `scripts/serve_web_app.py`, and the web smoke tests;
- source review of the WS4 and FHOPS shells, design notes, skins, and map
  implementations.

The live demos at `ws4.01101.dev` and `fhops.01101.dev` are behind Cloudflare
Access, so the comparison used the reference source and locally rendered
shells rather than authenticated demo sessions.

Measurements recorded during review:

| Measurement | Result |
| --- | --- |
| Catalog records | 2,183 (418 data layers, 1,765 virtual layers) |
| Catalog payload | 6,286,464 bytes (6.0 MB), gzip 279,170 bytes |
| `Content-Encoding` on catalog response | none |
| `Cache-Control` on catalog response | none |
| Rows rendered by default | 50 |
| Default result text | "2,183 matching records" |
| Dataset detail offset at 1440 x 900 | 4,688 px |
| Map section offset at 1440 x 900 | 4,887 px |
| Document width at 390 px viewport | 838 px |
| Document width at 768 px viewport | 838 px |
| Records with `uncertainty_notes` | 2,183 |
| Records with `known_gaps` | 0 |
| Records with `conflict_detected` verification | 12 |

The last three rows matter for filter design: a generic "has warnings" filter
would match every record because every record carries uncertainty prose. The
useful signals are verification status (12 conflicts), known gaps (0 today),
published preview availability (2,163 previews, 20 `not_previewable`), family,
and size.

## 3. Findings Against UX/UI Best Practices

### 3.1 Scorecard

Scores are 1 (poor) to 5 (strong) for the current app.

| Dimension | Score | Assessment |
| --- | ---: | --- |
| Information architecture | 2 | Four unrelated sections stacked in one scroll; no browse/detail/map separation. |
| Navigation and wayfinding | 2 | Hash deep links work, but opening a record replaces the search context and there is no "back to results". |
| Search and filtering | 2 | One substring search and a family toggle; no facets, ranking, active filter chips, or URL state. |
| Results density and scanability | 2 | Plain five-column table; long titles wrap into tall rows; no thumbnails, badges, or sticky header. |
| Dataset detail and provenance | 3 | Real metadata and provenance are present, but raw field names and enums are dumped without grouping or explanation. |
| Map interaction | 1 | Static image with `object-fit: fill`; no pan, zoom, fit-to-bounds, scale, or layer tree. |
| Responsive and mobile | 1 | Horizontal overflow at 390 and 768 px; detail and map are thousands of pixels below the list. |
| Accessibility | 2 | Semantic table and labels exist, but no skip link, sortable-header semantics, selected-row state, or visible focus for hidden radios. |
| Performance | 2 | 6 MB uncompressed JSON, no cache headers, no lazy detail payload, no lazy images. |
| Visual design and consistency | 2 | Clean but generic; oversized document heading, mixed link/accent colors, inconsistent density compared with WS4/FHOPS. |
| Loading, empty, and error states | 2 | Developer-facing commands appear in user-facing errors; no skeletons or retry. |
| Trust and uncertainty communication | 3 | Good raw honesty, but no explanatory layer and no at-a-glance confidence signal. |
| URL/shareability | 2 | Dataset and map hashes work; search, filters, sort, and page are not encoded. |
| Test coverage for UI behavior | 2 | Logic and fake-DOM smoke tests exist; no real-browser responsive, keyboard, or accessibility checks. |

### 3.2 P0: Blocks the core workflow

**P0-1. Opening a dataset destroys the browse context.**
`syncRouteState()` in `web/app.js` sets `state.query` to the selected dataset
ID and resets `family`, `sort`, and `pageSize`. A user who filters to "data
layers", sorts by size, and opens a record is returned to a one-row search.
There is no preserved "back to results" state. The URL does not carry the
original query. This is the single most damaging navigation bug.

**P0-2. Detail and map are thousands of pixels below the list.**
At 1440 x 900 with 50 results, the detail section starts at 4,688 px and the map
at 4,887 px. With the default page size there is no scroll or focus management
after a route change. The map is effectively unreachable on a laptop without a
long scroll, and on mobile it sits below the entire result list.

**P0-3. Only the first 50 of 2,183 results are reachable by default.**
`limitRecords()` slices to the chosen page size, but there is no pagination or
"load more" control. The result count says "2,183 matching records" while the
DOM contains 50 rows. Choosing "All" renders all 2,183 rows at once, which is
the opposite failure mode.

**P0-4. Mobile layout overflows horizontally.**
`.record-table` has `min-width: 820px`. `.table-wrap` has `overflow-x: auto`,
but its grid parent does not have `min-width: 0`, so the table expands the
document to 838 px at both 390 px and 768 px viewports. Controls, status text,
and table columns are clipped off-screen.

**P0-5. The catalog payload is large and uncompressed.**
`web/data/catalog.json` is 6.0 MB raw. The project server sends it without
`Content-Encoding: gzip` and without cache headers. The same file is about
279 KB when gzipped. On a slow connection this is a multi-second blank wait
before the first row appears.

### 3.3 P1: Major UX and usability gaps

**P1-1. The summary band consumes the first viewport on every route.**
The large title and three summary cards remain at the top of dataset and map
routes. They are useful once, not on every navigation. The result is that the
task surface starts below the fold.

**P1-2. The "Preview" column is semantically wrong.**
`CatalogBrowser.previewLabel()` returns source format (`TIFF`, `TIFF + WMS`)
from `record.preview.has_raster` / `has_wms`. It does not report whether the
published preview artifact exists. The detail panel uses the manifest and can
say something different. With 2,163 published previews, the most valuable
catalog facet is missing and the visible label is misleading. Rename the
current column to "Format" and add a separate "Preview" status/thumbnail.

**P1-3. No faceted filtering.**
The app has only family plus free text, even though the catalog contract calls
for verification status, warning/uncertainty signals, and preview readiness.
The data supports useful facets: family, published preview availability,
verification status (`metadata_recovered` vs `conflict_detected`), preview
exception (`not_previewable`), and size bucket.

**P1-4. Search is unranked and recomputes everything per keystroke.**
`filterRecords()` calls `searchableText()` for every record on every input
event; `searchableText()` flattens all metadata. There is no debounce, no
relevance ordering, no match highlighting, and no search across provenance or
uncertainty notes. At 2,183 records it is tolerable; at "All" page size it
re-renders the whole table on each keypress.

**P1-5. Search, filters, sort, and page are not in the URL.**
Only the dataset ID is in the hash. Users cannot share "virtual layers with
published previews sorted by size", reload the same view, or use browser
back/forward without losing filters.

**P1-6. Detail is a raw field dump.**
Metadata and provenance are rendered as ungrouped definition lists using raw
keys such as `manifest_row_source`, `zip_read_status`, and
`preview_eligibility_status`. Long keys wrap in narrow columns. A user sees
`candidate_missing_crs` and `metadata_recovered` without an explanation. The
information is valuable; the presentation does not teach the user what it
means.

**P1-7. The map is not a map.**
The preview is an `<img>` with `object-fit: fill`, laid over a decorative CSS
grid and an optional reference image. There is no pan, zoom, fit-to-bounds,
scale bar, coordinate readout, or geographic context. Layer controls only
toggle visibility and opacity. A geospatial catalog should let users explore
the layer spatially.

**P1-8. Preview manifest loading blocks the catalog.**
`loadCatalog()` awaits `loadPreviewManifest()` before rendering the summary or
results. If the published index is slow or the local fallback is missing, the
catalog waits. The catalog should render immediately and hydrate preview
badges/thumbnails asynchronously.

**P1-9. No preview thumbnails in results.**
The catalog is text-only even though 2,163 preview images exist. A thumbnail is
the fastest way for a user to recognize a layer. Lazy-loading a small preview
image per result would dramatically improve scanability.

### 3.4 P2: Polish, accessibility, and trust

- No skip link to results or map.
- Hidden segmented-control radios have no visible `:focus-visible` treatment on
  their labels.
- The result count is not an `aria-live` region; the selected row has no
  `aria-current` or equivalent state.
- Sortable columns are not sortable in the table; sort lives in a separate
  select. The table has no `aria-sort`.
- The generated timestamp is rendered as a raw ISO string
  (`2026-11-02T08:20:41+00:00`) rather than a human-readable local date.
- The product name is lowercase in the document title, and the page heading is
  a document-scale `h1` rather than an application brand.
- Error and empty states tell the user to run a Python generator or serve the
  `web/` directory themselves. That is appropriate for a maintainer, not a
  catalog user.
- Color is used for warning meaning in some map states without a text label.
- There is no dark-mode strategy. WS4/FHOPS are light-only; dark mode can be a
  later enhancement, not a first-cut requirement.
- There is no batch export, compare, or saved-search workflow. These are
  useful later, but they should not delay the browse fix.

### 3.5 What Already Works And Should Be Preserved

- Stable hash routes for dataset and map deep links.
- Separation of generated catalog data from the static app.
- The catalog includes real provenance, verification status, and uncertainty
  notes; the UI does not pretend the metadata is authoritative.
- The map preview state model distinguishes published, local, and unavailable
  artifacts and handles `not_previewable` records.
- Copy-to-clipboard snippets for Python and CLI.
- Static-first deployment: no credentials, no DataLad retrieval, no worker
  queue, no Node build step.
- Smoke tests that check the catalog artifact, UI logic, and DOM flow.
- The data contract already defines preview manifests, bounds, CRS, and legend
  classes, which is enough to build a real map without inventing new data.

## 4. What To Borrow From WS4 And FHOPS

### 4.1 Borrow

| Pattern | Why it fits |
| --- | --- |
| Compact header (44-48 px) with brand, workspace tabs, global search, status | Replaces the oversized document header and gives every route a stable anchor. |
| Workspace tabs (`Browse`, `Map`) | Separates catalog scanning from spatial exploration without a page reload. |
| Left panel + main canvas + optional inspector | Matches the task: narrow filters, wide results, contextual detail. |
| Neutral ink/muted/line/panel palette with one accent | The WS4/FHOPS language reads as a tool rather than a brochure. |
| Dense tables, 14 px system font, tabular numerals | Makes 2,183 records and byte sizes scannable. |
| Explicit loading/empty/error states that name the missing artifact | Preserves the project's honesty and helps maintainers diagnose cold clones. |
| Keyboard shortcuts (`/` search, arrows to move, `Enter` open, `Esc` close, `m` map) | Makes the catalog usable without a mouse. |
| Skip link, visible focus rings, ARIA tabs, `aria-live` status | Brings the app toward WCAG 2.2 AA. |
| MapLibre + layer tree + legend + map fallback | Turns the static preview into a real geospatial workspace. |
| Prefix-relative assets and API URLs | Keeps the app working under JupyterHub/code-server proxy paths. |
| URL-addressable state | Makes every view shareable and reloadable. |

### 4.2 Do Not Borrow Yet

| Pattern | Why not |
| --- | --- |
| FastAPI + uvicorn in the request path | The catalog is read-only and can stay static. Adding a service now adds deployment, auth, and failure modes for no user benefit. Revisit when AOI/download jobs exist. |
| SSE / live telemetry | There are no running jobs to stream. |
| Skin manifests | Premature for one catalog surface. A `review` view for maintainers can be a later feature. |
| Assistant/agent panel | Not needed for catalog browsing and has security implications. |
| Solver/Gantt/carbon/target panels | Different product. |
| 64-bit-heavy client state and parallel islands | Not applicable. |

The lesson from WS4/FHOPS is not "copy the sidebar". It is "make the state,
layout, and status visible; keep the surface dense; use real artifacts; fail
loudly and specifically."

## 5. Target Experience

### 5.1 Product Principles

1. **Task first.** The first screen is the catalog, not a landing page.
2. **Scan, then inspect.** Results should be scannable in seconds; detail should
   be available without losing the result set.
3. **Spatial when useful.** Map is a workspace, not a footer image.
4. **Trust through evidence.** Show provenance, verification, and preview
   status, but explain what they mean.
5. **Fast by default.** Compress, cache, paginate, lazy-load, and keep the map
   bundle off the browse route.
6. **Accessible and responsive.** Keyboard, screen reader, 320 px, and touch
   are first-class.
7. **Static-first.** No credentials, no server dependency for browse.

### 5.2 Information Architecture

Three surfaces, one shell:

| Surface | Purpose | Primary content |
| --- | --- | --- |
| **Browse** | Find a layer | Global search, facets, result list/table, preview thumbnails, selection |
| **Dataset** | Understand and use a layer | Summary, metadata, provenance, payload, gaps/uncertainty, actions, map entry |
| **Map** | Explore the layer spatially | Map canvas, layer/legend panel, opacity/visibility, basemap toggle, dataset inspector |

The global header is always present:

```text
[HectaresBC] [Browse] [Map]   [Search all 2,183 records........]   [Preview index: 2,163] [Help]
```

The dataset surface can be a full route or an inspector panel plus an expanded
route. On desktop, use a right inspector in Browse and a full-width dataset
route when the user opens a record. On mobile, opening a record pushes a detail
view with a clear "Back to results" control.

### 5.3 Layout And Responsive Behavior

**Desktop, 1200 px and up:**

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ HectaresBC  Browse  Map     [Search all 2,183 records........]  2,163 previews │
├───────────────┬────────────────────────────────────────────┬─────────────────┤
│ FILTERS       │ 2,183 results   Sort: Relevance   View: ▤  │ BCTS Operating  │
│ Family        │ ┌────────────────────────────────────────┐ │ Areas           │
│  All    2183  │ │ [img] BCTS Operating Areas             │ │ Data layer      │
│  Data    418  │ │       dl_adminunits_bcts · 1.0 MB      │ │ [Preview ready] │
│  Virtual 1765 │ │       [Preview] [Metadata recovered]   │ │ [Open map]      │
│ Preview       │ ├────────────────────────────────────────┤ │                 │
│  Any    2163  │ │ [img] Bull Trout                       │ │ Overview        │
│  Ready  2163  │ │       vl_virtualspecies... · 2.4 MB    │ │ Size      1.0 MB│
│  None     20  │ │       [No preview] [Metadata recovered]│ │ Source ZIP ...  │
│ Verification  │ ├────────────────────────────────────────┤ │                 │
│  Recovered    │ │ ...                                    │ │ Provenance      │
│  Conflict  12 │ └────────────────────────────────────────┘ │ ...             │
│               │ [◀ 1 2 3 ... 44 ▶]   Showing 1-50 of 2,183 │                 │
└───────────────┴────────────────────────────────────────────┴─────────────────┘
```

**Tablet, 768-1199 px:** collapse the filter rail into a filter bar above the
results; keep the inspector as a right drawer or replace it with a detail route.
The result list remains the primary column.

**Mobile, under 768 px:** single column. Sticky search and a "Filters" button
open a bottom sheet. Results are cards, not a horizontally scrolling table.
Opening a record replaces the list with the detail view and a sticky "Back to
results" bar. Map is a full-screen route with a bottom sheet for layer controls.

Key responsive rules:

- `min-width: 0` on every grid/flex child that can contain a table or map.
- No fixed table minimum width on small screens; switch to cards.
- 44 px minimum touch targets for controls.
- Sticky header and sticky result toolbar; do not let filters scroll away.
- Test at 320, 390, 768, 1024, 1440, and 1920 px.

### 5.4 Visual Design System

Use the WS4/FHOPS token language, with the existing HectaresBC green retained
as the identity accent.

| Token | Value | Use |
| --- | --- | --- |
| `--ink` | `#1f2933` | Primary text |
| `--muted` | `#616e7c` | Secondary labels, metadata |
| `--line` | `#d9e2ec` | Borders, dividers |
| `--bg` | `#f7f9fb` | App background |
| `--panel` | `#ffffff` | Panels, tables, inspector |
| `--accent` | `#23645a` | Brand, selected state, primary action |
| `--accent-strong` | `#174c44` | Hover/pressed |
| `--focus` | `#1f6feb` | Focus ring |
| `--ok` | `#2f7d4f` | Preview ready, verified |
| `--warn` | `#b45309` | Missing preview, conflict |
| `--danger` | `#b91c1c` | Errors |

Type and density:

- 14 px / 1.45 system-ui base, not 16 px document prose.
- 12-13 px for metadata labels and table headers.
- Tabular numerals for counts, sizes, bounds, and coordinates.
- 0.35-0.45 rem radii; 1 px borders; no heavy shadows.
- 44-48 px header; 32-36 px table rows on desktop; 64-80 px mobile cards.
- One accent color for actions; links use the same accent or the focus blue,
  not two unrelated blues.

Content language:

- Replace raw enums with human labels and a short explanation on hover or in a
  details block. Example: `candidate_missing_crs` becomes
  "Preview candidate — CRS not recovered" with a tooltip/help text.
- Replace "Catalog generated 2026-11-02T08:20:41+00:00" with
  "Catalog updated 2 Nov 2026, 08:20 UTC" and a relative time where useful.
- Error copy should say what the user can do, then show the maintainer command
  behind a "For maintainers" disclosure.

### 5.5 Component Inventory

Build these once and reuse them across Browse, Dataset, and Map:

- `AppShell`, `Header`, `WorkspaceTabs`, `SkipLink`
- `GlobalSearch`, `SearchHelp`, `ActiveFilterChips`, `ClearFilters`
- `FilterRail`, `FacetGroup`, `FacetOption`, `FacetCount`
- `ResultToolbar`, `ResultTable`, `ResultRow`, `ResultCard`, `PreviewThumb`
- `StatusBadge` (`Preview ready`, `No preview`, `Metadata recovered`,
  `Conflict detected`), `WarningBadge`
- `Pagination`, `ShowingCount`, `SortHeader`
- `DatasetHeader`, `ActionBar`, `MetadataSection`, `DefinitionList`,
  `ProvenanceList`, `PayloadMembers`, `GapCallout`, `CodeBlock`, `CopyButton`
- `MapCanvas`, `MapLayerPanel`, `LayerToggle`, `OpacityControl`, `Legend`,
  `MapStatus`, `MapFallback`, `BasemapToggle`
- `EmptyState`, `ErrorState`, `Skeleton`, `Toast`, `KeyboardHelp`

Keep DOM construction in small vanilla functions. Avoid a framework and avoid
a Node build step. If templates are used, escape interpolated values and keep
untrusted catalog text out of `innerHTML`.

Suggested module layout:

```text
web/
  index.html
  css/
    tokens.css
    base.css
    layout.css
    components.css
    map.css
  js/
    main.js
    router.js
    state.js
    store.js
    format.js
    search.js
    api.js
    views/
      catalog.js
      dataset.js
      map.js
    components/
      ...
  vendor/
    maplibre-gl.js
    maplibre-gl.css
  data/
    catalog.index.json
    catalog.details.json
    catalog.meta.json
```

Use native ES modules and relative imports. Add a `?v=<commit-or-build>` query
to versioned CSS/JS so the static server can cache aggressively.

## 6. Technical Approach

### 6.1 Architecture Decision

| Option | Verdict | Reason |
| --- | --- | --- |
| Keep the current single-page stack and restyle it | No | The problems are structural: state loss, scroll depth, no facets, no map. |
| Static-first ES-module SPA with a new shell | **Recommended** | Preserves the project's no-credential, no-build, static deployment posture. Supports all browse/detail/map needs. |
| Add FastAPI + uvicorn now | Not yet | Only justified for AOI clipping, download jobs, server-side preview rendering, or authenticated private data. Add later behind the same front-end contract. |
| React/Vue/Svelte + Vite | No | Adds a Node toolchain and a dependency surface for a mostly read-only catalog. WS4/FHOPS demonstrate that a small ES-module shell is sufficient. |

The upgrade should be a **static-first application shell**. The service
boundary stays at `scripts/serve_web_app.py` for development and a static host
in production. When AOI/download work arrives, a thin FastAPI service can serve
`/api/catalog` and `/api/previews` behind the same client store, without
rewriting the UI.

### 6.2 Route And State Model

Use hash routes. They work on static hosts and under proxy prefixes without
server rewrites, which is important for the existing JupyterHub/code-server
deployment.

| Route | Purpose |
| --- | --- |
| `#/catalog?q=...&family=...&preview=...&verify=...&sort=...&page=...` | Browse workspace |
| `#/dataset/<dataset_id>` | Dataset detail |
| `#/dataset/<dataset_id>/map` | Map workspace for one dataset |
| `#/about` | Optional methodology/help route |

Compatibility redirects:

- `#<dataset_id>` -> `#/dataset/<dataset_id>`
- `#map=<dataset_id>` -> `#/dataset/<dataset_id>/map`

Keep the old routes working for documentation, bookmarks, and smoke tests.
Encode only non-default values in the query string. Use `replaceState` for
filter changes and `pushState` for navigation so browser Back returns to the
previous result set.

Client state shape:

```js
{
  view: "catalog" | "dataset",
  datasetId: null | string,
  mapOpen: false,
  query: "",
  family: "all" | "data_layer" | "virtual_layer",
  preview: "all" | "available" | "unavailable" | "not_previewable",
  verification: "all" | "metadata_recovered" | "conflict_detected",
  sort: "relevance" | "title" | "dataset_id" | "family" | "size_desc",
  page: 1,
  pageSize: 25 | 50 | 100
}
```

Rules:

- Opening a dataset must not mutate the catalog query, family, sort, or page.
- Back from a dataset must restore the exact previous view.
- A malformed query parameter falls back to its default and reports nothing
  scary; unknown dataset IDs render the not-found state.
- The map route inherits the dataset ID but keeps its own layer/opacity state
  in the URL when practical.

### 6.3 Catalog Artifact Contract

Keep `web/data/catalog.json` as the compatibility artifact while introducing a
smaller browse payload.

Recommended generated artifacts:

| Artifact | Contents | Loaded |
| --- | --- | --- |
| `catalog.meta.json` | `schema_version`, `generated_at`, counts, source revision | On boot |
| `catalog.index.json` | One compact row per record: ID, title, family, source stem, size, verification, known gaps flag, preview status/availability, thumbnail URL, search text | On boot / browse |
| `catalog.details.json` | Full metadata, provenance, payload members, uncertainty notes keyed by dataset ID | Lazily on first dataset open |
| `previews.index.json` | Joined preview artifact index (status, kind, bounds, CRS, legend, manifest URL) | Asynchronously, non-blocking |

The existing `catalog.json` can remain as an alias for `catalog.details.json` or
be emitted for backward compatibility. The generator must keep the current
2,183-record invariants and the representative IDs used by tests.

Target sizes:

- `catalog.index.json`: under 1.5 MB raw / 200-300 KB gzip.
- `catalog.details.json`: lazy, under 6 MB raw / 300 KB gzip.
- `previews.index.json`: compact, under 500 KB raw.

If per-record detail files are preferred later, the client store can fetch
`records/<dataset_id>.json` on demand. Start with one lazy details file; shard
only if the payload or parse cost justifies it.

### 6.4 Preview Status Model

Do not conflate three different things:

| Concept | Source | Meaning |
| --- | --- | --- |
| Source format | `record.preview.has_raster`, `has_wms` | Whether the archive contains TIFF/WMS members |
| Preview eligibility | `record.preview.eligibility_status` | Whether recovered metadata is sufficient to attempt a preview |
| Published artifact | `previews.index.json` | Whether a real preview PNG exists and is usable now |

The Browse list should show:

- a **Format** label (`TIFF`, `TIFF + WMS`, `Vector`, `Unknown`);
- a **Preview** badge (`Preview ready`, `No preview`, `Not previewable`);
- an optional thumbnail when a published artifact exists.

The Dataset view should explain the difference in one short paragraph and show
the eligibility blockers only in an expandable "Why?" block. This removes the
current table/detail contradiction and makes the 2,163-preview coverage
discoverable.

### 6.5 Map Workspace

Use MapLibre GL JS, vendored like WS4/FHOPS, with the existing preview PNGs as
image overlays:

1. Load the catalog and preview manifest.
2. For a record with `wgs84_bounds`, add an `image` source with four corner
   coordinates and a raster layer.
3. Fit the map to the image bounds on open.
4. Add an OSM raster basemap by default, with an "Offline reference" toggle
   that uses the source-derived NRS reference image or a neutral background.
5. Add navigation controls, scale bar, attribution, and a coordinate readout.
6. Add a left layer panel with visibility, opacity, legend classes, basemap
   toggle, and "Fit layer".
7. Add a "Full screen" control and a deep link that preserves center/zoom.
8. If WebGL is unavailable or MapLibre fails to load, fall back to the current
   static image with a clear "Interactive map unavailable" message.
9. For `not_previewable`, `source_unavailable`, or missing-bounds artifacts,
   show a status panel with the reason and evidence, not a blank map.
10. Lazy-load MapLibre only on the map route so browse stays fast.

MapLibre image overlays require axis-aligned bounds. If a preview has
non-axis-aligned bounds or no `wgs84_bounds`, show the image in a pan/zoom
lightbox and explain that it is not georeferenced. Do not guess coordinates.

### 6.6 Performance Budget

| Metric | Target |
| --- | --- |
| Initial HTML + CSS + JS (browse) | under 150 KB gzip |
| `catalog.index.json` | under 300 KB gzip |
| Catalog first render | under 1.5 s on a fast connection; skeleton immediately |
| LCP (mobile, simulated 4G) | under 2.5 s |
| INP | under 200 ms |
| CLS | under 0.1 |
| Filter/search response | under 100 ms for 2,183 records |
| Table render (50 rows) | under 50 ms |
| MapLibre bundle | lazy-loaded only on the map route |

Implementation rules:

- Gzip (and optionally serve precompressed brotli) static JSON/JS/CSS in
  `scripts/serve_web_app.py`; set `Cache-Control` and `ETag`.
- Version assets with a build/commit query and cache them immutably.
- Render the catalog from `catalog.index.json`; load details on demand.
- Do not await the preview manifest before rendering browse.
- Use `loading="lazy"`, `decoding="async"`, and explicit dimensions on
  thumbnails.
- Debounce search input by 150-200 ms; precompute lowercase/normalized search
  text in the index.
- Paginate or virtualize results. Prefer pagination with "Showing 1-50 of
  2,183" over rendering thousands of rows.
- Avoid layout shift by reserving thumbnail and panel dimensions.
- Load MapLibre with a dynamic import or a separate script tag on the map route.

### 6.7 Accessibility Contract

Target WCAG 2.2 AA.

- Skip link to the result list and to the map.
- Semantic landmarks: `header`, `nav`, `main`, `aside`, `section` with headings.
- Visible `:focus-visible` ring (`2 px solid var(--focus)`, 2 px offset) on every
  interactive element, including custom segmented controls.
- Result table: real `<table>`, `<th scope="col">`, `aria-sort` on sortable
  headers, links in the title cell, selected row with `aria-current="true"`.
- Result count and filter changes announced through a polite live region.
- Mobile cards: list semantics with a clear accessible name per card.
- Dataset route: focus moves to the dataset heading; "Back to results" is the
  first focusable control.
- Map: accessible name, keyboard instructions, text summary of layer/bounds/
  legend, and a non-map fallback. Do not rely on color alone for status.
- Forms: every input has a visible label; errors are associated with
  `aria-describedby`.
- Touch targets at least 44 x 44 px.
- Respect `prefers-reduced-motion`; avoid animated transitions that cannot be
  disabled.
- Contrast: body text and muted text at least 4.5:1; large text at least 3:1.
- Test at 200% zoom and 320 px width with no horizontal scrolling.

### 6.8 Compatibility And Migration

- Keep the old hash routes as redirects for at least one release.
- Keep `scripts/serve_web_app.py` allowed prefixes working; add the new
  `web/data/` artifacts and `web/vendor/` if needed.
- Keep the catalog generator's 2,183-record invariants and representative IDs.
- Update `scripts/smoke_test_web_static_app.py` expected DOM IDs or replace it
  with a shell test that checks the new landmarks.
- Update `scripts/smoke_test_web_catalog_ui.js` for the new pure functions.
- Update `scripts/smoke_test_web_app_dom.js` or replace it with a Playwright
  test; the hand-written fake DOM will become brittle as the component tree
  grows.
- Update `docs/browser_app.rst` and `web/README.md` with the new routes,
  artifacts, and commands.
- Keep the app prefix-relative: no absolute `/` URLs in HTML, CSS, or JS.

## 7. Phased Implementation Plan

Proposed roadmap phase: **P19: Browser UI Upgrade**. Activate it with one parent
issue and one feature branch (`feature/p19-web-ui-upgrade`) per `AGENTS.md`.
Create child issues P19.0-P19.5 and keep `ROADMAP.md`, `CHANGE_LOG.md`, and
`planning/` synchronized.

### P19.0 UX Contract And Design System (1-2 days)

Deliverables:

- This plan approved and referenced from the roadmap.
- `web/css/tokens.css` with the palette, spacing, radii, typography, and focus
  tokens.
- Route map and state schema documented.
- Low-fidelity wireframes for desktop, tablet, and mobile.
- Component inventory and naming agreed.

Acceptance:

- Tokens render in a static styleguide page (`web/styleguide.html` or a
  documented section in the plan).
- Route and state schema reviewed before component work starts.
- No behavior change to the existing app yet.

### P19.1 Application Shell And Responsive Layout (3-4 days)

Deliverables:

- New `index.html` with header, workspace tabs, skip link, and main landmarks.
- Three-pane desktop grid; filter rail; result column; inspector drawer.
- Tablet and mobile layouts with a single column and bottom-sheet filters.
- Skeleton/loading, empty, error, and not-found shells.
- `min-width: 0` fixes for tables and maps.

Acceptance:

- No horizontal scrolling at 320, 390, 768, 1024, 1440, and 1920 px.
- Header, tabs, and skip link are keyboard accessible.
- Opening a dataset no longer changes the catalog query or result set.
- Old hash routes redirect to the new routes.

### P19.2 Browse Workspace (4-5 days)

Deliverables:

- `catalog.index.json` generation and client store.
- Search ranking, debounce, highlighting, and "no results" suggestions.
- Facets: family, preview availability, verification status, preview
  exception, size bucket; facet counts.
- Active filter chips, clear all, sort control, pagination with "Showing X-Y of
  Z", and page-size control.
- Result table on desktop and cards on mobile, with preview thumbnails,
  format label, preview badge, verification badge, and size.
- URL state and browser Back/Forward behavior.

Acceptance:

- A user can filter to "virtual layers with previews, sorted by size" and share
  the URL.
- Opening a record preserves the filter context; Back restores the exact view.
- Only one page of rows is in the DOM at a time.
- Search over 2,183 records responds in under 100 ms after debounce.
- Empty state offers "Clear filters" and example searches.

### P19.3 Dataset Inspector (3-4 days)

Deliverables:

- Dataset header with title, ID, family, verification badge, preview badge, and
  primary actions (Open map, Copy ID, Copy CLI, Download metadata JSON).
- Grouped overview, metadata, provenance, payload (when present), and
  gaps/uncertainty sections with human labels.
- Raw source fields behind a "Show raw field names" or "Technical details"
  disclosure.
- Copy buttons for ID, source ZIP, Python, CLI, and dry-run fetch.
- "Why is this preview unavailable?" explanation for non-previewable records.
- Focus management and "Back to results".

Acceptance:

- The detail view is readable without knowing the catalog schema.
- Long identifiers and paths wrap without breaking the layout.
- No raw enum is the only explanation of a state.
- Copy actions work with a visible success/failure state.
- The route is deep-linkable and reloadable.

### P19.4 Map Workspace (4-6 days)

Deliverables:

- Vendored MapLibre assets and a lazy map route.
- Image overlay from `wgs84_bounds`, fit-to-bounds, pan/zoom, scale bar,
  navigation controls, attribution, and coordinate readout.
- Layer panel with visibility, opacity, legend, basemap toggle, and fit layer.
- OSM basemap with an offline/reference fallback.
- Full-screen mode and deep link state.
- Static-image fallback when WebGL or MapLibre is unavailable.
- Clear states for `not_previewable`, missing bounds, and missing artifacts.

Acceptance:

- A previewable layer opens centered on its bounds and can be panned/zoomed.
- The layer can be hidden, faded, and fitted from the panel.
- The map works at 390 px and keyboard-only.
- A missing preview shows a useful explanation, not an empty canvas.
- The browse route does not load MapLibre.

### P19.5 Performance, Accessibility, Tests, And Close-Out (3-4 days)

Deliverables:

- Gzip (and optional precompressed brotli) and cache headers in
  `scripts/serve_web_app.py`.
- Lazy detail/preview loading and thumbnail optimization.
- Playwright browser checks for responsive layout, routing, keyboard, and map
  fallback.
- Accessibility pass with axe or a documented manual checklist.
- Updated smoke tests, docs, `README.md`, and `web/README.md`.
- Lighthouse/Core Web Vitals measurements recorded in the close-out.

Acceptance:

- Lighthouse mobile performance and accessibility at least 90 (or documented
  exceptions with reasons).
- No serious/critical axe findings on Browse, Dataset, and Map.
- Browser tests pass at 390, 768, and 1440 px.
- Old routes and representative dataset/map routes still work.
- Docs describe the new artifacts, routes, and commands.

### P19.6 Optional Later Work

- Compare two layers or two catalog snapshots.
- Saved searches and shareable collections.
- Batch selection and CSV/JSON export of result metadata.
- AOI drawing and tile selection.
- Controlled download request workflow with authentication, queue, and output
  lifecycle.
- A `review`/maintainer view showing diagnostics, artifact freshness, and
  coverage reports.
- Dark mode.

Do not let these delay P19.1-P19.5.

### Effort Summary

| Phase | Estimate | Depends on |
| --- | ---: | --- |
| P19.0 UX contract and tokens | 1-2 days | Approval of this plan |
| P19.1 Shell and responsive layout | 3-4 days | P19.0 |
| P19.2 Browse workspace | 4-5 days | P19.1 |
| P19.3 Dataset inspector | 3-4 days | P19.1 |
| P19.4 Map workspace | 4-6 days | P19.1, preview manifest contract |
| P19.5 Performance, a11y, tests, docs | 3-4 days | P19.2-P19.4 |
| **Total** | **18-25 dev days** | One developer, 4-5 weeks; two developers can parallelize P19.2/P19.3/P19.4 after P19.1. |

## 8. Testing And Acceptance

### 8.1 Test Matrix

| Layer | Test |
| --- | --- |
| Catalog generator | 2,183 records, family counts, representative IDs, new index/detail artifacts agree |
| Pure UI logic | Search ranking, facets, sort, pagination, URL encoding/decoding, preview status mapping |
| DOM smoke | New shell landmarks, route rendering, empty/error states, old route redirects |
| Browser (Playwright) | 390/768/1440 layouts, no horizontal scroll, keyboard flow, focus management, map fallback |
| Accessibility | axe scan plus manual keyboard/screen-reader checklist |
| Performance | Lighthouse/Core Web Vitals, transfer sizes, filter timing |
| Regression | Representative BCTS and Bull Trout routes; `not_previewable` route; missing submodule/cold-clone behavior |
| Docs | Sphinx build, `web/README.md` commands, route examples |

### 8.2 Definition Of Done

- The first screen is the catalog, not a summary band.
- A user can search, facet, sort, paginate, open a dataset, return, and open a
  map without losing context.
- Every view is shareable by URL.
- The app is usable at 320 px with no horizontal scrolling.
- The app is keyboard and screen-reader usable.
- Browse does not load MapLibre or the full detail payload.
- The catalog renders even when the preview index is unavailable.
- Preview availability is accurate and distinct from source format.
- The map is interactive when a georeferenced preview exists and explains
  itself when it does not.
- The static-first deployment still requires no credentials, no DataLad
  retrieval, no worker, and no Node build step.
- Old routes, docs, and smoke tests still work or have documented redirects.
- Lighthouse and axe results are recorded, with exceptions justified.

## 9. Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| The preview index is unavailable in a cold clone or without the data submodule | Render browse from the catalog first; hydrate previews asynchronously; show a non-blocking "preview index unavailable" badge. |
| Preview PNGs are annexed and may not be present | Lazy-load thumbnails; show a neutral placeholder; never block the list. |
| MapLibre WebGL is unavailable | Detect failure and fall back to the static image with a clear message. |
| OSM tile policy/network dependency | Provide an offline/reference basemap toggle and attribution; document tile usage. |
| 2,183 records grow beyond client-side comfort | Keep the index compact; paginate; add virtualization or a service API only when measurements require it. |
| `catalog.details.json` remains large | Lazy-load on first detail open; shard per record if needed. |
| Scope creep into AOI/download | Keep P19.6 explicitly separate; do not add job or credential code in this phase. |
| Existing smoke tests break during the rewrite | Update tests with the new DOM contract; keep pure logic functions stable; add redirects. |
| Design drifts from WS4/FHOPS | Use the shared token table and component language; document intentional differences. |
| Mobile regressions | Add Playwright width checks and a "no horizontal scroll" assertion to CI or the smoke script. |
| Accessibility regressions | Add axe/manual checks to the close-out criteria; include keyboard paths in browser tests. |

## 10. Non-Goals

- Recreating the original HectaresBC service.
- A full GIS editor, feature editing, or 3D.
- AOI clipping, download jobs, queues, or authenticated outputs in this phase.
- A database or multi-user accounts.
- A React/Vue/Svelte build pipeline.
- Replacing the Python API or Typer CLI.
- A marketing landing page.
- Dark mode as a first-cut requirement.
- Copying WS4/FHOPS solver, telemetry, skin, or assistant features.

## 11. Open Questions

1. Should preview thumbnails be generated as small derivatives (for example
   160 px wide) in the data repository, or should the browser use the full
   preview PNG with CSS sizing and lazy loading? Small derivatives are better
   for mobile but add a publication workflow.
2. Should the first release use OSM raster tiles, the recovered reference
   image, or both? Confirm tile usage policy and offline expectations.
3. Should the Browse list default to table or card layout on desktop? The plan
   recommends table with thumbnails; cards are for mobile and optional
   "comfortable" density.
4. Should the Dataset view be a full route, a right inspector, or both? The
   plan recommends an inspector for quick peeks and a full route for the
   canonical deep link.
5. Do we need a `review` view for maintainers (conflict status, artifact
   freshness, coverage) in P19, or can it wait?
6. Should the new app keep a `catalog.json` alias for external consumers, or
   should consumers move to `catalog.index.json` / `catalog.details.json`?
7. What is the minimum browser support matrix? MapLibre requires WebGL; the
   static fallback should cover older or restricted clients.

## 12. Activation Checklist

Following the repository workflow in `AGENTS.md`:

- [ ] Approve this plan and choose the phase number (proposed P19).
- [ ] Create the parent GitHub issue for "P19: Browser UI upgrade".
- [ ] Create the feature branch from current `main`:
      `feature/p19-web-ui-upgrade`.
- [ ] Create child issues P19.0-P19.5 with checklist subtasks.
- [ ] Add the phase to `ROADMAP.md` and record the issue numbers.
- [ ] Record the plan in `CHANGE_LOG.md` when work starts.
- [ ] Re-read the WS4/FHOPS reference shells and the preview artifact contract
      before the first component line.
- [ ] Capture before/after screenshots at 390, 768, and 1440 px for the
      close-out.

## 13. One-Sentence Recommendation

Treat this as an application-shell rewrite of the browse/detail/map surfaces,
not a CSS refresh: keep the honest data and static-first deployment, borrow the
WS4/FHOPS density and map discipline, and fix navigation state, mobile layout,
preview semantics, and payload size before adding any new features.
