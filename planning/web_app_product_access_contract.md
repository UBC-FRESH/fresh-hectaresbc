# Web App Product And Access-Control Contract

## Purpose

Define the first product and access-control contract for the future browser app before choosing a frontend framework, backend framework, map library, authentication integration, or hosted deployment design.

This completes P9.1. Later Phase 9 slices should use this contract to specify catalog browsing, metadata views, map preview, AOI selection, custom download requests, and hosting without turning the browser app into an unbounded rewrite of the historical HectaresBC service.

## Product Position

The browser app should be a hosted and optionally self-hostable interface over the recovered HectaresBC catalog and data repository.

It should make the recovered collection usable for people who do not want to install a Python package, understand DataLad/git-annex, or browse raw ZIP payload paths manually.

The app should not replace the Python API or Typer CLI. The Python package remains the core shared access layer. The web app should call into package/service code rather than inventing a separate catalog parser, metadata model, or retrieval workflow.

## Primary Users

Initial users:

- researchers and students looking for relevant HectaresBC layers;
- instructors preparing reproducible examples or course material;
- FRESH project maintainers validating recovered catalog and payload behavior;
- GIS users who need metadata, preview, and download guidance before working locally.

Later users:

- modelling workflow maintainers who need API-driven or batch request integration;
- external researchers who want to self-host the catalog/download service;
- domain collaborators who need curated layer collections for forest, biodiversity, carbon, cumulative-effects, or bioeconomy workflows.

## First-Session Workflows

A first useful session should support:

1. Search or filter the recovered catalog.
2. Open one layer record and inspect core metadata, provenance, source path, known gaps, and uncertainty notes.
3. See whether a layer has enough spatial metadata for preview.
4. Preview a representative layer when preview support exists.
5. Identify the expected raw payload path and package/CLI retrieval command.
6. For hosted workflows, request a prepared subset only after access-control and cost controls are in place.

The first app screen should be the catalog/search experience, not a marketing landing page.

## App Surfaces

The first browser app should be specified as a small set of surfaces:

- catalog search and filter view;
- dataset detail and provenance view;
- map preview view;
- AOI or tile-selection view;
- download/request submission view;
- request status and collection view;
- maintainer diagnostics or operations view, if hosted workflows need it.

P9.2 should make catalog and metadata browsing concrete before map and download workflows are implemented.

## Access-Control Posture

The access model should distinguish read-only discovery from compute/storage-cost workflows.

Public or low-friction access candidates:

- catalog search;
- dataset metadata pages;
- provenance and uncertainty notes;
- package/CLI usage snippets;
- public documentation.

Controlled access candidates:

- custom download requests;
- AOI clipping;
- tile bundle generation;
- queued jobs;
- stored outputs;
- any operation that can create meaningful server, object-store, or egress cost.

The initial hosted deployment may require UBC CWL or another access-control layer for controlled workflows. If public read-only catalog access is exposed earlier, it should remain static or low-cost enough that abuse risk is limited.

Do not put Arbutus, Chinook, S3, DataLad, or git-annex credentials in browser-delivered code. Hosted services must keep credentials server-side and user-local CLI workflows must keep credentials outside the repo.

## Backend Boundary

The existing `fresh_hectaresbc` package is the source of truth for:

- catalog loading;
- dataset lookup/search/filter behavior;
- source payload path resolution;
- local data-repository status semantics;
- DataLad/git-annex backend diagnostics and fetch result objects.

A future web service layer may add:

- HTTP request/response models;
- authentication/session handling;
- job queue integration;
- map preview tile or image generation;
- AOI validation;
- download bundle preparation;
- hosted diagnostics.

The web layer should not duplicate recovered catalog CSV parsing or silently fork dataset identity rules.

## Data Access Boundary

Default web development and smoke tests should not require:

- Arbutus credentials;
- Chinook credentials;
- private S3 configuration;
- DataLad network retrieval;
- local raw ZIP payload content;
- UBC CWL integration.

Routine tests should use packaged compact catalog metadata, simulated local data-repository states, and dry-run/request-planning behavior.

Credentialed retrieval, object-store access, AOI processing over real payloads, and hosted authentication belong in explicit operational validation paths.

## Abuse And Cost Constraints

Hosted workflows must be designed around cost and abuse limits before public exposure.

Expected controls:

- authentication for job-creating workflows;
- per-user request limits;
- per-request AOI size or tile-count limits;
- maximum output size limits;
- short-lived or lifecycle-managed prepared outputs;
- server-side logging sufficient for debugging and abuse response;
- explicit failure states when data, credentials, or worker capacity are unavailable.

The UI should expose clear request state and failure messages rather than hiding backend setup problems.

## First-Phase Non-Goals

P9 should not require the project to:

- recreate the original HectaresBC web service exactly;
- publish a production hosted service immediately;
- implement CWL integration before the app surfaces and service boundaries are specified;
- implement custom AOI clipping before catalog and preview workflows are concrete;
- expose raw object-store credentials or signed-write behavior to the browser;
- make DataLad a user-visible prerequisite for browser users;
- choose a heavyweight full-stack architecture before the smallest useful app shape is known.

## Open Questions For Later P9 Slices

Questions for P9.2:

- Which recovered catalog fields should be visible in the compact list view?
- Which filters are essential on day one?
- How should uncertainty, known gaps, and verification status appear without overstating authority?

Questions for P9.3:

- Which payload families can be previewed directly?
- Which layers need preprocessing before browser map preview is practical?
- Should preview use precomputed tiles, dynamic rendering, or static thumbnails first?

Questions for P9.4:

- What standard tile grid, if any, should define selectable areas?
- What AOI geometry formats should be accepted?
- What limits should apply before user authentication exists?

Questions for P9.5:

- What is the minimum viable request object?
- What output formats should be supported first?
- Where should prepared downloads live and how long should they persist?

Questions for P9.6:

- What is the smallest hosted deployment that protects credentials and controls cost?
- Which parts can be static?
- Which parts require a stateful service, worker, queue, or object-store integration?
