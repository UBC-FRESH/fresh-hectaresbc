"""Clip recovered HectaresBC raster layers to a GeoJSON AOI."""

from __future__ import annotations

import json
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fresh_hectaresbc import HectaresBC


class ClipError(RuntimeError):
    """Raised when a recovered raster cannot be clipped to the requested AOI."""


@dataclass(frozen=True)
class ClipResult:
    """One clipped raster result."""

    dataset_id: str
    title: str
    source_zip: str
    raster_member: str
    output_path: Path
    crs: str
    width: int
    height: int
    source_width: int
    source_height: int
    source_bytes: int
    output_bytes: int
    bounds_wgs84: tuple[float, float, float, float]
    dtype: str
    nodata: float | int | None
    source_resolution: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "dataset_id": self.dataset_id,
            "title": self.title,
            "source_zip": self.source_zip,
            "raster_member": self.raster_member,
            "output_path": str(self.output_path),
            "crs": self.crs,
            "width": self.width,
            "height": self.height,
            "source_width": self.source_width,
            "source_height": self.source_height,
            "source_bytes": self.source_bytes,
            "output_bytes": self.output_bytes,
            "bounds_wgs84": list(self.bounds_wgs84),
            "dtype": self.dtype,
            "nodata": self.nodata,
            "source_resolution": self.source_resolution,
        }


def _raster_members(record: Any) -> list[str]:
    raw = record.field("raster_member_paths")
    if not raw:
        return []
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        value = [raw]
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list):
        return []
    members = []
    for item in value:
        text = str(item).strip()
        if text.lower().endswith((".tif", ".tiff")):
            members.append(text)
    return members


def _resolve_zip(record: Any, archive_root: Path | None) -> tuple[Path, str]:
    hbc = HectaresBC()
    resolved = hbc.resolve(record.dataset_id)
    candidate = Path(resolved.absolute_path)
    if candidate.is_file():
        return candidate, "data_repository"
    if archive_root is not None:
        fallback = Path(archive_root).expanduser() / record.source_zip_path
        if fallback.is_file():
            return fallback, "local_archive"
    raise ClipError(
        f"Source ZIP for {record.dataset_id!r} is not available. Fetch the DataLad "
        "payload or pass --archive-root pointing at the recovered HectaresBC archive."
    )


def _pick_member(zip_path: Path, record: Any) -> str:
    members = _raster_members(record)
    with zipfile.ZipFile(zip_path) as archive:
        names = set(archive.namelist())
        for member in members:
            if member in names:
                return member
        matches = sorted(
            name
            for name in names
            if name.lower().endswith((".tif", ".tiff"))
            and not name.lower().endswith((".aux.xml", ".ovr"))
        )
        if not matches:
            raise ClipError(f"No GeoTIFF member found in {zip_path}.")
        return matches[0]


def _extract_member(zip_path: Path, member: str) -> tuple[Path, int]:
    with zipfile.ZipFile(zip_path) as archive:
        info = archive.getinfo(member)
        handle = tempfile.NamedTemporaryFile(suffix=".tif", delete=False)
        temp_path = Path(handle.name)
        handle.close()
        with archive.open(member) as source, temp_path.open("wb") as target:
            while True:
                chunk = source.read(1024 * 1024)
                if not chunk:
                    break
                target.write(chunk)
    return temp_path, info.file_size


def clip_raster_to_aoi(
    dataset_id: str,
    aoi_geojson: str | Path,
    output_dir: str | Path,
    *,
    archive_root: str | Path | None = None,
) -> ClipResult:
    """Clip one catalog raster to the first feature in ``aoi_geojson``."""

    import geopandas as gpd  # type: ignore[import-untyped]
    import numpy as np
    import rasterio  # type: ignore[import-untyped]
    from affine import Affine  # type: ignore[import-untyped]
    from rasterio.features import geometry_mask  # type: ignore[import-untyped]
    from rasterio.warp import transform_bounds  # type: ignore[import-untyped]
    from rasterio.windows import Window, from_bounds  # type: ignore[import-untyped]

    hbc = HectaresBC()
    record = hbc.get(dataset_id)
    if record is None:
        raise ClipError(f"Unknown dataset ID {dataset_id!r}.")

    archive = Path(archive_root).expanduser() if archive_root else None
    zip_path, source_resolution = _resolve_zip(record, archive)
    member = _pick_member(zip_path, record)
    temp_path, source_bytes = _extract_member(zip_path, member)
    output_root = Path(output_dir).expanduser().resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    output_path = output_root / f"{dataset_id}.tif"

    try:
        aoi = gpd.read_file(aoi_geojson)
        if aoi.empty:
            raise ClipError(f"AOI file {aoi_geojson} contains no features.")
        with rasterio.open(temp_path) as src:
            if src.crs is None:
                raise ClipError(f"{dataset_id} raster has no CRS; cannot clip safely.")
            aoi_src = aoi.to_crs(src.crs)
            geometries = [
                geometry
                for geometry in aoi_src.geometry
                if geometry is not None and not geometry.is_empty
            ]
            if not geometries:
                raise ClipError("AOI geometry is empty after reprojection.")
            aoi_bounds = aoi_src.total_bounds
            raw_window = from_bounds(*aoi_bounds, transform=src.transform)
            col_off = max(0, int(raw_window.col_off) - 1)
            row_off = max(0, int(raw_window.row_off) - 1)
            window = Window(
                col_off=col_off,
                row_off=row_off,
                width=max(1, min(src.width - col_off, int(raw_window.width) + 2)),
                height=max(1, min(src.height - row_off, int(raw_window.height) + 2)),
            )
            if window.width < 1 or window.height < 1:
                raise ClipError("AOI does not intersect the source raster extent.")
            data = src.read(window=window)
            window_transform = src.window_transform(window)
            inside = geometry_mask(
                geometries,
                out_shape=(data.shape[1], data.shape[2]),
                transform=window_transform,
                invert=True,
                all_touched=False,
            )
            if not bool(inside.any()):
                raise ClipError("AOI does not intersect source raster pixels.")
            nodata = src.nodata if src.nodata is not None else 0
            data[:, ~inside] = nodata
            rows, cols = np.where(inside)
            row_min, row_max = int(rows.min()), int(rows.max()) + 1
            col_min, col_max = int(cols.min()), int(cols.max()) + 1
            data = data[:, row_min:row_max, col_min:col_max]
            transform = window_transform @ Affine.translation(col_min, row_min)
            profile = src.profile.copy()
            profile.update(
                driver="GTiff",
                height=data.shape[1],
                width=data.shape[2],
                transform=transform,
                count=data.shape[0],
                compress="deflate",
                tiled=True,
                blockxsize=256,
                blockysize=256,
                nodata=nodata,
                BIGTIFF="IF_SAFER",
            )
            if data.dtype.kind in {"i", "u"}:
                profile["predictor"] = 2
            with rasterio.open(output_path, "w", **profile) as dst:
                dst.write(data)
            bounds_wgs84 = transform_bounds(
                src.crs, "EPSG:4326", *mask_bounds(data, transform)
            )
            result = ClipResult(
                dataset_id=dataset_id,
                title=record.title_candidate or record.source_stem,
                source_zip=str(zip_path),
                raster_member=member,
                output_path=output_path,
                crs=str(src.crs),
                width=int(data.shape[2]),
                height=int(data.shape[1]),
                source_width=int(src.width),
                source_height=int(src.height),
                source_bytes=source_bytes,
                output_bytes=output_path.stat().st_size,
                bounds_wgs84=tuple(float(value) for value in bounds_wgs84),
                dtype=str(data.dtype),
                nodata=nodata,
                source_resolution=source_resolution,
            )
    finally:
        temp_path.unlink(missing_ok=True)

    return result


def mask_bounds(data: Any, transform: Any) -> tuple[float, float, float, float]:
    """Return the native-CRS bounds of a masked array."""

    height, width = data.shape[1], data.shape[2]
    left, top = transform @ (0, 0)
    right, bottom = transform @ (width, height)
    return (float(left), float(bottom), float(right), float(top))
