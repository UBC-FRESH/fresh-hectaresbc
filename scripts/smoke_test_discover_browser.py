#!/usr/bin/env python3
"""Exercise bounds-based spatial layer discovery with the static app."""

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
        print("skipped discover browser test: playwright is not installed")
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
                print(f"skipped discover browser test: chromium unavailable ({error})")
                return 0

            page = browser.new_page(viewport={"width": 1440, "height": 900})
            page.goto(
                f"{base_url}#/dataset/dl_adminunits_bcts/map",
                wait_until="domcontentloaded",
            )
            page.wait_for_selector(".map-loading", state="detached", timeout=60000)
            page.wait_for_timeout(2000)
            page.locator("[data-discover-open]").click()
            page.wait_for_selector("#discover-panel:not([hidden])")
            page.wait_for_selector(".discover-result", timeout=15000)
            count = page.locator(".discover-result").count()
            assert count > 0
            before = int(page.locator("#tray-count").inner_text())
            page.locator("[data-discover-add]").first.click()
            assert int(page.locator("#tray-count").inner_text()) == before + 1
            page.locator("#discover-close").click()
            assert page.locator("#discover-panel").is_hidden()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

    print("validated discover browser flow")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
