#!/usr/bin/env python3
"""Audit recovered layers for browser map-preview feasibility."""

from __future__ import annotations

import argparse
import csv
import json
import sys
import warnings
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from xml.etree import ElementTree
from zipfile import BadZipFile, ZipFile

from fresh_hectaresbc import HectaresBC


DEFAULT_OUTPUT_DIR = Path("metadata/preview_feasibility")
DEFAULT_LOCAL_ARCHIVE_ROOT = Path("tmp/shared-data/hectaresbc")
DEFAULT_SAMPLE_SIZE = 0
FORBIDDEN_FRAGMENTS = (
    "/home/",
    "tmp/bootstrap",
    "tmp/shared-data/hectaresbc",
    "aws-secrets",
)
CSV_FIELDS = [
    "dataset_id",
    "title",
    "source_family",
    "source_zip_path",
    "raw_relative_path",
    "source_resolution",
    "source_content_status",
    "preview_feasibility_status",
    "preview_eligibility_blockers",
    "raster_member_path",
    "wms_member_path",
    "crs",
    "native_bounds",
    "wgs84_bounds",
    "raster_width",
    "raster_height",
    "band_count",
    "dtype",
    "nodata",
    "sample_width",
    "sample_height",
    "sample_valid_pixel_count",
    "sample_unique_value_count",
    "sample_min",
    "sample_max",
    "visual_signal_status",
    "wms_value_class_count",
    "error_message",
]


@dataclass(frozen=True)
class SourceZip:
    path: Path | None
    source_resolution: str
    content_status: str


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Audit all recovered layers for source-derived preview feasibility."
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Directory for compact feasibility audit outputs.",
    )
    parser.add_argument(
        "--local-archive-root",
        type=Path,
        default=DEFAULT_LOCAL_ARCHIVE_ROOT,
        help="Ignored local recovered archive fallback root.",
    )
    parser.add_argument(
        "--sample-size",
        type=int,
        default=DEFAULT_SAMPLE_SIZE,
        help=(
            "Maximum width or height for coarse raster signal sampling. "
            "Use 0 for metadata-only full-catalog audits."
        ),
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional development limit on number of records audited.",
    )
    parser.add_argument(
        "--progress-every",
        type=int,
        default=50,
        help="Print progress to stderr every N records. Use 0 to disable.",
    )
    args = parser.parse_args()

    records, summary = audit_preview_feasibility(
        local_archive_root=args.local_archive_root,
        sample_size=args.sample_size,
        limit=args.limit,
        progress_every=args.progress_every,
    )
    write_outputs(records, summary, args.output_dir)
    print(
        "wrote preview feasibility audit "
        f"{args.output_dir} ({summary['record_count']} records)"
    )
    return 0


def audit_preview_feasibility(
    *,
    local_archive_root: Path = DEFAULT_LOCAL_ARCHIVE_ROOT,
    sample_size: int = DEFAULT_SAMPLE_SIZE,
    limit: int | None = None,
    progress_every: int = 0,
) -> tuple[list[dict[str, str]], dict[str, Any]]:
    hbc = HectaresBC()
    catalog_records = list(hbc.catalog)
    if limit is not None:
        catalog_records = catalog_records[:limit]

    rows: list[dict[str, str]] = []
    for index, record in enumerate(catalog_records, start=1):
        if progress_every > 0 and (index == 1 or index % progress_every == 0):
            print(
                f"auditing {index}/{len(catalog_records)} {record.dataset_id}",
                file=sys.stderr,
                flush=True,
            )
        resolved = hbc.resolve(record)
        source = _resolve_source_zip(resolved.absolute_path, local_archive_root / record.source_zip_path)
        row = _base_row(record, resolved.raw_relative_path.as_posix(), source)
        if source.path is None:
            row.update(_status("source_unavailable", ["source_unavailable"]))
            rows.append(row)
            continue

        rows.append(_audit_source_zip(row, source.path, record, sample_size=sample_size))

    summary = _build_summary(rows, sample_size=sample_size, limit=limit)
    _validate_no_private_fragments(rows, summary)
    return rows, summary


def write_outputs(records: list[dict[str, str]], summary: dict[str, Any], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    csv_path = output_dir / "layer_preview_feasibility.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(records)

    (output_dir / "preview_feasibility_summary.json").write_text(
        json.dumps(summary, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _resolve_source_zip(data_repo_path: Path, fallback_path: Path) -> SourceZip:
    if data_repo_path.is_file():
        return SourceZip(
            path=data_repo_path,
            source_resolution="data_repo_content",
            content_status="content_present",
        )
    if fallback_path.is_file():
        return SourceZip(
            path=fallback_path,
            source_resolution="local_archive_fallback",
            content_status="local_archive_fallback_present",
        )
    return SourceZip(
        path=None,
        source_resolution="unavailable",
        content_status="source_unavailable",
    )


def _base_row(record: Any, raw_relative_path: str, source: SourceZip) -> dict[str, str]:
    return {
        "dataset_id": record.dataset_id,
        "title": record.title_candidate,
        "source_family": record.source_family,
        "source_zip_path": record.source_zip_path,
        "raw_relative_path": raw_relative_path,
        "source_resolution": source.source_resolution,
        "source_content_status": source.content_status,
        "preview_feasibility_status": "",
        "preview_eligibility_blockers": "[]",
        "raster_member_path": "",
        "wms_member_path": "",
        "crs": "",
        "native_bounds": "[]",
        "wgs84_bounds": "[]",
        "raster_width": "",
        "raster_height": "",
        "band_count": "",
        "dtype": "",
        "nodata": "",
        "sample_width": "",
        "sample_height": "",
        "sample_valid_pixel_count": "",
        "sample_unique_value_count": "",
        "sample_min": "",
        "sample_max": "",
        "visual_signal_status": "",
        "wms_value_class_count": "",
        "error_message": "",
    }


def _audit_source_zip(
    row: dict[str, str],
    zip_path: Path,
    record: Any,
    *,
    sample_size: int,
) -> dict[str, str]:
    try:
        with ZipFile(zip_path) as archive:
            names = archive.namelist()
            raster_member = _first_member_from_record(record, "raster_member_paths") or _first_matching(
                names, (".tif", ".tiff")
            )
            wms_member = _first_member_from_record(record, "wms_member_paths") or _first_matching(
                names, (".wms.xml",)
            )
            if wms_member:
                row["wms_member_path"] = wms_member
                row["wms_value_class_count"] = str(_wms_class_count(archive, wms_member))
    except (BadZipFile, OSError) as error:
        row.update(_status("raster_unreadable", ["zip_unreadable"], error))
        return row

    if not raster_member:
        row.update(_status("no_raster_member", ["no_raster_member"]))
        return row

    row["raster_member_path"] = raster_member
    try:
        raster_metadata = _read_raster_metadata(zip_path, raster_member, sample_size=sample_size)
    except Exception as error:  # noqa: BLE001 - audit output needs deterministic row failures.
        row.update(_status("raster_unreadable", ["raster_unreadable"], error))
        return row

    row.update({key: str(value) for key, value in raster_metadata.items() if key in row})
    row["native_bounds"] = json.dumps(raster_metadata["native_bounds"])
    row["wgs84_bounds"] = json.dumps(raster_metadata["wgs84_bounds"])
    row.update(_feasibility_status(raster_metadata))
    return row


def _read_raster_metadata(zip_path: Path, raster_member: str, *, sample_size: int) -> dict[str, Any]:
    import numpy as np
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.errors import NotGeoreferencedWarning
    from rasterio.warp import transform_bounds

    vfs_path = f"zip://{zip_path}!{raster_member}"
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=NotGeoreferencedWarning)
        with rasterio.open(vfs_path) as src:
            native_bounds = [float(value) for value in src.bounds]
            wgs84_bounds: list[float] = []
            if src.crs:
                wgs84_bounds = [
                    float(value)
                    for value in transform_bounds(src.crs, "EPSG:4326", *src.bounds, densify_pts=21)
                ]
            sample_width = ""
            sample_height = ""
            sample_valid_pixel_count = ""
            sample_unique_value_count = ""
            sample_min = ""
            sample_max = ""
            visual_signal_status = "not_sampled_metadata_only"
            if sample_size > 0:
                scale = min(sample_size / src.width, sample_size / src.height, 1)
                sample_width = max(1, round(src.width * scale))
                sample_height = max(1, round(src.height * scale))
                array = src.read(
                    1,
                    out_shape=(sample_height, sample_width),
                    masked=True,
                    resampling=Resampling.nearest,
                )
                values = np.asarray(array.compressed())
                unique_values = np.unique(values) if values.size else np.asarray([])
                sample_valid_pixel_count = int(values.size)
                sample_unique_value_count = int(unique_values.size)
                sample_min = "" if values.size == 0 else float(values.min())
                sample_max = "" if values.size == 0 else float(values.max())
                visual_signal_status = _visual_signal_status(values, unique_values)
            return {
                "crs": "" if src.crs is None else str(src.crs),
                "native_bounds": native_bounds,
                "wgs84_bounds": wgs84_bounds,
                "raster_width": src.width,
                "raster_height": src.height,
                "band_count": src.count,
                "dtype": src.dtypes[0],
                "nodata": "" if src.nodata is None else float(src.nodata),
                "sample_width": sample_width,
                "sample_height": sample_height,
                "sample_valid_pixel_count": sample_valid_pixel_count,
                "sample_unique_value_count": sample_unique_value_count,
                "sample_min": sample_min,
                "sample_max": sample_max,
                "visual_signal_status": visual_signal_status,
            }


def _visual_signal_status(values: Any, unique_values: Any) -> str:
    if values.size == 0:
        return "empty_sample"
    if unique_values.size == 1:
        only_value = float(unique_values[0])
        return "single_zero_sample" if only_value == 0 else "single_value_sample"
    return "multi_value_sample"


def _feasibility_status(metadata: dict[str, Any]) -> dict[str, str]:
    blockers = []
    if not metadata["crs"]:
        blockers.append("missing_crs")
    if not metadata["wgs84_bounds"]:
        blockers.append("missing_wgs84_bounds")
    if metadata["visual_signal_status"] == "empty_sample":
        blockers.append("empty_sample")
    if metadata["visual_signal_status"] == "single_zero_sample":
        blockers.append("low_signal_single_zero_sample")
    elif metadata["visual_signal_status"] == "single_value_sample":
        blockers.append("low_signal_single_value_sample")

    if blockers:
        status = "candidate_with_blockers"
    elif metadata["visual_signal_status"] == "not_sampled_metadata_only":
        status = "metadata_preview_candidate"
    else:
        status = "preview_candidate"
    return {
        "preview_feasibility_status": status,
        "preview_eligibility_blockers": json.dumps(blockers),
    }


def _status(status: str, blockers: list[str], error: Exception | None = None) -> dict[str, str]:
    return {
        "preview_feasibility_status": status,
        "preview_eligibility_blockers": json.dumps(blockers),
        "error_message": "" if error is None else str(error).splitlines()[0],
    }


def _first_member_from_record(record: Any, field_name: str) -> str:
    values = record.field(field_name)
    if not values:
        return ""
    parsed = json.loads(values)
    return parsed[0] if parsed else ""


def _first_matching(names: list[str], suffixes: tuple[str, ...]) -> str:
    for name in names:
        lowered = name.lower()
        if any(lowered.endswith(suffix) for suffix in suffixes):
            return name
    return ""


def _wms_class_count(archive: ZipFile, wms_member: str) -> int:
    try:
        root = ElementTree.fromstring(archive.read(wms_member))
    except ElementTree.ParseError:
        return 0
    return len(root.findall("entry"))


def _build_summary(
    rows: list[dict[str, str]],
    *,
    sample_size: int,
    limit: int | None,
) -> dict[str, Any]:
    status_counts = Counter(row["preview_feasibility_status"] for row in rows)
    family_counts = Counter(row["source_family"] for row in rows)
    family_status_counts: dict[str, dict[str, int]] = {}
    for row in rows:
        family_status_counts.setdefault(row["source_family"], {})
        family_status_counts[row["source_family"]][row["preview_feasibility_status"]] = (
            family_status_counts[row["source_family"]].get(row["preview_feasibility_status"], 0) + 1
        )

    return {
        "generated_at": datetime.now(UTC).replace(microsecond=0).isoformat(),
        "record_count": len(rows),
        "sample_size": sample_size,
        "limit": limit,
        "status_counts": dict(sorted(status_counts.items())),
        "family_counts": dict(sorted(family_counts.items())),
        "family_status_counts": {
            family: dict(sorted(counts.items()))
            for family, counts in sorted(family_status_counts.items())
        },
    }


def _validate_no_private_fragments(rows: list[dict[str, str]], summary: dict[str, Any]) -> None:
    serialized = json.dumps({"rows": rows, "summary": summary}, sort_keys=True).lower()
    matches = [fragment for fragment in FORBIDDEN_FRAGMENTS if fragment in serialized]
    if matches:
        raise ValueError(
            "preview feasibility audit contains forbidden fragments: "
            + ", ".join(sorted(matches))
        )


if __name__ == "__main__":
    raise SystemExit(main())
