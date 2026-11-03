"""Retention for bundle outputs and temporary AOI geometries.

Job records have their own retention policy. This module handles the larger
artifacts: ``<bundle_id>/`` directories, their ZIPs, and browser-drawn AOI files.
The newest bundles are kept; older terminal outputs are removed. Active jobs are
never targeted because their bundle directory has no manifest yet and therefore
is not discovered by the bundle scan.
"""

from __future__ import annotations

import json
import re
import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

_BUNDLE_ID_RE = re.compile(r"^[0-9A-Za-z_-]+$")
_ZIP_PREFIX = "hectaresbc-bundle-"


def _time_value(value: Any, fallback: Path | None = None) -> datetime:
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            parsed = None
        if parsed is not None:
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=UTC)
            return parsed.astimezone(UTC)
    if fallback is not None:
        try:
            return datetime.fromtimestamp(fallback.stat().st_mtime, tz=UTC)
        except OSError:
            pass
    return datetime.min.replace(tzinfo=UTC)


def _remove_dir(path: Path) -> bool:
    if not path.is_dir():
        return False
    shutil.rmtree(path, ignore_errors=True)
    return not path.exists()


def _remove_file(path: Path) -> bool:
    try:
        path.unlink()
        return True
    except FileNotFoundError:
        return False
    except OSError:
        return False


def prune_bundle_outputs(
    output_root: str | Path,
    *,
    max_bundles: int = 50,
    max_age_days: float = 30.0,
    aoi_max_age_days: float = 7.0,
    aoi_max_files: int = 500,
) -> dict[str, int]:
    """Remove old bundle outputs and temporary drawn-AOI files.

    ``max_age_days`` and ``aoi_max_age_days`` of zero or less disable age
    pruning. Active bundle jobs are not discovered until their manifest is
    written, so their in-progress directories are left alone.
    """

    root = Path(output_root).expanduser().resolve()
    if not root.is_dir():
        return {
            "removed_bundles": 0,
            "removed_zips": 0,
            "removed_aoi": 0,
            "kept_bundles": 0,
        }

    keep_limit = max(1, int(max_bundles))
    now = datetime.now(UTC)
    bundles: dict[str, tuple[datetime, Path, Path]] = {}
    for manifest_path in root.glob("*/manifest.json"):
        bundle_dir = manifest_path.parent
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        bundle_id = manifest.get("bundle_id") or bundle_dir.name
        if not isinstance(bundle_id, str) or not _BUNDLE_ID_RE.fullmatch(bundle_id):
            continue
        timestamp = _time_value(manifest.get("generated_utc"), manifest_path)
        zip_path = root / f"{_ZIP_PREFIX}{bundle_id}.zip"
        bundles[bundle_id] = (timestamp, bundle_dir, zip_path)

    kept: set[str] = set()
    removed_bundles = 0
    removed_zips = 0
    known_dirs = {metadata[1] for metadata in bundles.values()}
    for index, (bundle_id, (timestamp, bundle_dir, zip_path)) in enumerate(
        sorted(bundles.items(), key=lambda item: item[1][0], reverse=True)
    ):
        too_old = False
        if max_age_days > 0:
            age_days = (now - timestamp).total_seconds() / 86400
            too_old = age_days > max_age_days
        if index < keep_limit and not too_old:
            kept.add(bundle_id)
            continue
        if _remove_dir(bundle_dir):
            removed_bundles += 1
        if _remove_file(zip_path):
            removed_zips += 1

    # Remove stale incomplete bundle directories left by an interrupted process.
    if max_age_days > 0:
        for child in root.iterdir():
            if not child.is_dir() or child.name in {"aoi", "jobs"}:
                continue
            if child in known_dirs:
                continue
            try:
                age_days = (
                    now - datetime.fromtimestamp(child.stat().st_mtime, tz=UTC)
                ).total_seconds() / 86400
            except OSError:
                continue
            if age_days > max_age_days and _remove_dir(child):
                removed_bundles += 1

    # ZIPs with no manifest cannot be downloaded and can accumulate after
    # interrupted writes. Keep only ZIPs belonging to retained bundles.
    for zip_path in root.glob(f"{_ZIP_PREFIX}*.zip"):
        bundle_id = zip_path.name[len(_ZIP_PREFIX) : -4]
        if bundle_id in kept:
            continue
        if _remove_file(zip_path):
            removed_zips += 1

    removed_aoi = 0
    aoi_dir = root / "aoi"
    if aoi_dir.is_dir():
        aoi_limit = max(1, int(aoi_max_files))
        files = sorted(
            aoi_dir.glob("*.geojson"),
            key=lambda path: _time_value(None, path),
            reverse=True,
        )
        for index, path in enumerate(files):
            timestamp = _time_value(None, path)
            too_old = False
            if aoi_max_age_days > 0:
                age_days = (now - timestamp).total_seconds() / 86400
                too_old = age_days > aoi_max_age_days
            if index < aoi_limit and not too_old:
                continue
            if _remove_file(path):
                removed_aoi += 1

    return {
        "removed_bundles": removed_bundles,
        "removed_zips": removed_zips,
        "removed_aoi": removed_aoi,
        "kept_bundles": len(kept),
    }
