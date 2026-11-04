#!/usr/bin/env python3
"""Exercise labeled PNG export from the regular Map workspace."""

from __future__ import annotations

import argparse
import functools
import json
import socketserver
import threading
from http.server import SimpleHTTPRequestHandler
from pathlib import Path

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
        print("skipped map export browser test: playwright is not installed")
        return 0

    handler = functools.partial(QuietHandler, directory=str(REPO_ROOT))
    server = ReusableServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_address[1]}/web/"
    origin = base_url.split("/web/")[0]

    try:
        with sync_playwright() as playwright:
            try:
                browser = playwright.chromium.launch(headless=not args.headed)
            except Exception as error:  # pragma: no cover - environment dependent
                print(f"skipped map export browser test: chromium unavailable ({error})")
                return 0

            context = browser.new_context(
                viewport={"width": 1440, "height": 900},
                accept_downloads=True,
                storage_state={
                    "cookies": [],
                    "origins": [
                        {
                            "origin": origin,
                            "localStorage": [
                                {
                                    "name": "fresh-hectaresbc.layer-tray.v1",
                                    "value": json.dumps(
                                        [
                                            "dl_adminunits_coaltenure",
                                            "dl_adminunits_forestdistrict",
                                        ]
                                    ),
                                }
                            ],
                        }
                    ],
                },
            )
            page = context.new_page()
            page.goto(
                f"{base_url}#/dataset/dl_adminunits_bcts/map",
                wait_until="domcontentloaded",
            )
            page.wait_for_selector("#map-canvas .maplibregl-canvas", timeout=30000)
            page.wait_for_timeout(2200)
            assert page.locator(".map-context-layer").count() >= 2
            assert page.locator("#map-layer-panel .layer-legend li").count() > 0
            assert page.locator("[data-map-export]").is_visible()
            assert "BCTS Operating Areas" in page.locator(".map-title-card h1").inner_text()

            with page.expect_download(timeout=20000) as download_info:
                page.locator("[data-map-export]").click()
            download = download_info.value
            path = download.path()
            assert path is not None
            payload = Path(path).read_bytes()
            assert payload.startswith(b"\x89PNG\r\n\x1a\n")
            assert len(payload) > 10000
            assert download.suggested_filename.startswith("hectaresbc-map-")
            assert download.suggested_filename.endswith(".png")

            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

    print("validated map PNG export browser flow")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
