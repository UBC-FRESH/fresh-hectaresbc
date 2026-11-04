# Phase 41: Release Readiness And Documentation Consolidation

Parent issue: #297

## Goal

Give a new maintainer one current entry point for:

- what the browser and service can do;
- routes and user-facing workflows;
- local/public operations;
- verification commands;
- performance/accessibility/cold-checkout budgets;
- known limitations and non-goals;
- current handoff state.

No browser feature changes.

## Deliverables

### Release Readiness Guide

Add `docs/release_readiness.rst` covering:

- current capability matrix by surface;
- route map;
- browser/service prerequisites;
- local demo operations and protected public origin;
- full verification command set;
- performance budgets;
- data/preview/COG optional artifacts;
- security and access model;
- known limitations;
- release checklist.

### Repeatable Checks

Add `scripts/run_release_checks.sh`:

- asset budgets;
- static app and catalog JS checks;
- targeted Python tests;
- browser smokes for accessibility, cold checkout, admin, tours, compare, Series,
  Series video, contact sheet, map export, and performance;
- Sphinx `-W`;
- `git diff --check`.

The script should run from the repository root and stop on first failure.

### README And Overview

- Add a concise current browser/series/tour/export summary near the top.
- Link the release readiness guide.
- Update `docs/overview.rst` capabilities.
- Keep the deep historical narrative in `CHANGE_LOG.md` and `HANDOFF.md`.

### HANDOFF

- Refresh status/merge/PR/demo details.
- Point to the readiness guide and check script.
- Keep operational commands concise.

## Verification

- Run `scripts/run_release_checks.sh`.
- Build Sphinx with `-W`.
- Verify the published readiness guide.
- Confirm no open issues/PRs after closeout.

## Non-Goals

- New product features.
- Rewriting historical roadmap phases.
- Removing detailed development documentation.
- Archiving the repository.
