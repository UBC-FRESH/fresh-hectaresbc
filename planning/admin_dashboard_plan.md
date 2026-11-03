# Phase 24: Protected Admin Statistics Dashboard

Parent issue: #185

## Goal

Turn existing tile/job statistics into a compact admin workspace:

- cache and request health;
- latency and errors;
- source mix (`cache`, `overlay`, `cog`, `zip`);
- COG coverage and build candidates;
- job/queue summary;
- top datasets by request volume.

The dashboard relies on the existing Cloudflare Access boundary. It adds no user
accounts or persistence.

## Route And Access Contract

- New `#/admin` route.
- The Admin workspace tab is hidden until `/api/health` reports a running
  service.
- If stats are unavailable, the route shows a clear unavailable state instead of
  a broken dashboard.
- `/api/stats` remains read-only and contains no client identifiers.

## Metrics Contract

Use `/api/stats?top=25`:

- totals: requests, hits/misses, hit rate, errors, average/max latency;
- source counts: cache, overlay, COG, zip, error;
- top datasets: requests, hit rate, latency, source mix;
- COG datasets and count;
- bundle-job status counts.

The dashboard may also fetch `/api/bundle-jobs?limit=20` for a compact recent-job
view.

## COG Candidate Contract

A top dataset without a COG displays a copyable command:

```bash
python scripts/build_tile_cog.py --dataset-id <id> \
  --archive-root /path/to/hectaresbc --output-root var/tile-cogs
```

The dashboard does not execute build jobs or arbitrary commands.

## UI Contract

- Header: title, last refresh, Refresh button.
- Metric cards: requests, hit rate, average latency, max latency, errors.
- Source-mix bars/list.
- Job status summary.
- Top dataset table with COG status, hit rate, latency, sources, and copy command.
- Links to raw `/api/stats` and `/api/health`.
- Empty/unavailable states.

## Non-Goals

- Triggering COG builds from the browser.
- User-specific analytics, IP tracking, or cookies.
- Long-term metric persistence.
- New authentication or authorization beyond the access proxy.

## Verification

- Stats API tests.
- Mocked admin browser smoke.
- Existing workspace/clip/history smokes.
- Sphinx `-W`.
- Protected public dashboard verification.
