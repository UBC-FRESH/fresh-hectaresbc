# Map View Scaffold

This note records the P11.3 browser map-view scaffold decision.

## Renderer Choice

P11.3 uses a minimal local HTML/CSS scaffold instead of adding Leaflet, OpenLayers, MapLibre, or another map library.

Reasons:

- the first generated preview artifact is a labelled GeoJSON UI fixture, not authoritative recovered geometry;
- P11.3 only needs deterministic empty, available, unavailable, and not-found states;
- adding a full map library before source-derived preview artifacts exist would imply more spatial capability than the app currently has;
- default smoke tests should stay credential-free and network-free.

P11.4 extended this scaffold to render the generated GeoJSON fixture as an SVG overlay fitted to the artifact bounds. A full map library remains a later option once preview artifacts are derived from recovered payload content and require pan/zoom, reprojection, tile loading, or multiple layer types.

## Routes

Map preview routes use stable hash state:

```text
#map=<dataset_id>
```

Representative routes:

```text
#map=dl_water_cwb_canals
#map=vl_virtualspecies_bulltroutsalvelinusconfluentus_1135
```

The data-layer candidate route renders the generated GeoJSON fixture when `web/data/map_previews/manifest.json` and `web/data/map_previews/dl_water_cwb_canals/preview.geojson` have been generated. The virtual-layer route renders an unavailable state because virtual-layer map preview is outside the first data-layer implementation pass.

## Current Boundaries

P11.3 did not draw recovered map geometry. It provided:

- stable map route parsing;
- map preview shell;
- layer panel;
- selected-record metadata;
- generated-artifact status;
- unavailable-preview messaging;
- catalog-detail linkback.

P11.4 now draws the generated GeoJSON fixture, but this is still not recovered HectaresBC geometry. Source-derived preview artifact generation remains future work.
