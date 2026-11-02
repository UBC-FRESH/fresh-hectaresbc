#!/usr/bin/env python3
"""Verify the demo service through a local or public origin.

Run this after the cloudflared route and Cloudflare Access policy are in place:

    python scripts/check_demo_service.py \
        --base-url https://fresh-hectaresbc.01101.dev

It checks the static app, catalog/preview indexes, assistant status, tile
metadata and a sample tile, and the recent-bundle endpoint. It does not start an
agent conversation or create a bundle.
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def _get(url: str, timeout: float) -> tuple[int, bytes, dict[str, str]]:
    request = Request(url, headers={"User-Agent": "fresh-hectaresbc-demo-check"})
    try:
        with urlopen(request, timeout=timeout) as response:
            return response.status, response.read(), dict(response.headers)
    except HTTPError as exc:
        return exc.code, exc.read(), dict(exc.headers)


def _json(url: str, timeout: float) -> Any:
    status, body, _ = _get(url, timeout)
    if status != 200:
        raise RuntimeError(f"HTTP {status}: {url}")
    return json.loads(body)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8030")
    parser.add_argument("--timeout", type=float, default=30.0)
    parser.add_argument("--skip-tiles", action="store_true")
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    checks: list[tuple[str, bool, str]] = []

    def check(name: str, condition: bool, detail: str = "") -> None:
        checks.append((name, condition, detail))

    try:
        health = _json(f"{base}/api/health", args.timeout)
        check("health", health.get("status") == "ok", json.dumps(health)[:300])
        check("catalog index", bool(health.get("catalog_index")), "")
        check("preview index", bool(health.get("preview_index")), "")
        check("archive root", bool(health.get("archive_root")), str(health.get("archive_root")))
        check("agent enabled", bool(health.get("agent_enabled")), "")
        check("agent available", bool(health.get("agent_available")), "")
    except (URLError, HTTPError, RuntimeError, json.JSONDecodeError) as exc:
        check("health", False, str(exc))

    try:
        status, body, headers = _get(f"{base}/web/", args.timeout)
        check(
            "web app",
            status == 200 and b"HectaresBC" in body,
            f"HTTP {status} {headers.get('content-type', '')}",
        )
    except (URLError, HTTPError) as exc:
        check("web app", False, str(exc))

    try:
        catalog = _json(f"{base}/web/data/catalog.index.json", args.timeout)
        check(
            "catalog records",
            int(catalog.get("record_count", 0)) == 2183,
            str(catalog.get("record_count")),
        )
    except (URLError, HTTPError, RuntimeError, json.JSONDecodeError) as exc:
        check("catalog records", False, str(exc))

    try:
        previews = _json(
            f"{base}/external/fresh-hectaresbc-data/derived/web_map_previews/v1/index.json",
            args.timeout,
        )
        check(
            "published previews",
            int(previews.get("artifact_count", 0)) >= 2000,
            str(previews.get("artifact_count")),
        )
    except (URLError, HTTPError, RuntimeError, json.JSONDecodeError) as exc:
        check("published previews", False, str(exc))

    try:
        map_index = _json(f"{base}/web/data/map_previews_3857/index.json", args.timeout)
        check(
            "reprojected map previews",
            int(map_index.get("layer_count", 0)) >= 2000,
            str(map_index.get("layer_count")),
        )
    except (URLError, HTTPError, RuntimeError, json.JSONDecodeError) as exc:
        check("reprojected map previews", False, str(exc))

    if not args.skip_tiles:
        try:
            tile_meta = _json(
                f"{base}/api/tiles/dl_adminunits_bcts/metadata", args.timeout
            )
            check(
                "tile metadata",
                tile_meta.get("status") == "ok",
                f"maxzoom={tile_meta.get('maxzoom')} detail={tile_meta.get('max_detail')}",
            )
            status, body, headers = _get(
                f"{base}/api/tiles/dl_adminunits_bcts/10/162/329.png",
                args.timeout,
            )
            check(
                "tile PNG",
                status == 200
                and body.startswith(b"\x89PNG")
                and headers.get("content-type") == "image/png",
                f"HTTP {status} {len(body)} bytes",
            )
        except (URLError, HTTPError, RuntimeError, json.JSONDecodeError) as exc:
            check("tile PNG", False, str(exc))

    try:
        bundles = _json(f"{base}/api/bundles", args.timeout)
        check("bundle endpoint", bundles.get("status") == "ok", "")
    except (URLError, HTTPError, RuntimeError, json.JSONDecodeError) as exc:
        check("bundle endpoint", False, str(exc))

    failed = 0
    for name, ok, detail in checks:
        print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  ({detail})" if detail else ""))
        if not ok:
            failed += 1
    print(f"\n{len(checks) - failed}/{len(checks)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
