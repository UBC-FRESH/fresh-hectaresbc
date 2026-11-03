#!/usr/bin/env python3
"""Exercise saved and shareable workspace flows with the static app."""

from __future__ import annotations

import argparse
import functools
import json
import socketserver
import threading
from http.server import SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import quote

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
        print("skipped workspace browser test: playwright is not installed")
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
                print(f"skipped workspace browser test: chromium unavailable ({error})")
                return 0

            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.on("dialog", lambda dialog: dialog.accept("Test workspace"))
            page.goto(f"{base_url}#/catalog", wait_until="domcontentloaded")
            page.wait_for_selector(".result-row")
            page.wait_for_timeout(1000)
            page.locator(".result-row .tray-add").nth(0).click()
            page.locator(".result-row .tray-add").nth(1).click()
            page.locator("#tray-button").click()
            page.locator("[data-workspace-save]").click()
            page.wait_for_selector(".workspace-row", timeout=10000)
            assert page.locator(".workspace-row").count() == 1

            stored = page.evaluate(
                "() => JSON.parse(localStorage.getItem('fresh-hectaresbc.workspaces.v1'))[0].state"
            )
            assert stored["v"] == 1
            assert len(stored["layers"]) == 2
            assert stored["primary"] == stored["layers"][0]

            page.locator("[data-workspace-open]").click()
            page.wait_for_selector(".map-loading", state="detached", timeout=60000)
            page.wait_for_timeout(1500)
            assert page.locator(".maplibregl-canvas").count() == 1
            assert page.locator(".map-context-layer").count() == 1
            assert page.locator("#tray-count").inner_text() == "2"

            share_hash = (
                f"#/dataset/{quote(stored['primary'])}/map?w="
                f"{quote(json.dumps(stored))}"
            )
            page.goto(f"{base_url}{share_hash}", wait_until="domcontentloaded")
            page.wait_for_selector(".map-loading", state="detached", timeout=60000)
            page.wait_for_timeout(1000)
            assert page.locator("#tray-count").inner_text() == "2"
            assert page.locator(".map-context-layer").count() == 1
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

    print("validated workspace browser flow")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
