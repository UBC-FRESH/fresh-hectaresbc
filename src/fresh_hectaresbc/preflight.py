"""Advisory bundle preflight estimates from AOI and source metadata."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from rasterio.warp import transform_bounds

from fresh_hectaresbc import HectaresBC
from fresh_hectaresbc.aoi import AoiGeometryError, inspect_aoi_geometry
from fresh_hectaresbc.clip import pick_raster_member, resolve_source_zip

DEFAULT_MAX_LAYERS = 6
DEFAULT_MAX_AREA_HA = 10_000_000.0


class PreflightError(RuntimeError):
    """Raised when an estimate cannot be produced safely."""


def _layer_estimate(
    record: Any,
    *,
    bbox_wgs84: list[float],
    archive_root: str | Path | None,
) -> dict[str, Any]:
    dataset_id = record.dataset_id
    try:
        zip_path, resolution = resolve_source_zip(record, archive_root)
        member = pick_raster_member(zip_path, record)
        vfs = f"zip://{zip_path}!{member}"
        with rasterio.open(vfs) as source:
            if source.crs is None:
                raise ValueError("source raster has no CRS")
            left, bottom, right, top = transform_bounds(
                "EPSG:4326", source.crs, *bbox_wgs84, densify_pts=21
            )
            source_bounds = source.bounds
            west = max(left, source_bounds.left)
            east = min(right, source_bounds.right)
            south = max(bottom, source_bounds.bottom)
            north = min(top, source_bounds.top)
            if west >= east or south >= north:
                return {
                    "dataset_id": dataset_id,
                    "title": record.title_candidate or record.source_stem,
                    "status": "outside",
                    "width": 0,
                    "height": 0,
                    "pixels": 0,
                    "estimated_bytes": 0,
                    "estimated_seconds": 0,
                    "message": "AOI does not intersect this source raster.",
                }
            resolution_x = abs(float(source.transform.a))
            resolution_y = abs(float(source.transform.e))
            width = max(1, int(np.ceil((east - west) / resolution_x)))
            height = max(1, int(np.ceil((north - south) / resolution_y)))
            pixels = width * height
            itemsize = np.dtype(source.dtypes[0]).itemsize
            estimated_bytes = pixels * itemsize
            estimated_seconds = round(0.5 + pixels / 5_000_000.0, 2)
            return {
                "dataset_id": dataset_id,
                "title": record.title_candidate or record.source_stem,
                "status": "ok",
                "width": width,
                "height": height,
                "pixels": pixels,
                "estimated_bytes": estimated_bytes,
                "estimated_seconds": estimated_seconds,
                "source_resolution": resolution,
                "crs": str(source.crs),
            }
    except Exception as exc:  # noqa: BLE001 - report per-layer availability
        return {
            "dataset_id": dataset_id,
            "title": record.title_candidate or record.source_stem,
            "status": "unavailable",
            "width": 0,
            "height": 0,
            "pixels": 0,
            "estimated_bytes": 0,
            "estimated_seconds": 0,
            "message": str(exc),
        }


def estimate_bundle(
    *,
    layer_ids: list[str],
    aoi_geometry: dict[str, Any],
    archive_root: str | Path | None = None,
    max_layers: int = DEFAULT_MAX_LAYERS,
    max_area_ha: float = DEFAULT_MAX_AREA_HA,
) -> dict[str, Any]:
    """Return advisory pixel/size/time estimates without clipping pixels."""

    unique_layers = list(
        dict.fromkeys(str(layer).strip() for layer in layer_ids if layer)
    )
    if not unique_layers:
        raise PreflightError("Select at least one raster layer.")
    if len(unique_layers) > max_layers:
        raise PreflightError(
            f"Select at most {max_layers} layers; requested {len(unique_layers)}."
        )
    try:
        aoi = inspect_aoi_geometry(aoi_geometry, max_area_ha=max_area_ha)
    except AoiGeometryError as exc:
        raise PreflightError(str(exc)) from exc
    hbc = HectaresBC()
    layers = []
    for dataset_id in unique_layers:
        record = hbc.get(dataset_id)
        if record is None:
            raise PreflightError(f"Unknown dataset ID {dataset_id!r}.")
        layers.append(
            _layer_estimate(
                record,
                bbox_wgs84=aoi["bbox_wgs84"],
                archive_root=archive_root,
            )
        )
    total_pixels = sum(int(layer["pixels"]) for layer in layers)
    total_bytes = sum(int(layer["estimated_bytes"]) for layer in layers)
    total_seconds = round(sum(float(layer["estimated_seconds"]) for layer in layers), 2)
    return {
        "status": "ok",
        "aoi": {
            "area_ha": aoi["area_ha"],
            "bbox_wgs84": aoi["bbox_wgs84"],
        },
        "layers": layers,
        "total_pixels": total_pixels,
        "total_estimated_bytes": total_bytes,
        "estimated_seconds": total_seconds,
        "max_layers": max_layers,
        "max_area_ha": max_area_ha,
        "caveat": (
            "Advisory estimate based on AOI/source bounds and source dtype; "
            "compression and clipping overhead vary."
        ),
    }
