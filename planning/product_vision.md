# Product Vision

## Status

This is a current vision note, not a finalized architecture.

The project is still in bootstrap. Archive reconnaissance, metadata recovery, catalog design, storage backend selection, and service constraints will shape the final implementation.

## User-Local Package

The intended user-local workflow is:

```bash
pip install fresh-hectaresbc
```

The installed package should eventually provide:

- a core Python access library for catalog search, metadata inspection, dataset resolution, and data retrieval;
- a Typer CLI layered over that same core library;
- clear diagnostics for missing data, unavailable storage backends, and retrieval failures;
- safe wrapper commands around DataLad/git-annex and S3-compatible object stores.

Normal users should not need to learn DataLad directly. DataLad is powerful and useful for tracking large datasets, but it is easy for non-specialist users to break workflows with small operational mistakes. The package should hide common retrieval and cache-management details behind stable commands.

Candidate storage backends include:

- DRAC Arbutus object storage, noting that existing resources may need migration during the current cloud transition;
- UBC ARC Chinook S3-compatible storage, if it proves stable and appropriate for public HectaresBC distribution.

Storage backend details should remain configurable.

The CLI and browser app should not each invent their own data access logic. Both interfaces should depend on the shared core Python access library wherever possible.

## Browser Interface

The repository may also hold code, recipes, and documentation for a browser interface.

The web app vision includes:

- layer-list browsing;
- catalog search and metadata inspection;
- zoomable and pannable map preview;
- loading one or more map layers for inspection;
- drawing an area of interest;
- selecting one or more standard map tiles as an area of interest;
- submitting custom download requests;
- collecting prepared downloads.

The initial hosted service may require UBC CWL or another access-control layer to manage abuse risk and hosted resource costs.

The primary hosted instance may be operated by the project maintainer, but the code and recipes should not prevent others from self-hosting.

## Repo Role

This repository should hold:

- package code;
- web app code if and when it is built;
- reproducible recipes;
- documentation;
- compact catalog and metadata definitions;
- planning and governance notes;
- the submodule pointer to the DataLad-backed data repository.

Large data payloads belong in `UBC-FRESH/fresh-hectaresbc-data`, not directly in this repository.

## Layered Architecture

```text
archive/data repo -> catalog metadata -> core access library -> CLI/web app
```

The core access library is the stable center of the user-facing system. DataLad/git-annex and S3-compatible object stores are backend mechanisms. User-facing operations should be framed as catalog search, metadata inspection, fetch, export, and clip workflows.

## Open Questions

- What is the first useful API surface after archive reconnaissance?
- Which catalog metadata fields are required for both API/CLI and web users?
- Which storage backend should be the public default?
- Should API/CLI retrieval go through DataLad only, direct S3 URLs only, or a hybrid resolver?
- What authentication and rate-limiting model is acceptable for the hosted web app?
- How much processing should happen synchronously versus through queued download jobs?
