#!/usr/bin/env python3
"""Exercise the browser app in Chromium when Playwright is available.

The project keeps a dependency-free static app, so this smoke check is optional:
it exits successfully with a "skipped" message when Playwright or a browser is
not installed. The pytest wrapper only runs it when the browser stack exists.
"""

from __future__ import annotations

import argparse
import functools
import socketserver
import threading
from pathlib import Path

try:
    from scripts.serve_web_app import REPO_ROOT, FreshHectaresBCHandler
except ImportError:  # Direct execution puts scripts/ on sys.path.
    from serve_web_app import REPO_ROOT, FreshHectaresBCHandler


class QuietHandler(FreshHectaresBCHandler):
    def log_message(self, format: str, *args: object) -> None:
        return


class ReusableServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the browser UI smoke checks.")
    parser.add_argument("--headed", action="store_true", help="Show a browser window.")
    args = parser.parse_args()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("skipped browser UI smoke: playwright is not installed")
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
                print(f"skipped browser UI smoke: chromium unavailable ({error})")
                return 0

            page = browser.new_page(viewport={"width": 1440, "height": 900})
            page.goto(base_url, wait_until="domcontentloaded")
            page.wait_for_function(
                "() => document.querySelector('#result-count')?.textContent.includes('2,183')",
                timeout=30000,
            )

            assert_no_horizontal_overflow(page, "desktop")

            page.locator('input[data-facet="family"][value="data_layer"]').check()
            page.wait_for_function(
                "() => document.querySelector('#result-count')?.textContent.startsWith('418')",
                timeout=10000,
            )
            assert "family=data_layer" in page.evaluate("location.hash")
            page.locator("#clear-filters").click()
            page.wait_for_function(
                "() => document.querySelector('#result-count')?.textContent.includes('2,183')",
                timeout=10000,
            )

            page.fill("#search-input", "bull trout")
            page.wait_for_function(
                "() => document.querySelector('#result-count')?.textContent.startsWith('1 matching')",
                timeout=10000,
            )
            page.locator(".result-row .result-thumb").first.click()
            page.wait_for_selector(".inspector-title")
            assert "Bull Trout" in page.locator(".inspector-title").inner_text()
            assert page.input_value("#search-input") == "bull trout"
            assert page.evaluate("document.body.classList.contains('inspector-open')")

            page.locator(".result-title a").first.click()
            page.wait_for_selector(".dataset-title")
            assert "Bull Trout" in page.locator(".dataset-title").inner_text()
            assert "HKEY" in page.locator("#content").inner_text()
            assert page.evaluate("location.hash").startswith("#/dataset/")

            page.locator(".breadcrumb a").first.click()
            page.wait_for_selector("#result-count")
            assert page.input_value("#search-input") == "bull trout"
            assert page.locator("#result-count").inner_text().startswith("1 matching")

            assert page.locator("#tab-map").get_attribute("aria-disabled") is None

            page.goto(f"{base_url}#/map", wait_until="domcontentloaded")
            page.wait_for_timeout(2500)
            assert page.locator(".map-title-card h1").count() == 1
            if page.locator(".maplibregl-canvas").count() == 1:
                assert "BCTS Operating Areas" in page.locator(
                    ".map-title-card h1"
                ).inner_text()
                page.fill("#map-layer-search", "bull trout")
                page.wait_for_selector(".map-layer-result")
                assert page.locator(".map-layer-result").count() >= 1
                page.get_by_role("link", name="Preview layers", exact=True).click()
                page.wait_for_function(
                    "() => location.hash.includes('preview=available')",
                    timeout=10000,
                )
                preview_count = page.locator("#result-count").inner_text().split()[0]
                assert int(preview_count.replace(",", "")) >= 2000
            else:
                assert "No map layer" in page.locator("#content").inner_text()

            page.goto(f"{base_url}#/dataset/dl_adminunits_bcts/map", wait_until="domcontentloaded")
            page.wait_for_timeout(2500)
            assert page.locator("#map-canvas").count() == 1
            assert (
                page.locator(".maplibregl-canvas").count() == 1
                or page.locator(".map-fallback-card").count() == 1
            )

            page.goto(
                f"{base_url}#/dataset/dl_pinebeetle_pinekill1999/map",
                wait_until="domcontentloaded",
            )
            page.wait_for_selector(".map-fallback, .map-fallback-card")
            content = page.locator("#content").inner_text()
            assert "Not previewable" in content or "No map layer" in content

            page.goto(f"{base_url}#dl_adminunits_bcts", wait_until="domcontentloaded")
            page.wait_for_selector(".dataset-title")
            assert page.evaluate("location.hash") == "#/dataset/dl_adminunits_bcts"

            page.goto(f"{base_url}#/catalog", wait_until="domcontentloaded")
            page.wait_for_selector("#result-count")
            page.keyboard.press("/")
            assert page.evaluate("document.activeElement?.id") == "search-input"

            page.set_viewport_size({"width": 390, "height": 844})
            page.goto(f"{base_url}#/catalog", wait_until="domcontentloaded")
            page.wait_for_selector(".result-card")
            assert_no_horizontal_overflow(page, "mobile")
            assert page.locator(".result-card").first.is_visible()
            assert not page.locator(".table-wrap").first.is_visible()
            page.locator("[data-open-filters]").click()
            assert page.evaluate("document.body.classList.contains('filters-open')")
            assert page.locator("#filter-rail").is_visible()
            page.keyboard.press("Escape")
            assert not page.evaluate("document.body.classList.contains('filters-open')")

            page.set_viewport_size({"width": 768, "height": 1024})
            page.goto(f"{base_url}#/catalog", wait_until="domcontentloaded")
            page.wait_for_selector(".result-row")
            assert_no_horizontal_overflow(page, "tablet")

            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

    print("validated browser UI smoke flow")
    return 0


def assert_no_horizontal_overflow(page, label: str) -> None:
    metrics = page.evaluate(
        "() => ({inner: window.innerWidth, scroll: document.documentElement.scrollWidth})"
    )
    assert metrics["scroll"] <= metrics["inner"] + 1, (
        f"{label} viewport overflows horizontally: {metrics}"
    )


if __name__ == "__main__":
    raise SystemExit(main())
