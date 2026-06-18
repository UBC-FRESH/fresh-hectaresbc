# Archive Inventory Plan

## Purpose

Define the first read-only reconnaissance pass over the rescued HectaresBC archive.

The goal is to understand what was delivered in the 2022 extraction before choosing tooling, schemas, storage layouts, or publication workflows.

## Expected Source Location

```text
tmp/shared-data/hectaresbc
```

This source tree is local working data and must not be committed.

## First Pass Questions

- Is the expected archive directory present and readable?
- What is the top-level directory structure?
- How many files and directories are present?
- What file extensions and formats dominate the archive?
- Which files look like metadata, documentation, layer definitions, indexes, manifests, or logs?
- Which files look like geospatial data containers or sidecar files?
- Are there obvious duplicate, partial, corrupt, empty, or unusually large files?
- Are there virtual layer definitions or references to external source datasets?

## Output Rules

- Keep the pass read-only.
- Do not copy source data into tracked paths.
- Do not commit bulky generated inventories.
- Track only compact summaries that help guide the next step.
- Include commands used so the inventory can be rerun.
- Record uncertainty explicitly.

## Likely Follow-Up

After the first pass, update `ROADMAP.md` with more precise Phase 1 tasks and decide whether to add a small script for repeatable inventory generation.

The first pass should also inform the future DataLad-backed data repository lane by estimating file counts, large-file families, directory structure, and any metadata that should remain in the main repo versus the data repo.

