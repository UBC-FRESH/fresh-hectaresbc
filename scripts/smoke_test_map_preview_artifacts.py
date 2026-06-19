#!/usr/bin/env python3
"""Smoke-test generated browser map-preview artifacts."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


DEFAULT_PREVIEW_ROOT = Path("web/data/map_previews")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate generated Phase 11 map-preview artifacts."
    )
    parser.add_argument(
        "preview_root",
        nargs="?",
        type=Path,
        default=DEFAULT_PREVIEW_ROOT,
        help="Directory containing manifest.json and preview artifacts.",
    )
    args = parser.parse_args()

    manifest_path = args.preview_root / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    _require(manifest["schema_version"] == 1, "unexpected manifest schema version")
    _require(manifest["artifact_count"] == 1, "unexpected artifact count")
    _require(manifest["artifact_format"] == "geojson", "unexpected artifact format")
    _require(
        manifest["artifact_scope"] == "ui_fixture_pending_payload_derivation",
        "unexpected artifact scope",
    )
    _require(
        manifest["representative_records"]["data_layer_candidate"]
        == "dl_water_cwb_canals",
        "unexpected data-layer representative",
    )

    artifact = manifest["artifacts"][0]
    _require(artifact["dataset_id"] == "dl_water_cwb_canals", "unexpected dataset")
    _require(
        artifact["artifact_status"] == "fixture_pending_source_derivation",
        "unexpected artifact status",
    )
    _require(
        artifact["preview_eligibility_blockers"] == ["missing_crs", "missing_extent"],
        "unexpected eligibility blockers",
    )

    geojson_path = args.preview_root / artifact["artifact_path"]
    geojson = json.loads(geojson_path.read_text(encoding="utf-8"))
    _require(geojson["type"] == "FeatureCollection", "not a FeatureCollection")
    _require(len(geojson["features"]) == 1, "unexpected feature count")
    feature = geojson["features"][0]
    _require(feature["geometry"]["type"] == "LineString", "unexpected geometry")
    _require(feature["properties"]["fixture"] is True, "fixture flag missing")
    _require(
        "not recovered HectaresBC canal geometry"
        in feature["properties"]["fixture_warning"],
        "fixture warning missing",
    )

    serialized = json.dumps({"manifest": manifest, "geojson": geojson}, sort_keys=True)
    for fragment in ("/home/", "tmp/shared-data/hectaresbc", "aws-secrets"):
        _require(fragment not in serialized, f"artifact leaks forbidden fragment: {fragment}")

    print(f"validated map preview artifacts: {args.preview_root}")
    return 0


def _require(condition: object, message: str) -> None:
    if not condition:
        raise AssertionError(message)


if __name__ == "__main__":
    raise SystemExit(main())
