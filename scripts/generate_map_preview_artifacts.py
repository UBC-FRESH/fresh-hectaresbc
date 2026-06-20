#!/usr/bin/env python3
"""Generate browser map-preview artifacts from recovered source payloads."""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from xml.etree import ElementTree
from zipfile import ZipFile

from fresh_hectaresbc import HectaresBC


DEFAULT_OUTPUT = Path("web/data/map_previews")
DEFAULT_DATASET_ID = "dl_adminunits_bcts"
UNAVAILABLE_DATASET_ID = "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135"
SCHEMA_VERSION = 2
PREVIEW_MAX_SIZE = 768
LOCAL_ARCHIVE_ROOT = Path("tmp/shared-data/hectaresbc")
FORBIDDEN_FRAGMENTS = (
    "/home/",
    "tmp/bootstrap",
    "tmp/shared-data/hectaresbc",
    "aws-secrets",
)
SOURCE_CONFIG = {
    "dl_adminunits_bcts": {
        "zip_path": "data_layers/adminunits_bcts.zip",
        "internal_raster_path": "bcts.tiff",
        "internal_wms_path": "bcts.wms.xml",
    }
}
BASEMAP_CONFIG = {
    "dataset_id": "dl_adminunits_nrsab",
    "artifact_path": "context/bc_admin_reference.png",
    "internal_raster_path": "nrsab.tiff",
    "internal_wms_path": "nrsab.wms.xml",
    "role": "source_derived_basemap_reference",
}


@dataclass(frozen=True)
class SourceZip:
    path: Path
    source_kind: str
    raw_relative_path: Path
    source_zip_path: str
    content_status: str


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate browser map-preview artifacts from recovered payloads."
    )
    parser.add_argument(
        "--dataset-id",
        default=DEFAULT_DATASET_ID,
        choices=sorted(SOURCE_CONFIG),
        help="Dataset ID to generate a preview for.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Output directory for generated preview artifacts.",
    )
    parser.add_argument(
        "--max-size",
        type=int,
        default=PREVIEW_MAX_SIZE,
        help="Maximum preview image width or height in pixels.",
    )
    parser.add_argument(
        "--local-archive-root",
        type=Path,
        default=LOCAL_ARCHIVE_ROOT,
        help=(
            "Ignored local archive fallback root used when DataLad content is "
            "not materialized."
        ),
    )
    args = parser.parse_args()

    try:
        manifest = build_preview_manifest(
            args.output_dir,
            dataset_id=args.dataset_id,
            max_size=args.max_size,
            local_archive_root=args.local_archive_root,
            write_artifacts=True,
        )
    except FileNotFoundError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    write_manifest(manifest, args.output_dir)
    print(
        "wrote map preview artifacts "
        f"{args.output_dir} ({manifest['artifact_count']} artifacts)"
    )
    return 0


def build_preview_manifest(
    output_dir: Path,
    *,
    dataset_id: str = DEFAULT_DATASET_ID,
    max_size: int = PREVIEW_MAX_SIZE,
    local_archive_root: Path = LOCAL_ARCHIVE_ROOT,
    write_artifacts: bool = False,
) -> dict[str, Any]:
    if dataset_id not in SOURCE_CONFIG:
        raise ValueError(f"unsupported preview dataset: {dataset_id}")

    hbc = HectaresBC()
    candidate = hbc.get(dataset_id)
    unavailable = hbc.get(UNAVAILABLE_DATASET_ID)
    source = _resolve_source_zip(hbc, dataset_id, local_archive_root=local_archive_root)
    basemap_record = hbc.get(BASEMAP_CONFIG["dataset_id"])
    basemap_source = _resolve_source_zip(
        hbc,
        BASEMAP_CONFIG["dataset_id"],
        local_archive_root=local_archive_root,
    )
    config = SOURCE_CONFIG[dataset_id]
    artifact_path = Path(dataset_id) / "preview.png"
    basemap_artifact_path = Path(BASEMAP_CONFIG["artifact_path"])

    raster_metadata = _read_raster_metadata(
        source.path,
        config["internal_raster_path"],
        internal_wms_path=config["internal_wms_path"],
        max_size=max_size,
        output_path=(output_dir / artifact_path) if write_artifacts else None,
    )
    classes = _read_wms_classes(source.path, config["internal_wms_path"])
    basemap_metadata = _read_basemap_reference_metadata(
        basemap_source.path,
        BASEMAP_CONFIG["internal_raster_path"],
        max_size=max_size,
        output_path=(output_dir / basemap_artifact_path) if write_artifacts else None,
    )

    manifest: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(UTC).replace(microsecond=0).isoformat(),
        "artifact_count": 1,
        "artifact_format": "raster_png",
        "artifact_scope": "source_derived_payload_preview",
        "output_root": _public_output_root(output_dir),
        "representative_records": {
            "data_layer_candidate": dataset_id,
            "unavailable_record": UNAVAILABLE_DATASET_ID,
        },
        "reference_layers": [
            {
                "role": BASEMAP_CONFIG["role"],
                "dataset_id": basemap_record.dataset_id,
                "title": basemap_record.title_candidate,
                "source_family": basemap_record.source_family,
                "source_zip_path": basemap_record.source_zip_path,
                "raw_relative_path": basemap_source.raw_relative_path.as_posix(),
                "source_content_status": basemap_source.content_status,
                "source_content_present": True,
                "source_resolution": basemap_source.source_kind,
                "artifact_kind": "raster_png",
                "artifact_status": "source_derived_basemap_reference",
                "artifact_path": basemap_artifact_path.as_posix(),
                "internal_raster_path": BASEMAP_CONFIG["internal_raster_path"],
                "internal_wms_path": BASEMAP_CONFIG["internal_wms_path"],
                "crs": basemap_metadata["crs"],
                "native_bounds": basemap_metadata["native_bounds"],
                "wgs84_bounds": basemap_metadata["wgs84_bounds"],
                "raster_width": basemap_metadata["raster_width"],
                "raster_height": basemap_metadata["raster_height"],
                "preview_width": basemap_metadata["preview_width"],
                "preview_height": basemap_metadata["preview_height"],
                "dtype": basemap_metadata["dtype"],
                "nodata": basemap_metadata["nodata"],
                "value_count": basemap_metadata["value_count"],
                "description": (
                    "Source-derived BC/admin reference layer generated from the "
                    "recovered NRS administrative boundary raster. Valid pixels "
                    "provide land context; class changes and valid-data edges "
                    "provide major administrative/province-like boundaries."
                ),
                "provenance": {
                    "generated_by": "scripts/generate_map_preview_artifacts.py",
                    "source_dataset_id": basemap_record.dataset_id,
                    "source_title": basemap_record.title_candidate,
                    "source_zip_path": basemap_record.source_zip_path,
                    "internal_raster_path": BASEMAP_CONFIG["internal_raster_path"],
                    "legend_source_path": BASEMAP_CONFIG["internal_wms_path"],
                },
            }
        ],
        "artifacts": [
            {
                "dataset_id": candidate.dataset_id,
                "title": candidate.title_candidate,
                "source_family": candidate.source_family,
                "source_zip_path": candidate.source_zip_path,
                "raw_relative_path": source.raw_relative_path.as_posix(),
                "source_content_status": source.content_status,
                "source_content_present": True,
                "source_resolution": source.source_kind,
                "artifact_kind": "raster_png",
                "artifact_status": "source_derived_preview",
                "artifact_path": artifact_path.as_posix(),
                "internal_raster_path": config["internal_raster_path"],
                "internal_wms_path": config["internal_wms_path"],
                "crs": raster_metadata["crs"],
                "native_bounds": raster_metadata["native_bounds"],
                "wgs84_bounds": raster_metadata["wgs84_bounds"],
                "raster_width": raster_metadata["raster_width"],
                "raster_height": raster_metadata["raster_height"],
                "preview_width": raster_metadata["preview_width"],
                "preview_height": raster_metadata["preview_height"],
                "dtype": raster_metadata["dtype"],
                "nodata": raster_metadata["nodata"],
                "value_classes": classes,
                "value_class_count": len(classes),
                "preview_eligibility_status": "source_derived_preview",
                "preview_eligibility_blockers": [],
                "provenance": {
                    "generated_by": "scripts/generate_map_preview_artifacts.py",
                    "source_dataset_id": candidate.dataset_id,
                    "source_title": candidate.title_candidate,
                    "source_zip_path": candidate.source_zip_path,
                    "internal_raster_path": config["internal_raster_path"],
                    "legend_source_path": config["internal_wms_path"],
                    "reason": (
                        "Rasterio read the recovered GeoTIFF payload directly from "
                        "the source ZIP and Pillow wrote a downsampled RGBA PNG "
                        "using the recovered WMS legend colors."
                    ),
                    "unavailable_reference_dataset_id": unavailable.dataset_id,
                },
            }
        ],
    }
    _validate_manifest(manifest)
    return manifest


def write_manifest(manifest: dict[str, Any], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _resolve_source_zip(
    hbc: HectaresBC,
    dataset_id: str,
    *,
    local_archive_root: Path,
) -> SourceZip:
    resolved = hbc.resolve(dataset_id)
    if resolved.absolute_path.exists():
        return SourceZip(
            path=resolved.absolute_path,
            source_kind="data_repo_content",
            raw_relative_path=resolved.raw_relative_path,
            source_zip_path=resolved.source_zip_path,
            content_status="content_present",
        )

    fallback = local_archive_root / resolved.source_zip_path
    if fallback.exists():
        return SourceZip(
            path=fallback,
            source_kind="local_archive_fallback",
            raw_relative_path=resolved.raw_relative_path,
            source_zip_path=resolved.source_zip_path,
            content_status="local_archive_fallback_present",
        )

    raise FileNotFoundError(
        "source ZIP content is unavailable; retrieve "
        f"{resolved.raw_relative_path.as_posix()} with DataLad or restore "
        f"{(local_archive_root / resolved.source_zip_path).as_posix()}"
    )


def _read_raster_metadata(
    zip_path: Path,
    internal_raster_path: str,
    *,
    internal_wms_path: str,
    max_size: int,
    output_path: Path | None,
) -> dict[str, Any]:
    import numpy as np
    import rasterio
    from PIL import Image
    from rasterio.enums import Resampling
    from rasterio.warp import transform_bounds

    vfs_path = f"zip://{zip_path}!{internal_raster_path}"
    with rasterio.open(vfs_path) as src:
        scale = min(max_size / src.width, max_size / src.height, 1)
        preview_width = max(1, round(src.width * scale))
        preview_height = max(1, round(src.height * scale))
        array = src.read(
            1,
            out_shape=(preview_height, preview_width),
            masked=True,
            resampling=Resampling.nearest,
        )
        native_bounds = [float(value) for value in src.bounds]
        wgs84_bounds = [
            float(value)
            for value in transform_bounds(src.crs, "EPSG:4326", *src.bounds, densify_pts=21)
        ]
        metadata = {
            "crs": str(src.crs),
            "native_bounds": native_bounds,
            "wgs84_bounds": wgs84_bounds,
            "raster_width": src.width,
            "raster_height": src.height,
            "preview_width": preview_width,
            "preview_height": preview_height,
            "dtype": src.dtypes[0],
            "nodata": None if src.nodata is None else float(src.nodata),
        }

    if output_path is not None:
        classes = _read_wms_classes(zip_path, internal_wms_path)
        color_map = {item["value"]: item["rgba"] for item in classes}
        rgba = np.zeros((preview_height, preview_width, 4), dtype=np.uint8)
        data = np.asarray(array.filled(metadata["nodata"] if metadata["nodata"] is not None else 0))
        mask = np.ma.getmaskarray(array)
        for value, color in color_map.items():
            rgba[(data == value) & ~mask] = color
        output_path.parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray(rgba, mode="RGBA").save(output_path)

    return metadata


def _read_basemap_reference_metadata(
    zip_path: Path,
    internal_raster_path: str,
    *,
    max_size: int,
    output_path: Path | None,
) -> dict[str, Any]:
    import numpy as np
    import rasterio
    from PIL import Image
    from rasterio.enums import Resampling
    from rasterio.warp import transform_bounds

    vfs_path = f"zip://{zip_path}!{internal_raster_path}"
    with rasterio.open(vfs_path) as src:
        scale = min(max_size / src.width, max_size / src.height, 1)
        preview_width = max(1, round(src.width * scale))
        preview_height = max(1, round(src.height * scale))
        array = src.read(
            1,
            out_shape=(preview_height, preview_width),
            masked=True,
            resampling=Resampling.nearest,
        )
        native_bounds = [float(value) for value in src.bounds]
        wgs84_bounds = [
            float(value)
            for value in transform_bounds(src.crs, "EPSG:4326", *src.bounds, densify_pts=21)
        ]
        metadata = {
            "crs": str(src.crs),
            "native_bounds": native_bounds,
            "wgs84_bounds": wgs84_bounds,
            "raster_width": src.width,
            "raster_height": src.height,
            "preview_width": preview_width,
            "preview_height": preview_height,
            "dtype": src.dtypes[0],
            "nodata": None if src.nodata is None else float(src.nodata),
            "value_count": int(len(set(int(value) for value in array.compressed()))),
        }

    if output_path is not None:
        data = np.asarray(array.filled(metadata["nodata"] if metadata["nodata"] is not None else 0))
        valid = ~np.ma.getmaskarray(array)
        coast_edge = _valid_data_edge(valid)
        internal_edge = _class_change_edge(data, valid)
        boundary = _expand_mask(coast_edge | internal_edge)

        rgba = np.zeros((preview_height, preview_width, 4), dtype=np.uint8)
        rgba[valid] = [238, 244, 226, 55]
        rgba[internal_edge] = [42, 75, 66, 185]
        rgba[coast_edge] = [14, 54, 63, 235]
        rgba[boundary & ~(coast_edge | internal_edge)] = [42, 75, 66, 135]

        output_path.parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray(rgba, mode="RGBA").save(output_path)

    return metadata


def _valid_data_edge(valid: Any) -> Any:
    import numpy as np

    padded = np.pad(valid, 1, constant_values=False)
    edge = np.zeros_like(valid, dtype=bool)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        neighbor = padded[1 + dy : 1 + dy + valid.shape[0], 1 + dx : 1 + dx + valid.shape[1]]
        edge |= valid & ~neighbor
    return edge


def _class_change_edge(data: Any, valid: Any) -> Any:
    import numpy as np

    padded_data = np.pad(data, 1, mode="edge")
    padded_valid = np.pad(valid, 1, constant_values=False)
    edge = np.zeros_like(valid, dtype=bool)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        neighbor_data = padded_data[
            1 + dy : 1 + dy + data.shape[0],
            1 + dx : 1 + dx + data.shape[1],
        ]
        neighbor_valid = padded_valid[
            1 + dy : 1 + dy + valid.shape[0],
            1 + dx : 1 + dx + valid.shape[1],
        ]
        edge |= valid & neighbor_valid & (data != neighbor_data)
    return edge


def _expand_mask(mask: Any) -> Any:
    import numpy as np

    padded = np.pad(mask, 1, constant_values=False)
    expanded = np.zeros_like(mask, dtype=bool)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            expanded |= padded[
                1 + dy : 1 + dy + mask.shape[0],
                1 + dx : 1 + dx + mask.shape[1],
            ]
    return expanded


def _read_wms_classes(zip_path: Path, internal_wms_path: str) -> list[dict[str, Any]]:
    with ZipFile(zip_path) as archive:
        root = ElementTree.fromstring(archive.read(internal_wms_path))

    classes = []
    for entry in root.findall("entry"):
        value = int((entry.findtext("values") or "").strip())
        red = int((entry.findtext("color/red") or "0").strip())
        green = int((entry.findtext("color/green") or "0").strip())
        blue = int((entry.findtext("color/blue") or "0").strip())
        classes.append(
            {
                "value": value,
                "label": (entry.findtext("legend_entry") or "").strip(),
                "rgb": [red, green, blue],
                "rgba": [red, green, blue, 220],
            }
        )
    return classes


def _public_output_root(output_dir: Path) -> str:
    try:
        return output_dir.relative_to(Path.cwd()).as_posix()
    except ValueError:
        return output_dir.as_posix()


def _validate_manifest(manifest: dict[str, Any]) -> None:
    serialized = json.dumps(manifest, sort_keys=True).lower()
    matches = [fragment for fragment in FORBIDDEN_FRAGMENTS if fragment in serialized]
    if matches:
        raise ValueError(
            "map preview manifest contains forbidden fragments: "
            + ", ".join(sorted(matches))
        )


if __name__ == "__main__":
    raise SystemExit(main())
