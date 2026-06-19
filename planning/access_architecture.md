# Access Architecture

## Purpose

Frame the dependency order for the future `fresh-hectaresbc` access system.

The project should avoid building separate data access paths for the CLI and browser app. Both should sit on top of a shared core Python access library.

Phase 6 turns this high-level framing into a concrete core-library contract in `planning/core_access_library_architecture.md`.

## Layer Model

```text
archive/data repo -> catalog metadata -> core access library -> CLI/web app
```

## Layers

### Archive And Data Repository

The rescued HectaresBC source material starts under ignored local `tmp/`.

The long-term large-data home is expected to be `UBC-FRESH/fresh-hectaresbc-data`, configured as a DataLad/git-annex dataset and linked into this repository as `external/fresh-hectaresbc-data`.

### Catalog Metadata

The catalog should describe datasets independently of any one interface.

It should eventually capture:

- stable dataset identifiers;
- source path and original name;
- title and description;
- format and data family;
- spatial reference and extent where known;
- provenance;
- access hints;
- uncertainty and verification status.

### Core Access Library

The core Python library should provide the stable programmatic surface:

- catalog search;
- metadata lookup;
- dataset resolution;
- data retrieval and cache management;
- backend diagnostics;
- future export or clipping preparation.

DataLad/git-annex and S3-compatible object stores should be backend mechanisms, not the user-facing model.

### CLI

The Typer CLI should expose user-friendly commands over the core access library.

It should avoid direct custom retrieval logic that bypasses the core layer.

### Web App

The browser app should use the same catalog and access concepts as the core library.

It may need service-side workflows for map previews, AOI selection, queued clipping/export jobs, and download collection.

## Planning Rule

Do not implement CLI or web app data access logic until the shared catalog and core access-library contracts are clear enough to prevent duplication.
