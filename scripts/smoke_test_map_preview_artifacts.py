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
        description="Validate generated source-derived map-preview artifacts."
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
    _require(
        artifact["preview_eligibility_status"] == "source_derived_preview",
        "unexpected preview eligibility",
    )
    _require(artifact["preview_eligibility_blockers"] == [], "unexpected blockers")
    _require(artifact["crs"] == "EPSG:3005", "unexpected CRS")
    _require(artifact["internal_raster_path"] == "bcts.tiff", "unexpected raster path")
    _require(artifact["internal_wms_path"] == "bcts.wms.xml", "unexpected WMS path")
    _require(
        artifact["source_zip_path"] == "data_layers/adminunits_bcts.zip",
        "unexpected source",
    )
    _require(
        artifact["raw_relative_path"]
        == "raw/hectaresbc_2022_export/data_layers/adminunits_bcts.zip",
        "unexpected raw relative path",
    )
    _require(artifact["source_content_present"] is True, "source content not marked present")
    _require(
        artifact["source_resolution"] in {"data_repo_content", "local_archive_fallback"},
        "unexpected source resolution",
    )
    _require(artifact["source_content_status"].endswith("present"), "unexpected content status")
    _require(artifact["raster_width"] == 17216, "unexpected raster width")
    _require(artifact["raster_height"] == 15744, "unexpected raster height")
    _require(artifact["dtype"] == "int16", "unexpected dtype")
    _require(artifact["nodata"] == -9999.0, "unexpected nodata")
    _require(artifact["value_class_count"] == 12, "unexpected class count")
    _require(len(artifact["value_classes"]) == 12, "unexpected classes")
    _require(
        [item["value"] for item in artifact["value_classes"]] == list(range(1, 13)),
        "unexpected class values",
    )
    _require(
        artifact["value_classes"][0]["label"] == "TBA (Babine)",
        "unexpected first legend label",
    )
    _require(
        artifact["value_classes"][0]["rgba"] == [131, 171, 38, 220],
        "unexpected first legend color",
    )
    _require(
        _bounds_close(
            artifact["native_bounds"],
            [159587.5, 173787.5, 1881187.5, 1748187.5],
        ),
        "unexpected native bounds",
    )
    _require(
        _bounds_close(
            artifact["wgs84_bounds"],
            [-141.0962892349142, 45.9344383046823, -110.19483972116899, 60.71688156515922],
        ),
        "unexpected WGS84 bounds",
    )
    _require(artifact["preview_width"] > 0, "missing preview width")
    _require(artifact["preview_height"] > 0, "missing preview height")
    _require(
        max(artifact["preview_width"], artifact["preview_height"]) <= 768,
        "preview exceeds expected default maximum size",
    )

    png_path = args.preview_root / artifact["artifact_path"]
    _require(png_path.exists(), "preview PNG missing")
    with Image.open(png_path) as image:
        _require(image.mode == "RGBA", "preview PNG is not RGBA")
        _require(image.size == (artifact["preview_width"], artifact["preview_height"]), "size mismatch")
        alpha = image.getchannel("A")
        _require(alpha.getbbox() is not None, "preview PNG has no visible pixels")
        colors = image.getcolors(maxcolors=image.size[0] * image.size[1])
        _require(colors is not None, "preview PNG has too many colors for categorical preview")
        visible_colors = {color for _count, color in colors if color[3] > 0}
        _require(len(visible_colors) == 12, "preview PNG does not contain all 12 legend colors")

    serialized = json.dumps({"manifest": manifest}, sort_keys=True)
    for fragment in ("/home/", "tmp/shared-data/hectaresbc", "tmp/bootstrap", "aws-secrets"):
        _require(fragment not in serialized, f"artifact leaks forbidden fragment: {fragment}")

    print(f"validated map preview artifacts: {args.preview_root}")
    return 0


def _require(condition: object, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def _bounds_close(observed: list[float], expected: list[float], tolerance: float = 1e-6) -> bool:
    return len(observed) == len(expected) and all(
        abs(left - right) <= tolerance for left, right in zip(observed, expected, strict=True)
    )


if __name__ == "__main__":
    raise SystemExit(main())
