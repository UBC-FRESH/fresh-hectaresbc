"""Zoom-dependent raster tiles from recovered HectaresBC source rasters.

The source rasters are 100 m (1 ha) BC Albers GeoTIFFs, usually tiled 64×64
inside the recovered ZIP payloads. This module renders 256×256 Web-Mercator
tiles on demand so MapLibre can request only the tiles visible at the current
zoom/pan instead of drawing one flattened preview image.

At z0–8 the renderer serves tiles from the already-generated 2048 px EPSG:3857
map overlay, which avoids reopening the multi-hundred-megabyte zip:// source
for every low-zoom tile. At z9+ it reads and warps the source raster so the
1-ha cells remain available at high zoom. A bounded process cache keeps source
dataset handles open and serializes reads per handle; metadata lookup opens the
source once, after which high-zoom tile reads are typically tens of milliseconds.
"""

from __future__ import annotations

import json
import math
import os
import re
import tempfile
import threading
import time
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

import mercantile
import numpy as np
import rasterio
from PIL import Image
from rasterio.enums import Resampling
from rasterio.transform import from_bounds
from rasterio.vrt import WarpedVRT
from rasterio.warp import transform as warp_transform
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
# Low zooms are served from the 2048 px EPSG:3857 overlays; high zooms use the
# source raster. z8 is roughly the overlay's native resolution over BC.
OVERLAY_MAX_ZOOM = 8
DEFAULT_TILE_CACHE_MAX_BYTES = 4 * 1024**3
_MERCATOR_ROOT = REPO_ROOT / "web" / "data" / "map_previews_3857"
_MERCATOR_INDEX: dict[str, dict[str, Any]] | None = None
_MERCATOR_INDEX_LOCK = threading.Lock()
_COG_ROOT = REPO_ROOT / "var" / "tile-cogs"
_DATASET_ID_RE = re.compile(r"^[0-9A-Za-z_-]+$")
_TILE_WRITE_COUNT = 0
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
_USAGE_LOCK = threading.Lock()
_USAGE_TOTALS: dict[str, Any] = {
    "requests": 0,
    "cache_hits": 0,
    "cache_misses": 0,
    "errors": 0,
    "latency_ms_total": 0.0,
    "latency_ms_max": 0.0,
    "sources": {},
}
_USAGE_DATASETS: dict[str, dict[str, Any]] = {}


def reset_tile_usage_stats() -> None:
    with _USAGE_LOCK:
        _USAGE_TOTALS.update(
            {
                "requests": 0,
                "cache_hits": 0,
                "cache_misses": 0,
                "errors": 0,
                "latency_ms_total": 0.0,
                "latency_ms_max": 0.0,
                "sources": {},
            }
        )
        _USAGE_DATASETS.clear()


def _record_tile_usage(
    dataset_id: str,
    *,
    latency_ms: float,
    source: str,
    cache_hit: bool,
    error: bool,
) -> None:
    with _USAGE_LOCK:
        totals = _USAGE_TOTALS
        totals["requests"] += 1
        if cache_hit:
            totals["cache_hits"] += 1
        else:
            totals["cache_misses"] += 1
        if error:
            totals["errors"] += 1
        totals["latency_ms_total"] += latency_ms
        totals["latency_ms_max"] = max(totals["latency_ms_max"], latency_ms)
        source_counts = totals["sources"]
        source_counts[source] = source_counts.get(source, 0) + 1

        entry = _USAGE_DATASETS.setdefault(
            dataset_id,
            {
                "dataset_id": dataset_id,
                "requests": 0,
                "cache_hits": 0,
                "cache_misses": 0,
                "errors": 0,
                "latency_ms_total": 0.0,
                "latency_ms_max": 0.0,
                "sources": {},
                "last_utc": None,
            },
        )
        entry["requests"] += 1
        if cache_hit:
            entry["cache_hits"] += 1
        else:
            entry["cache_misses"] += 1
        if error:
            entry["errors"] += 1
        entry["latency_ms_total"] += latency_ms
        entry["latency_ms_max"] = max(entry["latency_ms_max"], latency_ms)
        entry_sources = entry["sources"]
        entry_sources[source] = entry_sources.get(source, 0) + 1
        entry["last_utc"] = datetime.now(UTC).isoformat()


def tile_usage_stats(top: int = 20) -> dict[str, Any]:
    """Return process-lifetime tile usage and cache statistics."""

    with _USAGE_LOCK:
        totals = dict(_USAGE_TOTALS)
        totals["sources"] = dict(_USAGE_TOTALS["sources"])
        requests = int(totals["requests"])
        totals["cache_hit_rate"] = (
            round(totals["cache_hits"] / requests, 4) if requests else 0.0
        )
        totals["avg_latency_ms"] = (
            round(totals["latency_ms_total"] / requests, 2) if requests else 0.0
        )
        totals["latency_ms_total"] = round(totals["latency_ms_total"], 2)
        totals["latency_ms_max"] = round(totals["latency_ms_max"], 2)
        datasets = []
        for entry in _USAGE_DATASETS.values():
            item = dict(entry)
            item["sources"] = dict(entry["sources"])
            item_requests = int(item["requests"])
            item["cache_hit_rate"] = (
                round(item["cache_hits"] / item_requests, 4) if item_requests else 0.0
            )
            item["avg_latency_ms"] = (
                round(item["latency_ms_total"] / item_requests, 2)
                if item_requests
                else 0.0
            )
            item["latency_ms_total"] = round(item["latency_ms_total"], 2)
            item["latency_ms_max"] = round(item["latency_ms_max"], 2)
            datasets.append(item)
        datasets.sort(key=lambda item: item["requests"], reverse=True)
        return {
            "since": "process_start",
            "totals": totals,
            "top_datasets": datasets[: max(0, int(top))],
        }



class TileError(RuntimeError):
    """Raised when a tile cannot be rendered."""


def configure_tile_cog_root(root: str | Path) -> None:
    global _COG_ROOT
    _COG_ROOT = Path(root).expanduser().resolve()


def _cog_path(dataset_id: str) -> Path | None:
    if not _DATASET_ID_RE.fullmatch(dataset_id):
        return None
    path = _COG_ROOT / f"{dataset_id}.tif"
    return path if path.is_file() else None


def _raster_vfs(dataset_id: str, zip_path: Path, member: str) -> str:
    cog_path = _cog_path(dataset_id)
    if cog_path is not None:
        return str(cog_path)
    return f"zip://{zip_path}!{member}"


def _manifest_path(dataset_id: str) -> Path | None:
    for root in (HIGHRES_ROOT, PUBLISHED_ROOT):
        path = root / "layers" / dataset_id / "manifest.json"
        if path.is_file():
            return path
    return None


@lru_cache(maxsize=512)
def _read_manifest(dataset_id: str) -> dict[str, Any]:
    path = _manifest_path(dataset_id)
    if path is None:
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


@lru_cache(maxsize=256)
def _record(dataset_id: str) -> Any:
    return HectaresBC().get(dataset_id)


@lru_cache(maxsize=256)
def _source_paths(
    dataset_id: str, archive_key: str
) -> tuple[str, str, str]:
    record = _record(dataset_id)
    if record is None:
        raise TileError(f"Unknown dataset ID {dataset_id!r}.")
    archive = Path(archive_key).expanduser() if archive_key else None
    zip_path, resolution = resolve_source_zip(record, archive)
    member = pick_raster_member(zip_path, record)
    return str(zip_path), member, resolution


_SOURCE_CACHE_MAX = 128
_SOURCE_CACHE: dict[str, tuple[Any, threading.Lock]] = {}
_SOURCE_CACHE_LOCK = threading.Lock()


def _source_handle(vfs: str) -> tuple[Any, threading.Lock, bool]:
    """Return an open source handle, a per-handle lock, and cache status.

    Source handles are expensive to open from ``zip://``. Keeping a bounded
    number of handles avoids reopening the ZIP for every tile. The per-handle
    lock serializes rasterio reads because GDAL dataset objects are not safe to
    use concurrently from multiple threads.
    """

    with _SOURCE_CACHE_LOCK:
        cached = _SOURCE_CACHE.get(vfs)
        if cached is not None:
            return cached[0], cached[1], True

    source = rasterio.open(vfs)
    handle_lock = threading.Lock()
    with _SOURCE_CACHE_LOCK:
        existing = _SOURCE_CACHE.get(vfs)
        if existing is not None:
            source.close()
            return existing[0], existing[1], True
        if len(_SOURCE_CACHE) < _SOURCE_CACHE_MAX:
            _SOURCE_CACHE[vfs] = (source, handle_lock)
            return source, handle_lock, True
    return source, handle_lock, False


def clear_source_cache() -> None:
    with _SOURCE_CACHE_LOCK:
        for source, _handle_lock in _SOURCE_CACHE.values():
            try:
                source.close()
            except Exception:  # noqa: BLE001 - best-effort cache cleanup
                pass
        _SOURCE_CACHE.clear()


def _max_zoom(pixel_size_m: float) -> int:
    # 100 m source cells are fully resolved by z12/13; deeper zoom over-samples
    # the same 1-ha cells. MapLibre can overzoom the last tile.
    if pixel_size_m >= 80:
        return 13
    if pixel_size_m >= 20:
        return 14
    return 15


def _source(dataset_id: str, archive_root: str | Path | None) -> tuple[Any, Path, str, str, dict[str, Any]]:
    record = _record(dataset_id)
    if record is None:
        raise TileError(f"Unknown dataset ID {dataset_id!r}.")
    archive_key = str(Path(archive_root).expanduser()) if archive_root else ""
    zip_path, member, resolution = _source_paths(dataset_id, archive_key)
    manifest = _read_manifest(dataset_id)
    return record, Path(zip_path), member, resolution, manifest


def layer_metadata(
    dataset_id: str,
    *,
    archive_root: str | Path | None = None,
) -> dict[str, Any]:
    """Return MapLibre raster-source metadata for one layer."""

    record, zip_path, member, resolution, manifest = _source(dataset_id, archive_root)
    vfs = _raster_vfs(dataset_id, zip_path, member)
    source = None
    cached = False
    try:
        source, source_lock, cached = _source_handle(vfs)
        with source_lock:
            if source.crs is None:
                raise TileError(f"{dataset_id} source raster has no CRS.")
            pixel_size = abs(float(source.transform.a))
            bounds_wgs84 = transform_bounds(
                source.crs, "EPSG:4326", *source.bounds, densify_pts=21
            )
            max_zoom = _max_zoom(pixel_size)
            value_classes = manifest.get("value_classes") or []
            return {
                "status": "ok",
                "dataset_id": dataset_id,
                "title": record.title_candidate or record.source_stem,
                "source_zip_path": record.source_zip_path,
                "source_resolution": resolution,
                "source_raster": "cog" if _cog_path(dataset_id) else "zip",
                "crs": str(source.crs),
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
    finally:
        if source is not None and not cached:
            source.close()


def _stats_for(dataset_id: str, vfs: str) -> tuple[float, float]:
    with _STATS_LOCK:
        cached = _STATS.get(dataset_id)
    if cached is not None:
        return cached
    source, source_lock, handle_cached = _source_handle(vfs)
    try:
        with source_lock:
            sample = source.read(
                1,
                out_shape=(min(512, source.height), min(512, source.width)),
                masked=True,
                resampling=Resampling.nearest,
            )
            values = np.asarray(sample.compressed(), dtype=float)
    finally:
        if not handle_cached:
            source.close()
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


def prune_tile_cache(
    cache_root: str | Path,
    *,
    max_bytes: int = DEFAULT_TILE_CACHE_MAX_BYTES,
) -> dict[str, int]:
    """Delete least-recently-used tile files until the cache is under budget."""

    root = Path(cache_root).expanduser().resolve()
    if not root.is_dir():
        return {"files": 0, "bytes": 0, "removed": 0}
    files: list[Path] = []
    total = 0
    for path in root.rglob("*.png"):
        try:
            total += path.stat().st_size
            files.append(path)
        except OSError:
            continue
    removed = 0
    if total > max_bytes:
        files.sort(key=lambda path: path.stat().st_mtime)
        for path in files:
            if total <= max_bytes:
                break
            try:
                size = path.stat().st_size
                path.unlink()
                total -= size
                removed += 1
            except OSError:
                continue
    return {"files": len(files) - removed, "bytes": total, "removed": removed}


def _transparent_png() -> bytes:
    buffer = tempfile.SpooledTemporaryFile()
    Image.new("RGBA", (TILE_SIZE, TILE_SIZE), (0, 0, 0, 0)).save(buffer, "PNG")
    buffer.seek(0)
    return buffer.read()


def _mercator_layers() -> dict[str, dict[str, Any]]:
    global _MERCATOR_INDEX
    with _MERCATOR_INDEX_LOCK:
        if _MERCATOR_INDEX is not None:
            return _MERCATOR_INDEX
        layers: dict[str, dict[str, Any]] = {}
        try:
            document = json.loads(
                (_MERCATOR_ROOT / "index.json").read_text(encoding="utf-8")
            )
        except (OSError, json.JSONDecodeError):
            document = {}
        for layer in document.get("layers", []):
            dataset_id = layer.get("dataset_id")
            if (
                isinstance(dataset_id, str)
                and layer.get("map_path")
                and layer.get("map_bounds_3857")
            ):
                layers[dataset_id] = layer
        _MERCATOR_INDEX = layers
        return layers


def _overlay_tile(dataset_id: str, z: int, x: int, y: int) -> bytes | None:
    """Render a low-zoom tile from the existing EPSG:3857 map overlay."""

    if z > OVERLAY_MAX_ZOOM:
        return None
    layer = _mercator_layers().get(dataset_id)
    if not layer:
        return None
    image_path = _MERCATOR_ROOT / str(layer["map_path"])
    try:
        image = Image.open(image_path).convert("RGBA")
        image.load()
    except (OSError, ValueError):
        return None

    bounds = layer["map_bounds_3857"]
    if not isinstance(bounds, list) or len(bounds) != 4:
        return None
    west, south, east, north = (float(value) for value in bounds)
    if east <= west or north <= south:
        return None
    tile = mercantile.xy_bounds(x, y, z)
    if tile.right <= west or tile.left >= east or tile.top <= south or tile.bottom >= north:
        return _transparent_png()

    width, height = image.size
    px0 = (tile.left - west) / (east - west) * width
    px1 = (tile.right - west) / (east - west) * width
    py0 = (north - tile.top) / (north - south) * height
    py1 = (north - tile.bottom) / (north - south) * height
    cx0 = max(0.0, px0)
    cy0 = max(0.0, py0)
    cx1 = min(float(width), px1)
    cy1 = min(float(height), py1)
    if cx1 <= cx0 or cy1 <= cy0:
        return _transparent_png()

    left = int(math.floor(cx0))
    top = int(math.floor(cy0))
    right = int(math.ceil(cx1))
    bottom = int(math.ceil(cy1))
    if right <= left or bottom <= top:
        return _transparent_png()
    crop = image.crop((left, top, right, bottom))

    def destination(value: float, start: float, end: float) -> int:
        return int(round((value - start) / (end - start) * TILE_SIZE))

    dx0 = max(0, min(TILE_SIZE, destination(left, px0, px1)))
    dy0 = max(0, min(TILE_SIZE, destination(top, py0, py1)))
    dx1 = max(0, min(TILE_SIZE, destination(right, px0, px1)))
    dy1 = max(0, min(TILE_SIZE, destination(bottom, py0, py1)))
    if dx1 <= dx0 or dy1 <= dy0:
        return _transparent_png()
    resized = crop.resize((dx1 - dx0, dy1 - dy0), Image.Resampling.BILINEAR)
    tile_image = Image.new("RGBA", (TILE_SIZE, TILE_SIZE), (0, 0, 0, 0))
    tile_image.alpha_composite(resized, (dx0, dy0))
    buffer = tempfile.SpooledTemporaryFile()
    tile_image.save(buffer, "PNG", compress_level=6)
    buffer.seek(0)
    return buffer.read()


def _write_tile_cache(
    cache_path: Path,
    png: bytes,
    *,
    cache_root: str | Path,
    cache_max_bytes: int,
) -> None:
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = cache_path.with_suffix(f".{os.getpid()}.{threading.get_ident()}.tmp")
    with _TILE_LOCK:
        temp_path.write_bytes(png)
        temp_path.replace(cache_path)
        global _TILE_WRITE_COUNT
        _TILE_WRITE_COUNT += 1
        if _TILE_WRITE_COUNT % 200 == 0:
            prune_tile_cache(cache_root, max_bytes=cache_max_bytes)


def _render_tile_impl(
    dataset_id: str,
    z: int,
    x: int,
    y: int,
    *,
    archive_root: str | Path | None = None,
    cache_root: str | Path | None = None,
    cache_max_bytes: int = DEFAULT_TILE_CACHE_MAX_BYTES,
) -> tuple[bytes, str]:
    """Render one tile and return ``(png, source_kind)``."""

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
            return cache_path.read_bytes(), "cache"
        try:
            overlay = _overlay_tile(dataset_id, z, x, y)
        except (OSError, ValueError):
            overlay = None
        if overlay is not None:
            _write_tile_cache(
                cache_path,
                overlay,
                cache_root=Path(cache_root).expanduser().resolve(),
                cache_max_bytes=cache_max_bytes,
            )
            return overlay, "overlay"

    source_kind = "cog" if _cog_path(dataset_id) else "zip"
    record, zip_path, member, resolution, manifest = _source(dataset_id, archive_root)
    vfs = _raster_vfs(dataset_id, zip_path, member)
    classes = manifest.get("value_classes") or []
    categorical = bool(classes)
    resampling = Resampling.nearest if categorical else Resampling.bilinear
    stats = (0.0, 1.0) if categorical else _stats_for(dataset_id, vfs)
    tile_bounds = mercantile.xy_bounds(x, y, z)
    nodata_value = None
    source = None
    handle_cached = False
    try:
        source, source_lock, handle_cached = _source_handle(vfs)
        with source_lock:
            nodata_value = source.nodata
            with WarpedVRT(
                source,
                crs=WEB_MERCATOR,
                resampling=resampling,
                src_nodata=source.nodata,
                nodata=source.nodata,
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
    finally:
        if source is not None and not handle_cached:
            source.close()

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
        _write_tile_cache(
            cache_path,
            png,
            cache_root=Path(cache_root).expanduser().resolve(),
            cache_max_bytes=cache_max_bytes,
        )
    return png, source_kind


def render_tile(
    dataset_id: str,
    z: int,
    x: int,
    y: int,
    *,
    archive_root: str | Path | None = None,
    cache_root: str | Path | None = None,
    cache_max_bytes: int = DEFAULT_TILE_CACHE_MAX_BYTES,
) -> bytes:
    """Render one Web-Mercator PNG tile and record usage statistics."""

    started = time.perf_counter()
    try:
        png, source_kind = _render_tile_impl(
            dataset_id,
            z,
            x,
            y,
            archive_root=archive_root,
            cache_root=cache_root,
            cache_max_bytes=cache_max_bytes,
        )
    except Exception:
        _record_tile_usage(
            dataset_id,
            latency_ms=(time.perf_counter() - started) * 1000,
            source="error",
            cache_hit=False,
            error=True,
        )
        raise
    _record_tile_usage(
        dataset_id,
        latency_ms=(time.perf_counter() - started) * 1000,
        source=source_kind,
        cache_hit=source_kind == "cache",
        error=False,
    )
    return png


def _class_for_value(classes: list[dict[str, Any]], value: Any) -> dict[str, Any] | None:
    for item in classes:
        if not isinstance(item, dict):
            continue
        if "value_min" in item and "value_max" in item:
            try:
                if float(item["value_min"]) <= float(value) <= float(item["value_max"]):
                    return item
            except (TypeError, ValueError):
                continue
        elif "value" in item:
            try:
                if float(item["value"]) == float(value):
                    return item
            except (TypeError, ValueError):
                continue
    return None


def identify_pixel(
    dataset_id: str,
    lon: float,
    lat: float,
    *,
    archive_root: str | Path | None = None,
) -> dict[str, Any]:
    """Read the source raster value and legend class at a WGS84 point."""

    record, zip_path, member, resolution, manifest = _source(dataset_id, archive_root)
    vfs = _raster_vfs(dataset_id, zip_path, member)
    source = None
    handle_cached = False
    try:
        source, source_lock, handle_cached = _source_handle(vfs)
        with source_lock:
            if source.crs is None:
                raise TileError(f"{dataset_id} source raster has no CRS.")
            xs, ys = warp_transform("EPSG:4326", source.crs, [lon], [lat])
            x, y = float(xs[0]), float(ys[0])
            bounds = source.bounds
            result = {
                "status": "ok",
                "dataset_id": dataset_id,
                "title": record.title_candidate or record.source_stem,
                "lon": lon,
                "lat": lat,
                "crs": str(source.crs),
                "pixel_size_m": abs(float(source.transform.a)),
                "source_resolution": resolution,
                "source_raster": "cog" if _cog_path(dataset_id) else "zip",
            }
            if not (
                bounds.left <= x < bounds.right and bounds.bottom <= y < bounds.top
            ):
                result["status"] = "outside"
                return result
            row, col = source.index(x, y)
            if row < 0 or col < 0 or row >= source.height or col >= source.width:
                result["status"] = "outside"
                return result
            data = source.read(
                1,
                window=rasterio.windows.Window(col, row, 1, 1),
                masked=True,
            )
            raw = data[0, 0]
            if np.ma.is_masked(raw):
                result["status"] = "nodata"
                return result
            value = raw.item()
            if source.nodata is not None and float(value) == float(source.nodata):
                result["status"] = "nodata"
                return result
            if isinstance(value, np.integer):
                value = int(value)
            else:
                value = float(value)
            classes = manifest.get("value_classes") or []
            item = _class_for_value(classes, value)
            result.update(
                {
                    "value": value,
                    "label": item.get("label") if item else None,
                    "categorical": bool(classes),
                    "color": (item.get("rgba") or item.get("rgb")) if item else None,
                }
            )
            return result
    except (rasterio.errors.RasterioError, ValueError) as exc:
        raise TileError(
            f"Could not identify {dataset_id} at {lon},{lat}: {exc}"
        ) from exc
    finally:
        if source is not None and not handle_cached:
            source.close()
