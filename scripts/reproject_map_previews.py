#!/usr/bin/env python3
"""Reproject browser map previews to Web Mercator (EPSG:3857).

Preview PNGs are rendered in the source raster CRS (usually EPSG:3005 / BC
Albers). MapLibre image overlays expect a Web-Mercator-compatible rectangle, so
placing a BC Albers image directly on the map produces a small but visible
misalignment. This script writes a parallel `map.png` for each preview and an
index with the Web-Mercator bounds. Native previews remain available for
thumbnails and provenance.

Run after generating/fetching previews:

    python scripts/reproject_map_previews.py --workers 8
"""

from __future__ import annotations

import argparse
import json
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
PUBLISHED_ROOT = (
    REPO_ROOT
    / "external"
    / "fresh-hectaresbc-data"
    / "derived"
    / "web_map_previews"
    / "v1"
)
HIGHRES_ROOT = REPO_ROOT / "web" / "data" / "map_previews_highres" / "v1"
DEFAULT_OUTPUT_ROOT = REPO_ROOT / "web" / "data" / "map_previews_3857"
AVAILABLE_STATUSES = {"source_derived_preview", "already_present"}


@dataclass(frozen=True)
class Job:
    dataset_id: str
    manifest_path: Path
    source: str
    output_root: Path


def _manifest_jobs(root: Path, source: str) -> dict[str, Job]:
    jobs: dict[str, Job] = {}
    if not root.is_dir():
        return jobs
    for manifest_path in sorted(root.glob("layers/*/manifest.json")):
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        status = manifest.get("artifact_status")
        if status not in AVAILABLE_STATUSES:
            continue
        dataset_id = str(manifest.get("dataset_id") or manifest_path.parent.name)
        if not (manifest_path.parent / "preview.png").is_file():
            continue
        jobs[dataset_id] = Job(dataset_id, manifest_path, source, root)
    return jobs


def build_jobs(
    *,
    published_root: Path,
    highres_root: Path,
    output_root: Path,
    dataset_ids: list[str] | None = None,
) -> list[Job]:
    published = _manifest_jobs(published_root, "published")
    highres = _manifest_jobs(highres_root, "highres")
    jobs = dict(published)
    jobs.update(highres)
    selected = []
    for dataset_id, job in sorted(jobs.items()):
        if dataset_ids and dataset_id not in dataset_ids:
            continue
        selected.append(Job(job.dataset_id, job.manifest_path, job.source, output_root))
    return selected


def _public_path(path: Path) -> str:
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def reproject_one(job: Job) -> tuple[dict[str, Any] | None, str | None]:
    import numpy as np
    import rasterio
    from PIL import Image
    from rasterio.enums import Resampling
    from rasterio.transform import from_bounds
    from rasterio.warp import reproject, transform_bounds

    try:
        manifest = json.loads(job.manifest_path.read_text(encoding="utf-8"))
        preview_path = job.manifest_path.parent / "preview.png"
        native_bounds = manifest.get("native_bounds")
        crs = manifest.get("crs")
        if not isinstance(native_bounds, list) or len(native_bounds) != 4 or not crs:
            return None, "manifest is missing native_bounds or crs"
        west, south, east, north = (float(value) for value in native_bounds)
        if west >= east or south >= north:
            return None, "manifest has invalid native bounds"
        image = Image.open(preview_path).convert("RGBA")
        width, height = image.size
        source = np.array(image).transpose(2, 0, 1)
        destination = np.zeros((4, height, width), dtype=np.uint8)
        dst_bounds = transform_bounds(crs, "EPSG:3857", west, south, east, north)
        src_transform = from_bounds(west, south, east, north, width, height)
        dst_transform = from_bounds(*dst_bounds, width, height)
        categorical = bool(
            manifest.get("value_classes") or manifest.get("value_class_count")
        )
        reproject(
            source=source,
            destination=destination,
            src_transform=src_transform,
            src_crs=crs,
            dst_transform=dst_transform,
            dst_crs="EPSG:3857",
            resampling=Resampling.nearest if categorical else Resampling.bilinear,
            src_nodata=None,
            dst_nodata=0,
            num_threads=1,
        )
        rgba = destination.transpose(1, 2, 0)
        rgba[rgba[:, :, 3] == 0] = (0, 0, 0, 0)
        output_dir = job.output_root / "layers" / job.dataset_id
        output_dir.mkdir(parents=True, exist_ok=True)
        map_path = output_dir / "map.png"
        Image.fromarray(rgba, "RGBA").save(map_path, optimize=True)
        map_bounds_wgs84 = transform_bounds("EPSG:3857", "EPSG:4326", *dst_bounds)
        return {
            "dataset_id": job.dataset_id,
            "title": manifest.get("title", job.dataset_id),
            "source_family": manifest.get("source_family", ""),
            "artifact_status": manifest.get("artifact_status"),
            "map_path": f"layers/{job.dataset_id}/map.png",
            "map_crs": "EPSG:3857",
            "map_width": width,
            "map_height": height,
            "map_bounds_3857": [float(value) for value in dst_bounds],
            "map_bounds_wgs84": [float(value) for value in map_bounds_wgs84],
            "value_classes": manifest.get("value_classes") or [],
            "source": job.source,
            "source_manifest": _public_path(job.manifest_path),
        }, None
    except Exception as exc:  # noqa: BLE001 - report per-layer failures
        return None, str(exc)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--published-root", type=Path, default=PUBLISHED_ROOT)
    parser.add_argument("--highres-root", type=Path, default=HIGHRES_ROOT)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--dataset-id", action="append", default=[])
    parser.add_argument("--limit", type=int)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    jobs = build_jobs(
        published_root=args.published_root.expanduser().resolve(),
        highres_root=args.highres_root.expanduser().resolve(),
        output_root=args.output_root.expanduser().resolve(),
        dataset_ids=args.dataset_id or None,
    )
    if args.limit:
        jobs = jobs[: args.limit]
    if not args.force:
        jobs = [
            job
            for job in jobs
            if not (
                job.output_root
                / "layers"
                / job.dataset_id
                / "map.png"
            ).is_file()
        ]
    print(f"reprojecting {len(jobs)} previews to EPSG:3857", flush=True)
    entries: list[dict[str, Any]] = []
    failures: list[dict[str, str]] = []
    with ProcessPoolExecutor(max_workers=max(1, args.workers)) as executor:
        futures = {executor.submit(reproject_one, job): job for job in jobs}
        for index, future in enumerate(as_completed(futures), start=1):
            entry, error = future.result()
            if entry:
                entries.append(entry)
            else:
                job = futures[future]
                failures.append({"dataset_id": job.dataset_id, "error": error or "unknown"})
            if index % 50 == 0 or index == len(futures):
                print(f"  {index}/{len(futures)}", flush=True)

    output_root = args.output_root.expanduser().resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    # If force is false, preserve index entries for existing map.png files.
    if not args.force:
        index_path = output_root / "index.json"
        if index_path.is_file():
            try:
                existing = json.loads(index_path.read_text(encoding="utf-8"))
                for entry in existing.get("layers", []):
                    if entry not in entries:
                        entries.append(entry)
            except (OSError, json.JSONDecodeError):
                pass
    entries.sort(key=lambda entry: entry["dataset_id"])
    index = {
        "schema_version": 1,
        "generated_at": datetime.now(UTC).replace(microsecond=0).isoformat(),
        "artifact_root": ".",
        "map_crs": "EPSG:3857",
        "layer_count": len(entries),
        "failure_count": len(failures),
        "layers": entries,
        "failures": failures[:100],
    }
    (output_root / "index.json").write_text(
        json.dumps(index, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(
        f"wrote {output_root / 'index.json'} "
        f"({len(entries)} layers, {len(failures)} failures)",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
