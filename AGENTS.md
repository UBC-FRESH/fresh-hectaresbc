# AGENTS.md

This file is the working contract for AI coding agents in this repository.

## Project Purpose

`fresh-hectaresbc` exists to recover, inventory, document, and modernize the archived HectaresBC geospatial data collection after the original Province of British Columbia platform was decommissioned on June 30, 2022.

The goal is not to recreate the old platform exactly. The goal is to preserve the valuable archived data assets and rebuild them into an open, searchable, reproducible, maintainable geospatial data platform for research, teaching, modelling, and decision support.

## Current Repo State

This repository is currently a bootstrap skeleton. It contains:

- `README.md`: minimal project title.
- `ROADMAP.md`: lightweight project plan and current next-step tracker.
- `CHANGE_LOG.md`: append-only project narrative.
- `planning/`: deeper planning notes when a topic is too large for the roadmap.
- `tmp/`: ignored local working area that may contain private notes, rescued archive data, and other non-public working material.

There is no established application stack, package manager, test suite, ingestion framework, catalog schema, or CI contract yet. Do not invent one without clear need or user direction.

Private bootstrap notes may exist under `tmp/bootstrap.md`. Treat that file as local context only. Do not copy names, private references, or miscellaneous unpublished details from it into tracked files unless the user explicitly asks for a cleaned public version.

## Source Data

The rescued original data dump is expected under:

```text
tmp/shared-data/hectaresbc
```

That directory is an inflated copy of `hectaresbc.tar.gz` and may be large. Treat it as local source material, not as repo content.

Rules:

- Do not commit archived datasets, generated extracts, bulky inventories, or other large data files unless the user explicitly asks.
- Keep `tmp/` ignored.
- Prefer small, reproducible scripts and documentation over checked-in derived data.
- If creating inventories or reports from the archive, write them to a deliberate tracked location only when they are compact and useful as project metadata.
- Record data provenance whenever a dataset, layer, virtual layer, or metadata record is interpreted.

## Large-Data Repository Strategy

The HectaresBC data collection is expected to be too large, and too file-heavy, to track directly in this repository with plain Git and GitHub.

The intended architecture is:

- This repository (`fresh-hectaresbc`) tracks code, documentation, planning notes, small metadata, catalog definitions, and reproducible workflows.
- A second public repository, `UBC-FRESH/fresh-hectaresbc-data`, will be configured as a DataLad/git-annex dataset for the large HectaresBC payloads.
- This repository will later link that data repository as a Git submodule, expected at:

```text
external/fresh-hectaresbc-data
```

This follows the established FEMIC pattern where the main repository links DataLad-managed external data under `external/`.

Rules:

- Do not attempt to solve large-data tracking with plain Git LFS, ad hoc archives, or committed data dumps unless the roadmap is explicitly changed.
- Do not add the HectaresBC payload directly to this repository.
- Keep local rescued source material under ignored `tmp/` until the DataLad data-repository contract is ready.
- When the data repo is introduced, commit only the submodule pointer and documentation in this repo; annexed payloads belong to the DataLad repo and its configured storage remotes.
- Cold-clone validation must prove that a new checkout can initialize the submodule and retrieve representative annexed payloads.

## Product Vision

The final package and service model is not settled yet. Current public-facing direction:

- The Python package should eventually be installable with `pip install fresh-hectaresbc`.
- The installed package should provide a Python API and Typer CLI for catalog search, metadata inspection, and data retrieval.
- Normal users should not need to learn DataLad/git-annex. The package should wrap the data-repository and object-store details behind safer commands and clearer diagnostics.
- Storage backends should remain configurable while the project evaluates public S3-compatible options, including DRAC Arbutus and UBC ARC Chinook.
- This repository may also hold code, recipes, and documentation for a browser interface that supports catalog browsing, metadata review, map preview, area-of-interest selection, and custom download requests.
- The web app may initially require an access-control layer such as UBC CWL to manage abuse risk and hosted resource costs.

Do not over-specify implementation details before archive reconnaissance, catalog design, and data storage decisions provide enough evidence.

## Working Principles

- Read `AGENTS.md`, `ROADMAP.md`, and `CHANGE_LOG.md` before making project-shaping changes.
- Preserve the distinction between archived source data, derived working outputs, and tracked project metadata.
- Favor reproducible workflows over one-off manual transformations.
- Use structured parsers and geospatial tooling where available instead of ad hoc text processing for data formats.
- Keep naming conventions explicit once they emerge; do not silently normalize filenames or dataset identifiers without documenting the mapping.
- When uncertain about a dataset's meaning, lineage, coordinate reference system, licensing, or completeness, document the uncertainty rather than guessing.
- Keep changes scoped. This repo is early-stage, so avoid broad framework choices unless they are needed for the immediate task.
- Keep public repo content clean of private, irrelevant, or unpublished references. Prefer sanitized summaries over raw pasted notes.

## Planning Workflow

This repo should use a lightweight version of the agent-assisted workflow used in the FEMIC project. Borrow the discipline, not the full complexity.

Active rules now:

- Keep the current plan in `ROADMAP.md`.
- Keep the immediate edge of work in the `Current Next Steps` section of `ROADMAP.md`.
- Record completed deliverables in `CHANGE_LOG.md` with dated bullets.
- Use `planning/` for focused notes, investigations, and contracts that are too detailed for the roadmap.
- Before non-trivial work, update or confirm the roadmap entry that governs it.
- Use GitHub issues with `gh` in tandem with the roadmap:
  - roadmap phases should generally map to GitHub parent issues;
  - roadmap tasks should generally map to linked child issues;
  - roadmap subtasks should generally be checklist steps documented inside the child issue;
  - record issue numbers beside active roadmap phases/tasks once created.

## Strict Development Workflow

Use this workflow for active development from the first phase boundary onward:

- One active roadmap phase should generally correspond to one GitHub parent issue and one feature branch.
- Create or activate the GitHub parent issue before starting a roadmap phase.
- Create the feature branch from current `main` for that parent issue.
- Create child issues for roadmap tasks under the parent issue.
- Document roadmap subtasks as checklist steps inside the child issue body.
- Work child issues one at a time where practical, usually in roadmap order.
- Close each child issue only after its repo changes, documentation, and verification for that task are complete.
- Keep `ROADMAP.md`, `CHANGE_LOG.md`, and issue comments synchronized as task state changes.
- Open a PR from the phase branch back to `main` when the parent issue's child issues are complete or explicitly deferred.
- Close the parent issue only after the PR has merged back to `main`.
- Do not start a new active parent issue and branch until the current parent issue is closed, unless the maintainer explicitly approves a parallel lane.

Existing bootstrap-created parent issues for future phases are planning placeholders. Treat them as inactive backlog lanes until their phase is explicitly activated.

Planned later, once the repo has enough structure to justify them:

- More formal GitHub issue hygiene rules, labels, milestones, and release tracking.
- CI, linting, formatting, tests, and pre-commit rules.
- Documentation build checks.
- Package or command-line tooling contracts.
- Machine-readable metadata/catalog schemas.
- Full data publication and storage contracts.
- Commit granularity rules tied to roadmap tasks.

## Expected Deliverables Over Time

The expected project phases are:

1. Data recovery: inventory archived assets, verify integrity, organize source files, recover metadata, recover virtual layer definitions, and document provenance.
2. Data infrastructure: establish repo structure, automated ingestion, metadata catalog, naming conventions, and maintenance procedures.
3. Data access: cloud storage, searchable catalog, published documentation, programmatic access, and GIS workflow support.
4. User access: Python API, Typer CLI, and browser-based catalog/map/download workflows.
5. Applications: forest estate modelling, biodiversity and habitat modelling, carbon accounting, cumulative effects assessment, bioeconomy analysis, and student research support.

Use these phases as orientation, not as permission to add large systems prematurely.

## Tooling And Verification

At the time this contract was written, there are no project-specific commands to run.

When adding tooling:

- Document required commands in `README.md` or a dedicated notes file.
- Add the smallest useful verification path for the change.
- Prefer scripts that can be rerun from a clean checkout with the external archive mounted or restored under `tmp/shared-data/hectaresbc`.
- Do not require absolute machine-specific paths outside this repository unless unavoidable; if unavoidable, document them clearly.

## Git Hygiene

- Treat existing uncommitted changes as user work unless you made them.
- Do not revert user changes without explicit instruction.
- Avoid committing generated, bulky, or environment-specific files.
- Keep `.gitignore` aligned with data handling rules, especially for `tmp/` and any future generated-output directories.

## Documentation Standards

Documentation should be practical and provenance-oriented:

- Say what was found, where it came from, and how it was inspected.
- Include exact paths for local archive locations when useful.
- Include commands used for repeatable inspection steps.
- Capture assumptions, known gaps, and follow-up questions.
- Avoid presenting recovered metadata as authoritative until it has been verified against source files or original HectaresBC definitions.
