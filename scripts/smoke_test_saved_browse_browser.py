#!/usr/bin/env python3
"""Exercise saved Browse searches and favorite datasets with the static app."""

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
        print("skipped saved browse browser test: playwright is not installed")
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
                print(f"skipped saved browse browser test: chromium unavailable ({error})")
                return 0

            page = browser.new_page(viewport={"width": 1440, "height": 900})
            page.on("dialog", lambda dialog: dialog.accept("Bull trout search"))
            page.goto(f"{base_url}#/catalog", wait_until="domcontentloaded")
            page.wait_for_selector("#result-count")
            page.fill("#search-input", "bull trout")
            page.wait_for_timeout(500)
            page.locator("[data-save-search]").click()
            page.wait_for_selector("[data-saved-search-open]", timeout=10000)
            assert page.locator("[data-saved-search-open]").count() == 1
            page.fill("#search-input", "")
            page.wait_for_timeout(300)
            page.locator("[data-saved-search-open]").click()
            page.wait_for_timeout(500)
            assert page.input_value("#search-input") == "bull trout"

            favorite = page.locator(".result-row .favorite-toggle").first
            favorite.click()
            assert favorite.get_attribute("aria-pressed") == "true"
            page.wait_for_selector("[data-favorite-remove]", timeout=10000)
            assert page.locator("[data-favorite-remove]").count() == 1
            page.locator("[data-favorite-remove]").click()
            assert page.locator("[data-favorite-remove]").count() == 0
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

    print("validated saved browse browser flow")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
