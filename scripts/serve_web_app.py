#!/usr/bin/env python3
"""Serve the browser app without exposing repository directory listings."""

from __future__ import annotations

import argparse
import functools
import http.server
import posixpath
import socketserver
from pathlib import Path
from urllib.parse import unquote, urlsplit


REPO_ROOT = Path(__file__).resolve().parents[1]
ALLOWED_PREFIXES = (
    "/web/",
    "/external/fresh-hectaresbc-data/derived/web_map_previews/v1/",
)


class FreshHectaresBCHandler(http.server.SimpleHTTPRequestHandler):
    """Serve only browser assets and published preview artifacts."""

    def do_GET(self) -> None:
        if self.path in {"", "/"}:
            self.send_response(302)
            self.send_header("Location", "/web/")
            self.end_headers()
            return
        super().do_GET()

    def do_HEAD(self) -> None:
        if self.path in {"", "/"}:
            self.send_response(302)
            self.send_header("Location", "/web/")
            self.end_headers()
            return
        super().do_HEAD()

    def translate_path(self, path: str) -> str:
        clean_path = normalized_url_path(path)
        if not is_allowed_path(clean_path):
            return str(REPO_ROOT / "__fresh_hectaresbc_forbidden__")
        return str((REPO_ROOT / clean_path.lstrip("/")).resolve())

    def list_directory(self, path: str):  # noqa: ANN001, ANN201 - stdlib override
        self.send_error(403, "Directory listing disabled")
        return None


def normalized_url_path(path: str) -> str:
    url_path = unquote(urlsplit(path).path)
    normalized = posixpath.normpath(url_path)
    if url_path.endswith("/") and not normalized.endswith("/"):
        normalized += "/"
    if not normalized.startswith("/"):
        normalized = "/" + normalized
    return normalized


def is_allowed_path(path: str) -> bool:
    if path == "/web":
        return True
    return any(path.startswith(prefix) for prefix in ALLOWED_PREFIXES)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Serve the browser app and published preview artifacts safely."
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8023)
    args = parser.parse_args()

    handler = functools.partial(FreshHectaresBCHandler, directory=str(REPO_ROOT))
    with socketserver.TCPServer((args.host, args.port), handler) as httpd:
        print(f"serving fresh-hectaresbc web app at http://{args.host}:{args.port}/web/")
        httpd.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
