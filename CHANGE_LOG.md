# Change Log

## 2026-06-18

- Added initial root `AGENTS.md` contract for recovering and modernizing the archived HectaresBC data collection.
- Established a lightweight FEMIC-inspired governance scaffold with `ROADMAP.md`, `CHANGE_LOG.md`, and `planning/`.
- Recorded that stricter workflow elements such as GitHub issue hygiene, CI, tests, schemas, and documentation build checks are planned later rather than active day-one requirements.
- Updated the public governance contract to treat `tmp/bootstrap.md` as private local context and keep tracked repo content sanitized.
- Created the Phase 0 GitHub issue set with parent issue #1 and child issues #5, #2, #4, and #3; closed completed child issues #5, #2, and #4.
- Updated `AGENTS.md` and `ROADMAP.md` so roadmap phases generally map to GitHub parent issues, roadmap tasks map to child issues, and child issue checklists carry task steps.
- Added a planned DataLad-backed large-data repository phase for `UBC-FRESH/fresh-hectaresbc-data`, with parent issue #6 and child issues #8, #11, #9, #7, and #10.
- Documented that HectaresBC payloads are expected to live in a separate DataLad/git-annex repository linked later as `external/fresh-hectaresbc-data`, following the FEMIC `external/` pattern.
- Added product-vision roadmap phases for an installable Python API/Typer CLI package and a browser catalog/map/download web app.
- Created GitHub parent issues #12 and #13 with child issues #16, #17, #14, #18, #15, #20, #22, #19, #23, #24, and #21 to track those future product lanes.
- Refactored future product planning into a dependency-ordered architecture: core Python access library (#25), Typer CLI (#26), package distribution (#12), browser app (#13), and future hardening.
- Closed superseded issues #14 and #17 after replacing them with core access-library issues #30, #28, and #29.
- Added strict development workflow rules: active roadmap phases map to a parent issue and feature branch, tasks map to child issues, child issues close one at a time, and parent issues close only after the phase PR merges to `main`.
- Opened draft Phase 0 PR #32 from `feature/p0-governance-bootstrap` to `main`; it remains draft until the first archive reconnaissance informs #3.
- Completed the Phase 0 archive reconnaissance review for #3 and recorded compact findings in `planning/archive_reconnaissance_2026-06-18.md`.
- Confirmed the local HectaresBC archive is about 17 GB with 2,191 files, including 418 data-layer ZIPs, 1,765 virtual-layer ZIPs, and compact root metadata/control files.
- Concluded that Phase 1 should focus on compact inventory, ZIP manifests, metadata parsing, representative integrity checks, and data-repository layout decisions before adding package/docs/CI scaffolding.
- Merged Phase 0 governance baseline PR #32 and updated the roadmap closeout state so Phase 1 activation is the next workflow step.
- Activated Phase 1 archive reconnaissance with parent issue #34, branch `feature/p1-archive-reconnaissance`, and child issues #36, #37, #38, #39, and #35.
- Completed the P1.1 archive inventory output contract in `planning/phase1_archive_reconnaissance_plan.md`.
- Completed P1.2 by adding `scripts/archive_inventory.py` and generating compact tracked outputs in `metadata/archive_inventory/`.
- Verified the generated archive summary and ZIP manifest parse successfully, cover 2,191 files and 2,183 ZIP rows, and report zero bad ZIP rows.
