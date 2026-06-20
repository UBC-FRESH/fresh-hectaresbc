#!/usr/bin/env python3
"""Smoke-test generated browser map-preview artifacts."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


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
    _require(manifest["schema_version"] == 2, "unexpected manifest schema version")
    _require(manifest["artifact_count"] == 1, "unexpected artifact count")
    _require(manifest["artifact_format"] == "raster_png", "unexpected artifact format")
    _require(
        manifest["artifact_scope"] == "source_derived_payload_preview",
        "unexpected artifact scope",
    )
    _require(
        manifest["representative_records"]["data_layer_candidate"]
        == "dl_adminunits_bcts",
        "unexpected data-layer representative",
    )

    artifact = manifest["artifacts"][0]
    _require(artifact["dataset_id"] == "dl_adminunits_bcts", "unexpected dataset")
    _require(
        artifact["artifact_status"] == "source_derived_preview",
        "unexpected artifact status",
    )
    _require(artifact["artifact_kind"] == "raster_png", "unexpected artifact kind")
    _require(artifact["preview_eligibility_blockers"] == [], "unexpected blockers")
    _require(artifact["crs"] == "EPSG:3005", "unexpected CRS")
    _require(artifact["internal_raster_path"] == "bcts.tiff", "unexpected raster path")
    _require(artifact["source_zip_path"] == "data_layers/adminunits_bcts.zip", "unexpected source")
    _require(artifact["value_class_count"] == 12, "unexpected class count")
    _require(len(artifact["value_classes"]) == 12, "unexpected classes")
    _require(artifact["preview_width"] > 0, "missing preview width")
    _require(artifact["preview_height"] > 0, "missing preview height")

    png_path = args.preview_root / artifact["artifact_path"]
    _require(png_path.exists(), "preview PNG missing")
    with Image.open(png_path) as image:
        _require(image.mode == "RGBA", "preview PNG is not RGBA")
        _require(image.size == (artifact["preview_width"], artifact["preview_height"]), "size mismatch")
        alpha = image.getchannel("A")
        _require(alpha.getbbox() is not None, "preview PNG has no visible pixels")

    serialized = json.dumps({"manifest": manifest}, sort_keys=True)
    for fragment in ("/home/", "tmp/shared-data/hectaresbc", "aws-secrets"):
        _require(fragment not in serialized, f"artifact leaks forbidden fragment: {fragment}")

    print(f"validated map preview artifacts: {args.preview_root}")
    return 0


def _require(condition: object, message: str) -> None:
    if not condition:
        raise AssertionError(message)


if __name__ == "__main__":
    raise SystemExit(main())
