"""Prepare multi-layer clipped raster bundles for an AOI."""

from __future__ import annotations

import json
import shutil
import uuid
import zipfile
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fresh_hectaresbc import HectaresBC
from fresh_hectaresbc.clip import ClipError, clip_raster_to_aoi
from fresh_hectaresbc.femic_bridge import FemicBridgeError, resolve_aoi

DEFAULT_MAX_LAYERS = 6
DEFAULT_MAX_AREA_HA = 10_000_000.0


class BundleError(RuntimeError):
    """Raised when an AOI bundle cannot be prepared safely."""


class BundleCancelled(RuntimeError):
    """Raised when a bundle job is cancelled between clipping steps."""


ProgressCallback = Callable[[dict[str, Any]], None]
CancelCheck = Callable[[], bool]


def _progress(callback: ProgressCallback | None, payload: dict[str, Any]) -> None:
    if callback is not None:
        callback(payload)


def _bundle_id() -> str:
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    return f"{stamp}-{uuid.uuid4().hex[:8]}"


def _load_aoi_geojson(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise BundleError(f"Could not read AOI GeoJSON {path}: {exc}") from exc
    if payload.get("type") not in {"Feature", "FeatureCollection"}:
        raise BundleError("AOI GeoJSON must be a Feature or FeatureCollection.")
    return payload


def _aoi_metadata_from_file(path: Path, name: str | None) -> dict[str, Any]:
    import geopandas as gpd  # type: ignore[import-untyped]

    aoi = gpd.read_file(path)
    if aoi.empty:
        raise BundleError("AOI GeoJSON contains no features.")
    if aoi.crs is None:
        aoi = aoi.set_crs("EPSG:4326")
    aoi_3005 = aoi.to_crs("EPSG:3005")
    aoi_wgs84 = aoi.to_crs("EPSG:4326")
    bounds_3005 = aoi_3005.total_bounds
    bounds_wgs84 = aoi_wgs84.total_bounds
    area_ha = float(aoi_3005.geometry.area.sum() / 10_000.0)
    return {
        "name": name or "custom AOI",
        "feature_count": int(len(aoi)),
        "bbox_3005": [float(value) for value in bounds_3005],
        "bbox_wgs84": [float(value) for value in bounds_wgs84],
        "area_ha": area_ha,
    }


def _sanitize_clip(result: Any, bundle_dir: Path, source_zip: str) -> dict[str, Any]:
    relative = result.output_path.relative_to(bundle_dir).as_posix()
    return {
        "dataset_id": result.dataset_id,
        "title": result.title,
        "file": relative,
        "source_zip": source_zip,
        "raster_member": result.raster_member,
        "crs": result.crs,
        "width": result.width,
        "height": result.height,
        "source_width": result.source_width,
        "source_height": result.source_height,
        "bounds_wgs84": list(result.bounds_wgs84),
        "dtype": result.dtype,
        "nodata": result.nodata,
        "bytes": result.output_bytes,
        "source_resolution": result.source_resolution,
    }


def prepare_bundle(
    *,
    layer_ids: list[str],
    output_root: str | Path,
    aoi_query: str | None = None,
    aoi_name: str | None = None,
    aoi_geojson: str | Path | None = None,
    archive_root: str | Path | None = None,
    femic_src: str | Path | None = None,
    max_layers: int = DEFAULT_MAX_LAYERS,
    max_area_ha: float = DEFAULT_MAX_AREA_HA,
    public_url: str | None = None,
    progress_callback: ProgressCallback | None = None,
    cancel_check: CancelCheck | None = None,
) -> dict[str, Any]:
    """Resolve an AOI, clip selected rasters, and write a downloadable ZIP."""

    unique_layers = list(dict.fromkeys(str(layer).strip() for layer in layer_ids if layer))
    if not unique_layers:
        raise BundleError("Select at least one raster layer.")
    if len(unique_layers) > max_layers:
        raise BundleError(
            f"Select at most {max_layers} layers per demo bundle; requested {len(unique_layers)}."
        )

    _progress(
        progress_callback,
        {
            "stage": "resolving_aoi",
            "layer_total": len(unique_layers),
            "completed": 0,
            "failed": 0,
        },
    )

    hbc = HectaresBC()
    records = {}
    for dataset_id in unique_layers:
        record = hbc.get(dataset_id)
        if record is None:
            raise BundleError(f"Unknown dataset ID {dataset_id!r}.")
        records[dataset_id] = record

    root = Path(output_root).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    bundle_id = _bundle_id()
    bundle_dir = root / bundle_id
    layers_dir = bundle_dir / "layers"
    layers_dir.mkdir(parents=True)

    if bool(aoi_query) == bool(aoi_geojson):
        raise BundleError("Provide exactly one of aoi_query or aoi_geojson.")
    if aoi_query:
        try:
            aoi_payload = resolve_aoi(
                aoi_query,
                name=aoi_name,
                output_dir=bundle_dir / "aoi",
                femic_src=femic_src,
            )
        except FemicBridgeError as exc:
            raise BundleError(str(exc)) from exc
        if aoi_payload.get("status") != "ok":
            return {
                "status": aoi_payload.get("status", "needs_name"),
                "bundle_id": bundle_id,
                "aoi": aoi_payload,
                "message": "The AOI query is ambiguous or incomplete; choose a candidate name.",
            }
        aoi_path = Path(aoi_payload["saved_geojson"])
        shutil.copy2(aoi_path, bundle_dir / "aoi.geojson")
        aoi_metadata = {
            "name": aoi_payload["name"],
            "query": aoi_payload["query"],
            "feature_count": aoi_payload["feature_count"],
            "bbox_3005": aoi_payload["bbox_3005"],
            "bbox_wgs84": aoi_payload["bbox_wgs84"],
            "area_ha": aoi_payload["area_ha"],
            "labels": aoi_payload.get("labels", []),
            "package_title": aoi_payload.get("package_title"),
            "resource_name": aoi_payload.get("resource_name"),
        }
    else:
        source_aoi = Path(aoi_geojson).expanduser().resolve()
        payload = _load_aoi_geojson(source_aoi)
        shutil.copy2(source_aoi, bundle_dir / "aoi.geojson")
        aoi_metadata = _aoi_metadata_from_file(bundle_dir / "aoi.geojson", aoi_name)
        aoi_metadata["query"] = None
        aoi_metadata["labels"] = []
        aoi_payload = {"status": "ok", **aoi_metadata}

    if aoi_metadata["area_ha"] > max_area_ha:
        raise BundleError(
            f"AOI is {aoi_metadata['area_ha']:,.0f} ha; the demo limit is "
            f"{max_area_ha:,.0f} ha."
        )

    clipped: list[dict[str, Any]] = []
    failures: list[dict[str, str]] = []
    _progress(
        progress_callback,
        {
            "stage": "clipping",
            "layer_total": len(unique_layers),
            "layer_index": 0,
            "completed": 0,
            "failed": 0,
        },
    )
    for index, dataset_id in enumerate(unique_layers, start=1):
        if cancel_check is not None and cancel_check():
            raise BundleCancelled("Bundle canceled.")
        _progress(
            progress_callback,
            {
                "stage": "clipping",
                "layer_total": len(unique_layers),
                "layer_index": index,
                "current_layer": dataset_id,
                "completed": len(clipped),
                "failed": len(failures),
            },
        )
        try:
            result = clip_raster_to_aoi(
                dataset_id,
                bundle_dir / "aoi.geojson",
                layers_dir,
                archive_root=archive_root,
            )
            clipped.append(
                _sanitize_clip(result, bundle_dir, records[dataset_id].source_zip_path)
            )
        except (ClipError, OSError, ValueError) as exc:
            failures.append({"dataset_id": dataset_id, "error": str(exc)})
        _progress(
            progress_callback,
            {
                "stage": "clipping",
                "layer_total": len(unique_layers),
                "layer_index": index,
                "current_layer": dataset_id,
                "completed": len(clipped),
                "failed": len(failures),
            },
        )

    if cancel_check is not None and cancel_check():
        raise BundleCancelled("Bundle canceled.")
    _progress(
        progress_callback,
        {
            "stage": "packaging",
            "layer_total": len(unique_layers),
            "completed": len(clipped),
            "failed": len(failures),
        },
    )

    manifest = {
        "schema_version": 1,
        "bundle_id": bundle_id,
        "generated_utc": datetime.now(UTC).isoformat(),
        "status": "complete" if not failures else ("partial" if clipped else "failed"),
        "aoi": aoi_metadata,
        "layers": clipped,
        "failures": failures,
        "limits": {
            "max_layers": max_layers,
            "max_area_ha": max_area_ha,
        },
    }
    (bundle_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    (bundle_dir / "README.txt").write_text(
        "HectaresBC clipped raster bundle\n"
        "===============================\n\n"
        f"AOI: {aoi_metadata['name']}\n"
        f"Area: {aoi_metadata['area_ha']:,.1f} ha\n"
        f"Layers: {len(clipped)}\n\n"
        "Each GeoTIFF in layers/ is clipped to aoi.geojson and preserves the\n"
        "source raster CRS, dtype, and nodata value. See manifest.json for\n"
        "source ZIP/member provenance and clipping metadata.\n",
        encoding="utf-8",
    )

    zip_path = root / f"hectaresbc-bundle-{bundle_id}.zip"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(bundle_dir.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(bundle_dir).as_posix())

    base_url = (public_url or "").rstrip("/")
    download_url = f"{base_url}/api/bundles/{bundle_id}/download"

    return {
        **manifest,
        "bundle_id": bundle_id,
        "bundle_dir": str(bundle_dir),
        "zip_path": str(zip_path),
        "zip_bytes": zip_path.stat().st_size,
        "download_name": zip_path.name,
        "download_url": download_url,
    }
