# Preview Feasibility Metadata

This directory stores compact tracked audit outputs for Phase 16 full layer
preview publication.

The audit is produced by:

```bash
python scripts/audit_layer_preview_feasibility.py
```

Outputs:

- `layer_preview_feasibility.csv`: one row per recovered catalog record with
  source ZIP resolution, first raster member, CRS/bounds, raster dimensions,
  nodata, coarse sample signal, WMS class count, and preview feasibility status.
- `preview_feasibility_summary.json`: compact status counts for the full audit.

The audit reads recovered source ZIPs from the DataLad submodule when content is
materialized and falls back to the ignored local archive under
`tmp/shared-data/hectaresbc` during development. Generated CSV/JSON metadata
must not contain absolute local paths, ignored source-root paths, or credential
fragments.

This directory is not the preview artifact cache. Bulky generated preview PNGs
belong in the DataLad-backed data repository under the layout defined in:

```text
planning/full_layer_preview_artifact_contract.md
```
