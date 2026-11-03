#!/usr/bin/env python3
"""Exercise the layer tray and map context flow with the static app."""

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
        print("skipped tray browser test: playwright is not installed")
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
                print(f"skipped tray browser test: chromium unavailable ({error})")
                return 0

            page = browser.new_page(viewport={"width": 1440, "height": 900})
            page.goto(f"{base_url}#/catalog", wait_until="domcontentloaded")
            page.wait_for_selector(".result-row")
            add_buttons = page.locator(".result-row .tray-add")
            add_buttons.nth(0).click()
            add_buttons.nth(1).click()
            assert page.locator("#tray-count").inner_text() == "2"

            page.locator("#tray-button").click()
            page.wait_for_selector("#tray-panel:not([hidden])")
            assert page.locator(".tray-layer").count() == 2
            href = page.locator("[data-tray-open-map]").get_attribute("href")
            assert href and "layers=" in href
            page.locator("[data-tray-open-map]").click()
            page.wait_for_selector(".map-loading", state="detached", timeout=60000)
            page.wait_for_timeout(1500)
            assert page.locator(".maplibregl-canvas").count() == 1
            assert page.locator(".map-context-layer").count() == 1
            assert page.locator("[data-context-visible]").count() == 1
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

    print("validated tray browser flow")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
