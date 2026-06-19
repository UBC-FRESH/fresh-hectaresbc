# Map View Scaffold

This note records the P11.3 browser map-view scaffold decision.

## Renderer Choice

P11.3 uses a minimal local HTML/CSS scaffold instead of adding Leaflet, OpenLayers, MapLibre, or another map library.

Reasons:

- the first generated preview artifact is a labelled GeoJSON UI fixture, not authoritative recovered geometry;
- P11.3 only needs deterministic empty, available, unavailable, and not-found states;
- adding a full map library before source-derived preview artifacts exist would imply more spatial capability than the app currently has;
- default smoke tests should stay credential-free and network-free.

P11.4 can either extend this scaffold to render the generated GeoJSON fixture or introduce a proven map library if the representative preview artifact format requires it.

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

The data-layer candidate route renders an available map shell and layer panel when `web/data/map_previews/manifest.json` has been generated. The virtual-layer route renders an unavailable state because virtual-layer map preview is outside the first data-layer implementation pass.

## Current Boundaries

P11.3 does not draw recovered map geometry. It provides:

- stable map route parsing;
- map preview shell;
- layer panel;
- selected-record metadata;
- generated-artifact status;
- unavailable-preview messaging;
- catalog-detail linkback.

Actual feature rendering belongs to P11.4.
