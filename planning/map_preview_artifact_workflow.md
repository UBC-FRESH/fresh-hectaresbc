# Map Preview Artifact Workflow

This note records the P11.2 artifact workflow for the first browser map-preview implementation slice.

## Artifact Format

The first generated artifact format is GeoJSON plus a small JSON manifest:

```text
web/data/map_previews/
  manifest.json
  dl_water_cwb_canals/
    preview.geojson
```

`web/data/map_previews/` is ignored because it is generated from package/catalog state and will later be replaced or extended by derived artifacts from recovered payload content.

## Representative Candidate

P11.2 targets:

```text
dl_water_cwb_canals
```

The candidate is the smallest recovered data-layer ZIP currently identified with both raster and WMS member signals. Its compact metadata blockers remain:

```text
missing_crs
missing_extent
```

## Current Artifact Scope

The generated GeoJSON is a browser UI fixture, not recovered HectaresBC canal geometry. It is intentionally labelled:

```text
fixture_pending_source_derivation
```

This keeps the next map UI slices moving without pretending the raw ZIP/TIFF payload is browser-ready or spatially authoritative. The manifest preserves:

- dataset ID and title;
- source ZIP path;
- data-repository raw relative path;
- local source-content status;
- eligibility status and blockers;
- fixture warning;
- generation script provenance.

## Boundaries

The default P11.2 workflow does not require:

- Arbutus or Chinook credentials;
- DataLad network retrieval;
- hosted workers;
- raw TIFF parsing;
- CRS or extent inference.

If the representative ZIP content is retrieved later, the artifact workflow can be extended to derive authoritative preview geometry, tiles, or COG/PMTiles artifacts while preserving the same manifest-oriented contract.
