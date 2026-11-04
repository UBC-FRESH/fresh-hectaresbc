#!/usr/bin/env python3
"""Exercise cold-checkout and offline fallback states."""

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

    def handle_error(self, request, client_address):
        return


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--headed", action="store_true")
    args = parser.parse_args()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("skipped cold-checkout browser test: playwright is not installed")
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
                    f"skipped cold-checkout browser test: chromium unavailable ({error})"
                )
                return 0

            # 1. Missing generated catalog, then retry once it is restored.
            page = browser.new_page(viewport={"width": 1440, "height": 900})
            block_catalog = {"value": True}

            def catalog_route(route):
                if block_catalog["value"]:
                    route.abort()
                else:
                    route.continue_()

            page.route("**/data/catalog.*", catalog_route)
            page.goto(f"{base_url}#/catalog", wait_until="domcontentloaded")
            page.wait_for_selector("#content .error-state", timeout=30000)
            assert page.locator("#content .error-state h1").count() == 1
            assert "Catalog data unavailable" in page.locator(
                "#content .error-state"
            ).inner_text()
            assert "generate_web_catalog.py" in page.locator(
                "#content .error-state"
            ).inner_text()
            block_catalog["value"] = False
            page.locator("[data-retry]").click()
            page.wait_for_selector("#content .result-row", timeout=30000)
            page.close()

            # 2. Missing preview index: Browse survives; Map/Tours/Series explain.
            missing_preview = browser.new_page(
                viewport={"width": 1440, "height": 900}
            )
            for pattern in [
                "**/external/fresh-hectaresbc-data/derived/web_map_previews/v1/index.json",
                "**/data/map_previews/manifest.json",
                "**/data/map_previews_highres/v1/index.json",
                "**/data/map_previews_3857/index.json",
            ]:
                missing_preview.route(pattern, lambda route: route.abort())
            missing_preview.goto(f"{base_url}#/catalog", wait_until="domcontentloaded")
            missing_preview.wait_for_selector("#content .result-row", timeout=30000)
            missing_preview.wait_for_timeout(500)
            assert "Preview index unavailable" in missing_preview.locator(
                "#preview-status"
            ).inner_text()

            missing_preview.goto(f"{base_url}#/map", wait_until="domcontentloaded")
            missing_preview.wait_for_selector(".map-fallback-card", timeout=30000)
            assert missing_preview.locator(".map-fallback-card h2").count() == 1
            fallback_text = missing_preview.locator(
                ".map-fallback-card"
            ).text_content()
            assert "No map layer available" in fallback_text
            assert "fetch_web_previews.py" in fallback_text

            missing_preview.goto(f"{base_url}#/tours", wait_until="domcontentloaded")
            missing_preview.wait_for_selector(".tours-shell", timeout=30000)
            assert missing_preview.locator(".tour-card").count() == 5
            assert "not in this checkout's preview index" in missing_preview.locator(
                "#tour-series"
            ).inner_text()

            missing_preview.goto(
                f"{base_url}#/series?layers=dl_adminunits_bcts,dl_adminunits_coaltenure",
                wait_until="domcontentloaded",
            )
            missing_preview.wait_for_selector(".series-shell", timeout=30000)
            assert "Two previewable layers are needed" in missing_preview.locator(
                ".series-shell"
            ).inner_text()
            missing_preview.close()

            # 3. Missing map preview images while the preview index remains.
            missing_images = browser.new_page(
                viewport={"width": 1440, "height": 900}
            )
            missing_images.route(
                "**/data/map_previews_3857/layers/**",
                lambda route: route.abort(),
            )
            missing_images.goto(
                f"{base_url}#/dataset/dl_adminunits_bcts/map",
                wait_until="domcontentloaded",
            )
            missing_images.wait_for_selector(
                "#map-canvas .maplibregl-canvas", timeout=30000
            )
            missing_images.wait_for_timeout(1800)
            assert missing_images.locator(".map-image-error").count() == 1
            assert "Preview image missing locally" in missing_images.locator(
                ".map-image-error"
            ).inner_text()
            missing_images.close()

            # 4. No optional service: static app stays usable; privileged actions hide.
            no_service = browser.new_page(viewport={"width": 1440, "height": 900})
            no_service.route(
                "**/api/**",
                lambda route: route.fulfill(status=404, body=""),
            )
            no_service.goto(
                f"{base_url}#/dataset/dl_adminunits_bcts/map",
                wait_until="domcontentloaded",
            )
            no_service.wait_for_selector(
                "#map-canvas .maplibregl-canvas", timeout=30000
            )
            no_service.wait_for_timeout(1000)
            assert no_service.locator("[data-open-clip]").is_hidden()
            assert no_service.locator("[data-identify-toggle]").is_hidden()
            assert no_service.locator("#assistant-button").is_hidden()
            assert no_service.locator("#tab-admin").is_hidden()
            no_service.goto(f"{base_url}#/tours", wait_until="domcontentloaded")
            no_service.wait_for_selector(".tours-shell", timeout=30000)
            assert "Clip requires the optional map service" in no_service.locator(
                "#tour-clip"
            ).inner_text()
            no_service.close()

            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

    print("validated cold-checkout browser fallbacks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
