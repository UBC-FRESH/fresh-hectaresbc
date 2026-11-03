# Phase 28: Bundle Preflight Estimates

Parent issue: #217

## Goal

Estimate Clip output volume before a bundle job starts:

- per-layer clipped pixel dimensions;
- uncompressed output-size estimate;
- rough processing-duration estimate;
- outside/unsupported layer warnings;
- totals across selected layers.

Estimates are advisory and explicitly not a guarantee.

## API Contract

`POST /api/bundles/estimate`

Request:

```json
{
  "layer_ids": ["dl_adminunits_bcts"],
  "aoi_geometry": {"type": "Polygon", "coordinates": []}
}
```

Response:

```json
{
  "status": "ok",
  "aoi": {"area_ha": 12345.0, "bbox_wgs84": []},
  "layers": [
    {
      "dataset_id": "dl_adminunits_bcts",
      "title": "BCTS Operating Areas",
      "status": "ok",
      "width": 1000,
      "height": 900,
      "pixels": 900000,
      "estimated_bytes": 1800000,
      "estimated_seconds": 1.2
    }
  ],
  "total_pixels": 900000,
  "total_estimated_bytes": 1800000,
  "estimated_seconds": 1.2,
  "caveat": "Advisory estimate based on AOI/source bounds and source dtype; compression and clipping overhead vary."
}
```

Rules:

- Validate geometry and layer IDs using the same limits as bundle creation.
- Estimate from source raster metadata and AOI/source bounds intersection.
- Do not read/clip raster pixels.
- `estimated_bytes` is uncompressed source dtype volume.
- `estimated_seconds` is a simple advisory throughput model, not a promise.
- Layers outside the AOI or with unusable sources return warnings rather than failing the whole estimate.

## UI Contract

Clip drawer:

- **Estimate** action beside Prepare.
- Result card with total pixels, estimated uncompressed size, rough duration, and caveat.
- Per-layer rows with dimensions and outside/unsupported warnings.
- Invalidate estimate when AOI or selected layers change.
- Estimate does not submit a job or change AOI/layers.

## Non-Goals

- Exact compressed-size prediction.
- Reading full rasters for preflight.
- Guaranteed completion-time estimates.
- Server-side queue reservation.

## Verification

- Synthetic archive API test.
- API-mocked Clip browser preflight test.
- Sphinx `-W`.
- Public demo verification.
