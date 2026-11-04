#!/usr/bin/env python3
"""Build optional compressed COG derivatives for high-zoom raster tiles.

The source HectaresBC TIFFs live inside large ZIP payloads and have no
overviews. Converting a viewed layer to a tiled, compressed GeoTIFF with
overviews makes the first high-zoom tile much cheaper. This is intentionally a
per-layer pilot rather than an all-archive conversion.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import uuid
from pathlib import Path

import rasterio
from rasterio.enums import Resampling
from rasterio.shutil import copy as rasterio_copy

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = REPO_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from fresh_hectaresbc import HectaresBC  # noqa: E402
from fresh_hectaresbc.clip import pick_raster_member, resolve_source_zip  # noqa: E402

CORE_ADMIN_DATASETS = [
    "dl_adminunits_coaltenure",
    "dl_adminunits_firezone",
    "dl_adminunits_forestdistrict",
    "dl_adminunits_healthunits",
    "dl_adminunits_ilmbregions",
    "dl_adminunits_municipalities",
]


def _resampling(name: str) -> Resampling:
    try:
        return getattr(Resampling, name)
    except AttributeError as exc:
        raise argparse.ArgumentTypeError(f"unknown resampling method: {name}") from exc


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dataset-id",
        action="append",
        default=[],
        help="Dataset ID to convert; repeat for multiple layers.",
    )
    parser.add_argument(
        "--preset",
        choices=("core-admin",),
        help="Expand a named dataset preset.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the resolved dataset plan without opening the archive.",
    )
    parser.add_argument(
        "--archive-root",
        type=Path,
        default=Path(os.environ["FRESH_HECTARESBC_ARCHIVE_ROOT"])
        if os.environ.get("FRESH_HECTARESBC_ARCHIVE_ROOT")
        else None,
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=REPO_ROOT / "var" / "tile-cogs",
    )
    parser.add_argument(
        "--overviews",
        default="2,4,8,16,32",
        help="Comma-separated overview factors.",
    )
    parser.add_argument("--block-size", type=int, default=512)
    parser.add_argument(
        "--resampling",
        default="nearest",
        choices=("nearest", "average", "bilinear", "cubic"),
    )
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    dataset_ids = list(args.dataset_id)
    if args.preset == "core-admin":
        dataset_ids.extend(CORE_ADMIN_DATASETS)
    dataset_ids = list(dict.fromkeys(dataset_ids))
    if not dataset_ids:
        parser.error("provide --dataset-id or --preset")

    try:
        overviews = [int(value) for value in args.overviews.split(",") if value]
    except ValueError as exc:
        parser.error(str(exc))
    if not overviews or any(value < 2 for value in overviews):
        parser.error("overview factors must be integers >= 2")

    output_root = args.output_root.expanduser().resolve()
    if args.dry_run:
        print(
            json.dumps(
                {
                    "status": "dry-run",
                    "output_root": str(output_root),
                    "datasets": [
                        {
                            "dataset_id": dataset_id,
                            "output": str(output_root / f"{dataset_id}.tif"),
                        }
                        for dataset_id in dataset_ids
                    ],
                }
            )
        )
        return 0
    output_root.mkdir(parents=True, exist_ok=True)
    archive_root = args.archive_root.expanduser() if args.archive_root else None
    hbc = HectaresBC()
    failures = 0

    for dataset_id in dataset_ids:
        record = hbc.get(dataset_id)
        if record is None:
            print(json.dumps({"status": "error", "dataset_id": dataset_id, "error": "unknown dataset"}))
            failures += 1
            continue
        output_path = output_root / f"{dataset_id}.tif"
        if output_path.is_file() and not args.force:
            print(
                json.dumps(
                    {
                        "status": "skipped",
                        "dataset_id": dataset_id,
                        "output": str(output_path),
                        "bytes": output_path.stat().st_size,
                    }
                )
            )
            continue
        try:
            zip_path, source_resolution = resolve_source_zip(record, archive_root)
            member = pick_raster_member(zip_path, record)
            vfs = f"zip://{zip_path}!{member}"
            temp_path = output_root / f".{dataset_id}.{uuid.uuid4().hex}.tmp.tif"
            started = time.perf_counter()
            with rasterio.open(vfs) as source:
                rasterio_copy(
                    source,
                    temp_path,
                    driver="GTiff",
                    tiled=True,
                    blockxsize=args.block_size,
                    blockysize=args.block_size,
                    compress="deflate",
                    predictor=2,
                    bigtiff="IF_SAFER",
                )
            with rasterio.open(temp_path, "r+") as derived:
                derived.build_overviews(overviews, _resampling(args.resampling))
                derived.update_tags(
                    ns="rio_overview", resampling=args.resampling
                )
            temp_path.replace(output_path)
            print(
                json.dumps(
                    {
                        "status": "ok",
                        "dataset_id": dataset_id,
                        "source_zip": str(zip_path),
                        "member": member,
                        "source_resolution": source_resolution,
                        "output": str(output_path),
                        "bytes": output_path.stat().st_size,
                        "overviews": overviews,
                        "seconds": round(time.perf_counter() - started, 2),
                    }
                )
            )
        except Exception as exc:  # noqa: BLE001 - report per-layer failures
            failures += 1
            try:
                temp_path.unlink(missing_ok=True)
            except (NameError, OSError):
                pass
            print(
                json.dumps(
                    {
                        "status": "error",
                        "dataset_id": dataset_id,
                        "error": str(exc),
                    }
                )
            )
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
