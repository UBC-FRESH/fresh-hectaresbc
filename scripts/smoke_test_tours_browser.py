#!/usr/bin/env python3
"""Exercise the curated Tours workspace and its deep links."""

from __future__ import annotations

import argparse
import functools
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
        print("skipped tours browser test: playwright is not installed")
        return 0

    handler = functools.partial(QuietHandler, directory=str(REPO_ROOT))
    server = ReusableServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_address[1]}/web/"

    try:
        with sync_playwright() as playwright:
            try:
                browser = playwright.chromium.launch(headless=not args.headed)
            except Exception as error:  # pragma: no cover - environment dependent
                print(f"skipped tours browser test: chromium unavailable ({error})")
                return 0

            page = browser.new_page(viewport={"width": 1440, "height": 900})
            page.goto(f"{base_url}#/tours", wait_until="domcontentloaded")
            page.wait_for_selector(".tours-shell", timeout=30000)
            page.wait_for_timeout(800)
            assert page.locator(".tour-card").count() == 5
            assert page.locator("#tab-tours").get_attribute("aria-current") == "page"
            assert page.locator("#tour-browse .primary-button").count() == 1
            series_href = page.locator("#tour-series .primary-button").get_attribute(
                "href"
            )
            assert series_href.startswith("#/series?layers=dl_pinebeetle_allkill1999")
            assert "dl_pinebeetle_allkill2015" in series_href
            assert "clip=timber+supply+area" in page.locator(
                "#tour-clip .primary-button"
            ).get_attribute("href")
            discovery_href = page.locator(
                "#tour-discover .primary-button"
            ).get_attribute("href")
            assert discovery_href == "#/map?discover=view"

            page.goto(base_url + series_href, wait_until="domcontentloaded")
            page.wait_for_selector(".series-shell", timeout=30000)
            page.wait_for_timeout(1800)
            assert page.locator("[data-series-chip]").count() == 17
            assert page.locator(".maplibregl-canvas").count() == 1

            page.goto(f"{base_url}#/tours", wait_until="domcontentloaded")
            page.wait_for_selector(".tours-shell", timeout=30000)
            page.locator("#tour-compare .primary-button").click()
            page.wait_for_selector(".compare-shell", timeout=30000)
            page.wait_for_timeout(1200)
            assert page.locator(".compare-pane").count() == 2

            # Clip deep link opens a prefilled panel.
            clip_page = browser.new_page(viewport={"width": 1440, "height": 900})
            clip_page.route(
                "**/api/health",
                lambda route: route.fulfill(
                    status=200,
                    content_type="application/json",
                    body='{"status":"ok","max_layers":6,"max_area_ha":10000000,"agent_enabled":false,"agent_available":false}',
                ),
            )
            clip_page.goto(
                f"{base_url}#/dataset/dl_adminunits_bcts/map?clip=timber+supply+area&clipName=TSA+27",
                wait_until="domcontentloaded",
            )
            clip_page.wait_for_selector("#clip-panel", timeout=30000)
            clip_page.wait_for_selector("#map-canvas .maplibregl-canvas", timeout=30000)
            clip_page.wait_for_timeout(1200)
            assert clip_page.locator("#clip-panel").is_visible()
            assert clip_page.locator("#clip-query").input_value() == "timber supply area"
            assert clip_page.locator("#clip-name").input_value() == "TSA 27"
            assert clip_page.evaluate("document.activeElement?.id") == "clip-query"
            assert clip_page.locator("[data-open-clip]").get_attribute(
                "aria-expanded"
            ) == "true"

            # Discovery deep link opens and runs current-view discovery.
            page.goto(f"{base_url}{discovery_href}", wait_until="domcontentloaded")
            page.wait_for_selector("#discover-panel", timeout=30000)
            page.wait_for_selector("#map-canvas .maplibregl-canvas", timeout=30000)
            page.wait_for_timeout(1800)
            assert page.locator("#discover-panel").is_visible()
            assert page.locator("#discover-search").count() == 1
            assert page.evaluate("document.activeElement?.id") == "discover-close"

            page.set_viewport_size({"width": 390, "height": 844})
            page.goto(f"{base_url}#/tours", wait_until="domcontentloaded")
            page.wait_for_selector(".tours-shell", timeout=30000)
            page.wait_for_timeout(400)
            assert not page.evaluate(
                "document.documentElement.scrollWidth > document.documentElement.clientWidth"
            )
            assert page.locator(".tour-card").count() == 5

            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

    print("validated curated tours browser flow")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
