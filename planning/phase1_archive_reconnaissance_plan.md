# Phase 1 Archive Reconnaissance Plan

## Purpose

Define the Phase 1 output contract for compact, reproducible reconnaissance of the rescued HectaresBC archive.

This plan completes `P1.1` and governs child issues `P1.2` through `P1.5`.

## Source Boundary

Expected local source:

```text
tmp/shared-data/hectaresbc
```

Rules:

- Keep the pass read-only against `tmp/shared-data/hectaresbc`.
- Do not extract full payload data into tracked paths.
- Do not commit TIFFs, ZIPs, shapefiles, geodatabases, notebooks copied from `tmp/`, or bulky generated inventories.
- Track only compact summaries and small machine-readable manifests.
- Every tracked finding should be reproducible from documented commands.

## Planned Tracked Outputs

Use this directory for compact machine-readable outputs:

```text
metadata/archive_inventory/
```

Planned outputs:

- `archive_summary.json`: high-level file counts, directory counts, sizes, extension counts, and root control-file inventory.
- `zip_manifest.csv`: one row per ZIP with path, relative directory, filename, size, payload family guess, and naming-derived fields when safe.
- `root_metadata_files.md`: summary of root control files, row counts, schemas/columns, and consistency checks.
- `zip_payload_families.md`: representative ZIP entry structures and payload family notes.
- `data_repo_layout_recommendation.md`: evidence-based recommendation for preserving rescued layout versus introducing a canonical layout.

If any planned file would become large or noisy, prefer a summarized Markdown report and document why the full detail is deferred to the DataLad data repository.

## Command Pattern

Prefer simple, rerunnable commands and Python standard-library scripts before adding project dependencies.

Allowed Phase 1 inspection operations:

- `find`, `du`, `wc`, `awk`, `sort`, `head`, `zipinfo`, and similar read-only shell commands;
- Python standard-library reads of CSV, paths, ZIP metadata, sizes, hashes if needed, and JSON/CSV writing;
- representative `zipinfo` or `zipfile` entry-list inspection without extracting payloads.

Avoid:

- full unzip/extraction;
- geospatial library dependency setup;
- package scaffold;
- CI or pre-commit setup;
- DataLad repository initialization.

## Validation

Before closing a Phase 1 child issue, run checks appropriate to the changed surface:

```bash
git status --short
find metadata planning -type f -size +10M -print
git check-ignore -v tmp/shared-data/hectaresbc tmp/bootstrap.md
```

For machine-readable CSV/JSON outputs, also run a parser smoke check using Python standard library.

## Phase 1 Child Issue Contract

### P1.2: Root Inventory And ZIP Manifest

Produce compact root inventory and ZIP manifest outputs without extracting payloads.

### P1.3: Root Metadata And Control Files

Summarize `data_layers.txt`, `virtual_layers.txt`, and `virtual_layers_metadata_all.csv`, including row counts and field names.

### P1.4: ZIP Payload Families And Integrity Signals

Classify representative ZIP entry structures and define low-cost integrity signals.

### P1.5: Data Repository Layout Recommendation

Recommend whether `fresh-hectaresbc-data` should preserve the rescued layout exactly, introduce a canonical layout, or use a hybrid with explicit provenance mappings.

