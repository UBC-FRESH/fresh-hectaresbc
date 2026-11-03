#!/usr/bin/env python3
"""Exercise the Clip AOI save/apply/delete library flow with mocked area API."""

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
        print("skipped AOI library browser test: playwright is not installed")
        return 0

    handler = functools.partial(QuietHandler, directory=str(REPO_ROOT))
    server = ReusableServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_address[1]}/web/"

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
        if path == "/api/aoi/inspect":
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(
                    {
                        "status": "ok",
                        "area_ha": 1000.0,
                        "max_area_ha": 10_000_000,
                        "within_limit": True,
                        "remaining_ha": 9_999_000,
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
                print(f"skipped AOI library browser test: chromium unavailable ({error})")
                return 0

            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.on("dialog", lambda dialog: dialog.accept("Saved box"))
            page.route("**/api/**", api)
            page.goto(
                f"{base_url}#/dataset/dl_adminunits_bcts/map",
                wait_until="domcontentloaded",
            )
            page.wait_for_selector(".map-loading", state="detached", timeout=60000)
            page.wait_for_timeout(2200)
            page.locator("[data-open-clip]").click()
            page.wait_for_selector("#clip-panel:not([hidden])")
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
            page.wait_for_function(
                "() => document.querySelector('.clip-area-caption')?.innerText.includes('1,000 ha')",
                timeout=10000,
            )
            page.locator("[data-clip-save-aoi]").click()
            page.wait_for_selector("[data-clip-aoi-apply]", timeout=10000)
            assert page.locator(".clip-aoi-row").count() == 1
            assert "Saved box" in page.locator(".clip-aoi-apply").inner_text()

            page.locator("[data-clip-clear]").click()
            page.locator("[data-clip-aoi-apply]").click()
            page.wait_for_function(
                "() => document.querySelector('.clip-area-caption')?.innerText.includes('1,000 ha')",
                timeout=10000,
            )
            assert page.locator("[data-clip-prepare]").is_enabled()

            page.locator("[data-clip-aoi-delete]").click()
            assert page.locator(".clip-aoi-row").count() == 0
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

    print("validated AOI library browser flow")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
