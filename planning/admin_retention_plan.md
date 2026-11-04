# Phase 39: Bundle Retention And Admin Storage Polish

Parent issue: #285

## Goal

Make retained storage visible and controllable from the protected admin
dashboard:

- tile cache usage;
- COG derivative usage;
- completed bundle/ZIP usage;
- temporary AOI file usage;
- configured retention policy;
- a manual **Prune expired outputs** action.

Existing automatic retention limits remain unchanged.

## API Contract

### `GET /api/stats`

Add:

```json
{
  "storage": {
    "tile_cache": {"root": "...", "files": 0, "bytes": 0, "max_bytes": 0},
    "tile_cogs": {"root": "...", "files": 0, "bytes": 0},
    "bundles": {"root": "...", "files": 0, "bytes": 0, "bundles": 0, "zips": 0},
    "aoi": {"root": "...", "files": 0, "bytes": 0}
  },
  "retention": {
    "job_history_limit": 100,
    "job_history_max_age_days": 30,
    "bundle_history_limit": 50,
    "bundle_history_max_age_days": 30,
    "bundle_aoi_max_age_days": 7,
    "bundle_aoi_max_files": 500
  }
}
```

Usage is computed on demand when the admin dashboard requests stats. Errors while
walking a directory are ignored rather than failing the endpoint.

### `POST /api/admin/prune`

Runs existing retention logic:

- `job_manager.prune_jobs()`;
- `job_manager.prune_outputs()`.

Response:

```json
{
  "status": "ok",
  "jobs": {"removed": 0, "kept": 10},
  "outputs": {
    "removed_bundles": 0,
    "removed_zips": 0,
    "removed_aoi": 0,
    "kept_bundles": 2
  }
}
```

The endpoint does not create a job and does not change configuration.

## Admin UI

- Add two metrics:
  - bundle storage;
  - tile-cache usage against configured max.
- Add a **Storage and retention** panel:
  - cache, COGs, bundles/ZIPs, AOI usage with file counts and human-readable bytes;
  - cache utilization bar;
  - retention limits/ages;
  - **Prune expired outputs** button.
- While pruning, button reads `Pruning…` and is disabled.
- Success toast includes removed jobs/bundles/ZIPs/AOI counts.
- Refresh stats after pruning.

## Tests

Server:

- synthetic archive/stats includes storage and retention fields;
- `POST /api/admin/prune` returns counts and does not remove active jobs.

Browser:

- stats mock includes storage/retention;
- admin dashboard renders 7 metrics and storage rows;
- prune action calls the endpoint, disables/re-enables, and refreshes stats.

## Non-Goals

- Changing retention defaults.
- Deleting active jobs or bundles.
- Per-dataset cache eviction UI.
- Authentication changes inside the service.

## Verification

- Targeted Python tests.
- Admin browser smoke.
- Existing cold-checkout, Series, Compare, and performance smokes.
- Sphinx `-W`.
- Public admin storage verification.
