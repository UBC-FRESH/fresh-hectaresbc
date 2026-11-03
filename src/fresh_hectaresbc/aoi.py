"""Validate browser-drawn AOI geometry and inspect its area before clipping."""

from __future__ import annotations

import math
from typing import Any

from pyproj import Transformer
from shapely.geometry import mapping, shape
from shapely.ops import transform as shapely_transform

MAX_COORDINATES = 500_000


class AoiGeometryError(ValueError):
    """Raised when client geometry is malformed or too large."""


def validate_aoi_geometry(geometry: dict[str, Any]) -> Any:
    """Validate a finite Polygon/MultiPolygon and return a shapely geometry."""

    if not isinstance(geometry, dict):
        raise AoiGeometryError("aoi geometry must be a GeoJSON geometry object")
    if geometry.get("type") not in {"Polygon", "MultiPolygon"}:
        raise AoiGeometryError("aoi geometry must be a Polygon or MultiPolygon")
    coordinates = geometry.get("coordinates")
    if not isinstance(coordinates, list):
        raise AoiGeometryError("aoi geometry is missing coordinates")

    count = 0

    def walk(value: Any) -> None:
        nonlocal count
        if isinstance(value, (list, tuple)):
            for item in value:
                walk(item)
            return
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            if not math.isfinite(float(value)):
                raise AoiGeometryError("aoi geometry contains a non-finite coordinate")
            count += 1
            if count > MAX_COORDINATES:
                raise AoiGeometryError("aoi geometry has too many coordinates")
            return
        raise AoiGeometryError("aoi geometry coordinates must be numeric")

    walk(coordinates)
    try:
        parsed = shape(geometry)
    except Exception as exc:  # noqa: BLE001 - malformed client geometry
        raise AoiGeometryError(f"aoi geometry could not be parsed: {exc}") from exc
    if parsed.is_empty or not parsed.is_valid:
        raise AoiGeometryError("aoi geometry is empty or invalid")
    return parsed


def inspect_aoi_geometry(
    geometry: dict[str, Any],
    *,
    max_area_ha: float,
) -> dict[str, Any]:
    """Return area, bounds, and limit status for a WGS84 AOI geometry."""

    parsed = validate_aoi_geometry(geometry)
    transformer = Transformer.from_crs("EPSG:4326", "EPSG:3005", always_xy=True)
    projected = shapely_transform(transformer.transform, parsed)
    bounds_wgs84 = [float(value) for value in parsed.bounds]
    bounds_3005 = [float(value) for value in projected.bounds]
    area_ha = float(projected.area / 10_000.0)
    limit = float(max_area_ha)
    return {
        "status": "ok",
        "geometry_type": parsed.geom_type,
        "area_ha": area_ha,
        "max_area_ha": limit,
        "within_limit": area_ha <= limit,
        "remaining_ha": max(0.0, limit - area_ha),
        "bbox_wgs84": bounds_wgs84,
        "bbox_3005": bounds_3005,
    }


def geometry_feature_collection(parsed: Any, name: str = "Drawn AOI") -> dict[str, Any]:
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"name": name},
                "geometry": mapping(parsed),
            }
        ],
    }
