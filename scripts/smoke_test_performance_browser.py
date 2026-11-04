#!/usr/bin/env python3
"""Measure browser performance budgets for catalog and Series loading."""

from __future__ import annotations

import argparse
import functools
import socketserver
import threading
import time
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
        print("skipped performance browser test: playwright is not installed")
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
                print(
                    f"skipped performance browser test: chromium unavailable ({error})"
                )
                return 0

            page = browser.new_page(viewport={"width": 1440, "height": 900})
            catalog_requests = []
            page.on("request", lambda request: catalog_requests.append(request.url))
            started = time.perf_counter()
            page.goto(f"{base_url}#/catalog", wait_until="domcontentloaded")
            page.wait_for_selector(
                "#content .result-row, #content .result-card", timeout=30000
            )
            catalog_ready = time.perf_counter() - started
            catalog_heap = page.evaluate(
                "performance.memory ? performance.memory.usedJSHeapSize : 0"
            )
            print(
                f"catalog ready={catalog_ready:.2f}s requests={len(catalog_requests)} "
                f"heap={catalog_heap / 1048576:.1f} MB"
            )
            assert catalog_ready < 5.0
            assert len(catalog_requests) < 80
            assert catalog_heap / 1048576 < 80
            page.close()

            series_page = browser.new_page(viewport={"width": 1440, "height": 900})
            preview_requests = []
            series_page.on(
                "request",
                lambda request: preview_requests.append(request.url)
                if "/map_previews_3857/layers/" in request.url
                and request.url.split("?")[0].endswith("/map.png")
                else None,
            )
            layers = ",".join(
                f"dl_pinebeetle_allkill{year}" for year in range(1999, 2016)
            )
            series_page.goto(
                f"{base_url}#/series?layers={layers}&speed=2000",
                wait_until="domcontentloaded",
            )
            series_page.wait_for_selector(".series-shell", timeout=30000)
            series_page.wait_for_selector(
                "#series-map .maplibregl-canvas", timeout=30000
            )
            series_page.wait_for_timeout(1200)
            toggle = series_page.locator("[data-series-toggle]")
            if toggle.inner_text() == "Pause":
                toggle.click()
            series_page.wait_for_timeout(2500)
            series_heap = series_page.evaluate(
                "performance.memory ? performance.memory.usedJSHeapSize : 0"
            )
            print(
                f"series17 preview_requests={len(preview_requests)} "
                f"heap={series_heap / 1048576:.1f} MB"
            )
            assert len(preview_requests) <= 4
            assert series_heap / 1048576 < 80

            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

    print("validated browser performance budgets")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
