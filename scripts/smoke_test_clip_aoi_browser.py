#!/usr/bin/env python3
"""Exercise the Clip AOI browser flow with a static server and mocked API.

This test does not need the archive, FEMIC, or a running FastAPI service. It
serves the real static app, mocks the API endpoints with Playwright routes, and
checks the job progress, partial-failure, retry, and cancellation states.
"""

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
    parser.add_argument("--headed", action="store_true", help="Show a browser window.")
    args = parser.parse_args()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("skipped Clip AOI browser test: playwright is not installed")
        return 0

    handler = functools.partial(QuietHandler, directory=str(REPO_ROOT))
    server = ReusableServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_address[1]}/web/"

    post_bodies: list[dict[str, object]] = []
    partial_polls = 0
    canceled = False

    partial_result = {
        "status": "partial",
        "bundle_id": "fake-partial",
        "layers": [{"dataset_id": "dl_adminunits_bcts"}],
        "failures": [
            {
                "dataset_id": "vl_fake_failed",
                "error": "Synthetic source unavailable",
            }
        ],
        "zip_bytes": 1234,
        "download_url": "/api/bundles/fake-partial/download",
    }
    complete_result = {
        "status": "complete",
        "bundle_id": "fake-complete",
        "layers": [{"dataset_id": "vl_fake_failed"}],
        "failures": [],
        "zip_bytes": 4321,
        "download_url": "/api/bundles/fake-complete/download",
    }

    def api(route, request):  # noqa: ANN001, ANN202
        nonlocal partial_polls, canceled
        path = urlparse(request.url).path
        if path == "/api/health":
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"status": "ok", "service": "clip-aoi-test"}),
            )
            return
        if path == "/api/agent":
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"enabled": False, "available": False}),
            )
            return
        if path == "/api/bundles":
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"status": "ok", "bundles": []}),
            )
            return
        if path == "/api/bundle-jobs" and request.method == "POST":
            post_bodies.append(json.loads(request.post_data or "{}"))
            if len(post_bodies) == 1:
                job_id = "job-partial"
            elif len(post_bodies) == 2:
                job_id = "job-retry"
            else:
                job_id = "job-cancel"
            route.fulfill(
                status=202,
                content_type="application/json",
                body=json.dumps(
                    {
                        "status": "running",
                        "job_id": job_id,
                        "job": {
                            "job_id": job_id,
                            "status": "running",
                            "progress": 1,
                            "message": "Starting bundle job…",
                        },
                    }
                ),
            )
            return
        if path == "/api/bundle-jobs/job-partial" and request.method == "GET":
            partial_polls += 1
            if partial_polls == 1:
                body = {
                    "job_id": "job-partial",
                    "status": "running",
                    "progress": 8,
                    "message": "Clipping layer 1 of 1: dl_adminunits_bcts",
                }
            else:
                body = {
                    "job_id": "job-partial",
                    "status": "partial",
                    "progress": 100,
                    "message": "Bundle ready with some layer failures.",
                    "result": partial_result,
                }
            route.fulfill(
                status=200, content_type="application/json", body=json.dumps(body)
            )
            return
        if path == "/api/bundle-jobs/job-retry" and request.method == "GET":
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(
                    {
                        "job_id": "job-retry",
                        "status": "complete",
                        "progress": 100,
                        "message": "Bundle ready.",
                        "result": complete_result,
                    }
                ),
            )
            return
        if path == "/api/bundle-jobs/job-cancel" and request.method == "GET":
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(
                    {
                        "job_id": "job-cancel",
                        "status": "running",
                        "progress": 8,
                        "message": "Clipping layer 1 of 1: dl_adminunits_bcts",
                    }
                ),
            )
            return
        if path == "/api/bundle-jobs/job-cancel/cancel" and request.method == "POST":
            canceled = True
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(
                    {
                        "job_id": "job-cancel",
                        "status": "canceled",
                        "progress": 0,
                        "message": "Bundle job canceled.",
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
                print(f"skipped Clip AOI browser test: chromium unavailable ({error})")
                return 0

            page = browser.new_page(viewport={"width": 1280, "height": 800})
            page.route("**/api/**", api)
            page.goto(
                f"{base_url}#/dataset/dl_adminunits_bcts/map",
                wait_until="domcontentloaded",
            )
            page.wait_for_selector(".map-loading", state="detached", timeout=60000)
            page.wait_for_timeout(2500)
            page.locator("[data-open-clip]").click()
            page.wait_for_selector("#clip-panel:not([hidden])")
            assert page.locator(".clip-chip").count() == 1

            page.locator("[data-clip-draw]").click()
            page.wait_for_timeout(300)
            box = page.locator("#map-canvas").bounding_box()
            assert box is not None
            cx = box["x"] + box["width"] * 0.5
            cy = box["y"] + box["height"] * 0.5
            dx = box["width"] * 0.035
            dy = box["height"] * 0.035
            page.mouse.move(cx - dx, cy - dy)
            page.mouse.down()
            page.mouse.move(cx + dx, cy + dy, steps=8)
            page.mouse.up()
            page.wait_for_timeout(700)
            assert "Drawn AOI ready" in page.locator(".clip-status").first.inner_text()

            page.locator("[data-clip-prepare]").click()
            page.wait_for_selector("[data-clip-cancel]", timeout=10000)
            assert page.locator(".clip-progress").count() == 1
            page.wait_for_selector(".clip-failures", timeout=15000)
            assert "Synthetic source unavailable" in page.locator(
                ".clip-failures"
            ).text_content()
            assert page.locator("[data-clip-retry]").is_visible()

            page.locator("[data-clip-retry]").click()
            page.wait_for_function(
                "() => document.querySelector('.clip-result')?.innerText.includes('complete')",
                timeout=15000,
            )
            assert post_bodies[1]["layer_ids"] == ["vl_fake_failed"]
            assert page.locator(".clip-failures").count() == 0

            page.locator("[data-clip-prepare]").click()
            page.wait_for_selector("[data-clip-cancel]", timeout=10000)
            page.locator("[data-clip-cancel]").click()
            page.wait_for_function(
                "() => document.querySelector('.clip-status')?.innerText.includes('canceled')",
                timeout=15000,
            )
            assert canceled
            assert page.locator("[data-clip-cancel]").count() == 0

            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

    print("validated Clip AOI browser flow")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
