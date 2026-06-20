#!/usr/bin/env python3
"""Generate source-derived layer preview artifacts in batch mode."""

from __future__ import annotations

import argparse
import csv
import json
import sys
import warnings
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from xml.etree import ElementTree
from zipfile import ZipFile


DEFAULT_FEASIBILITY_CSV = Path("metadata/preview_feasibility/layer_preview_feasibility.csv")
DEFAULT_OUTPUT_ROOT = Path("external/fresh-hectaresbc-data/derived/web_map_previews/v1")
DEFAULT_LOCAL_ARCHIVE_ROOT = Path("tmp/shared-data/hectaresbc")
DEFAULT_MAX_SIZE = 256
SCHEMA_VERSION = 1
FORBIDDEN_FRAGMENTS = (
    "/home/",
    "tmp/bootstrap",
    "tmp/shared-data/hectaresbc",
    "aws-secrets",
)
PALETTE = (
    (20, 81, 117, 215),
    (219, 94, 47, 215),
    (64, 145, 108, 215),
    (123, 82, 171, 215),
    (208, 162, 49, 215),
    (37, 128, 171, 215),
    (173, 72, 112, 215),
    (85, 154, 54, 215),
    (116, 94, 62, 215),
    (71, 111, 191, 215),
    (183, 111, 43, 215),
    (45, 147, 145, 215),
)


@dataclass(frozen=True)
class SourceZip:
    path: Path | None
    source_resolution: str
    content_status: str


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate source-derived preview PNGs and manifests in batch mode."
    )
    parser.add_argument(
        "--feasibility-csv",
        type=Path,
        default=DEFAULT_FEASIBILITY_CSV,
        help="Preview feasibility CSV produced by audit_layer_preview_feasibility.py.",
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=DEFAULT_OUTPUT_ROOT,
        help="Preview artifact root. Defaults to the DataLad data-repo derived layout.",
    )
    parser.add_argument(
        "--local-archive-root",
        type=Path,
        default=DEFAULT_LOCAL_ARCHIVE_ROOT,
        help="Ignored local recovered archive fallback root.",
    )
    parser.add_argument(
        "--dataset-id",
        action="append",
        default=[],
        help="Generate only a specific dataset ID. May be supplied multiple times.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional limit for smoke runs.",
    )
    parser.add_argument(
        "--max-size",
        type=int,
        default=DEFAULT_MAX_SIZE,
        help="Maximum generated preview width or height.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate layers even when manifest and PNG already exist.",
    )
    parser.add_argument(
        "--progress-every",
        type=int,
        default=25,
        help="Print progress to stderr every N records. Use 0 to disable.",
    )
    args = parser.parse_args()

    rows = read_feasibility_rows(args.feasibility_csv)
    if args.dataset_id:
        wanted = set(args.dataset_id)
        rows = [row for row in rows if row["dataset_id"] in wanted]
        missing = sorted(wanted - {row["dataset_id"] for row in rows})
        if missing:
            raise SystemExit(f"dataset IDs not found in feasibility CSV: {', '.join(missing)}")
    if args.limit is not None:
        rows = rows[: args.limit]

    summary = generate_batch(
        rows,
        output_root=args.output_root,
        local_archive_root=args.local_archive_root,
        max_size=args.max_size,
        force=args.force,
        progress_every=args.progress_every,
    )
    print(
        "wrote layer preview batch "
        f"{args.output_root} ({summary['processed_count']} processed)"
    )
    return 0


def read_feasibility_rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as stream:
        return list(csv.DictReader(stream))


def generate_batch(
    rows: list[dict[str, str]],
    *,
    output_root: Path,
    local_archive_root: Path = DEFAULT_LOCAL_ARCHIVE_ROOT,
    max_size: int = DEFAULT_MAX_SIZE,
    force: bool = False,
    progress_every: int = 0,
) -> dict[str, Any]:
    output_root.mkdir(parents=True, exist_ok=True)
    layers: list[dict[str, Any]] = []
    failures: list[dict[str, str]] = []
    started_at = datetime.now(UTC).replace(microsecond=0).isoformat()

    for index, row in enumerate(rows, start=1):
        dataset_id = row["dataset_id"]
        if progress_every > 0 and (index == 1 or index % progress_every == 0):
            print(f"generating {index}/{len(rows)} {dataset_id}", file=sys.stderr, flush=True)

        layer_dir = output_root / "layers" / dataset_id
        manifest_path = layer_dir / "manifest.json"
        preview_path = layer_dir / "preview.png"
        if not force and manifest_path.exists() and preview_path.exists():
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            layers.append(_index_entry_from_manifest(manifest, skipped=True))
            continue

        source = _resolve_source_zip(row, local_archive_root)
        try:
            manifest = _generate_one(row, source, output_root=output_root, max_size=max_size)
            _validate_manifest(manifest)
            layer_dir.mkdir(parents=True, exist_ok=True)
            manifest_path.write_text(
                json.dumps(manifest, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )
            layers.append(_index_entry_from_manifest(manifest, skipped=False))
        except Exception as error:  # noqa: BLE001 - batch output should capture row-level failures.
            failure = _failure_record(row, source, error)
            failures.append(failure)
            layers.append(_index_entry_from_failure(failure))

    summary = _write_batch_outputs(
        output_root,
        rows=rows,
        layers=layers,
        failures=failures,
        started_at=started_at,
        max_size=max_size,
    )
    _validate_no_private_fragments(output_root)
    return summary


def _resolve_source_zip(row: dict[str, str], local_archive_root: Path) -> SourceZip:
    data_repo_path = Path("external/fresh-hectaresbc-data") / row["raw_relative_path"]
    fallback_path = local_archive_root / row["source_zip_path"]
    if data_repo_path.is_file():
        return SourceZip(data_repo_path, "data_repo_content", "content_present")
    if fallback_path.is_file():
        return SourceZip(
            fallback_path,
            "local_archive_fallback",
            "local_archive_fallback_present",
        )
    return SourceZip(None, "unavailable", "source_unavailable")


def _generate_one(
    row: dict[str, str],
    source: SourceZip,
    *,
    output_root: Path,
    max_size: int,
) -> dict[str, Any]:
    if source.path is None:
        raise FileNotFoundError("source ZIP content is unavailable")

    raster_member = row["raster_member_path"]
    if not raster_member:
        raise ValueError("row has no raster member")

    layer_dir = output_root / "layers" / row["dataset_id"]
    preview_path = layer_dir / "preview.png"
    render = _render_preview_png(
        source.path,
        raster_member,
        row["wms_member_path"],
        output_path=preview_path,
        max_size=max_size,
    )
    artifact_path = f"layers/{row['dataset_id']}/preview.png"
    manifest_path = f"layers/{row['dataset_id']}/manifest.json"
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(UTC).replace(microsecond=0).isoformat(),
        "dataset_id": row["dataset_id"],
        "title": row["title"],
        "source_family": row["source_family"],
        "source_zip_path": row["source_zip_path"],
        "raw_relative_path": row["raw_relative_path"],
        "source_content_status": source.content_status,
        "source_resolution": source.source_resolution,
        "artifact_kind": "raster_png",
        "artifact_status": "source_derived_preview",
        "artifact_path": artifact_path,
        "manifest_path": manifest_path,
        "internal_raster_path": raster_member,
        "internal_wms_path": row["wms_member_path"],
        "crs": render["crs"],
        "native_bounds": render["native_bounds"],
        "wgs84_bounds": render["wgs84_bounds"],
        "raster_width": render["raster_width"],
        "raster_height": render["raster_height"],
        "preview_width": render["preview_width"],
        "preview_height": render["preview_height"],
        "dtype": render["dtype"],
        "nodata": render["nodata"],
        "value_classes": render["value_classes"],
        "value_class_count": len(render["value_classes"]),
        "preview_eligibility_status": row["preview_feasibility_status"],
        "preview_eligibility_blockers": json.loads(row["preview_eligibility_blockers"]),
        "visual_signal_status": render["visual_signal_status"],
        "visible_pixel_count": render["visible_pixel_count"],
        "provenance": {
            "generated_by": "scripts/generate_layer_preview_batch.py",
            "source_dataset_id": row["dataset_id"],
            "source_title": row["title"],
            "source_zip_path": row["source_zip_path"],
            "internal_raster_path": raster_member,
            "legend_source_path": row["wms_member_path"],
            "reason": (
                "Rasterio read the recovered raster from the source ZIP and "
                "Pillow wrote a browser-fit RGBA preview PNG."
            ),
        },
    }


def _render_preview_png(
    zip_path: Path,
    raster_member: str,
    wms_member: str,
    *,
    output_path: Path,
    max_size: int,
) -> dict[str, Any]:
    import numpy as np
    import rasterio
    from PIL import Image
    from rasterio.enums import Resampling
    from rasterio.warp import transform_bounds

    vfs_path = f"zip://{zip_path}!{raster_member}"
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

    classes = _read_wms_classes(zip_path, wms_member) if wms_member else []
    rgba = _rgba_from_array(array, classes)
    visible_pixel_count = int((rgba[:, :, 3] > 0).sum())
    output_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, mode="RGBA").save(output_path)
    metadata.update(
        {
            "value_classes": classes,
            "visual_signal_status": _visual_signal_status(rgba),
            "visible_pixel_count": visible_pixel_count,
        }
    )
    return metadata


def _rgba_from_array(array: Any, classes: list[dict[str, Any]]) -> Any:
    import numpy as np

    data = np.asarray(array.filled(0))
    valid = ~np.ma.getmaskarray(array)
    rgba = np.zeros((data.shape[0], data.shape[1], 4), dtype=np.uint8)
    if classes:
        for item in classes:
            rgba[(data == item["value"]) & valid] = item["rgba"]
        return rgba

    values = np.asarray(array.compressed())
    if values.size == 0:
        return rgba
    unique_values = np.unique(values)
    if unique_values.size <= len(PALETTE):
        for index, value in enumerate(unique_values):
            color = PALETTE[index]
            if float(value) == 0.0:
                color = (177, 185, 178, 48)
            rgba[(data == value) & valid] = color
        return rgba

    low = float(values.min())
    high = float(values.max())
    span = high - low
    if span == 0:
        rgba[valid] = PALETTE[0]
        return rgba

    normalized = np.clip((data.astype(float) - low) / span, 0, 1)
    rgba[valid, 0] = (32 + normalized[valid] * 201).astype(np.uint8)
    rgba[valid, 1] = (78 + normalized[valid] * 139).astype(np.uint8)
    rgba[valid, 2] = (111 - normalized[valid] * 63).astype(np.uint8)
    rgba[valid, 3] = 210
    return rgba


def _visual_signal_status(rgba: Any) -> str:
    visible = rgba[:, :, 3] > 0
    if not visible.any():
        return "empty_preview"
    colors = {tuple(color) for color in rgba[visible].reshape(-1, 4)}
    return "single_color_preview" if len(colors) == 1 else "multi_color_preview"


def _read_wms_classes(zip_path: Path, wms_member: str) -> list[dict[str, Any]]:
    with ZipFile(zip_path) as archive:
        root = ElementTree.fromstring(archive.read(wms_member))

    classes: list[dict[str, Any]] = []
    for entry in root.findall("entry"):
        value_text = (entry.findtext("values") or "").strip()
        if not value_text:
            continue
        red = int((entry.findtext("color/red") or "0").strip())
        green = int((entry.findtext("color/green") or "0").strip())
        blue = int((entry.findtext("color/blue") or "0").strip())
        classes.append(
            {
                "value": int(value_text),
                "label": (entry.findtext("legend_entry") or "").strip(),
                "rgb": [red, green, blue],
                "rgba": [red, green, blue, 220],
            }
        )
    return classes


def _index_entry_from_manifest(manifest: dict[str, Any], *, skipped: bool) -> dict[str, Any]:
    return {
        "dataset_id": manifest["dataset_id"],
        "title": manifest["title"],
        "source_family": manifest["source_family"],
        "artifact_status": "already_present" if skipped else manifest["artifact_status"],
        "artifact_kind": manifest["artifact_kind"],
        "manifest_path": manifest["manifest_path"],
        "artifact_path": manifest["artifact_path"],
        "wgs84_bounds": manifest["wgs84_bounds"],
        "preview_eligibility_blockers": manifest["preview_eligibility_blockers"],
        "source_zip_path": manifest["source_zip_path"],
    }


def _index_entry_from_failure(failure: dict[str, str]) -> dict[str, Any]:
    return {
        "dataset_id": failure["dataset_id"],
        "title": failure["title"],
        "source_family": failure["source_family"],
        "artifact_status": "generation_failed",
        "artifact_kind": "raster_png",
        "manifest_path": "",
        "artifact_path": "",
        "wgs84_bounds": [],
        "preview_eligibility_blockers": json.loads(failure["preview_eligibility_blockers"]),
        "source_zip_path": failure["source_zip_path"],
    }


def _failure_record(row: dict[str, str], source: SourceZip, error: Exception) -> dict[str, str]:
    return {
        "dataset_id": row["dataset_id"],
        "title": row["title"],
        "source_family": row["source_family"],
        "source_zip_path": row["source_zip_path"],
        "source_resolution": source.source_resolution,
        "source_content_status": source.content_status,
        "preview_eligibility_blockers": json.dumps(["generation_failed"]),
        "error_message": str(error).splitlines()[0],
    }


def _write_batch_outputs(
    output_root: Path,
    *,
    rows: list[dict[str, str]],
    layers: list[dict[str, Any]],
    failures: list[dict[str, str]],
    started_at: str,
    max_size: int,
) -> dict[str, Any]:
    status_counts = Counter(layer["artifact_status"] for layer in layers)
    summary = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(UTC).replace(microsecond=0).isoformat(),
        "started_at": started_at,
        "artifact_root": "derived/web_map_previews/v1",
        "max_size": max_size,
        "requested_count": len(rows),
        "processed_count": len(layers),
        "artifact_count": sum(1 for layer in layers if layer["artifact_path"]),
        "failure_count": len(failures),
        "status_counts": dict(sorted(status_counts.items())),
    }
    index = {
        **summary,
        "reference_layers": [],
        "layers": layers,
    }
    (output_root / "index.json").write_text(
        json.dumps(index, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    validation_dir = output_root / "validation" / _run_id(started_at)
    validation_dir.mkdir(parents=True, exist_ok=True)
    (validation_dir / "generation_summary.json").write_text(
        json.dumps(summary, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    with (validation_dir / "failed_layers.csv").open("w", newline="", encoding="utf-8") as stream:
        fieldnames = [
            "dataset_id",
            "title",
            "source_family",
            "source_zip_path",
            "source_resolution",
            "source_content_status",
            "preview_eligibility_blockers",
            "error_message",
        ]
        writer = csv.DictWriter(stream, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(failures)
    return summary


def _run_id(timestamp: str) -> str:
    return timestamp.replace(":", "").replace("-", "").replace("+0000", "Z")


def _validate_manifest(manifest: dict[str, Any]) -> None:
    if manifest["artifact_status"] != "source_derived_preview":
        raise ValueError("unexpected artifact status")
    if not manifest["wgs84_bounds"]:
        raise ValueError("missing WGS84 bounds")
    if manifest["visible_pixel_count"] <= 0:
        raise ValueError("preview PNG has no visible pixels")


def _validate_no_private_fragments(output_root: Path) -> None:
    payload = "\n".join(
        path.read_text(encoding="utf-8")
        for path in output_root.rglob("*.json")
    )
    for fragment in FORBIDDEN_FRAGMENTS:
        if fragment in payload:
            raise ValueError(f"preview batch output leaks forbidden fragment: {fragment}")


if __name__ == "__main__":
    raise SystemExit(main())
