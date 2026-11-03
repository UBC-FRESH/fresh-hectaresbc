# Phase 25: Spatial Layer Discovery

Parent issue: #191

## Goal

Find previewable catalog layers that intersect the current map viewport or Clip
AOI, then add selected results to the tray.

## Spatial Contract

- Viewport bounds come from MapLibre `getBounds()` as WGS84
  `[[west, south], [east, north]]`.
- AOI bounds come from the current drawn geometry or resolved boundary bbox.
- Layer bounds come from preview artifacts:
  - `_map_bounds_wgs84` when available;
  - otherwise `wgs84_bounds`.
- Intersection is bounds-based, not exact geometry intersection. Results are
  labeled as “bounds intersect” so users do not mistake it for cadastral precision.
- Only previewable artifacts with usable bounds participate.
- Duplicate IDs are removed; results are sorted by title.

## UI Contract

A new **Discover** panel is opened from the map actions:

- source toggle: **Current view** / **AOI** (AOI disabled when none exists);
- Run/Refresh action;
- result count and “bounds intersect” note;
- family filter and text filter;
- result rows with title, dataset ID, family, and Add action;
- bulk add up to remaining tray capacity;
- empty/unavailable states;
- no server call; all discovery runs against the loaded preview index.

Adding a result uses the existing tray logic and respects the six-layer tray cap.
The panel closes when the assistant, Clip panel, or tray opens.

## Non-Goals

- Exact polygon/raster spatial intersection or a server-side spatial index.
- Automatic addition of all results.
- Spatial queries against unpublished/non-previewable records.
- Replacing catalog search or map layer switching.

## Verification

- JS logic checks for bounds intersection.
- Browser smoke for viewport discovery and add-to-tray.
- Existing tray/map/workspace smokes.
- Sphinx `-W`.
- Public protected discovery verification.
