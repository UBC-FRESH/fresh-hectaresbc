#!/usr/bin/env python3
"""Exercise the protected admin dashboard with mocked statistics APIs."""

from __future__ import annotations

import argparse
import functools
import json
import socketserver
import threading
from http.server import SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        return


class ReusableServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--headed", action="store_true")
    args = parser.parse_args()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("skipped admin browser test: playwright is not installed")
        return 0

    handler = functools.partial(QuietHandler, directory=str(REPO_ROOT))
    server = ReusableServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_address[1]}/web/"
    stats_hits = 0
    prune_hits = 0

    def api(route, request):  # noqa: ANN001, ANN202
        nonlocal stats_hits, prune_hits
        path = urlparse(request.url).path
        if path == "/api/health":
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"status": "ok", "max_layers": 6, "max_area_ha": 10_000_000}),
            )
            return
        if path == "/api/stats":
            stats_hits += 1
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(
                    {
                        "status": "ok",
                        "tiles": {
                            "since": "process_start",
                            "totals": {
                                "requests": 42,
                                "cache_hits": 30,
                                "cache_misses": 12,
                                "errors": 1,
                                "latency_ms_total": 2100,
                                "latency_ms_max": 380,
                                "sources": {"cache": 30, "overlay": 5, "cog": 6, "zip": 1},
                                "cache_hit_rate": 0.7143,
                                "avg_latency_ms": 50,
                            },
                            "top_datasets": [
                                {
                                    "dataset_id": "dl_adminunits_bcts",
                                    "requests": 20,
                                    "cache_hits": 15,
                                    "cache_misses": 5,
                                    "errors": 0,
                                    "latency_ms_total": 1200,
                                    "latency_ms_max": 380,
                                    "sources": {"cache": 15, "overlay": 3, "cog": 2},
                                    "cache_hit_rate": 0.75,
                                    "avg_latency_ms": 60,
                                }
                            ],
                        },
                        "tile_cog_root": "/tmp/cogs",
                        "tile_cogs": 1,
                        "cog_datasets": ["dl_adminunits_bcts"],
                        "bundle_jobs": {"complete": 3, "failed": 1, "total": 4},
                        "storage": {
                            "tile_cache": {
                                "root": "/tmp/tiles",
                                "files": 12,
                                "bytes": 1234567,
                                "max_bytes": 4294967296,
                            },
                            "tile_cogs": {
                                "root": "/tmp/cogs",
                                "files": 1,
                                "bytes": 2345678,
                            },
                            "bundles": {
                                "root": "/tmp/bundles",
                                "files": 8,
                                "bytes": 3456789,
                                "bundles": 2,
                                "zips": 2,
                            },
                            "aoi": {
                                "root": "/tmp/bundles/aoi",
                                "files": 3,
                                "bytes": 4567,
                            },
                        },
                        "retention": {
                            "job_history_limit": 100,
                            "job_history_max_age_days": 30,
                            "bundle_history_limit": 50,
                            "bundle_history_max_age_days": 30,
                            "bundle_aoi_max_age_days": 7,
                            "bundle_aoi_max_files": 500,
                        },
                    }
                ),
            )
            return
        if path == "/api/admin/prune" and request.method == "POST":
            prune_hits += 1
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(
                    {
                        "status": "ok",
                        "jobs": {"removed": 0, "kept": 4},
                        "outputs": {
                            "removed_bundles": 1,
                            "removed_zips": 1,
                            "removed_aoi": 2,
                            "kept_bundles": 2,
                        },
                    }
                ),
            )
            return
        if path == "/api/bundle-jobs":
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(
                    {
                        "status": "ok",
                        "jobs": [
                            {
                                "job_id": "job-1",
                                "status": "complete",
                                "aoi_name": "TSA 27",
                                "layer_ids": ["dl_adminunits_bcts"],
                                "message": "Bundle ready.",
                            }
                        ],
                    }
                ),
            )
            return
        route.continue_()

    try:
        with sync_playwright() as playwright:
            try:
                browser = playwright.chromium.launch(headless=not args.headed)
            except Exception as error:  # pragma: no cover - environment dependent
                print(f"skipped admin browser test: chromium unavailable ({error})")
                return 0

            page = browser.new_page(viewport={"width": 1440, "height": 900})
            page.route("**/api/**", api)
            page.goto(f"{base_url}#/admin", wait_until="domcontentloaded")
            page.wait_for_selector(".admin-shell", timeout=30000)
            assert page.locator("#tab-admin").is_visible()
            page.wait_for_selector(".admin-metric", timeout=10000)
            assert page.locator(".admin-metric").count() == 7
            assert "71.4%" in page.locator(".admin-metrics").inner_text()
            assert "bundle storage" in page.locator(".admin-metrics").inner_text().lower()
            assert "Storage & retention" in page.locator(".admin-storage-panel").inner_text()
            assert "Retention: jobs 100" in page.locator(".admin-storage-panel").inner_text()
            assert "dl_adminunits_bcts" in page.locator(".admin-table").first.inner_text()
            assert page.locator(".history-status.ok").count() >= 1
            assert page.locator("[data-admin-refresh]").count() == 1
            page.locator("[data-admin-refresh]").click()
            page.wait_for_timeout(500)
            assert stats_hits >= 2
            page.locator("[data-admin-prune]").click()
            page.wait_for_timeout(500)
            assert prune_hits == 1
            assert stats_hits >= 3
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

    print("validated admin browser flow")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
