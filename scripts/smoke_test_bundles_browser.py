#!/usr/bin/env python3
"""Exercise the bundle/job history route with mocked API responses."""

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
        print("skipped bundle history browser test: playwright is not installed")
        return 0

    handler = functools.partial(QuietHandler, directory=str(REPO_ROOT))
    server = ReusableServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_address[1]}/web/"

    jobs = [
        {
            "job_id": "job-active",
            "status": "running",
            "progress": 40,
            "message": "Clipping layer 2 of 3: dl_bec_becv10",
            "layer_ids": ["dl_adminunits_bcts", "dl_bec_becv10"],
            "failed_layers": 0,
            "aoi_name": "Active TSA",
            "created_utc": "2026-11-03T10:00:00+00:00",
            "result": None,
        },
        {
            "job_id": "job-failed",
            "status": "partial",
            "progress": 100,
            "message": "Bundle ready with some layer failures.",
            "layer_ids": ["dl_adminunits_bcts"],
            "failed_layers": 1,
            "aoi_name": "Failed TSA",
            "created_utc": "2026-11-03T09:00:00+00:00",
            "result": {
                "status": "partial",
                "failures": [{"dataset_id": "fake_failed_layer", "error": "no source"}],
                "download_url": "/api/bundles/fake/download",
            },
        },
    ]
    bundles = [
        {
            "bundle_id": "bundle-1",
            "status": "partial",
            "generated_utc": "2026-11-03T09:00:00+00:00",
            "aoi": {"name": "Failed TSA", "area_ha": 123456.0},
            "layer_count": 1,
            "failures": 1,
            "download_url": "/api/bundles/bundle-1/download",
            "manifest_url": "/api/bundles/bundle-1",
        }
    ]
    calls: list[str] = []

    def api(route, request):  # noqa: ANN001, ANN202
        path = urlparse(request.url).path
        if path == "/api/health":
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"status": "ok", "max_layers": 6, "max_area_ha": 10_000_000}),
            )
            return
        if path == "/api/bundles":
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"status": "ok", "bundles": bundles}),
            )
            return
        if path == "/api/bundle-jobs" and request.method == "GET":
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"status": "ok", "jobs": jobs}),
            )
            return
        if path.endswith("/cancel") and request.method == "POST":
            calls.append("cancel")
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"status": "canceled"}),
            )
            return
        if path.endswith("/retry") and request.method == "POST":
            calls.append("retry")
            route.fulfill(
                status=202,
                content_type="application/json",
                body=json.dumps({"status": "queued", "job_id": "job-retry"}),
            )
            return
        route.continue_()

    try:
        with sync_playwright() as playwright:
            try:
                browser = playwright.chromium.launch(headless=not args.headed)
            except Exception as error:  # pragma: no cover - environment dependent
                print(f"skipped bundle history browser test: chromium unavailable ({error})")
                return 0

            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.route("**/api/**", api)
            page.goto(f"{base_url}#/bundles", wait_until="domcontentloaded")
            page.wait_for_selector(".history-shell", timeout=30000)
            assert page.locator(".history-card").count() == 3
            page.wait_for_selector("[data-history-cancel]", timeout=10000)
            page.wait_for_selector("[data-history-retry]", timeout=10000)
            assert page.locator("[data-history-cancel]").count() == 1
            assert page.locator("[data-history-retry]").count() == 1
            assert page.locator(".history-card").first.inner_text().find("Active TSA") >= 0

            page.locator("[data-history-retry]").click()
            page.wait_for_selector("[data-history-cancel]", timeout=10000)
            assert calls == ["retry"]
            page.locator("[data-history-cancel]").click()
            page.wait_for_timeout(500)
            assert calls == ["retry", "cancel"]

            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

    print("validated bundle history browser flow")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
