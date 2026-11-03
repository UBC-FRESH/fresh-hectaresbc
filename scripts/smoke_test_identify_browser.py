#!/usr/bin/env python3
"""Exercise the click-to-identify map flow with a mocked identify API."""

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
        print("skipped identify browser test: playwright is not installed")
        return 0

    handler = functools.partial(QuietHandler, directory=str(REPO_ROOT))
    server = ReusableServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_address[1]}/web/"
    identify_calls: list[str] = []

    def api(route, request):  # noqa: ANN001, ANN202
        path = urlparse(request.url).path
        if path == "/api/health":
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(
                    {"status": "ok", "max_layers": 6, "max_area_ha": 10_000_000}
                ),
            )
            return
        if path == "/api/tiles/dl_adminunits_bcts/identify":
            identify_calls.append(request.url)
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(
                    {
                        "status": "ok",
                        "dataset_id": "dl_adminunits_bcts",
                        "title": "BCTS Operating Areas",
                        "value": 42,
                        "label": "Test class",
                        "lon": -119.0,
                        "lat": 51.0,
                        "source_raster": "cog",
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
                print(f"skipped identify browser test: chromium unavailable ({error})")
                return 0

            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.route("**/api/**", api)
            page.goto(
                f"{base_url}#/dataset/dl_adminunits_bcts/map",
                wait_until="domcontentloaded",
            )
            page.wait_for_selector(".map-loading", state="detached", timeout=60000)
            page.wait_for_timeout(2500)
            page.locator("[data-identify-toggle]").click()
            box = page.locator("#map-canvas").bounding_box()
            assert box is not None
            page.mouse.click(
                box["x"] + box["width"] * 0.5,
                box["y"] + box["height"] * 0.5,
            )
            page.wait_for_selector(".map-identify-value", timeout=15000)
            assert "42" in page.locator(".map-identify-value").inner_text()
            assert "Test class" in page.locator(".map-identify-value").inner_text()
            assert identify_calls
            page.locator("[data-identify-close]").click()
            assert page.locator(".map-identify-value").count() == 0
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

    print("validated identify browser flow")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
