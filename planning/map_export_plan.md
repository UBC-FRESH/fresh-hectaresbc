# Phase 32: Single-Map PNG Export

Parent issue: #243

## Goal

Add **Download PNG** to the regular Map workspace. The export should be useful in
slides and reports: the rendered map plus layer identity, visible context layers,
the recovered legend, date, and attribution.

Compare and Series already export labeled PNGs; this phase completes the same
capability for the primary map.

## Export Contract

Action location: Map workspace action bar, beside Dataset / Browse / Preview.

Output:

- PNG named `hectaresbc-map-<dataset_id>-<YYYY-MM-DD>.png`.
- Rendered MapLibre canvas at its backing resolution.
- Header band with:
  - primary layer title;
  - dataset ID;
  - visible context layer titles, or an explicit "No context layers" line;
  - a note when the primary layer is hidden.
- Recovered legend panel over the map when the primary artifact exposes
  `value_classes`.
  - Up to 24 classes are drawn.
  - A truncated row reports additional classes.
  - If no classes exist, the panel says no classes were recovered.
- Footer with date and OpenStreetMap attribution.

## Composition Rules

- Compose in a 2D canvas; no external dependency.
- Scale text and spacing against `canvas.width / canvas.clientWidth` so
  high-DPI maps retain legible labels.
- Use the existing MapLibre canvas as the map region; DOM overlays are not
  captured directly, so the export redraws its own title and legend.
- Preserve the current map view, AOI overlay, context overlays, and basemap.
- Long titles, IDs, context lists, and legend labels are truncated with ellipses.
- Export is disabled with a toast when the map is still loading or no canvas is
  available.

## Data Sources

Read from the live workspace rather than duplicating map state:

- `.map-title-card h1` for the primary title;
- `.map-title-card p` for the dataset ID;
- `#layer-visible` for primary visibility;
- checked `[data-context-visible]` inputs and their labels for context layers;
- `.layer-legend li` swatches and text for the recovered legend.

## Non-Goals

- Server-side rendering.
- PDF/georeferenced GeoTIFF output.
- Embedding scale bars or north arrows beyond MapLibre's rendered controls.
- Exporting the hidden layer-control panel itself.
- Changing Compare or Series export behavior.

## Verification

- Browser test on a static Map route:
  - Download action exists and triggers a PNG download;
  - file has a PNG signature and non-trivial size;
  - title, dataset ID, and legend are present in the live workspace;
  - context-layer list is included when tray layers exist;
  - action remains keyboard-focusable.
- Existing Compare and Series export smokes remain green.
- Sphinx `-W`.
- Public map export verification after deployment.
