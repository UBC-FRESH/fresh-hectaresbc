#!/usr/bin/env python3
"""Exercise Series contact-sheet PNG export."""

from __future__ import annotations

import argparse
import functools
import socketserver
import struct
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
        print("skipped contact-sheet browser test: playwright is not installed")
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
                    f"skipped contact-sheet browser test: chromium unavailable ({error})"
                )
                return 0

            context = browser.new_context(
                viewport={"width": 1440, "height": 900},
                accept_downloads=True,
            )
            page = context.new_page()
            page.goto(
                f"{base_url}#/series?layers=dl_adminunits_bcts,dl_adminunits_coaltenure,dl_adminunits_firezone&speed=500",
                wait_until="domcontentloaded",
            )
            page.wait_for_selector(".series-shell", timeout=30000)
            page.wait_for_selector("#series-map .maplibregl-canvas", timeout=30000)
            page.wait_for_timeout(1400)
            assert page.locator("[data-series-contact]").inner_text() == "Contact sheet"

            with page.expect_download(timeout=60000) as download_info:
                page.locator("[data-series-contact]").click()
            download = download_info.value
            path = download.path()
            assert path is not None
            payload = Path(path).read_bytes()
            assert payload.startswith(b"\x89PNG\r\n\x1a\n")
            assert len(payload) > 10000
            width, height = struct.unpack(">II", payload[16:24])
            assert width >= 900
            assert height >= 250
            assert width > height
            assert download.suggested_filename.startswith(
                "hectaresbc-series-contact-sheet-"
            )
            assert download.suggested_filename.endswith(".png")
            assert page.locator("[data-series-contact]").inner_text() == "Contact sheet"

            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

    print("validated Series contact-sheet browser flow")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
