# Full Layer Preview Artifact Contract

This note defines the P16.1 contract for compiling source-derived browser map
preview artifacts for all feasible recovered HectaresBC layers.

Phase 16 should expand the current single-layer `dl_adminunits_bcts` preview
workflow into a batch workflow. The batch output is a derived data product, so
bulky generated preview payloads belong in the DataLad-backed data repository,
not in this main code repository.

## Repository Responsibilities

`fresh-hectaresbc` tracks:

- preview generator and validation scripts;
- manifest/schema contracts;
- browser loading logic;
- compact coverage inventories and test fixtures when useful;
- documentation and regeneration instructions.

`UBC-FRESH/fresh-hectaresbc-data` tracks:

- generated preview artifacts under DataLad/git-annex;
- compact preview indexes and per-layer manifest JSON files;
- publication and validation reports for preview artifacts.

The main repository may continue to write ignored local development artifacts
under:

```text
web/data/map_previews/
```

Those files are reproducible local outputs. They are not the durable preview
cache.

## Data Repository Layout

The durable preview artifact root is:

```text
external/fresh-hectaresbc-data/derived/web_map_previews/v1/
```

Inside the data repository, this maps to:

```text
derived/web_map_previews/v1/
  README.md
  index.json
  coverage.csv
  reference_layers/
    <reference_id>/
      manifest.json
      preview.png
  layers/
    <dataset_id>/
      manifest.json
      preview.png
  validation/
    <run_id>/
      generation_summary.json
      failed_layers.csv
      retrieval_sampling.md
```

Rules:

- `index.json`, `coverage.csv`, `manifest.json`, Markdown notes, and compact
  validation reports should be Git-tracked when they remain small and useful
  for discovery.
- `preview.png` and any future bulky preview payloads should be annexed.
- If a future layer requires multiple image files, tiles, or other bulky
  artifacts, those payloads belong beside the per-layer manifest and should be
  annexed.
- Do not serialize absolute local paths, `tmp/` source paths, credential paths,
  or private machine details into public manifests.

## Artifact Types

The first required artifact kind remains:

```text
artifact_kind: raster_png
```

The first version should generate one browser-fit PNG/RGBA preview per feasible
layer. A tile pyramid, COG, PMTiles archive, vector simplification pipeline, or
AOI clipping product can be added later only after this single-preview artifact
contract is working at full catalog scale.

Allowed artifact statuses:

- `source_derived_preview`: generated from recovered source payload content and
  suitable for browser map preview.
- `source_derived_basemap_reference`: generated from recovered source payload
  content and used as map context/reference.
- `not_previewable`: inspected source content is not suitable for a useful
  preview.
- `source_unavailable`: source payload content was not materialized or readable
  during the batch run.
- `unsupported_format`: payload format is not supported by the current preview
  generator.
- `generation_failed`: an unexpected read or render failure occurred and should
  be investigated.

`not_previewable`, `source_unavailable`, `unsupported_format`, and
`generation_failed` records should appear in `coverage.csv` and `index.json`,
but they do not require `preview.png`.

## Per-Layer Manifest Fields

Each generated preview manifest must include:

- `schema_version`;
- `generated_at`;
- `dataset_id`;
- `title`;
- `source_family`;
- `source_zip_path`;
- `raw_relative_path`;
- `source_content_status`;
- `source_resolution`;
- `artifact_kind`;
- `artifact_status`;
- `artifact_path`;
- `crs`;
- `native_bounds`;
- `wgs84_bounds`;
- `raster_width`;
- `raster_height`;
- `preview_width`;
- `preview_height`;
- `dtype`;
- `nodata`;
- `value_classes` when categorical legend metadata is available;
- `value_class_count`;
- `preview_eligibility_status`;
- `preview_eligibility_blockers`;
- `provenance`.

The `provenance` object must include:

- generator script name and version or commit when available;
- source dataset ID and title;
- source ZIP path;
- internal raster/vector member path;
- legend source path when used;
- derivation method summary;
- source-readability notes and uncertainty notes when relevant.

For browser portability, `artifact_path` is relative to the artifact root:

```text
derived/web_map_previews/v1/
```

## Catalog-Level Index

`index.json` is the browser-facing compact index. It should include:

- `schema_version`;
- `generated_at`;
- `artifact_root`;
- `data_repo_commit`;
- `artifact_count`;
- `previewable_count`;
- `not_previewable_count`;
- `source_unavailable_count`;
- `generation_failed_count`;
- `reference_layers`;
- `layers`.

Each `layers[]` entry should be compact enough for browser catalog loading:

- `dataset_id`;
- `title`;
- `source_family`;
- `artifact_status`;
- `artifact_kind`;
- `manifest_path`;
- `artifact_path` when a payload exists;
- `wgs84_bounds` when known;
- `preview_eligibility_blockers`;
- `source_zip_path`.

`coverage.csv` is the human-auditable batch inventory. It should carry the same
status and blocker fields, plus source member paths and failure messages.

## Publication And Object Store

The generated preview payloads are published through the data repository:

```bash
cd external/fresh-hectaresbc-data
datalad save -m "Add generated web map preview artifacts"
git annex copy derived/web_map_previews/v1 --to arbutus-s3
```

The exact publication command may be refined during P16.4, but requirements are:

- annexed preview payloads must be available from the configured object-store
  special remote;
- compact Git-tracked manifests and indexes must be pushed to GitHub with the
  data repository;
- representative cold-clone validation must prove that a new checkout can
  retrieve selected preview PNGs from the object-store remote;
- credentials remain user-local under `~/.config/fresh-hectaresbc/` and must
  never be written into this repository, the data repository, or generated
  manifests.

The DataLad/git-annex object store is the durable cache. It is not assumed to be
a clean public browser URL surface by itself. P16.5 must decide how the static
browser app discovers and loads published preview artifacts in deployed and
local-development contexts.

## Validation Requirements

For every generated preview payload:

- manifest JSON parses;
- manifest contains no forbidden private path fragments;
- referenced PNG exists;
- PNG opens as `RGBA`;
- PNG dimensions match manifest metadata;
- visible pixels exist unless the layer is explicitly recorded as
  `not_previewable`;
- WGS84 bounds are present for map fitting;
- CRS is recorded when source data exposes it;
- source ZIP and internal member paths are stable project-relative identifiers.

For batch closeout:

- coverage counts reconcile with the recovered catalog;
- failures are listed with deterministic status codes and messages;
- representative data layers and virtual layers are sampled;
- representative annexed preview PNGs are retrievable from the object-store
  special remote in a clean clone.

## Deferred Work

The following are intentionally out of scope for P16.1:

- generating all previews;
- uploading preview payloads;
- changing the browser renderer;
- creating tile pyramids;
- implementing AOI masking or download jobs.
