# Phase 21: Browser Workspace Enhancements

Parent issue: #166

## Goal

Turn the browser from a single-layer inspector into a reusable workspace:

- collect layers across catalog/dataset/map routes;
- show a small multi-layer context stack on the map;
- inspect recent bundle jobs outside the Clip drawer;
- identify raster values by clicking the map.

The static-first app and optional FastAPI service boundaries remain unchanged.
No account system, database, frontend build pipeline, or general-purpose GIS
editor is introduced.

## Route And State Contract

- New `#/bundles` route renders bundle/job history.
- Map routes accept an optional `layers=` list of dataset IDs for context
  overlays:
  - `#/map?layers=id1,id2`
  - `#/dataset/<id>/map?layers=id1,id2`
- The persistent layer tray is client state, stored in `localStorage`; at most
  three non-primary context layers are rendered on the map.
- The primary map layer remains the route dataset and keeps the existing
  visibility/opacity/legend controls.
- Context layers get independent visibility and opacity controls.
- Bundle history actions use existing `/api/bundles` and `/api/bundle-jobs`
  endpoints; no new database or user model.

## Child Issues

### P21.2 Layer Tray And Multi-Layer Map

- Header tray button with count.
- Tray drawer: list, remove, move up/down, clear, open map.
- Add-to-tray actions on Browse rows/cards, Dataset actions, and Map actions.
- Map context overlays for up to three tray layers.
- Keep URL state for context layer IDs.
- Browser smoke coverage and docs.

### P21.3 Bundle And Job History Route

- `#/bundles` route with empty/error states.
- List active/terminal jobs and completed bundles with status, AOI, layer count,
  failures, timestamps, and download links.
- Retry failed layers where failure details are available.
- Add `GET /api/bundle-jobs` if listing active jobs is required.
- Tests and docs.

### P21.4 Click-To-Identify

- Identify API returns value, legend label, dataset, coordinates, and nodata
  status for a clicked point.
- Map identify mode toggles click handling and shows a compact result card.
- Handle non-covering clicks, unavailable source, and no-data cells.
- Tests and docs.

## Non-Goals

- Full GIS layer styling/symbology.
- Editing or uploading arbitrary data layers.
- User accounts, sharing permissions, or collaboration.
- Bulk COG conversion.
- Replacing the Clip AOI workflow.

## Verification

- Python tests for new service endpoints.
- Static/catalog browser smokes.
- API-mocked Clip AOI and workspace browser checks.
- Sphinx `-W`.
- Public protected demo checks after deployment.
