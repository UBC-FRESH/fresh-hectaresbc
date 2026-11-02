"""FEMIC BC Data Catalogue bridge for AOI resolution and materialization.

FEMIC owns the BC Data Catalogue search/scoring and AOI-scoped WFS machinery.
This module keeps that logic on the FEMIC side, then turns the selected boundary
features into a small GeoJSON AOI that the HectaresBC raster clipper can use.
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

BC_BBOX_3005 = (159587.5, 173787.5, 1881187.5, 1748187.5)
NAME_FIELD_HINTS = (
    "name",
    "description",
    "label",
    "tsa",
    "region",
    "district",
    "area",
    "unit",
)


class FemicBridgeError(RuntimeError):
    """Raised when FEMIC cannot resolve or materialize an AOI boundary."""


@dataclass(frozen=True)
class AoiBoundary:
    """One resolved AOI boundary ready for raster clipping."""

    query: str
    name: str
    package_title: str
    package_name: str
    resource_name: str
    wfs_typename: str
    feature_count: int
    labels: tuple[str, ...]
    geometry: dict[str, Any]
    bbox_wgs84: tuple[float, float, float, float]
    bbox_3005: tuple[float, float, float, float]
    area_ha: float
    saved_geojson: Path
    saved_metadata: Path

    def to_dict(self, *, include_geometry: bool = True) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "status": "ok",
            "query": self.query,
            "name": self.name,
            "package_title": self.package_title,
            "package_name": self.package_name,
            "resource_name": self.resource_name,
            "wfs_typename": self.wfs_typename,
            "feature_count": self.feature_count,
            "labels": list(self.labels),
            "bbox_wgs84": list(self.bbox_wgs84),
            "bbox_3005": list(self.bbox_3005),
            "area_ha": self.area_ha,
            "saved_geojson": str(self.saved_geojson),
            "saved_metadata": str(self.saved_metadata),
        }
        if include_geometry:
            payload["geometry"] = self.geometry
        return payload


def _ensure_femic(femic_src: str | Path | None = None) -> None:
    if femic_src:
        path = str(Path(femic_src).expanduser().resolve())
        if path not in sys.path:
            sys.path.insert(0, path)
    try:
        import femic  # noqa: F401
    except ImportError as exc:  # pragma: no cover - environment dependent
        raise FemicBridgeError(
            "FEMIC is not importable. Install FEMIC or pass --femic-src / set "
            "FRESH_HECTARESBC_FEMIC_SRC to the FEMIC src directory."
        ) from exc


def _normalize(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").casefold()).strip()


def _flatten_properties(properties: dict[str, Any]) -> str:
    values: list[str] = []
    for value in properties.values():
        if isinstance(value, str):
            values.append(value)
        elif isinstance(value, (int, float)):
            values.append(str(value))
        elif isinstance(value, (list, tuple)):
            values.extend(str(item) for item in value)
    return _normalize(" ".join(values))


def _label_for_properties(properties: dict[str, Any]) -> str:
    pieces: list[str] = []
    for key, value in properties.items():
        key_lower = key.casefold()
        if value in (None, "") or not any(hint in key_lower for hint in NAME_FIELD_HINTS):
            continue
        pieces.append(f"{key}={value}")
    if pieces:
        return " | ".join(pieces[:4])
    return " | ".join(
        f"{key}={value}"
        for key, value in list(properties.items())[:4]
        if value not in (None, "")
    )


def _candidate_options(
    features: list[dict[str, Any]], limit: int = 40
) -> list[dict[str, str]]:
    """Return display labels plus a safe name to pass back to resolve."""

    options: list[dict[str, str]] = []
    seen: set[str] = set()
    for feature in features:
        properties = feature.get("properties") or {}
        label = _label_for_properties(properties)
        preferred = ""
        for key, value in properties.items():
            if value in (None, ""):
                continue
            key_lower = key.casefold()
            if "description" in key_lower or key_lower in {
                "name",
                "admin_area_name",
                "region_name",
                "management_area_name",
                "unit_name",
            }:
                preferred = str(value)
                break
        name = preferred or label
        key = name.casefold()
        if not name or key in seen:
            continue
        seen.add(key)
        options.append({"label": label, "name": name})
        if len(options) >= limit:
            break
    return options


def _candidate_labels(features: list[dict[str, Any]], limit: int = 40) -> list[str]:
    labels: list[str] = []
    for feature in features:
        label = _label_for_properties(feature.get("properties") or {})
        if label and label not in labels:
            labels.append(label)
        if len(labels) >= limit:
            break
    return labels


def _matching_features(
    features: list[dict[str, Any]], tokens: list[str]
) -> list[dict[str, Any]]:
    """Match features, preferring exact numeric property equality.

    ``TSA 27`` must select ``TSA_NUMBER=27`` rather than every feature whose
    area string happens to contain "27".
    """

    numeric_tokens = [token for token in tokens if token.isdigit()]
    text_tokens = [token for token in tokens if not token.isdigit()]
    exact: list[dict[str, Any]] = []
    substring: list[dict[str, Any]] = []
    for feature in features:
        properties = feature.get("properties") or {}
        text = _flatten_properties(properties)
        property_values = {
            _normalize(value)
            for value in properties.values()
            if isinstance(value, (str, int, float))
        }
        numeric_ok = all(
            any(
                value == token or value.lstrip("0") == token.lstrip("0")
                for value in property_values
            )
            for token in numeric_tokens
        )
        text_ok = all(token in text for token in text_tokens)
        if numeric_ok and text_ok:
            exact.append(feature)
        if all(token in text for token in tokens):
            substring.append(feature)
    return exact if exact else substring


def _infer_crs(features: list[dict[str, Any]]) -> str:
    coordinates: list[tuple[float, float]] = []

    def collect(value: Any) -> None:
        if isinstance(value, (list, tuple)):
            if (
                len(value) >= 2
                and isinstance(value[0], (int, float))
                and isinstance(value[1], (int, float))
            ):
                coordinates.append((float(value[0]), float(value[1])))
                return
            for item in value:
                collect(item)

    for feature in features[:50]:
        collect((feature.get("geometry") or {}).get("coordinates"))
    if not coordinates:
        return "EPSG:3005"
    max_x = max(abs(x) for x, _ in coordinates)
    max_y = max(abs(y) for _, y in coordinates)
    if max_x <= 180 and max_y <= 90:
        return "EPSG:4326"
    return "EPSG:3005"


def _select_wfs_resource(match: Any) -> Any | None:
    for resource in getattr(match, "resources", ()):
        if (
            getattr(resource, "wfs_queryable", False)
            and getattr(resource, "wfs_typename", None)
            and getattr(resource, "url", None)
        ):
            return resource
    return None


def _fetch_features(resource: Any, bbox_epsg3005: tuple[float, float, float, float]) -> tuple[list[dict[str, Any]], str]:
    """Fetch WFS features through FEMIC's materialization helper."""

    from femic.bcdc_fetch import _fetch_wfs_payload_paged

    payload, request_url, warnings = _fetch_wfs_payload_paged(
        base_url=resource.url,
        typename=resource.wfs_typename,
        bbox_epsg3005=bbox_epsg3005,
    )
    features = payload.get("features") or []
    if not isinstance(features, list):
        raise FemicBridgeError("WFS response did not contain a feature list.")
    return features, request_url


def _candidate_score(match: Any, query: str, name: str) -> int:
    text = _normalize(f"{getattr(match, 'title', '')} {getattr(match, 'package_name', '')}")
    query_tokens = set(_normalize(query).split(" "))
    name_tokens = set(_normalize(name).split(" ")) if name else set()
    score = 0
    score += 5 * sum(1 for token in query_tokens if token and token in text)
    score += 8 * sum(1 for token in name_tokens if token and token in text)
    if "timber supply" in text and ("tsa" in name_tokens or "timber" in query_tokens):
        score += 50
    if "regional district" in text and "regional" in query_tokens:
        score += 50
    if "management area" in text and "tsa" in name_tokens:
        score -= 40
    if _select_wfs_resource(match) is not None:
        score += 10
    return score


def search_aoi_layers(
    query: str,
    *,
    limit: int = 5,
    femic_src: str | Path | None = None,
) -> dict[str, Any]:
    """Resolve candidate BCDC boundary packages without downloading geometry."""

    _ensure_femic(femic_src)
    from femic.bcdc_catalog import resolve_bcdc_candidates

    result = resolve_bcdc_candidates(query, limit=limit)
    return {
        "query": query,
        "matches": [match.to_dict() for match in result.matches],
        "notes": list(result.notes),
    }


def resolve_aoi(
    query: str,
    *,
    name: str | None = None,
    limit: int = 5,
    output_dir: str | Path,
    femic_src: str | Path | None = None,
    bbox_epsg3005: tuple[float, float, float, float] = BC_BBOX_3005,
) -> dict[str, Any]:
    """Resolve a named TSA/admin boundary and write a small GeoJSON AOI.

    Returns a structured ``needs_name`` or ``ambiguous`` response when the
    catalogue layer is found but the requested feature is not unique, so the
    agent can ask the user to choose rather than guessing.
    """

    _ensure_femic(femic_src)
    from femic.bcdc_catalog import resolve_bcdc_candidates

    resolved = resolve_bcdc_candidates(query, limit=max(limit, 8))
    if not resolved.matches:
        raise FemicBridgeError(f"No BC Data Catalogue boundary match found for {query!r}.")

    requested_name = (name or "").strip()
    ranked = sorted(
        resolved.matches,
        key=lambda match: _candidate_score(match, query, requested_name),
        reverse=True,
    )
    chosen = None
    features: list[dict[str, Any]] = []
    request_url = ""
    resource = None
    for match in ranked[:5]:
        candidate_resource = _select_wfs_resource(match)
        if candidate_resource is None:
            continue
        try:
            candidate_features, candidate_url = _fetch_features(
                candidate_resource, bbox_epsg3005
            )
        except Exception:
            continue
        if not candidate_features:
            continue
        if requested_name:
            tokens = [token for token in _normalize(requested_name).split(" ") if token]
            candidate_matches = _matching_features(candidate_features, tokens)
            if not candidate_matches:
                continue
            features = candidate_features
        else:
            features = candidate_features
        chosen = match
        resource = candidate_resource
        request_url = candidate_url
        break

    if chosen is None or resource is None:
        # Return the best resolvable layer's candidate labels so the agent can
        # ask the user to choose a feature rather than silently picking one.
        for match in ranked:
            candidate_resource = _select_wfs_resource(match)
            if candidate_resource is None:
                continue
            try:
                features, request_url = _fetch_features(
                    candidate_resource, bbox_epsg3005
                )
            except Exception:
                continue
            if features:
                chosen = match
                resource = candidate_resource
                break
        if chosen is None or resource is None or not features:
            raise FemicBridgeError(
                f"No WFS-backed boundary layer could be materialized for {query!r}."
            )

    top_match = chosen
    assert resource is not None

    labels = _candidate_labels(features)
    options = _candidate_options(features)
    if not requested_name:
        return {
            "status": "needs_name",
            "query": query,
            "package_title": top_match.title,
            "resource_name": resource.name,
            "wfs_typename": resource.wfs_typename,
            "feature_count": len(features),
            "candidates": labels,
            "candidate_options": options,
            "request_url": request_url,
        }

    tokens = [token for token in _normalize(requested_name).split(" ") if token]
    matches = _matching_features(features, tokens)
    if not matches:
        return {
            "status": "needs_name",
            "query": query,
            "requested_name": requested_name,
            "package_title": top_match.title,
            "resource_name": resource.name,
            "wfs_typename": resource.wfs_typename,
            "feature_count": len(features),
            "candidates": labels,
            "candidate_options": options,
            "request_url": request_url,
        }

    matched_labels = _candidate_labels(matches, limit=10)
    if len(matches) > 8:
        return {
            "status": "ambiguous",
            "query": query,
            "requested_name": requested_name,
            "package_title": top_match.title,
            "resource_name": resource.name,
            "wfs_typename": resource.wfs_typename,
            "match_count": len(matches),
            "candidates": matched_labels,
            "candidate_options": _candidate_options(matches, limit=10),
            "request_url": request_url,
        }

    import geopandas as gpd  # type: ignore[import-untyped]
    from shapely.geometry import shape  # type: ignore[import-untyped]
    from shapely.ops import unary_union  # type: ignore[import-untyped]

    crs = _infer_crs(matches)
    geometries = [
        shape(feature["geometry"])
        for feature in matches
        if feature.get("geometry")
    ]
    if not geometries:
        raise FemicBridgeError("Matched WFS features did not contain usable geometry.")
    geometry = unary_union(geometries)
    gdf = gpd.GeoDataFrame(geometry=[geometry], crs=crs)
    gdf_wgs84 = gdf.to_crs("EPSG:4326")
    gdf_3005 = gdf.to_crs("EPSG:3005")
    bounds_3005 = gdf_3005.total_bounds
    bounds_wgs84 = gdf_wgs84.total_bounds
    area_ha = float(gdf_3005.geometry.area.iloc[0] / 10_000.0)

    output_root = Path(output_dir).expanduser().resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    slug = re.sub(r"[^A-Za-z0-9]+", "-", requested_name).strip("-").lower() or "aoi"
    geojson_path = output_root / f"{slug}.geojson"
    metadata_path = output_root / f"{slug}.json"
    feature = {
        "type": "Feature",
        "properties": {
            "name": requested_name,
            "query": query,
            "package_title": top_match.title,
            "resource_name": resource.name,
            "wfs_typename": resource.wfs_typename,
            "feature_count": len(matches),
            "labels": matched_labels,
            "area_ha": area_ha,
        },
        "geometry": gdf_wgs84.geometry.iloc[0].__geo_interface__,
    }
    geojson_path.write_text(
        json.dumps(
            {"type": "FeatureCollection", "features": [feature]},
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    metadata = AoiBoundary(
        query=query,
        name=requested_name,
        package_title=top_match.title,
        package_name=top_match.package_name,
        resource_name=resource.name,
        wfs_typename=resource.wfs_typename,
        feature_count=len(matches),
        labels=tuple(matched_labels),
        geometry=feature["geometry"],
        bbox_wgs84=tuple(float(value) for value in bounds_wgs84),
        bbox_3005=tuple(float(value) for value in bounds_3005),
        area_ha=area_ha,
        saved_geojson=geojson_path,
        saved_metadata=metadata_path,
    )
    metadata_path.write_text(
        json.dumps(
            {
                **metadata.to_dict(include_geometry=False),
                "generated_utc": datetime.now(UTC).isoformat(),
                "request_url": request_url,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return metadata.to_dict()
