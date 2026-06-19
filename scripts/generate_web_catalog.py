"""Generate browser catalog JSON from the fresh_hectaresbc package API."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fresh_hectaresbc import DatasetRecord, HectaresBC


DEFAULT_OUTPUT = Path("web/data/catalog.json")
FORBIDDEN_FRAGMENTS = (
    "tmp/",
    "secret",
    "bootstrap.md",
    "external/fresh-hectaresbc-data/raw/",
)
SUMMARY_FIELDS = (
    "parent_layer_title",
    "fixed_layer_name",
    "fixed_grid_name",
    "description",
    "coverage",
    "creator",
    "publisher",
    "rights",
    "units",
    "lineage",
    "license_or_use_constraints",
    "crs",
    "spatial_extent",
    "original_layer_id",
    "hkey",
    "layer_name",
    "date_created",
    "source_table",
    "source_column",
    "priority",
    "element_subnational_id",
    "status_flags",
)
PROVENANCE_FIELDS = (
    "manifest_row_source",
    "root_listing_source",
    "root_metadata_source",
    "zip_metadata_source",
    "recovery_sources",
    "recovery_method",
    "recovered_at",
    "zip_read_status",
    "manifest_zip_status",
    "zip_metadata_read_status",
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate web/data/catalog.json from packaged catalog metadata."
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Output JSON path.",
    )
    args = parser.parse_args()

    payload = build_catalog_payload()
    write_catalog_payload(payload, args.output)
    print(f"wrote {args.output} ({payload['record_count']} records)")
    return 0


def build_catalog_payload() -> dict[str, Any]:
    catalog = HectaresBC().catalog
    records = [record_to_web(record) for record in catalog]
    family_counts = Counter(record["source_family"] for record in records)

    payload: dict[str, Any] = {
        "schema_version": 1,
        "generated_at": datetime.now(UTC).replace(microsecond=0).isoformat(),
        "record_count": len(records),
        "family_counts": dict(sorted(family_counts.items())),
        "records": records,
    }
    _validate_payload(payload)
    return payload


def write_catalog_payload(payload: dict[str, Any], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def record_to_web(record: DatasetRecord) -> dict[str, Any]:
    raster_members = _parsed_list(record.field("raster_member_paths"))
    wms_members = _parsed_list(record.field("wms_member_paths"))

    return {
        "dataset_id": record.dataset_id,
        "source_family": record.source_family,
        "title": record.title_candidate or record.source_stem,
        "source_zip_path": record.source_zip_path,
        "source_filename": record.source_filename,
        "source_stem": record.source_stem,
        "manifest_size_bytes": record.manifest_size_bytes,
        "verification_status": record.verification_status,
        "known_gaps": _parsed_list(record.known_gaps),
        "uncertainty_notes": _parsed_list(record.uncertainty_notes),
        "preview": {
            "has_raster": bool(raster_members),
            "has_wms": bool(wms_members),
            "raster_member_count": len(raster_members),
            "wms_member_count": len(wms_members),
            "preview_status": "metadata_candidate" if raster_members else "not_evaluated",
        },
        "metadata": _field_group(record, SUMMARY_FIELDS),
        "provenance": _field_group(record, PROVENANCE_FIELDS, public_sources=True),
    }


def _field_group(
    record: DatasetRecord, fields: tuple[str, ...], *, public_sources: bool = False
) -> dict[str, Any]:
    group: dict[str, Any] = {}
    for field in fields:
        value = record.field(field)
        if not value:
            continue
        parsed = _parsed_value(value)
        group[field] = _public_source_value(parsed) if public_sources else parsed
    return group


def _parsed_value(value: str) -> Any:
    value = value.strip()
    if not value:
        return ""
    if value[0] in "[{":
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value


def _parsed_list(value: str) -> list[Any]:
    parsed = _parsed_value(value)
    if parsed in ("", None):
        return []
    if isinstance(parsed, list):
        return parsed
    return [parsed]


def _public_source_value(value: Any) -> Any:
    if isinstance(value, str):
        return _public_source(value)
    if isinstance(value, list):
        return [_public_source_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _public_source_value(item) for key, item in value.items()}
    return value


def _public_source(value: str) -> str:
    return value.replace("tmp/shared-data/hectaresbc/", "rescued_archive/")


def _validate_payload(payload: dict[str, Any]) -> None:
    serialized = json.dumps(payload, sort_keys=True).lower()
    matches = [fragment for fragment in FORBIDDEN_FRAGMENTS if fragment in serialized]
    if matches:
        raise ValueError(
            "web catalog payload contains forbidden fragments: "
            + ", ".join(sorted(matches))
        )


if __name__ == "__main__":
    raise SystemExit(main())
