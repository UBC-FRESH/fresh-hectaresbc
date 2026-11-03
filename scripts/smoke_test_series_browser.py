#!/usr/bin/env python3
"""Exercise the editable single-map flicker series with the static app."""

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


def wait_for_series(page) -> None:
    page.wait_for_selector(".series-shell", timeout=30000)
    page.wait_for_selector("#series-map .maplibregl-canvas", timeout=30000)
    page.wait_for_timeout(1200)


def pause_series(page) -> None:
    toggle = page.locator("[data-series-toggle]")
    if toggle.inner_text() == "Pause":
        toggle.click()
    page.wait_for_timeout(150)


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

            origin = base_url.split("/web/")[0]
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
            wait_for_series(page)
            assert page.locator(".maplibregl-canvas").count() == 1
            assert page.locator("[data-series-chip]").count() == 3
            assert page.locator("[data-series-sequence]").count() == 2
            assert page.locator("[data-series-sequence]").first.inner_text().startswith(
                "% Forest Killed"
            )
            assert "1999–2015" in page.locator("[data-series-sequence]").first.inner_text()
            assert page.locator("[data-series-frame]").inner_text().startswith(
                "Frame "
            )

            page.locator("#tray-button").click()
            series_link = page.locator(".tray-actions a", has_text="Flicker series")
            assert series_link.count() == 1
            assert "layers=dl_adminunits_bcts" in series_link.get_attribute("href")
            page.locator("#tray-button").click()

            pause_series(page)
            assert page.locator("[data-series-toggle]").inner_text() == "Play"
            active = page.locator(".series-frame-chip.is-active")
            assert active.count() == 1
            start_index = int(active.get_attribute("data-series-chip"))
            next_index = (start_index + 1) % 3
            page.locator("[data-series-next]").click()
            page.wait_for_timeout(200)
            assert page.locator("[data-series-frame]").inner_text().startswith(
                f"Frame {next_index + 1} of 3"
            )
            page.locator("[data-series-prev]").click()
            page.wait_for_timeout(200)
            assert page.locator(".series-frame-chip.is-active").get_attribute(
                "data-series-chip"
            ) == str(start_index)

            page.locator(".series-editor > summary").click()
            page.locator("[data-series-add-select]").select_option(
                "dl_adminunits_healthunits"
            )
            page.locator("[data-series-add]").click()
            page.wait_for_function(
                "location.hash.includes('dl_adminunits_healthunits')",
                timeout=10000,
            )
            wait_for_series(page)
            assert page.locator("[data-series-chip]").count() == 4
            assert page.locator(".maplibregl-canvas").count() == 1

            page.locator(".series-editor > summary").click()
            first_id = page.locator("[data-series-chip] small").nth(0).text_content()
            second_id = page.locator("[data-series-chip] small").nth(1).text_content()
            page.locator(
                '[data-series-move="0"][data-direction="1"]'
            ).click()
            page.wait_for_timeout(500)
            page.wait_for_function(
                "(expected) => document.querySelector('[data-series-chip] small')?.textContent === expected",
                arg=second_id,
                timeout=15000,
            )
            wait_for_series(page)
            assert (
                page.locator("[data-series-chip] small").nth(0).text_content()
                == second_id
            )
            assert (
                page.locator("[data-series-chip] small").nth(1).text_content()
                == first_id
            )

            page.locator(".series-editor > summary").click()
            page.locator("[data-series-remove]").last.click()
            page.wait_for_timeout(500)
            page.wait_for_function(
                "() => document.querySelectorAll('[data-series-chip]').length === 3",
                timeout=15000,
            )
            wait_for_series(page)
            assert page.locator("[data-series-chip]").count() == 3

            page.locator("[data-series-sequence]").first.click()
            page.wait_for_function(
                "location.hash.includes('dl_pinebeetle_allkill1999')",
                timeout=10000,
            )
            wait_for_series(page)
            assert page.locator("[data-series-chip]").count() == 17
            assert page.locator(".maplibregl-canvas").count() == 1
            assert "1999–2015" in page.locator("[data-series-sequence]").first.inner_text()
            pause_series(page)
            sequence_index = int(
                page.locator(".series-frame-chip.is-active").get_attribute(
                    "data-series-chip"
                )
            )
            sequence_next = (sequence_index + 1) % 17
            page.locator("[data-series-next]").click()
            page.wait_for_timeout(200)
            assert page.locator("[data-series-frame]").inner_text().startswith(
                f"Frame {sequence_next + 1} of 17"
            )

            with page.expect_download(timeout=15000) as download_info:
                page.locator("[data-series-download]").click()
            download = download_info.value
            assert download.suggested_filename.startswith(
                f"hectaresbc-series-frame-{sequence_next + 1}-"
            )

            page.set_viewport_size({"width": 390, "height": 844})
            page.wait_for_timeout(500)
            assert not page.evaluate(
                "document.documentElement.scrollWidth > document.documentElement.clientWidth"
            )
            assert page.locator(".series-stage").bounding_box()["height"] >= 350

            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

    print("validated editable series browser flow")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
