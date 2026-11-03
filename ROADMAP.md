
# Roadmap

This roadmap is intentionally lightweight. It should guide the next few moves without forcing the repo to carry FEMIC-level process before the HectaresBC archive shape is understood.

## Phase 0: Governance Bootstrap

GitHub parent issue: #1

- [x] P0.1 Create root agent operating contract in `AGENTS.md`. Child issue: #5.
- [x] P0.2 Establish lightweight roadmap and changelog surfaces. Child issue: #2.
- [x] P0.3 Create first focused planning note for archive inventory. Child issue: #4.
- [x] P0.4 Review and refine this scaffold after the first archive reconnaissance pass. Child issue: #3.
- [x] P0.5 Define strict issue, branch, and PR workflow. Child issue: #31.

## Phase 1: Archive Reconnaissance

GitHub parent issue: #34

Active branch: `feature/p1-archive-reconnaissance`

- [x] P1.1 Define archive inventory output contract. Child issue: #36.
- [x] P1.2 Build root inventory and ZIP manifest. Child issue: #37.
- [x] P1.3 Parse root metadata and control files. Child issue: #38.
- [x] P1.4 Classify ZIP payload families and integrity signals. Child issue: #39.
- [x] P1.5 Recommend data repository layout approach. Child issue: #35.

## Phase 2: Metadata And Provenance Recovery

GitHub parent issue: #43

Active branch: `feature/p2-metadata-provenance`

- [x] P2.1 Define a minimal dataset identity model: source path, original name, inferred title, format, CRS when known, metadata source, and uncertainty notes. Child issue: #45.
- [x] P2.2 Recover compact virtual-layer catalog records from root metadata and ZIP evidence. Child issue: #48.
- [x] P2.3 Recover compact data-layer metadata records from per-ZIP metadata files. Child issue: #47.
- [x] P2.4 Draft naming and provenance conventions before any broad normalization. Child issue: #44.
- [x] P2.5 Summarize metadata recovery results and Phase 3 ingestion-design inputs. Child issue: #46.

## Phase 3: Reproducible Ingestion Design

GitHub parent issue: #50

Active branch: `feature/p3-ingestion-design`

- [x] Activate Phase 3 with a GitHub parent issue and feature branch after Phase 2 PR #49 merges to `main`.
- [x] P3.1 Choose tooling based on archive contents, not before. Child issue: #54.
- [x] P3.2 Design compact, rerunnable inventory and metadata extraction workflows. Child issue: #51.
- [x] P3.3 Add the first validation checks for source-data readability and metadata consistency. Child issue: #52.
- [x] P3.4 Summarize ingestion design and Phase 4 inputs. Child issue: #53.

## Phase 4: DataLad-Backed Data Repository

GitHub parent issue: #6

Active branch: `feature/p4-datalad-data-repo`

The HectaresBC archive is expected to include large files and a large total data payload. This repository will not track that payload directly with plain Git/GitHub. The planned pattern is to link a separate public DataLad/git-annex dataset repository, `UBC-FRESH/fresh-hectaresbc-data`, as a Git submodule under `external/fresh-hectaresbc-data`, following the established FEMIC `external/` pattern.

Phase 4 storage work should configure a DataLad/git-annex S3 special remote pointing to a new Arbutus object-storage bucket. Credentials must use the user-local FEMIC-style pattern under `~/.config/fresh-hectaresbc/`, not tracked repo files. See `planning/arbutus_s3_special_remote_plan.md`.

- [x] P4.1 Define the data repository contract. Child issue: #8.
- [x] P4.2 Initialize `UBC-FRESH/fresh-hectaresbc-data` as a DataLad dataset. Child issue: #11.
- [x] P4.3 Configure storage remote for annexed payloads. Child issue: #9.
- [x] P4.4 Link the DataLad repo as a Git submodule at `external/fresh-hectaresbc-data`. Child issue: #7.
- [x] P4.5 Validate cold-clone data access workflow. Child issue: #10.

## Phase 5: Full HectaresBC Data Publication

GitHub parent issue: #57

Active branch: `feature/p5-full-data-publication`

Phase 4 proved the DataLad/git-annex, submodule, and Arbutus S3 special-remote architecture with six representative ZIP payloads. Phase 5 publishes the remaining rescued HectaresBC archive payloads into `UBC-FRESH/fresh-hectaresbc-data` so API, CLI, package, and web-app work can build against the actual full data repository.

- [x] P5.1 Define full archive publication contract. Child issue: #58.
- [x] P5.2 Mirror compact metadata and root control files into the data repo. Child issue: #59.
- [x] P5.3 Annex all remaining raw HectaresBC ZIP payloads. Child issue: #60.
- [x] P5.4 Upload all annexed payloads to `arbutus-s3`. Child issue: #61.
- [x] P5.5 Validate full ZIP inventory coverage. Child issue: #62.
- [x] P5.6 Validate cold-clone retrieval sampling. Child issue: #63.
- [x] P5.7 Update submodule pointer and full-data documentation. Child issue: #64.

## Phase 6: Core Python Access Library

GitHub parent issue: #25

Merged PRs: #67 and #69

The core Python access library is the shared layer that should power both the CLI and the browser app. It should expose catalog search, metadata lookup, dataset resolution, retrieval/cache behavior, and backend diagnostics. DataLad/git-annex and S3-compatible object stores should be internal backends, not the user-facing abstraction.

- [x] P6.1 Define core access architecture. Child issue: #27.
- [x] P6.2 Define catalog query API. Child issue: #30.
- [x] P6.3 Define retrieval and cache API. Child issue: #28.
- [x] P6.4 Define backend abstraction for DataLad and object stores. Child issue: #29.
- [x] P6.5 Implement initial core Python API. Coordinating child issue: #68.
  - [x] P6.5.1 Add package scaffold and public API entrypoint. Implementation issue: #70.
  - [x] P6.5.2 Implement catalog records, lookup, search, and filters. Implementation issue: #71.
  - [x] P6.5.3 Implement dataset path resolution and local content status. Implementation issue: #72.
  - [x] P6.5.4 Implement DataLad backend diagnostics and fetch result objects. Implementation issue: #73.
  - [x] P6.5.5 Verify, document, and close the initial core API slice. Implementation issue: #74.

## Phase 7: Typer CLI Interface

GitHub parent issue: #26

Merged PR: #80

The CLI should be a thin, user-friendly interface over the completed core Python access library. It should expose catalog search, metadata inspection, data path/status, backend diagnostics, and fetch workflows without requiring normal users to understand DataLad/git-annex operations.

Phase 7 must be implementation-oriented. Command handlers should call `fresh_hectaresbc.HectaresBC` rather than reimplementing catalog, resolver, or backend behavior. Default verification must avoid credentials and network retrieval; use dry-run fetch and simulated backend states for routine tests.

- [x] P7.1 Define CLI command contract and output rules. Child issue: #18.
- [x] P7.2 Add Typer CLI scaffold and console entrypoint. Child issue: #75.
- [x] P7.3 Implement catalog CLI commands. Child issue: #76.
- [x] P7.4 Implement local data path and status CLI commands. Child issue: #77.
- [x] P7.5 Implement diagnostics and fetch CLI commands. Child issue: #78.
- [x] P7.6 Verify, document, and close the CLI phase. Child issue: #79.

## Phase 8: Package Distribution and Install Workflow

GitHub parent issue: #12

Active branch: `feature/p8-package-distribution`

The envisioned local user workflow is `pip install fresh-hectaresbc`, followed by Python API or CLI access to HectaresBC catalog and data workflows. Packaging should support the core library and CLI layers without mixing their responsibilities.

Phase 8 must make installed-package behavior real. Catalog lookup/search/filter should work outside a source checkout using compact packaged metadata, while raw HectaresBC ZIP payloads remain external in the DataLad data repository.

- [x] P8.1 Define package distribution contract. Child issue: #16.
- [x] P8.2 Define package install and smoke-test plan. Child issue: #15.
- [x] P8.3 Embed compact catalog metadata in package data. Child issue: #81.
- [x] P8.4 Validate wheel and source distribution artifacts. Child issue: #82.
- [x] P8.5 Add clean install smoke-test workflow. Child issue: #83.
- [x] P8.6 Verify, document, and close package distribution phase. Child issue: #84.

## Phase 9: Browser Catalog, Map, and Download Web App Planning

GitHub parent issue: #13

Merged PR: #86

The envisioned browser app would revive useful parts of the original HectaresBC service: browse layer lists and metadata, preview layers on a map, define an area of interest by drawing or selecting standard tiles, submit custom download requests, and collect prepared outputs. The initial hosted deployment may require UBC CWL or another access-control layer to manage abuse risk and hosting costs. Others could self-host if deployment recipes are published.

Phase 9 produced planning contracts only. It did not implement the browser app. Phase 10 is the implementation phase for the first working browser catalog surface.

- [x] P9.1 Define web app product and access-control contract. Child issue: #20.
- [x] P9.2 Specify catalog and metadata browser. Child issue: #22.
- [x] P9.3 Specify map preview workflow. Child issue: #19.
- [x] P9.4 Specify AOI and tile-selection workflow. Child issue: #23.
- [x] P9.5 Specify custom download request workflow. Child issue: #24.
- [x] P9.6 Define web app hosting and deployment plan. Child issue: #21.

## Phase 10: Browser Catalog App Implementation

GitHub parent issue: #87

Merged PR: #93

Phase 10 must produce a real runnable browser app surface, not another planning layer. The first useful implementation should be a catalog/search/detail browser over generated catalog data from the existing `fresh_hectaresbc` package. Default verification must not require raw ZIP/TIFF payloads, DataLad network retrieval, Arbutus/Chinook credentials, UBC CWL, hosted workers, or object-store access.

- [x] P10.1 Add web app scaffold and catalog artifact generator. Child issue: #88.
- [x] P10.1a Add Python API quickstart example. Child issue: #94.
- [x] P10.1b Add CLI quickstart example. Child issue: #95.
- [x] P10.2 Implement catalog search, filter, and list UI. Child issue: #89.
- [x] P10.3 Implement dataset detail and provenance UI. Child issue: #90.
- [x] P10.4 Add browser app smoke verification. Child issue: #91.
- [x] P10.5 Verify, document, and close browser catalog implementation phase. Child issue: #92.

## Phase 11: Browser Map Preview Implementation

GitHub parent issue: #96

Merged branch: `feature/p11-map-preview-implementation`

Merged PR: #103

Phase 11 must produce a real runnable browser map-preview surface, not another planning layer. The first useful implementation should let users identify previewable recovered data layers, open a representative layer in a map view, inspect preview provenance, and control layer visibility/opacity. Default verification must not require Arbutus/Chinook credentials, UBC CWL, hosted workers, object-store retrieval, or AOI/download processing.

- [x] P11.0 Establish repo-local `.venv` workflow. Child issue: #104.
- [x] P11.1 Audit preview eligibility and representative layers. Child issue: #97.
- [x] P11.2 Add derived preview artifact workflow. Child issue: #98.
- [x] P11.3 Implement browser map view scaffold. Child issue: #99.
- [x] P11.4 Render representative data layer on the map. Child issue: #100.
- [x] P11.5 Add map layer controls and catalog linkback. Child issue: #101.
- [x] P11.6 Verify, document, and close map preview phase. Child issue: #102.

## Phase 12: Source-Derived Real Map Previews

GitHub parent issue: #105

Active branch: `feature/p12-source-derived-map-previews`

Draft PR: #111

Phase 12 replaces the Phase 11 fixture happy path with a real source-derived raster preview. The first target is `dl_adminunits_bcts` / BCTS Operating Areas, derived from the real `bcts.tiff` inside `adminunits_bcts.zip`. The default browser route should become `#map=dl_adminunits_bcts`, with a PNG/RGBA overlay generated from recovered payload content, real CRS and bounds metadata, legend classes, visibility/opacity controls, and catalog linkback.

- [x] P12.1 Audit real preview candidate and source raster readability. Child issue: #106.
- [x] P12.2 Implement source-derived raster PNG preview generator. Child issue: #107.
- [x] P12.3 Update browser map renderer for raster overlay artifacts. Child issue: #108.
- [x] P12.4 Add real-data smoke checks and tests. Child issue: #109.
- [x] P12.5 Document and close source-derived preview phase. Child issue: #110.

## Phase 13: Map Context and Preview Coverage

GitHub parent issue: #112

Active branch: `feature/p13-map-context-preview-coverage`

Phase 13 follows the first real source-derived preview by improving the map-preview user experience and making current preview coverage limits explicit. The immediate product fix is a restrained offline basemap/context layer behind preview overlays so real raster layers do not appear to float in an empty viewport. The current source-derived preview generator remains configured for `dl_adminunits_bcts` only until a later layer-expansion slice audits and adds more source configs.

- [x] P13.1 Add minimalist basemap context behind preview overlays. Child issue: #113.
- [x] P13.2 Document preview coverage limits and expansion path. Child issue: #114.

## Phase 14: Source-Derived Basemap And Reliable Deep Links

GitHub parent issue: #116

Active branch: `feature/p14-source-derived-basemap-deeplinks`

Phase 14 corrects the Phase 13 map context mistake. The browser needs a recognizable basemap/reference context from actual recovered or authoritative geography, not a decorative sketch hidden under the preview raster. The first implementation should derive an offline BC/admin reference artifact from recovered HectaresBC administrative boundary rasters, render it visibly with the BCTS preview, and fix direct hash routes so users do not need to search manually after opening a map or detail link.

- [x] P14.1 Generate source-derived BC/admin basemap artifact. Child issue: #117.
- [x] P14.2 Render visible basemap and fix deep-link state. Child issue: #118.
- [x] P14.3 Verify, document, and close source-derived basemap phase. Child issue: #119.

## Phase 15: Sphinx Docs And GitHub Pages Publication

GitHub parent issue: #121

Merged PR: #125

Phase 15 adds formal project documentation using Sphinx and publishes it to
GitHub Pages automatically on pushes to `main`, following the lighter-weight
version of the FHOPS documentation pattern. The docs should cover the current
Python API, CLI, data repository, browser map-preview workflow, and development
commands without pretending that future AOI/download services already exist.

- [x] P15.1 Add Sphinx docs scaffold and API reference. Child issue: #124.
- [x] P15.2 Add GitHub Pages docs workflow. Child issue: #123.
- [x] P15.3 Verify, document, and close docs phase. Child issue: #122.

## Phase 16: Full Layer Preview Artifact Publication

GitHub parent issue: #126

Active branch: `feature/p16-full-layer-preview-publication`

Phase 16 queues full source-derived preview coverage for the browser map app.
The goal is to compile useful preview artifacts for all feasible recovered
HectaresBC layers, then cache and publish those generated artifacts through the
DataLad-backed data repository and its configured object-store special remote.
Bulky preview images must not be committed to this main code repository.

The intended ownership split is:

- this repository tracks generator code, manifest/schema contracts, browser
  loading logic, compact coverage metadata, tests, and documentation;
- `UBC-FRESH/fresh-hectaresbc-data` stores generated preview artifacts under an
  agreed DataLad/git-annex layout;
- annexed preview payloads are uploaded to the configured object-store remote
  so a cold clone can retrieve representative preview artifacts without private
  local paths.

- [x] P16.1 Define full preview artifact contract and DataLad storage layout. Child issue: #129.
- [x] P16.2 Audit all layer preview feasibility. Child issue: #127.
- [x] P16.3 Implement batch preview generation and resumable validation. Child issue: #128.
- [x] P16.4 Publish generated preview artifacts to the DataLad object store. Child issue: #132.
- [x] P16.5 Update browser app to consume published preview manifests. Child issue: #130.
- [x] P16.6 Verify, document, and close full preview publication phase. Child issue: #131.

## Phase 17: CLI Documentation Expansion

GitHub parent issue: #135

Active branch: `feature/p17-cli-docs`

Phase 17 expands the public documentation for the implemented Typer CLI. The
goal is to let users discover catalog records, inspect local data status, run
diagnostics, and plan or perform retrieval from documented commands without
reading source code or planning contracts.

- [x] P17.1 Add Sphinx CLI guide. Child issue: #137.
- [x] P17.2 Document CLI examples, outputs, and safety boundaries. Child issue: #138.
- [x] P17.3 Verify and close CLI documentation phase. Child issue: #136.

## Phase 18: Future Workflow Hardening

These are planned but not active requirements yet.

- [ ] P18.1 Add more formal GitHub issue hygiene, labels, milestones, and release tracking when task volume warrants it.
- [ ] P18.2 Add linting, formatting, tests, and pre-commit once code exists.
- [ ] P18.3 Add broader CI once there are stable commands to run beyond docs builds.
- [ ] P18.4 Add documentation quality gates beyond basic Sphinx build checks once docs mature.
- [ ] P18.5 Add machine-readable catalog schemas once the metadata model stabilizes.
- [ ] P18.6 Add full data publication/storage hardening once Phase 5 publication has been validated.

## Phase 19: Browser UI Upgrade

Status: completed and merged to `main` via PR #140, with tile-performance
hardening in PRs #151 and #155. Planning:
`planning/web_ui_upgrade_plan.md`.

Phase 19 replaces the document-style catalog page with an application shell:
a Browse workspace with search, facets, pagination, preview thumbnails, and a
contextual inspector; a dataset route with grouped metadata/provenance and
copyable usage commands; and a MapLibre map workspace with a static fallback.
The work keeps the static-first deployment and does not add credentials,
hosted workers, a database, or a frontend build pipeline.

- [x] P19.0 Add the UI review and upgrade plan, design tokens, and route/state contract.
- [x] P19.1 Replace the stacked page with a responsive application shell and preserve legacy hash routes.
- [x] P19.2 Add the compact catalog index, faceted Browse workspace, URL state, pagination, and preview thumbnails.
- [x] P19.3 Add the dataset inspector and grouped detail/provenance views with copy/download actions.
- [x] P19.4 Add the MapLibre map workspace with layer controls, legend, and static/offline fallback.
- [x] P19.5 Add gzip/cache server behavior, real-browser smoke coverage, and updated docs.
- [x] P19.6 Make the Map workspace open a useful default preview layer, enable Map from Browse, add preview-layer discovery links and a searchable change-layer control, add `scripts/fetch_web_previews.py` plus a missing-image banner, and add ignored 2048 px local preview overrides for sharper full-screen maps.
- [x] P19.8 Reproject map preview overlays to EPSG:3857 so they align with the Web-Mercator basemap; keep native previews for thumbnails.
- [x] P19.9 Complete full-library 2048 px previews for all 2,183 records, including virtual layers and the sparse pine-beetle rasters previously marked not previewable, and reproject the full set to EPSG:3857.
- [x] P19.10 Add on-demand 1-ha source raster tiles (`/api/tiles/{id}/{z}/{x}/{y}.png`) with Web-Mercator reprojection, legend colors, nodata handling, and disk caching; MapLibre uses raster tiles when the service is available and falls back to the static preview otherwise.
- [x] P19.11 Add demo service operations: detached `demo_ctl.sh`, systemd/env/cloudflared templates, public-origin health checker, and LRU tile-cache pruning.
- [x] P19.12 Add a low-zoom tile fast path from the 2048 px EPSG:3857 overlays and cache catalog/manifest/source-path lookups; keep z9+ source-raster tiles.
- [x] P19.13 Reuse bounded source dataset handles for z9+ tiles with per-handle read locking.
- [x] P19.14 Add optional compressed COG derivatives with overviews and prefer them over zip:// sources at high zoom.
- [x] P19.15 Add process-lifetime tile usage/cache statistics and a `/api/stats` endpoint.
- [x] P19.7 Verify, document, and close the browser UI upgrade phase.

## Phase 20: Agent GIS Assistant And AOI Bundles

Status: completed and merged to `main` via PRs #140, #142, #145, #147, #149,
#153, and #155. Planning: `planning/agent_gis_bundles.md`.

Phase 20 adds an optional FastAPI service and browser assistant that can explain
the UI, search the recovered raster catalog, resolve FEMIC/BC Data Catalogue
boundaries into AOIs, clip selected rasters to those AOIs, and prepare
downloadable multi-layer bundles. The static app remains usable without the
service.

- [x] P20.1 Add the FEMIC BCDC boundary resolution/materialization bridge with name and numeric-feature matching.
- [x] P20.2 Add windowed raster clipping that preserves CRS, dtype, and nodata.
- [x] P20.3 Add bundle assembly with AOI, manifest, provenance, ZIP, and demo limits.
- [x] P20.4 Add the optional FastAPI service, static mounts, agent API, layer search, AOI, and bundle endpoints.
- [x] P20.5 Add the browser "Ask" assistant panel with UI help and tool-driven AOI/bundle workflows.
- [x] P20.6 Add agent tools, tests, docs, and the separate demo deployment.
- [x] P20.8 Add the browser Clip AOI drawer with boundary candidates, mouse/touch drawing, searchable layer selection, validated GeoJSON bundle requests, and recent bundle links.
- [x] P20.9 Add queued bundle jobs with persisted progress, per-layer status, best-effort cancellation, and a browser progress bar.
- [x] P20.10 Add per-layer failure details and failed-layer retry for partial/failed bundles.
- [x] P20.11 Add terminal job-history retention with count/age pruning and health stats.
- [x] P20.12 Add bundle-output and temporary-AOI retention by count/age, including stale incomplete directories.
- [x] P20.13 Add an automated Clip AOI browser smoke test with mocked API progress, partial failures, retry, and cancellation.
- [x] P20.14 Add exact drawn-AOI area preflight, a live limit meter, and pre-submit rejection above the configured limit.
- [x] P20.7 Verify and close the agent GIS assistant phase.

## Phase 21: Browser Workspace Enhancements

Status: completed and merged to `main` via PR #172. Parent issue: #166. Planning:
`planning/ui_workspace_enhancements_plan.md`.

Phase 21 turns the single-layer browser into a reusable workspace: a persistent
layer tray, a small multi-layer map context stack, a bundle/job history route,
and click-to-identify raster values. It stays static-first and keeps the optional
service boundary intact.

- [x] P21.1 Plan workspace routes, tray state, and identify contract. Child issue: #167.
- [x] P21.2 Add layer tray and multi-layer map. Child issue: #168.
- [x] P21.3 Add bundle and job history route. Child issue: #169.
- [x] P21.4 Add click-to-identify raster values. Child issue: #170.
- [x] P21.5 Verify and close Phase 21. Child issue: #171.

## Phase 22: Saved And Shareable Workspaces

Status: completed and merged to `main` via PR #178. Parent issue: #173. Planning: `planning/workspace_persistence_plan.md`.

Phase 22 encodes tray layers, primary layer, map view, AOI, and Clip selections
into a shareable map URL and adds named workspaces in local browser storage.

- [x] P22.1 Plan workspace route and restore contract. Child issue: #174.
- [x] P22.2 Add map view state and workspace restore. Child issue: #175.
- [x] P22.3 Add saved and shareable workspace UI. Child issue: #176.
- [x] P22.4 Verify and close Phase 22. Child issue: #177.

## Phase 23: Reusable AOI Library

Status: completed and merged to `main` via PR #184. Parent issue: #179. Planning: `planning/aoi_library_plan.md`.

Phase 23 stores named and recent AOIs in local browser storage, restores boundary
AOIs through FEMIC, restores compact drawn AOIs directly, and exposes apply/delete
actions in the Clip drawer.

- [x] P23.1 Plan AOI library storage and restore. Child issue: #180.
- [x] P23.2 Add AOI persistence and Clip restore. Child issue: #181.
- [x] P23.3 Add AOI library UI and browser coverage. Child issue: #182.
- [x] P23.4 Verify and close Phase 23. Child issue: #183.

## Phase 24: Protected Admin Statistics Dashboard

Status: completed and merged to `main` via PR #190. Parent issue: #185. Planning: `planning/admin_dashboard_plan.md`.

Phase 24 turns `/api/stats` into a protected admin view of cache health, latency,
source mix, COG coverage, job status, and top datasets.

- [x] P24.1 Plan admin dashboard route and metrics contract. Child issue: #186.
- [x] P24.2 Add admin stats API details and route. Child issue: #187.
- [x] P24.3 Add admin dashboard UI and browser coverage. Child issue: #188.
- [x] P24.4 Verify and close Phase 24. Child issue: #189.

## Phase 25: Spatial Layer Discovery

Status: completed and merged to `main` via PR #196. Parent issue: #191. Planning: `planning/spatial_discovery_plan.md`.

Phase 25 finds previewable layers whose bounds intersect the current map view or
AOI, then lets users add results to the tray.

- [x] P25.1 Plan spatial discovery contract. Child issue: #192.
- [x] P25.2 Add map bounds and preview intersection helpers. Child issue: #193.
- [x] P25.3 Add discovery UI and tray integration. Child issue: #194.
- [x] P25.4 Verify and close Phase 25. Child issue: #195.

## Phase 26: Saved Searches And Favorites

Status: completed and merged to `main` via PR #202. Parent issue: #197. Planning: `planning/saved_browse_plan.md`.

Phase 26 saves named Browse views and favorite datasets in local browser storage
and exposes them in the Browse rail and result/detail controls.

- [x] P26.1 Plan saved search and favorite contract. Child issue: #198.
- [x] P26.2 Add saved search/favorite persistence. Child issue: #199.
- [x] P26.3 Add saved rail UI and browser coverage. Child issue: #200.
- [x] P26.4 Verify and close Phase 26. Child issue: #201.

## Phase 27: Compare Map Workspace

Status: completed and merged to `main` via PR #208. Parent issue: #203. Planning: `planning/compare_map_plan.md`.

Phase 27 adds synchronized side-by-side comparison for two previewable layers,
with tray/map entry points and selectors.

- [x] P27.1 Plan compare route and sync contract. Child issue: #204.
- [x] P27.2 Add multi-map compare support. Child issue: #205.
- [x] P27.3 Add compare UI and browser coverage. Child issue: #206.
- [x] P27.4 Verify and close Phase 27. Child issue: #207.

## Phase 28: Bundle Preflight Estimates

Status: implementation in progress on `feature/p28-bundle-preflight`.
Parent issue: #217. Planning: `planning/bundle_preflight_plan.md`.

Phase 28 adds advisory output-volume and rough-duration estimates for selected
Clip layers before a bundle job starts.

- [x] P28.1 Plan bundle preflight contract. Child issue: #218.
- [ ] P28.2 Add bundle estimate API. Child issue: #219.
- [ ] P28.3 Add Clip preflight UI and browser coverage. Child issue: #220.
- [ ] P28.4 Verify and close Phase 28. Child issue: #221.

## Current Next Steps

1. Complete P28.1 planning contract and close child issue #218.
2. Implement P28.2 estimate API.
3. Implement P28.3 Clip preflight UI and browser coverage.
4. Open the Phase 28 PR, verify, merge, and close parent #217.
