#!/usr/bin/env python3
"""Serve the browser app without exposing repository directory listings."""

from __future__ import annotations

import argparse
import functools
import gzip
import http.server
import mimetypes
import posixpath
import socketserver
from pathlib import Path
from urllib.parse import unquote, urlsplit


REPO_ROOT = Path(__file__).resolve().parents[1]
ROOT_REDIRECT_LOCATION = "web/"
ALLOWED_PREFIXES = (
    "/web/",
    "/external/fresh-hectaresbc-data/derived/web_map_previews/v1/",
)
COMPRESSIBLE_TYPES = frozenset(
    {
        "application/javascript",
        "application/json",
        "application/xml",
        "image/svg+xml",
        "text/css",
        "text/html",
        "text/javascript",
        "text/plain",
    }
)
_GZIP_CACHE: dict[tuple[str, int, int], bytes] = {}
_GZIP_CACHE_LIMIT = 32


class FreshHectaresBCHandler(http.server.SimpleHTTPRequestHandler):
    """Serve browser assets with compression and safe cache hints."""

    def do_GET(self) -> None:
        if self.path in {"", "/"}:
            self._redirect_root()
            return
        self._serve(include_body=True)

    def do_HEAD(self) -> None:
        if self.path in {"", "/"}:
            self._redirect_root()
            return
        self._serve(include_body=False)

    def _redirect_root(self) -> None:
        self.send_response(302)
        self.send_header("Location", ROOT_REDIRECT_LOCATION)
        self.end_headers()

    def _serve(self, *, include_body: bool) -> None:
        clean_path = normalized_url_path(self.path)
        if not is_allowed_path(clean_path):
            self.send_error(403, "Forbidden")
            return

        target = Path(self.translate_path(self.path))
        if target.is_dir():
            index = target / "index.html"
            if index.is_file():
                target = index
            else:
                self.send_error(403, "Directory listing disabled")
                return
        if not target.is_file():
            self.send_error(404, "File not found")
            return

        content_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        body = target.read_bytes()
        encoding: str | None = None
        if include_body and _accepts_gzip(self.headers.get("Accept-Encoding", "")):
            if should_compress(content_type, len(body)):
                body = _gzip_bytes(target, body)
                encoding = "gzip"

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", cache_control_for(clean_path, self.path))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header(
            "Last-Modified", self.date_time_string(target.stat().st_mtime)
        )
        if encoding:
            self.send_header("Content-Encoding", encoding)
            self.send_header("Vary", "Accept-Encoding")
        self.end_headers()
        if include_body:
            self.wfile.write(body)

    def translate_path(self, path: str) -> str:
        clean_path = normalized_url_path(path)
        if not is_allowed_path(clean_path):
            return str(REPO_ROOT / "__fresh_hectaresbc_forbidden__")
        return str((REPO_ROOT / clean_path.lstrip("/")).resolve())

    def list_directory(self, path: str):  # noqa: ANN001, ANN201 - stdlib override
        self.send_error(403, "Directory listing disabled")
        return None


def _accepts_gzip(value: str) -> bool:
    return "gzip" in value.lower()


def should_compress(content_type: str, size: int) -> bool:
    """Return whether a response benefits from gzip compression."""

    return size > 1024 and content_type.split(";", 1)[0].strip() in COMPRESSIBLE_TYPES


def cache_control_for(clean_path: str, raw_path: str) -> str:
    """Return a conservative cache policy for browser assets and data."""

    query = urlsplit(raw_path).query
    suffix = Path(clean_path).suffix.lower()
    if suffix == ".html" or clean_path.endswith("/"):
        return "no-cache"
    if "v=" in query or "version=" in query:
        return "public, max-age=31536000, immutable"
    if suffix == ".json":
        return "public, max-age=60, must-revalidate"
    if suffix in {".css", ".js", ".png", ".svg", ".woff2"}:
        return "public, max-age=86400"
    return "public, max-age=3600"


def _gzip_bytes(target: Path, body: bytes) -> bytes:
    """Compress a file once and reuse the result until the file changes."""

    stat = target.stat()
    key = (str(target), stat.st_mtime_ns, stat.st_size)
    cached = _GZIP_CACHE.get(key)
    if cached is not None:
        return cached
    if len(_GZIP_CACHE) >= _GZIP_CACHE_LIMIT:
        _GZIP_CACHE.clear()
    compressed = gzip.compress(body, compresslevel=6)
    _GZIP_CACHE[key] = compressed
    return compressed


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
