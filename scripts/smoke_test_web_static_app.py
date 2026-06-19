#!/usr/bin/env python3
"""Smoke-test the static browser app shell and generated catalog artifact."""

from __future__ import annotations

import argparse
import contextlib
import functools
import http.server
import json
import socketserver
import threading
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_WEB_ROOT = REPO_ROOT / "web"
DEFAULT_CATALOG = DEFAULT_WEB_ROOT / "data" / "catalog.json"
REPRESENTATIVE_IDS = {
    "dl_adminunits_bcts",
    "dl_water_cwb_canals",
    "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135",
}
FORBIDDEN_CATALOG_FRAGMENTS = (
    "/home/",
    "tmp/bootstrap",
    "tmp/shared-data/hectaresbc",
    "aws-secrets",
)


class QuietHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        return


class AssetParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.stylesheets: list[str] = []
        self.scripts: list[str] = []
        self.ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if "id" in values and values["id"]:
            self.ids.add(values["id"])
        if tag == "link" and values.get("rel") == "stylesheet" and values.get("href"):
            self.stylesheets.append(values["href"] or "")
        if tag == "script" and values.get("src"):
            self.scripts.append(values["src"] or "")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate the static browser app shell, HTTP serving, and catalog JSON."
    )
    parser.add_argument("--web-root", type=Path, default=DEFAULT_WEB_ROOT)
    parser.add_argument("--catalog", type=Path, default=DEFAULT_CATALOG)
    args = parser.parse_args()

    web_root = args.web_root.resolve()
    catalog_path = args.catalog.resolve()
    _check_static_assets(web_root)
    catalog = _check_catalog(catalog_path)
    _check_http_serving(web_root)

    print(
        "validated static web app: "
        f"{web_root.relative_to(REPO_ROOT)} with {catalog['record_count']} records"
    )
    return 0


def _check_static_assets(web_root: Path) -> None:
    index_path = web_root / "index.html"
    _require(index_path.is_file(), f"missing app shell: {index_path}")

    parser = AssetParser()
    parser.feed(index_path.read_text(encoding="utf-8"))

    expected_ids = {
        "status",
        "record-count",
        "data-layer-count",
        "virtual-layer-count",
        "catalog-controls",
        "search-input",
        "sort-select",
        "page-size-select",
        "record-list",
        "record-detail",
        "detail-status",
        "map-status",
        "map-preview",
    }
    missing_ids = sorted(expected_ids.difference(parser.ids))
    _require(not missing_ids, f"missing expected DOM ids: {missing_ids}")
    _require(parser.stylesheets, "index.html does not reference a stylesheet")
    _require(parser.scripts, "index.html does not reference browser scripts")

    for asset_url in [*parser.stylesheets, *parser.scripts]:
        asset_path = web_root / urlsplit(asset_url).path
        _require(asset_path.is_file(), f"referenced asset is missing: {asset_url}")

    for relative_path in ("catalog.js", "app.js", "styles.css", "README.md"):
        _require((web_root / relative_path).is_file(), f"missing web asset: {relative_path}")


def _check_catalog(catalog_path: Path) -> dict[str, object]:
    _require(catalog_path.is_file(), f"missing generated catalog: {catalog_path}")
    raw = catalog_path.read_text(encoding="utf-8")
    for fragment in FORBIDDEN_CATALOG_FRAGMENTS:
        _require(fragment not in raw, f"catalog leaks forbidden fragment: {fragment}")

    catalog = json.loads(raw)
    records = catalog.get("records")
    _require(catalog.get("record_count") == 2183, "unexpected catalog record count")
    _require(isinstance(records, list), "catalog records must be a list")
    _require(len(records) == catalog["record_count"], "catalog record count mismatch")
    family_counts = catalog.get("family_counts") or {}
    _require(family_counts.get("data_layer") == 418, "unexpected data-layer count")
    _require(family_counts.get("virtual_layer") == 1765, "unexpected virtual-layer count")
    preview_counts = catalog.get("preview_eligibility_counts") or {}
    _require(
        preview_counts.get("candidate_missing_crs") == 418,
        "unexpected candidate_missing_crs count",
    )
    _require(
        preview_counts.get("not_supported") == 1765,
        "unexpected not_supported count",
    )
    representatives = catalog.get("representative_preview_records") or {}
    _require(
        representatives.get("data_layer_candidate") == "dl_water_cwb_canals",
        "unexpected representative data-layer candidate",
    )
    _require(
        representatives.get("unavailable_record")
        == "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135",
        "unexpected representative unavailable record",
    )

    by_id = {record.get("dataset_id"): record for record in records if isinstance(record, dict)}
    for dataset_id in REPRESENTATIVE_IDS:
        record = by_id.get(dataset_id)
        _require(record, f"missing representative record: {dataset_id}")
        for key in (
            "dataset_id",
            "source_family",
            "title",
            "source_zip_path",
            "metadata",
            "provenance",
            "preview",
            "verification_status",
            "uncertainty_notes",
        ):
            _require(key in record, f"{dataset_id} missing catalog key: {key}")
        preview = record.get("preview") or {}
        for key in (
            "eligibility_status",
            "eligibility_reason",
            "eligibility_blockers",
            "has_crs_metadata",
            "has_extent_metadata",
        ):
            _require(key in preview, f"{dataset_id} missing preview key: {key}")

    return catalog


def _check_http_serving(web_root: Path) -> None:
    handler = functools.partial(
        QuietHTTPRequestHandler,
        directory=str(web_root),
    )
    with contextlib.ExitStack() as stack:
        httpd = stack.enter_context(
            socketserver.TCPServer(("127.0.0.1", 0), handler)
        )
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        stack.callback(httpd.shutdown)

        base_url = f"http://127.0.0.1:{httpd.server_address[1]}"
        for path, expected in (
            ("/", "Recovered HectaresBC Catalog"),
            ("/catalog.js", "CatalogBrowser"),
            ("/app.js", "loadCatalog"),
            ("/styles.css", "record-detail"),
            ("/data/catalog.json", '"record_count": 2183'),
        ):
            with urllib.request.urlopen(base_url + path, timeout=10) as response:
                body = response.read().decode("utf-8")
            _require(expected in body, f"HTTP response for {path} missed {expected!r}")


def _require(condition: object, message: str) -> None:
    if not condition:
        raise AssertionError(message)


if __name__ == "__main__":
    raise SystemExit(main())
