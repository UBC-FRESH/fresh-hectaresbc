# Roadmap

This roadmap is intentionally lightweight. It should guide the next few moves without forcing the repo to carry FEMIC-level process before the HectaresBC archive shape is understood.

## Phase 0: Governance Bootstrap

GitHub parent issue: #1

- [x] P0.1 Create root agent operating contract in `AGENTS.md`. Child issue: #5.
- [x] P0.2 Establish lightweight roadmap and changelog surfaces. Child issue: #2.
- [x] P0.3 Create first focused planning note for archive inventory. Child issue: #4.
- [x] P0.4 Review and refine this scaffold after the first archive reconnaissance pass. Child issue: #3.
- [x] P0.5 Define strict issue, branch, and PR workflow. Child issue: #31.

## Phase 1: Archive Reconnaissance

GitHub parent issue: #34

Active branch: `feature/p1-archive-reconnaissance`

- [x] P1.1 Define archive inventory output contract. Child issue: #36.
- [x] P1.2 Build root inventory and ZIP manifest. Child issue: #37.
- [x] P1.3 Parse root metadata and control files. Child issue: #38.
- [x] P1.4 Classify ZIP payload families and integrity signals. Child issue: #39.
- [x] P1.5 Recommend data repository layout approach. Child issue: #35.

## Phase 2: Metadata And Provenance Recovery

GitHub parent issue: #43

Active branch: `feature/p2-metadata-provenance`

- [x] P2.1 Define a minimal dataset identity model: source path, original name, inferred title, format, CRS when known, metadata source, and uncertainty notes. Child issue: #45.
- [x] P2.2 Recover compact virtual-layer catalog records from root metadata and ZIP evidence. Child issue: #48.
- [x] P2.3 Recover compact data-layer metadata records from per-ZIP metadata files. Child issue: #47.
- [x] P2.4 Draft naming and provenance conventions before any broad normalization. Child issue: #44.
- [x] P2.5 Summarize metadata recovery results and Phase 3 ingestion-design inputs. Child issue: #46.

## Phase 3: Reproducible Ingestion Design

GitHub parent issue: #50

Active branch: `feature/p3-ingestion-design`

- [x] Activate Phase 3 with a GitHub parent issue and feature branch after Phase 2 PR #49 merges to `main`.
- [x] P3.1 Choose tooling based on archive contents, not before. Child issue: #54.
- [x] P3.2 Design compact, rerunnable inventory and metadata extraction workflows. Child issue: #51.
- [ ] P3.3 Add the first validation checks for source-data readability and metadata consistency. Child issue: #52.
- [ ] P3.4 Summarize ingestion design and Phase 4 inputs. Child issue: #53.

## Phase 4: DataLad-Backed Data Repository

GitHub parent issue: #6

The HectaresBC archive is expected to include large files and a large total data payload. This repository will not track that payload directly with plain Git/GitHub. The planned pattern is to link a separate public DataLad/git-annex dataset repository, `UBC-FRESH/fresh-hectaresbc-data`, as a Git submodule under `external/fresh-hectaresbc-data`, following the established FEMIC `external/` pattern.

Phase 4 storage work should configure a DataLad/git-annex S3 special remote pointing to a new Arbutus object-storage bucket. Credentials must use the user-local FEMIC-style pattern under `~/.config/fresh-hectaresbc/`, not tracked repo files. See `planning/arbutus_s3_special_remote_plan.md`.

- [ ] P4.1 Define the data repository contract. Child issue: #8.
- [ ] P4.2 Initialize `UBC-FRESH/fresh-hectaresbc-data` as a DataLad dataset. Child issue: #11.
- [ ] P4.3 Configure storage remote for annexed payloads. Child issue: #9.
- [ ] P4.4 Link the DataLad repo as a Git submodule at `external/fresh-hectaresbc-data`. Child issue: #7.
- [ ] P4.5 Validate cold-clone data access workflow. Child issue: #10.

## Phase 5: Core Python Access Library

GitHub parent issue: #25

The core Python access library is the shared layer that should power both the CLI and the browser app. It should expose catalog search, metadata lookup, dataset resolution, retrieval/cache behavior, and backend diagnostics. DataLad/git-annex and S3-compatible object stores should be internal backends, not the user-facing abstraction.

- [ ] P5.1 Define core access architecture. Child issue: #27.
- [ ] P5.2 Define catalog query API. Child issue: #30.
- [ ] P5.3 Define retrieval and cache API. Child issue: #28.
- [ ] P5.4 Define backend abstraction for DataLad and object stores. Child issue: #29.

## Phase 6: Typer CLI Interface

GitHub parent issue: #26

The CLI should be a thin, user-friendly interface over the core Python access library. It should expose catalog search, metadata inspection, retrieval, cache, and diagnostics workflows without requiring normal users to understand DataLad/git-annex operations.

- [ ] P6.1 Define Typer CLI workflows. Child issue: #18.

## Phase 7: Package Distribution and Install Workflow

GitHub parent issue: #12

The envisioned local user workflow is `pip install fresh-hectaresbc`, followed by Python API or CLI access to HectaresBC catalog and data workflows. Packaging should support the core library and CLI layers without mixing their responsibilities.

- [ ] P7.1 Define package distribution contract. Child issue: #16.
- [ ] P7.2 Package install and smoke-test plan. Child issue: #15.

## Phase 8: Browser Catalog, Map, and Download Web App

GitHub parent issue: #13

The envisioned browser app would revive useful parts of the original HectaresBC service: browse layer lists and metadata, preview layers on a map, define an area of interest by drawing or selecting standard tiles, submit custom download requests, and collect prepared outputs. The initial hosted deployment may require UBC CWL or another access-control layer to manage abuse risk and hosting costs. Others could self-host if deployment recipes are published.

- [ ] P8.1 Define web app product and access-control contract. Child issue: #20.
- [ ] P8.2 Specify catalog and metadata browser. Child issue: #22.
- [ ] P8.3 Specify map preview workflow. Child issue: #19.
- [ ] P8.4 Specify AOI and tile-selection workflow. Child issue: #23.
- [ ] P8.5 Specify custom download request workflow. Child issue: #24.
- [ ] P8.6 Define web app hosting and deployment plan. Child issue: #21.

## Phase 9: Future Workflow Hardening

These are planned but not active requirements yet.

- [ ] P9.1 Add more formal GitHub issue hygiene, labels, milestones, and release tracking when task volume warrants it.
- [ ] P9.2 Add linting, formatting, tests, and pre-commit once code exists.
- [ ] P9.3 Add CI once there are stable commands to run.
- [ ] P9.4 Add documentation build checks once formal docs exist.
- [ ] P9.5 Add machine-readable catalog schemas once the metadata model stabilizes.
- [ ] P9.6 Add full data publication/storage contracts once the DataLad architecture is proven.

## Current Next Steps

1. Complete P3.3 by adding the first validation checks for recovered catalog consistency and representative source readability.
2. Complete P3.4 with a Phase 3 summary and Phase 4 DataLad/data-repository inputs.
3. Keep future parent issues (#6, #25, #26, #12, #13) as inactive planning placeholders until their phase is explicitly activated.
