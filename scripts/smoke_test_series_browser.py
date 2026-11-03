#!/usr/bin/env python3
"""Exercise the multi-layer flicker series workspace with the static app."""

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
        print("skipped series browser test: playwright is not installed")
        return 0

    handler = functools.partial(QuietHandler, directory=str(REPO_ROOT))
    server = ReusableServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_address[1]}/web/"
    layers = "dl_adminunits_bcts,dl_adminunits_coaltenure,dl_adminunits_firezone"

    try:
        with sync_playwright() as playwright:
            try:
                browser = playwright.chromium.launch(headless=not args.headed)
            except Exception as error:  # pragma: no cover - environment dependent
                print(f"skipped series browser test: chromium unavailable ({error})")
                return 0

            origin = base_url.rstrip("/")
            context = browser.new_context(
                viewport={"width": 1440, "height": 900},
                storage_state={
                    "cookies": [],
                    "origins": [
                        {
                            "origin": origin,
                            "localStorage": [
                                {
                                    "name": "fresh-hectaresbc.layer-tray.v1",
                                    "value": json.dumps(layers.split(",")),
                                }
                            ],
                        }
                    ],
                },
            )
            page = context.new_page()
            page.goto(
                f"{base_url}#/series?layers={layers}&speed=500",
                wait_until="domcontentloaded",
            )
            page.wait_for_selector(".series-shell", timeout=30000)
            page.wait_for_timeout(2500)
            assert page.locator(".maplibregl-canvas").count() == 3
            assert page.locator(".series-pane").count() == 3
            assert page.locator(".series-label").count() == 3
            assert page.locator("[data-series-frame]").inner_text().startswith(
                "Frame "
            )
            page.locator("#tray-button").click()
            series_link = page.locator(".tray-actions a", has_text="Flicker series")
            assert series_link.count() == 1
            assert "layers=dl_adminunits_bcts" in series_link.get_attribute("href")
            page.locator("#tray-button").click()

            # Pause before asserting frame state; flicker transitions are visible.
            page.locator("[data-series-toggle]").click()
            assert page.locator("[data-series-toggle]").inner_text() == "Play"
            page.wait_for_timeout(250)
            active = page.locator(".series-pane.is-active")
            assert active.count() == 1
            assert active.evaluate("(element) => getComputedStyle(element).opacity") == "1"

            start_index = int(
                page.locator(".series-pane.is-active").get_attribute(
                    "data-series-pane"
                )
            )
            next_index = (start_index + 1) % 3
            page.locator("[data-series-next]").click()
            page.wait_for_timeout(250)
            assert page.locator("[data-series-frame]").inner_text().startswith(
                f"Frame {next_index + 1} of 3"
            )
            assert page.locator(".series-pane.is-active").get_attribute(
                "data-series-pane"
            ) == str(next_index)

            page.locator("[data-series-prev]").click()
            page.wait_for_timeout(250)
            assert page.locator(".series-pane.is-active").get_attribute(
                "data-series-pane"
            ) == str(start_index)

            page.locator("[data-series-speed]").select_option("2000")
            assert "speed=2000" in page.evaluate("location.hash")
            page.locator("[data-series-toggle]").click()
            assert page.locator("[data-series-toggle]").inner_text() == "Pause"

            with page.expect_download(timeout=15000) as download_info:
                page.locator("[data-series-download]").click()
            download = download_info.value
            assert download.suggested_filename.startswith(
                f"hectaresbc-series-frame-{start_index + 1}-"
            )

            page.set_viewport_size({"width": 390, "height": 844})
            page.wait_for_timeout(500)
            assert not page.evaluate(
                "document.documentElement.scrollWidth > document.documentElement.clientWidth"
            )
            assert page.locator(".series-stage").bounding_box()["height"] >= 500

            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

    print("validated series browser flow")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
