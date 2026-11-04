Overview
========

HectaresBC was a geospatial data platform for British Columbia. This repository
does not try to recreate the old service exactly. It preserves the recovered
data assets and rebuilds access around reproducible catalog metadata, a
DataLad/git-annex data repository, and small user-facing tools.

Current capabilities include:

* catalog lookup, search, and filtering through the Python API;
* a thin Typer CLI over the same API;
* local path resolution, content-status checks, backend diagnostics, and dry-run
  retrieval planning;
* a responsive browser catalog with Browse, Dataset, MapLibre Map, Compare,
  Series, Tours, Bundles, and protected Admin routes;
* synchronized Compare (split/wipe/flicker) and Series (2–30 frames with lazy
  sources, prefetch, year discovery, PNG/contact-sheet/WebM export);
* guided Tours with prefilled Clip and auto-open Discovery deep links;
* labeled Map PNG export and accessible focus/shortcut/mobile behavior;
* protected admin storage usage, retention settings, and manual pruning;
* a DataLad-backed source-derived browser preview publication covering 2,183
  recovered catalog records, with 2,163 preview PNGs and 20 records marked
  ``not_previewable``;
* an optional FastAPI service with on-demand 1-ha raster tiles, low-zoom overlay
  and optional COG fast paths, tile-cache and usage statistics, the OpenCode
  assistant, FEMIC boundary resolution, AOI area preflight, clipped raster
  bundle jobs with progress/cancel/retry, and configurable output retention;
* saved and shareable browser workspaces that restore tray layers, map view,
  AOI, and Clip selections;
* a local reusable AOI library for named and recent boundaries and drawn areas.

Important current limits:

* raw HectaresBC payloads live outside this repository in a DataLad submodule;
* the map is a focused raster workspace, not a full general-purpose GIS editor;
* the optional service is a demo-scale deployment with six-layer and area limits;
* service authentication is delegated to a proxy such as Cloudflare Access/Zero
  Trust; the app does not implement user accounts;
* COG derivatives and 2048 px preview overrides are optional generated data, not
  tracked repository content.
