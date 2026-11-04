#!/usr/bin/env python3
"""Exercise keyboard, focus, touch-target, and reduced-motion behavior."""

from __future__ import annotations

import argparse
import functools
import socketserver
import threading
from http.server import SimpleHTTPRequestHandler
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SMALL_TARGET_JS = """
() => [...document.querySelectorAll(
  'button, a[href], input, select, textarea, summary'
)].filter((element) => {
  if (element.closest('.maplibregl-ctrl')) return false;
  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && (rect.width < 24 || rect.height < 24);
}).map((element) => ({
  tag: element.tagName,
  id: element.id,
  cls: String(element.className || ''),
  text: (element.innerText || element.value || element.getAttribute('aria-label') || '').slice(0, 50),
  width: Math.round(element.getBoundingClientRect().width),
  height: Math.round(element.getBoundingClientRect().height),
}))
"""


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        return


class ReusableServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def assert_no_small_targets(page, surface: str) -> None:
    small = page.evaluate(SMALL_TARGET_JS)
    assert not small, f"{surface} has controls below 24px: {small}"


def assert_no_overflow(page, surface: str) -> None:
    assert not page.evaluate(
        "document.documentElement.scrollWidth > document.documentElement.clientWidth"
    ), f"{surface} overflows horizontally"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--headed", action="store_true")
    args = parser.parse_args()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("skipped accessibility browser test: playwright is not installed")
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
                    f"skipped accessibility browser test: chromium unavailable ({error})"
                )
                return 0

            page = browser.new_page(viewport={"width": 1440, "height": 900})
            page.route(
                "**/api/health",
                lambda route: route.fulfill(
                    status=200,
                    content_type="application/json",
                    body='{"status":"ok","max_layers":6,"max_area_ha":10000000,"agent_enabled":false,"agent_available":false}',
                ),
            )
            page.goto(f"{base_url}#/catalog", wait_until="domcontentloaded")
            page.wait_for_selector("#content", timeout=30000)
            page.wait_for_timeout(500)

            assert page.locator("#tab-browse").get_attribute("aria-current") == "page"
            assert page.locator("#tab-map").get_attribute("aria-current") is None
            assert page.locator('[role="tablist"]').count() == 0

            # Skip link must focus the workspace without hijacking the hash router.
            page.keyboard.press("Tab")
            assert page.evaluate(
                "document.activeElement?.classList.contains('skip-link')"
            )
            page.keyboard.press("Enter")
            page.wait_for_timeout(100)
            assert page.evaluate("document.activeElement?.id") == "content"
            assert page.evaluate("location.hash") == "#/catalog"

            # Tray focus handoff, focus restore, and shortcut isolation.
            page.locator("#tray-button").focus()
            page.locator("#tray-button").click()
            page.wait_for_timeout(100)
            assert page.locator("#tray-panel").is_visible()
            assert page.locator("#tray-button").get_attribute("aria-expanded") == "true"
            assert page.evaluate("document.activeElement?.id") == "tray-close"
            page.keyboard.press("j")
            assert page.evaluate("document.activeElement?.id") == "tray-close"
            page.keyboard.press("Escape")
            page.wait_for_timeout(100)
            assert page.locator("#tray-panel").is_hidden()
            assert page.evaluate("document.activeElement?.id") == "tray-button"

            # Help dialog is modal and restores focus when closed.
            page.locator("#help-button").click()
            assert page.locator("#help-dialog").evaluate("(dialog) => dialog.open")
            page.keyboard.press("Escape")
            page.wait_for_timeout(100)
            assert not page.locator("#help-dialog").evaluate("(dialog) => dialog.open")
            assert page.evaluate("document.activeElement?.id") == "help-button"

            # Discovery panel focus handoff and restore.
            page.goto(f"{base_url}#/dataset/dl_adminunits_bcts/map", wait_until="domcontentloaded")
            page.wait_for_selector("#map-canvas .maplibregl-canvas", timeout=30000)
            page.wait_for_timeout(1000)
            page.locator("[data-discover-open]").focus()
            page.locator("[data-discover-open]").click()
            page.wait_for_timeout(100)
            assert page.locator("#discover-panel").is_visible()
            assert page.evaluate("document.activeElement?.id") == "discover-close"
            page.keyboard.press("Escape")
            page.wait_for_timeout(100)
            assert page.locator("#discover-panel").is_hidden()
            assert page.evaluate(
                "document.activeElement?.hasAttribute('data-discover-open')"
            )

            # Clip panel focus handoff and restore.
            page.locator("[data-open-clip]").focus()
            page.locator("[data-open-clip]").click()
            page.wait_for_timeout(150)
            assert page.locator("#clip-panel").is_visible()
            assert page.evaluate("document.activeElement?.id") == "clip-query"
            assert page.locator("[data-open-clip]").get_attribute("aria-expanded") == "true"
            page.keyboard.press("Escape")
            page.wait_for_timeout(100)
            assert page.locator("#clip-panel").is_hidden()
            assert page.evaluate(
                "document.activeElement?.hasAttribute('data-open-clip')"
            )

            # Mobile filter rail focus handoff and restore.
            page.set_viewport_size({"width": 390, "height": 844})
            page.goto(f"{base_url}#/catalog", wait_until="domcontentloaded")
            page.wait_for_selector("[data-open-filters]", timeout=30000)
            page.locator("[data-open-filters]").focus()
            page.locator("[data-open-filters]").click()
            page.wait_for_timeout(150)
            assert page.evaluate(
                "document.querySelector('#filter-rail').contains(document.activeElement)"
            )
            page.keyboard.press("Escape")
            page.wait_for_timeout(100)
            assert page.evaluate(
                "document.activeElement?.hasAttribute('data-open-filters')"
            )

            # App-owned controls must meet the 24px target in mobile layouts.
            for surface, route, ready in [
                ("catalog", "#/catalog", "[data-open-filters]"),
                (
                    "map",
                    "#/dataset/dl_adminunits_bcts/map",
                    "#map-canvas .maplibregl-canvas",
                ),
                (
                    "compare",
                    "#/compare?left=dl_adminunits_bcts&right=dl_adminunits_coaltenure",
                    ".compare-shell",
                ),
                (
                    "series",
                    "#/series?layers=dl_adminunits_bcts,dl_adminunits_coaltenure,dl_adminunits_firezone",
                    ".series-shell",
                ),
            ]:
                page.goto(f"{base_url}{route}", wait_until="domcontentloaded")
                page.wait_for_selector(ready, timeout=30000)
                page.wait_for_timeout(1200)
                assert_no_small_targets(page, surface)
                assert_no_overflow(page, surface)

            # Tray count contrast: white on the dark accent.
            page.goto(f"{base_url}#/catalog", wait_until="domcontentloaded")
            page.wait_for_selector("#tray-count", timeout=30000)
            assert page.locator("#tray-count").evaluate(
                "(element) => getComputedStyle(element).color"
            ) == "rgb(255, 255, 255)"

            # Reduced motion pauses both flicker workspaces.
            reduced = browser.new_context(
                viewport={"width": 1440, "height": 900},
                reduced_motion="reduce",
            )
            reduced_page = reduced.new_page()
            reduced_page.goto(
                f"{base_url}#/series?layers=dl_adminunits_bcts,dl_adminunits_coaltenure,dl_adminunits_firezone",
                wait_until="domcontentloaded",
            )
            reduced_page.wait_for_selector(".series-shell", timeout=30000)
            reduced_page.wait_for_timeout(1200)
            assert reduced_page.locator("[data-series-toggle]").inner_text() == "Play"
            reduced_page.goto(
                f"{base_url}#/compare?left=dl_adminunits_bcts&right=dl_adminunits_coaltenure&mode=flicker",
                wait_until="domcontentloaded",
            )
            reduced_page.wait_for_selector(".compare-shell", timeout=30000)
            reduced_page.wait_for_timeout(1200)
            assert reduced_page.locator("[data-flicker-toggle]").inner_text() == "Play"
            reduced.close()

            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

    print("validated accessibility and mobile browser flow")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
