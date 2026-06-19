# Map Preview Eligibility Audit

This note records the P11.1 preview-eligibility baseline for the first browser map-preview implementation slice.

## Current Signals

The browser catalog generator now emits preview eligibility from recovered package catalog fields:

- raster member presence;
- WMS XML member presence;
- recovered CRS metadata;
- recovered spatial extent metadata;
- source family;
- source ZIP path, manifest size, provenance, known gaps, and uncertainty notes already exposed in each browser catalog record.

The generated browser catalog includes:

```text
preview_eligibility_counts
representative_preview_records
records[].preview.eligibility_status
records[].preview.eligibility_reason
records[].preview.eligibility_blockers
records[].preview.has_crs_metadata
records[].preview.has_extent_metadata
```

## Eligibility Statuses

- `preview_ready`: data-layer record has raster, recovered CRS metadata, and recovered spatial extent metadata.
- `candidate_missing_crs`: data-layer record has raster signals, but recovered metadata does not provide authoritative CRS. If extent is also absent, `missing_extent` is included as an additional blocker.
- `candidate_missing_extent`: data-layer record has raster and CRS signals, but recovered metadata does not provide authoritative bounds.
- `metadata_only`: data-layer record has no recovered raster member signal.
- `not_supported`: record family is outside the first Phase 11 data-layer preview scope.

## Audit Result

As of P11.1, the generated catalog contains:

- `candidate_missing_crs`: 418 records;
- `not_supported`: 1,765 records.

All recovered data-layer records have raster and WMS member signals, but the compact recovered metadata does not yet expose authoritative CRS or spatial extent. Phase 11 can still proceed, but P11.2 must derive or validate CRS and bounds from representative payloads or derived preview artifacts before map rendering can claim spatial correctness.

Virtual layers have raster signals, but they are marked `not_supported` for the first implementation pass because Phase 11 starts with recovered data-layer preview behavior. Virtual-layer map preview can be revisited after the data-layer workflow has a tested preview artifact path.

## Representative Records

P11.1 selects:

- `dl_water_cwb_canals` as the first data-layer preview candidate.
- `vl_virtualspecies_bulltroutsalvelinusconfluentus_1135` as the unavailable-preview representative.

`dl_water_cwb_canals` is suitable for the first candidate because it is the smallest recovered data-layer ZIP currently identified with both raster and WMS member signals. It is not yet `preview_ready`; its blockers are `missing_crs` and `missing_extent`.

`vl_virtualspecies_bulltroutsalvelinusconfluentus_1135` is suitable for unavailable-state coverage because it is already used by catalog/detail smoke tests, has a clear recovered title, has a raster signal, and is intentionally outside the first data-layer map-preview scope.

## Boundaries

This audit does not retrieve annexed payloads, read raw TIFF content, infer CRS, derive extents, create preview tiles, or implement map rendering. Those belong to later P11 child issues.
