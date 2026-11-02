# Demo Deployment Notes

This is the origin-side setup for the `fresh-hectaresbc.01101.dev` demo. The
Cloudflare tunnel, DNS, Access application, and Globus OAuth policy are
configured outside this repository, following the WS4/FHOPS pattern.

## Service

The demo clone is expected at:

```text
/srv/shared-data/gep/ws4/fresh-hectaresbc-demo
```

Install the service and environment file:

```bash
sudo cp deploy/fresh-hectaresbc-demo.service /etc/systemd/system/
sudo cp deploy/fresh-hectaresbc-demo.env.example /etc/fresh-hectaresbc-demo.env
sudo editor /etc/fresh-hectaresbc-demo.env
sudo systemctl daemon-reload
sudo systemctl enable --now fresh-hectaresbc-demo
```

The service binds `0.0.0.0:8030` and reads:

- `FRESH_HECTARESBC_ARCHIVE_ROOT` for source rasters used by tiles and clipping;
- `FRESH_HECTARESBC_FEMIC_SRC` for FEMIC BCDC boundary resolution;
- `FRESH_HECTARESBC_PUBLIC_URL` for bundle download links;
- `FRESH_HECTARESBC_TILE_CACHE_MAX_BYTES` for the tile-cache budget.

Restart and inspect:

```bash
sudo systemctl restart fresh-hectaresbc-demo
sudo journalctl -u fresh-hectaresbc-demo -f
```

For a non-systemd host, `scripts/demo_ctl.sh start|stop|status|logs` manages a
detached process with a PID file and log under `var/`.

## Tunnel

Use `deploy/cloudflared-ingress.example.yml` as a template. The origin is the
container/host address that runs port 8030.

```text
cloudflared tunnel route dns <tunnel> fresh-hectaresbc.01101.dev
sudo systemctl restart cloudflared
```

If `cloudflared` runs in the same network namespace as the service, the origin
can be `http://127.0.0.1:8030`; otherwise use the service host/container IP.

## Cloudflare Access

Create a self-hosted Access application for the **entire hostname**, not only
`/web/` or `/api/`:

```text
fresh-hectaresbc.01101.dev
```

Use a policy that allows the intended Globus identity provider constrained to
UBC CWL, matching the `fhops.01101.dev` and `ws4.01101.dev` setup. Do not add a
bypass for `/api/*`, `/api/agent*`, `/api/bundles*`, or `/api/tiles*`.

The assistant is enabled (`--allow-agent`) and has the service user's shell
permissions. Treat the Access policy as the authentication boundary. The service
strips common AWS/Globus credential variables from the agent environment, but it
is not a sandbox.

## Verification

From any machine that can reach the public hostname:

```bash
python scripts/check_demo_service.py \
  --base-url https://fresh-hectaresbc.01101.dev
```

The check covers the app, catalog, preview indexes, assistant status, tile
metadata, a sample tile, and the bundle endpoint. It does not start an agent
conversation or create a bundle.

Local origin check:

```bash
python scripts/check_demo_service.py --base-url http://127.0.0.1:8030
```

## Tile Cache

Tiles are written under `var/tile-cache/`. The service prunes least-recently-used
tiles when the cache exceeds `FRESH_HECTARESBC_TILE_CACHE_MAX_BYTES` (default
4 GiB). Budget disk for the tile cache separately from the preview data.
