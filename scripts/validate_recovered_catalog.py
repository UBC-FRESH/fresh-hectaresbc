#!/usr/bin/env python3
"""Validate recovered HectaresBC catalog metadata.

This script uses only the Python standard library. It validates compact tracked
metadata outputs and writes a small Markdown report.
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path


DEFAULT_MANIFEST = Path("metadata/archive_inventory/zip_manifest.csv")
DEFAULT_DATA = Path("metadata/recovered_catalog/data_layer_records.csv")
DEFAULT_VIRTUAL = Path("metadata/recovered_catalog/virtual_layer_records.csv")
DEFAULT_OUTPUT = Path("metadata/validation/recovered_catalog_validation.md")

EXPECTED_DATA_COUNT = 418
EXPECTED_VIRTUAL_COUNT = 1765
EXPECTED_TOTAL_COUNT = EXPECTED_DATA_COUNT + EXPECTED_VIRTUAL_COUNT
EXPECTED_VIRTUAL_CONFLICTS = 12

JSON_FIELDS = {
    "data_layer": [
        "payload_members",
        "metadata_member_paths",
        "root_metadata_html_paths",
        "metadata_csv_paths",
        "category_metadata_sample_paths",
        "value_metadata_sample_paths",
        "raster_member_paths",
        "wms_member_paths",
        "nested_zip_paths",
        "html_h1",
        "html_h2",
        "category_csv_columns",
        "format_signals",
        "recovery_sources",
        "known_gaps",
        "metadata_mismatches",
        "uncertainty_notes",
    ],
    "virtual_layer": [
        "payload_members",
        "metadata_member_paths",
        "raster_member_paths",
        "status_flags",
        "zip_metadata_mismatches",
        "recovery_sources",
        "known_gaps",
        "uncertainty_notes",
    ],
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--virtual", type=Path, default=DEFAULT_VIRTUAL)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def add_check(
    checks: list[dict[str, object]],
    name: str,
    passed: bool,
    detail: str,
    examples: list[str] | None = None,
) -> None:
    checks.append(
        {
            "name": name,
            "passed": passed,
            "detail": detail,
            "examples": examples or [],
        }
    )


def duplicate_values(rows: list[dict[str, str]], field: str) -> list[str]:
    counts = Counter(row.get(field, "") for row in rows)
    return sorted(value for value, count in counts.items() if count > 1)


def validate_json_fields(
    rows: list[dict[str, str]], fields: list[str]
) -> tuple[int, list[str]]:
    failures: list[str] = []
    parsed = 0
    for row in rows:
        row_id = row.get("dataset_id", row.get("source_filename", "[unknown]"))
        for field in fields:
            if field not in row:
                failures.append(f"{row_id}: missing field {field}")
                continue
            try:
                json.loads(row[field])
                parsed += 1
            except json.JSONDecodeError as exc:
                failures.append(f"{row_id}: {field}: {exc}")
    return parsed, failures


def list_field(row: dict[str, str], field: str) -> list[str]:
    try:
        value = json.loads(row.get(field, "[]"))
    except json.JSONDecodeError:
        return []
    return value if isinstance(value, list) else []


def validate_catalog(
    manifest_rows: list[dict[str, str]],
    data_rows: list[dict[str, str]],
    virtual_rows: list[dict[str, str]],
) -> list[dict[str, object]]:
    checks: list[dict[str, object]] = []
    manifest_paths = {row["relative_path"] for row in manifest_rows}

    add_check(
        checks,
        "data-layer record count",
        len(data_rows) == EXPECTED_DATA_COUNT,
        f"observed {len(data_rows)}, expected {EXPECTED_DATA_COUNT}",
    )
    add_check(
        checks,
        "virtual-layer record count",
        len(virtual_rows) == EXPECTED_VIRTUAL_COUNT,
        f"observed {len(virtual_rows)}, expected {EXPECTED_VIRTUAL_COUNT}",
    )
    add_check(
        checks,
        "combined record count",
        len(data_rows) + len(virtual_rows) == EXPECTED_TOTAL_COUNT,
        f"observed {len(data_rows) + len(virtual_rows)}, expected {EXPECTED_TOTAL_COUNT}",
    )

    data_duplicates = duplicate_values(data_rows, "dataset_id")
    virtual_duplicates = duplicate_values(virtual_rows, "dataset_id")
    add_check(
        checks,
        "unique data-layer dataset IDs",
        not data_duplicates,
        f"duplicate count: {len(data_duplicates)}",
        data_duplicates[:10],
    )
    add_check(
        checks,
        "unique virtual-layer dataset IDs",
        not virtual_duplicates,
        f"duplicate count: {len(virtual_duplicates)}",
        virtual_duplicates[:10],
    )

    all_rows = data_rows + virtual_rows
    missing_manifest = [
        row["source_zip_path"]
        for row in all_rows
        if row.get("source_zip_path") not in manifest_paths
    ]
    add_check(
        checks,
        "recovered records join to ZIP manifest",
        not missing_manifest,
        f"missing manifest joins: {len(missing_manifest)}",
        missing_manifest[:10],
    )

    data_family_errors = [
        row["dataset_id"]
        for row in data_rows
        if row.get("source_family") != "data_layer"
    ]
    virtual_family_errors = [
        row["dataset_id"]
        for row in virtual_rows
        if row.get("source_family") != "virtual_layer"
    ]
    add_check(
        checks,
        "data-layer source_family values",
        not data_family_errors,
        f"errors: {len(data_family_errors)}",
        data_family_errors[:10],
    )
    add_check(
        checks,
        "virtual-layer source_family values",
        not virtual_family_errors,
        f"errors: {len(virtual_family_errors)}",
        virtual_family_errors[:10],
    )

    data_json_count, data_json_failures = validate_json_fields(
        data_rows, JSON_FIELDS["data_layer"]
    )
    virtual_json_count, virtual_json_failures = validate_json_fields(
        virtual_rows, JSON_FIELDS["virtual_layer"]
    )
    add_check(
        checks,
        "data-layer JSON-in-CSV fields parse",
        not data_json_failures,
        f"parsed {data_json_count}; failures: {len(data_json_failures)}",
        data_json_failures[:10],
    )
    add_check(
        checks,
        "virtual-layer JSON-in-CSV fields parse",
        not virtual_json_failures,
        f"parsed {virtual_json_count}; failures: {len(virtual_json_failures)}",
        virtual_json_failures[:10],
    )

    data_payload_errors: list[str] = []
    for row in data_rows:
        rasters = list_field(row, "raster_member_paths")
        wms = list_field(row, "wms_member_paths")
        if not rasters or not wms:
            data_payload_errors.append(row["dataset_id"])
    add_check(
        checks,
        "data-layer expected payload members",
        not data_payload_errors,
        f"records without raster and WMS members: {len(data_payload_errors)}",
        data_payload_errors[:10],
    )

    virtual_payload_errors: list[str] = []
    for row in virtual_rows:
        rasters = list_field(row, "raster_member_paths")
        metadata = list_field(row, "metadata_member_paths")
        if not rasters or "metadata.txt" not in metadata:
            virtual_payload_errors.append(row["dataset_id"])
    add_check(
        checks,
        "virtual-layer expected payload members",
        not virtual_payload_errors,
        f"records without raster and metadata.txt members: {len(virtual_payload_errors)}",
        virtual_payload_errors[:10],
    )

    status_counts = Counter(row["verification_status"] for row in virtual_rows)
    add_check(
        checks,
        "virtual-layer priority conflicts remain visible",
        status_counts.get("conflict_detected", 0) == EXPECTED_VIRTUAL_CONFLICTS,
        "conflict_detected count: "
        f"{status_counts.get('conflict_detected', 0)}, expected {EXPECTED_VIRTUAL_CONFLICTS}",
    )

    crs_extent_filled = [
        row["dataset_id"]
        for row in data_rows
        if row.get("crs") or row.get("spatial_extent")
    ]
    add_check(
        checks,
        "data-layer CRS and extent remain blank",
        not crs_extent_filled,
        f"records with CRS/extent filled before raster inspection: {len(crs_extent_filled)}",
        crs_extent_filled[:10],
    )

    return checks


def write_report(
    output: Path,
    manifest: Path,
    data: Path,
    virtual: Path,
    checks: list[dict[str, object]],
) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    passed = sum(1 for check in checks if check["passed"])
    failed = len(checks) - passed
    lines = [
        "# Recovered Catalog Validation",
        "",
        "## Inputs",
        "",
        f"- ZIP manifest: `{manifest}`",
        f"- Data-layer records: `{data}`",
        f"- Virtual-layer records: `{virtual}`",
        "",
        "## Summary",
        "",
        f"- Checks passed: {passed}",
        f"- Checks failed: {failed}",
        "",
        "## Checks",
        "",
        "| Check | Status | Detail |",
        "| --- | --- | --- |",
    ]
    for check in checks:
        status = "PASS" if check["passed"] else "FAIL"
        lines.append(f"| {check['name']} | {status} | {check['detail']} |")

    failures = [check for check in checks if not check["passed"]]
    if failures:
        lines.extend(["", "## Failure Examples", ""])
        for check in failures:
            lines.append(f"### {check['name']}")
            examples = check["examples"]
            if examples:
                lines.extend(f"- `{example}`" for example in examples)
            else:
                lines.append("- No examples captured.")
            lines.append("")

    lines.extend(
        [
            "## Command",
            "",
            "```bash",
            "python scripts/validate_recovered_catalog.py",
            "```",
            "",
        ]
    )
    output.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    args = parse_args()
    manifest_rows = read_csv(args.manifest)
    data_rows = read_csv(args.data)
    virtual_rows = read_csv(args.virtual)
    checks = validate_catalog(manifest_rows, data_rows, virtual_rows)
    write_report(args.output, args.manifest, args.data, args.virtual, checks)
    if any(not check["passed"] for check in checks):
        raise SystemExit(1)


if __name__ == "__main__":
    main()

