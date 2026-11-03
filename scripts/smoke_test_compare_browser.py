#!/usr/bin/env python3
"""Exercise the synchronized compare map workspace with the static app."""

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
        print("skipped compare browser test: playwright is not installed")
        return 0

    handler = functools.partial(QuietHandler, directory=str(REPO_ROOT))
    server = ReusableServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_address[1]}/web/"
    right_id = "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135"

    try:
        with sync_playwright() as playwright:
            try:
                browser = playwright.chromium.launch(headless=not args.headed)
            except Exception as error:  # pragma: no cover - environment dependent
                print(f"skipped compare browser test: chromium unavailable ({error})")
                return 0

            page = browser.new_page(viewport={"width": 1440, "height": 900})
            page.goto(
                f"{base_url}#/compare?left=dl_adminunits_bcts&right={right_id}",
                wait_until="domcontentloaded",
            )
            page.wait_for_selector(".compare-shell", timeout=30000)
            page.wait_for_timeout(2500)
            assert page.locator(".maplibregl-canvas").count() == 2
            assert page.locator(".compare-label").count() == 2
            assert page.locator("[data-compare-select]").count() == 2

            page.locator("[data-compare-swap]").click()
            page.wait_for_timeout(800)
            hash_value = page.evaluate("location.hash")
            assert "left=" + right_id in hash_value
            assert "right=dl_adminunits_bcts" in hash_value
            page.wait_for_timeout(1800)
            assert page.locator(".maplibregl-canvas").count() == 2

            page.locator('[data-compare-mode="wipe"]').click()
            page.wait_for_selector(".compare-stage.is-wipe", timeout=10000)
            page.wait_for_timeout(1800)
            assert "mode=wipe" in page.evaluate("location.hash")
            assert page.locator(".maplibregl-canvas").count() == 2
            clip_before = page.locator(".compare-pane.is-left").evaluate(
                "(element) => element.style.clipPath"
            )
            divider = page.locator(".compare-divider").bounding_box()
            assert divider is not None
            page.mouse.move(
                divider["x"] + divider["width"] / 2,
                divider["y"] + divider["height"] / 2,
            )
            page.mouse.down()
            page.mouse.move(
                divider["x"] + 100,
                divider["y"] + divider["height"] / 2,
                steps=5,
            )
            page.mouse.up()
            page.wait_for_timeout(300)
            clip_after = page.locator(".compare-pane.is-left").evaluate(
                "(element) => element.style.clipPath"
            )
            assert clip_before != clip_after
            page.locator('[data-compare-mode="split"]').click()
            page.wait_for_selector(".compare-stage:not(.is-wipe)", timeout=10000)
            page.locator('[data-compare-mode="flicker"]').click()
            page.wait_for_selector(".compare-stage.is-flicker", timeout=10000)
            page.wait_for_timeout(1800)
            assert "mode=flicker" in page.evaluate("location.hash")
            assert page.locator(".maplibregl-canvas").count() == 2
            assert page.locator("[data-flicker-toggle]").count() == 1
            first_opacity = page.locator(".compare-pane.is-left").evaluate(
                "(element) => getComputedStyle(element).opacity"
            )
            page.wait_for_timeout(1200)
            second_opacity = page.locator(".compare-pane.is-left").evaluate(
                "(element) => getComputedStyle(element).opacity"
            )
            assert first_opacity != second_opacity
            page.locator("[data-flicker-toggle]").click()
            assert page.locator("[data-flicker-toggle]").inner_text() == "Play"
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

    print("validated compare browser flow")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
