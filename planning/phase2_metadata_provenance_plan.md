# Phase 2 Metadata And Provenance Recovery Plan

## Purpose

Define the Phase 2 contract for recovering compact, evidence-backed HectaresBC metadata and provenance records from the rescued archive.

This plan completes `P2.1` and governs child issues `P2.2` through `P2.5`.

## Source Boundary

Expected local source:

```text
tmp/shared-data/hectaresbc
```

Relevant tracked Phase 1 inputs:

- `metadata/archive_inventory/archive_summary.json`
- `metadata/archive_inventory/zip_manifest.csv`
- `metadata/archive_inventory/root_metadata_files.md`
- `metadata/archive_inventory/zip_payload_families.md`
- `metadata/archive_inventory/data_repo_layout_recommendation.md`

Rules:

- Keep the pass read-only against `tmp/shared-data/hectaresbc`.
- Do not bulk extract archived ZIP payloads into tracked paths.
- Do not commit TIFFs, ZIPs, shapefiles, geodatabases, notebooks copied from `tmp/`, or bulky generated records.
- Treat root files and ZIP metadata files as evidence, not as automatically authoritative.
- Preserve source paths, filenames, raw identifiers, and uncertainty notes before introducing any canonical names.
- Capture CRS, extent, lineage, license, or semantic meaning only when the source metadata supports it.

## Minimal Dataset Identity Model

Use `metadata/catalog_schema/dataset_identity_model.md` as the Phase 2 target model.

Every recovered record should preserve:

- source family: `data_layer` or `virtual_layer`;
- original source path and source filename;
- source ZIP path from the rescued archive;
- payload member paths that support the record;
- original HectaresBC identifiers or fields when present;
- human-readable title candidates when present;
- metadata source file and field provenance;
- verification status;
- explicit uncertainty notes.

## Planned Tracked Outputs

Use compact tracked outputs only when they are useful for review and small enough for the main repo.

Likely Phase 2 output locations:

```text
metadata/catalog_schema/
metadata/recovered_catalog/
```

Planned or candidate outputs:

- `metadata/catalog_schema/dataset_identity_model.md`: field-level identity and provenance contract.
- `metadata/recovered_catalog/virtual_layer_records.csv` or `.json`: compact virtual-layer records recovered from root metadata.
- `metadata/recovered_catalog/data_layer_records.csv` or `.json`: compact data-layer records recovered from per-ZIP metadata files.
- `metadata/recovered_catalog/recovery_summary.md`: counts, evidence sources, gaps, and handoff notes.

If a candidate output becomes large, noisy, or too early to stabilize, prefer a summarized Markdown report and defer full records to the DataLad data repository.

## Phase 2 Child Issue Contract

### P2.2: Virtual Layer Catalog Records

Recover compact virtual-layer records using `virtual_layers.txt`, `virtual_layers_metadata_all.csv`, the ZIP manifest, and representative virtual-layer ZIP metadata payloads.

Expected emphasis:

- preserve `layer_id`, `filename`, `hkey`, `layer_name`, `query`, and `hkey_query`;
- join root metadata to ZIP manifest rows by filename;
- identify missing, ambiguous, or conflicting records;
- avoid interpreting SQL-like query semantics beyond what the source directly states.

### P2.3: Data-Layer Metadata Records

Recover compact data-layer records from data-layer ZIP metadata members and root inventory signals.

Expected emphasis:

- inspect ZIP member metadata without bulk extraction;
- preserve original ZIP paths, member paths, title candidates, format signals, and WMS XML pointers;
- capture CRS and extent only when directly found in source metadata;
- document missing or conflicting metadata.

### P2.4: Naming And Provenance Conventions

Draft conventions before any broad normalization.

Expected emphasis:

- define provisional stable ID rules;
- distinguish source names from display names and future canonical names;
- define provenance citation fields for root files, ZIPs, and derived records;
- identify normalization operations that are allowed, blocked, or deferred.

### P2.5: Phase 2 Summary And Phase 3 Inputs

Summarize recovered metadata sources, counts, unresolved gaps, and concrete ingestion-design inputs.

The output should make Phase 3 implementation choices easier without forcing a package scaffold or geospatial dependency stack prematurely.

## Validation

Before closing a Phase 2 child issue, run checks appropriate to the changed surface:

```bash
git status --short
find metadata planning -type f -size +10M -print
git check-ignore -v tmp/shared-data/hectaresbc tmp/bootstrap.md
```

For machine-readable CSV/JSON outputs, also run a parser smoke check using Python standard library.

