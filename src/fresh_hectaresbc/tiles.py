"""Zoom-dependent raster tiles from recovered HectaresBC source rasters.

The source rasters are 100 m (1 ha) BC Albers GeoTIFFs, usually tiled 64×64
inside the recovered ZIP payloads. This module renders 256×256 Web-Mercator
tiles on demand so MapLibre can request only the tiles visible at the current
zoom/pan instead of drawing one flattened preview image.
"""

from __future__ import annotations

import json
import math
import os
import tempfile
import threading
from pathlib import Path
from typing import Any

import mercantile
import numpy as np
import rasterio
from PIL import Image
from rasterio.enums import Resampling
from rasterio.transform import from_bounds
from rasterio.vrt import WarpedVRT
from rasterio.warp import transform_bounds

from fresh_hectaresbc import HectaresBC
from fresh_hectaresbc.clip import pick_raster_member, resolve_source_zip

REPO_ROOT = Path(__file__).resolve().parents[2]
HIGHRES_ROOT = REPO_ROOT / "web" / "data" / "map_previews_highres" / "v1"
PUBLISHED_ROOT = (
    REPO_ROOT
    / "external"
    / "fresh-hectaresbc-data"
    / "derived"
    / "web_map_previews"
    / "v1"
)
TILE_SIZE = 256
WEB_MERCATOR = "EPSG:3857"
PALETTE = (
    (20, 81, 117, 230),
    (219, 94, 47, 230),
    (64, 145, 108, 230),
    (123, 82, 171, 230),
    (208, 162, 49, 230),
    (37, 128, 171, 230),
    (173, 72, 112, 230),
    (85, 154, 54, 230),
    (116, 94, 62, 230),
    (71, 111, 191, 230),
    (183, 111, 43, 230),
    (45, 147, 145, 230),
)
_STATS: dict[str, tuple[float, float]] = {}
_STATS_LOCK = threading.Lock()
_TILE_LOCK = threading.Lock()


class TileError(RuntimeError):
    """Raised when a tile cannot be rendered."""


def _manifest_path(dataset_id: str) -> Path | None:
    for root in (HIGHRES_ROOT, PUBLISHED_ROOT):
        path = root / "layers" / dataset_id / "manifest.json"
        if path.is_file():
            return path
    return None


def _read_manifest(dataset_id: str) -> dict[str, Any]:
    path = _manifest_path(dataset_id)
    if path is None:
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _max_zoom(pixel_size_m: float) -> int:
    # 100 m source cells are fully resolved by z12/13; deeper zoom over-samples
    # the same 1-ha cells. MapLibre can overzoom the last tile.
    if pixel_size_m >= 80:
        return 13
    if pixel_size_m >= 20:
        return 14
    return 15


def _source(dataset_id: str, archive_root: str | Path | None) -> tuple[Any, Path, str, str, dict[str, Any]]:
    record = HectaresBC().get(dataset_id)
    if record is None:
        raise TileError(f"Unknown dataset ID {dataset_id!r}.")
    archive = Path(archive_root).expanduser() if archive_root else None
    zip_path, resolution = resolve_source_zip(record, archive)
    member = pick_raster_member(zip_path, record)
    manifest = _read_manifest(dataset_id)
    return record, zip_path, member, resolution, manifest


def layer_metadata(
    dataset_id: str,
    *,
    archive_root: str | Path | None = None,
) -> dict[str, Any]:
    """Return MapLibre raster-source metadata for one layer."""

    record, zip_path, member, resolution, manifest = _source(dataset_id, archive_root)
    vfs = f"zip://{zip_path}!{member}"
    try:
        with rasterio.open(vfs) as src:
            if src.crs is None:
                raise TileError(f"{dataset_id} source raster has no CRS.")
            pixel_size = abs(float(src.transform.a))
            bounds_wgs84 = transform_bounds(
                src.crs, "EPSG:4326", *src.bounds, densify_pts=21
            )
            max_zoom = _max_zoom(pixel_size)
            value_classes = manifest.get("value_classes") or []
            return {
                "status": "ok",
                "dataset_id": dataset_id,
                "title": record.title_candidate or record.source_stem,
                "source_zip_path": record.source_zip_path,
                "source_resolution": resolution,
                "crs": str(src.crs),
                "tile_crs": WEB_MERCATOR,
                "tile_size": TILE_SIZE,
                "minzoom": 0,
                "maxzoom": max_zoom,
                "pixel_size_m": pixel_size,
                "max_detail": (
                    "1 ha (100 m)" if 80 <= pixel_size < 120 else f"{pixel_size:g} m"
                ),
                "bounds_wgs84": [float(value) for value in bounds_wgs84],
                "bounds_3857": [
                    float(value)
                    for value in transform_bounds(
                        "EPSG:4326", WEB_MERCATOR, *bounds_wgs84, densify_pts=21
                    )
                ],
                "categorical": bool(value_classes),
                "value_classes": value_classes,
                "tile_url": f"/api/tiles/{dataset_id}/{{z}}/{{x}}/{{y}}.png",
                "source": "highres" if (HIGHRES_ROOT / "layers" / dataset_id).is_dir() else "published",
            }
    except rasterio.errors.RasterioError as exc:
        raise TileError(f"Could not open source raster for {dataset_id}: {exc}") from exc


def _stats_for(dataset_id: str, vfs: str) -> tuple[float, float]:
    with _STATS_LOCK:
        cached = _STATS.get(dataset_id)
    if cached is not None:
        return cached
    with rasterio.open(vfs) as src:
        sample = src.read(
            1,
            out_shape=(min(512, src.height), min(512, src.width)),
            masked=True,
            resampling=Resampling.nearest,
        )
        values = np.asarray(sample.compressed(), dtype=float)
    if values.size == 0:
        stats = (0.0, 1.0)
    else:
        low = float(np.min(values))
        high = float(np.max(values))
        stats = (low, high if high > low else low + 1.0)
    with _STATS_LOCK:
        _STATS[dataset_id] = stats
    return stats


def _rgba_from_values(
    data: np.ndarray,
    mask: np.ndarray,
    *,
    classes: list[dict[str, Any]],
    stats: tuple[float, float],
) -> np.ndarray:
    valid = ~mask
    rgba = np.zeros((data.shape[0], data.shape[1], 4), dtype=np.uint8)
    if not valid.any():
        return rgba

    if classes:
        for item in classes:
            if "value_min" in item and "value_max" in item:
                selected = (
                    (data >= item["value_min"])
                    & (data <= item["value_max"])
                    & valid
                )
            else:
                selected = (data == item["value"]) & valid
            rgba[selected] = item.get("rgba") or [*item["rgb"], 220]
        uncovered = valid & (rgba[:, :, 3] == 0)
        if uncovered.any():
            remaining = np.unique(data[uncovered])
            for index, value in enumerate(remaining[: len(PALETTE)]):
                color = PALETTE[index]
                if float(value) == 0.0:
                    color = (177, 185, 178, 48)
                rgba[(data == value) & uncovered] = color
        return rgba

    low, high = stats
    normalized = np.clip((data.astype(float) - low) / (high - low), 0, 1)
    rgba[valid, 0] = (32 + normalized[valid] * 201).astype(np.uint8)
    rgba[valid, 1] = (78 + normalized[valid] * 139).astype(np.uint8)
    rgba[valid, 2] = (111 - normalized[valid] * 63).astype(np.uint8)
    rgba[valid, 3] = 220
    return rgba


def _transparent_png() -> bytes:
    buffer = tempfile.SpooledTemporaryFile()
    Image.new("RGBA", (TILE_SIZE, TILE_SIZE), (0, 0, 0, 0)).save(buffer, "PNG")
    buffer.seek(0)
    return buffer.read()


def render_tile(
    dataset_id: str,
    z: int,
    x: int,
    y: int,
    *,
    archive_root: str | Path | None = None,
    cache_root: str | Path | None = None,
) -> bytes:
    """Render one Web-Mercator PNG tile from the recovered source raster."""

    if z < 0 or z > 15:
        raise TileError("Tile zoom must be between 0 and 15.")
    limit = 1 << z
    if x < 0 or y < 0 or x >= limit or y >= limit:
        raise TileError("Tile coordinates are outside the zoom grid.")

    cache_path = None
    if cache_root:
        cache_path = (
            Path(cache_root).expanduser().resolve()
            / dataset_id
            / str(z)
            / str(x)
            / f"{y}.png"
        )
        if cache_path.is_file():
            return cache_path.read_bytes()

    record, zip_path, member, resolution, manifest = _source(dataset_id, archive_root)
    vfs = f"zip://{zip_path}!{member}"
    classes = manifest.get("value_classes") or []
    categorical = bool(classes)
    resampling = Resampling.nearest if categorical else Resampling.bilinear
    stats = (0.0, 1.0) if categorical else _stats_for(dataset_id, vfs)
    tile_bounds = mercantile.xy_bounds(x, y, z)
    nodata_value = None
    try:
        with rasterio.open(vfs) as src:
            nodata_value = src.nodata
            with WarpedVRT(
                src,
                crs=WEB_MERCATOR,
                resampling=resampling,
                src_nodata=src.nodata,
                nodata=src.nodata,
                boundless=True,
            ) as vrt:
                window = rasterio.windows.from_bounds(
                    tile_bounds.left,
                    tile_bounds.bottom,
                    tile_bounds.right,
                    tile_bounds.top,
                    transform=vrt.transform,
                )
                data = vrt.read(
                    1,
                    window=window,
                    out_shape=(TILE_SIZE, TILE_SIZE),
                    masked=True,
                    resampling=resampling,
                )
    except (rasterio.errors.RasterioError, ValueError) as exc:
        raise TileError(f"Could not render tile {dataset_id}/{z}/{x}/{y}: {exc}") from exc

    values = np.asarray(data.filled(nodata_value if nodata_value is not None else 0))
    mask = np.ma.getmaskarray(data)
    rgba = _rgba_from_values(values, mask, classes=classes, stats=stats)
    if not (rgba[:, :, 3] > 0).any():
        png = _transparent_png()
    else:
        buffer = tempfile.SpooledTemporaryFile()
        Image.fromarray(rgba, "RGBA").save(buffer, "PNG", optimize=True)
        buffer.seek(0)
        png = buffer.read()

    if cache_path is not None:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = cache_path.with_suffix(f".{os.getpid()}.{threading.get_ident()}.tmp")
        with _TILE_LOCK:
            temp_path.write_bytes(png)
            temp_path.replace(cache_path)
    return png
