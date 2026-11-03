# Phase 27: Compare Map Workspace

Parent issue: #203

## Goal

Add a synchronized side-by-side map comparison for two previewable layers,
accessible from the tray and map workspace.

## Route Contract

New route:

```text
#/compare?left=<dataset_id>&right=<dataset_id>
```

- Missing sides default from the tray/current map layer when possible.
- Invalid or non-previewable IDs show a clear missing-layer state.
- The map tab is treated as active while comparing.
- Compare selectors rebuild the route with the selected left/right IDs.

## Map Lifecycle Contract

- Refactor the map module to track multiple active maps instead of one.
- Normal `create` still destroys prior maps.
- `createCompare` creates two maps and synchronizes center/zoom from either pane.
- The right map omits duplicate navigation controls.
- A resize action updates both maps after layout changes.
- Existing single-map AOI, identify, tray, and workspace behavior remains
  unchanged.

## UI Contract

- Compare action on the map workspace and tray drawer.
- Two side-by-side map panes with dataset title/ID labels.
- Left/right selectors from previewable layers; tray layers are prioritized.
- Swap action.
- Missing/unavailable state with a link back to the map.
- Responsive stack at narrow widths if side-by-side is unusable.

## Non-Goals

- Pixel-perfect swipe clipping on one raster surface.
- Synchronizing AOI/identify controls across panes.
- Editing/styles or more than two comparison layers.
- Server-side comparison endpoints.

## Verification

- Browser smoke for two panes, selectors, swap, and route restore.
- Existing map/tray smokes.
- Sphinx `-W`.
- Public protected compare verification.
