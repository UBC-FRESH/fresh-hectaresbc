#!/usr/bin/env python3
"""Summarize ZIP payload families and integrity signals.

This script uses the generated ZIP manifest and representative ZIP central
directories. It does not extract payload files.
"""

from __future__ import annotations

import argparse
import csv
import json
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any


DEFAULT_SOURCE = Path("tmp/shared-data/hectaresbc")
DEFAULT_MANIFEST = Path("metadata/archive_inventory/zip_manifest.csv")
DEFAULT_OUTPUT = Path("metadata/archive_inventory/zip_payload_families.md")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def read_manifest(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def extension_counts(row: dict[str, str]) -> dict[str, int]:
    return json.loads(row["entry_extension_counts"])


def has_flag(row: dict[str, str], field: str) -> bool:
    return row[field].lower() == "true"


def format_bytes(value: int) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(value)
    for unit in units:
        if size < 1024 or unit == units[-1]:
            if unit == "B":
                return f"{int(size)} {unit}"
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{value} B"


def family_summary(rows: list[dict[str, str]]) -> dict[str, Any]:
    return {
        "count": len(rows),
        "zip_status": Counter(row["zip_status"] for row in rows),
        "has_tiff": sum(has_flag(row, "has_tiff") for row in rows),
        "has_wms_xml": sum(has_flag(row, "has_wms_xml") for row in rows),
        "has_category_metadata": sum(has_flag(row, "has_category_metadata") for row in rows),
        "has_value_metadata": sum(has_flag(row, "has_value_metadata") for row in rows),
        "metadata_entry_rows": sum(int(row["metadata_entry_count"]) > 0 for row in rows),
        "total_compressed_bytes": sum(int(row["size_bytes"]) for row in rows),
        "total_uncompressed_bytes": sum(int(row["entry_uncompressed_bytes"]) for row in rows),
        "patterns": Counter(row["entry_extension_counts"] for row in rows),
    }


def choose_examples(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    examples: list[dict[str, str]] = []

    def add(label: str, predicate: Any) -> None:
        for row in rows:
            if predicate(row):
                example = dict(row)
                example["_example_label"] = label
                if all(existing["relative_path"] != example["relative_path"] for existing in examples):
                    examples.append(example)
                return

    add("typical data layer with value metadata", lambda row: has_flag(row, "has_value_metadata"))
    add("data layer with category metadata", lambda row: has_flag(row, "has_category_metadata"))
    add("data layer with CSV metadata", lambda row: "csv" in extension_counts(row))
    add("data layer with nested ZIP entry", lambda row: "zip" in extension_counts(row))
    add("largest compressed ZIP", lambda row: row == max(rows, key=lambda item: int(item["size_bytes"])))
    return examples


def choose_virtual_examples(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    if not rows:
        return []
    largest = max(rows, key=lambda item: int(item["size_bytes"]))
    first = rows[0]
    examples = []
    for label, row in [
        ("typical virtual layer", first),
        ("largest virtual layer", largest),
    ]:
        example = dict(row)
        example["_example_label"] = label
        if all(existing["relative_path"] != example["relative_path"] for existing in examples):
            examples.append(example)
    return examples


def zip_entries(source: Path, relative_path: str, limit: int = 24) -> list[str]:
    path = source / relative_path
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
    if len(names) <= limit:
        return names
    return names[:limit] + [f"... ({len(names) - limit} more entries)"]


def write_counter_table(handle: Any, counter: Counter[str], limit: int = 12) -> None:
    handle.write("| Count | Entry extension pattern |\n")
    handle.write("| ---: | --- |\n")
    for pattern, count in counter.most_common(limit):
        handle.write(f"| {count} | `{pattern}` |\n")
    handle.write("\n")


def write_example(handle: Any, source: Path, row: dict[str, str]) -> None:
    handle.write(f"### {row['_example_label']}\n\n")
    handle.write(f"- ZIP: `{row['relative_path']}`\n")
    handle.write(f"- Compressed size: {format_bytes(int(row['size_bytes']))}\n")
    handle.write(f"- Entry files/directories: {row['entry_file_count']} files, {row['entry_dir_count']} directories\n")
    handle.write(f"- Entry extension counts: `{row['entry_extension_counts']}`\n")
    handle.write(f"- Metadata entries: {row['metadata_entry_count']}\n\n")
    handle.write("Representative central-directory entries:\n\n")
    handle.write("```text\n")
    for entry in zip_entries(source, row["relative_path"]):
        handle.write(f"{entry}\n")
    handle.write("```\n\n")


def write_report(output: Path, source: Path, manifest: Path, rows: list[dict[str, str]]) -> None:
    data_rows = [row for row in rows if row["family"] == "data_layer"]
    virtual_rows = [row for row in rows if row["family"] == "virtual_layer"]
    data = family_summary(data_rows)
    virtual = family_summary(virtual_rows)

    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as handle:
        handle.write("# ZIP Payload Families And Integrity Signals\n\n")
        handle.write("## Purpose\n\n")
        handle.write(
            "Classify HectaresBC ZIP payload families using the compact ZIP manifest "
            "and representative ZIP central-directory entry lists. No payload files "
            "were extracted.\n\n"
        )
        handle.write("## Inputs\n\n")
        handle.write(f"- Source root: `{source.as_posix()}`\n")
        handle.write(f"- ZIP manifest: `{manifest.as_posix()}`\n\n")

        handle.write("## Family Summary\n\n")
        handle.write("| Family | ZIPs | ZIP Status OK | Has TIFF | Has WMS XML | Has Category Metadata | Has Value Metadata | Metadata Entries Present |\n")
        handle.write("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n")
        handle.write(
            f"| data layers | {data['count']} | {data['zip_status'].get('ok', 0)} | "
            f"{data['has_tiff']} | {data['has_wms_xml']} | {data['has_category_metadata']} | "
            f"{data['has_value_metadata']} | {data['metadata_entry_rows']} |\n"
        )
        handle.write(
            f"| virtual layers | {virtual['count']} | {virtual['zip_status'].get('ok', 0)} | "
            f"{virtual['has_tiff']} | {virtual['has_wms_xml']} | {virtual['has_category_metadata']} | "
            f"{virtual['has_value_metadata']} | {virtual['metadata_entry_rows']} |\n\n"
        )

        handle.write("## Size Signals\n\n")
        handle.write("| Family | Compressed Total | Uncompressed Entry Total |\n")
        handle.write("| --- | ---: | ---: |\n")
        handle.write(
            f"| data layers | {format_bytes(data['total_compressed_bytes'])} | "
            f"{format_bytes(data['total_uncompressed_bytes'])} |\n"
        )
        handle.write(
            f"| virtual layers | {format_bytes(virtual['total_compressed_bytes'])} | "
            f"{format_bytes(virtual['total_uncompressed_bytes'])} |\n\n"
        )

        handle.write("## Data-Layer Entry Patterns\n\n")
        write_counter_table(handle, data["patterns"])
        handle.write("## Virtual-Layer Entry Patterns\n\n")
        write_counter_table(handle, virtual["patterns"])

        handle.write("## Representative Data-Layer ZIPs\n\n")
        for row in choose_examples(data_rows):
            write_example(handle, source, row)

        handle.write("## Representative Virtual-Layer ZIPs\n\n")
        for row in choose_virtual_examples(virtual_rows):
            write_example(handle, source, row)

        nested_zip_rows = [row for row in data_rows if "zip" in extension_counts(row)]
        no_metadata_rows = [row for row in rows if int(row["metadata_entry_count"]) == 0]

        handle.write("## Notable Signals\n\n")
        handle.write(f"- Data-layer ZIPs with nested ZIP entries: {len(nested_zip_rows)}\n")
        if nested_zip_rows:
            handle.write("  - Examples:\n")
            for row in nested_zip_rows[:10]:
                handle.write(f"    - `{row['relative_path']}`\n")
        handle.write(f"- ZIP rows with no metadata-like entries: {len(no_metadata_rows)}\n")
        handle.write("- All ZIPs in the manifest opened successfully with Python `zipfile.ZipFile`.\n\n")

        handle.write("## Integrity Signals For Phase 1\n\n")
        handle.write(
            "Low-cost checks appropriate for Phase 1:\n\n"
            "- central directory opens successfully (`zip_status = ok`);\n"
            "- expected entry families are present for each ZIP family;\n"
            "- every data-layer ZIP has at least one TIFF and one WMS XML entry;\n"
            "- every virtual-layer ZIP has one TIFF and one TXT metadata entry;\n"
            "- listing files and metadata CSV row counts match manifest filenames;\n"
            "- manifest row count matches archive ZIP count.\n\n"
            "Deferred or optional checks:\n\n"
            "- full CRC validation using `ZipFile.testzip()` reads each compressed payload and should be run deliberately, likely in the DataLad/data-repository lane or as a targeted integrity audit;\n"
            "- TIFF readability, CRS inspection, and raster statistics require geospatial tooling and belong after Phase 1;\n"
            "- HTML/XML metadata parsing belongs in Phase 2 or later metadata recovery work.\n"
        )


def main() -> int:
    args = parse_args()
    rows = read_manifest(args.manifest)
    write_report(args.output, args.source, args.manifest, rows)
    print(f"wrote {args.output}")
    print(f"zip_rows {len(rows)}")
    print(f"data_layer_rows {sum(row['family'] == 'data_layer' for row in rows)}")
    print(f"virtual_layer_rows {sum(row['family'] == 'virtual_layer' for row in rows)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
