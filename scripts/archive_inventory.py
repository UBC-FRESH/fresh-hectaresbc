#!/usr/bin/env python3
"""Build compact inventory outputs for the rescued HectaresBC archive.

This script reads file metadata and ZIP central directories only. It does not
extract payload files.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any


DEFAULT_SOURCE = Path("tmp/shared-data/hectaresbc")
DEFAULT_OUTPUT = Path("metadata/archive_inventory")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help=f"Archive source root, default: {DEFAULT_SOURCE}",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Output directory, default: {DEFAULT_OUTPUT}",
    )
    return parser.parse_args()


def relative_posix(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def file_extension(path: Path) -> str:
    return path.suffix.lower().lstrip(".") or "[none]"


def count_tree(path: Path) -> dict[str, int]:
    file_count = 0
    dir_count = 0
    total_bytes = 0
    for child in path.rglob("*"):
        if child.is_dir():
            dir_count += 1
        elif child.is_file():
            file_count += 1
            total_bytes += child.stat().st_size
    return {
        "file_count": file_count,
        "dir_count": dir_count,
        "size_bytes": total_bytes,
    }


def root_item_summary(source: Path) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for item in sorted(source.iterdir(), key=lambda p: p.name):
        if item.is_dir():
            tree_counts = count_tree(item)
            items.append(
                {
                    "path": item.name,
                    "type": "directory",
                    **tree_counts,
                }
            )
        elif item.is_file():
            items.append(
                {
                    "path": item.name,
                    "type": "file",
                    "file_count": 1,
                    "dir_count": 0,
                    "size_bytes": item.stat().st_size,
                    "extension": file_extension(item),
                }
            )
    return items


def summarize_zip(path: Path, source: Path) -> dict[str, Any]:
    relative_path = relative_posix(path, source)
    parent = path.parent.name
    family = {
        "data_layers": "data_layer",
        "virtual_layers": "virtual_layer",
    }.get(parent, "other")

    stem = path.stem
    name_parts = stem.split(".")
    underscore_parts = stem.split("_")
    layer_id = ""
    if family == "virtual_layer" and name_parts and name_parts[-1].isdigit():
        layer_id = name_parts[-1]

    row: dict[str, Any] = {
        "relative_path": relative_path,
        "directory": path.parent.relative_to(source).as_posix(),
        "filename": path.name,
        "stem": stem,
        "family": family,
        "name_prefix": underscore_parts[0] if underscore_parts else stem,
        "virtual_layer_id": layer_id,
        "size_bytes": path.stat().st_size,
        "zip_status": "ok",
        "entry_count": 0,
        "entry_file_count": 0,
        "entry_dir_count": 0,
        "entry_uncompressed_bytes": 0,
        "entry_extension_counts": "{}",
        "has_tiff": "false",
        "has_wms_xml": "false",
        "metadata_entry_count": 0,
        "has_category_metadata": "false",
        "has_value_metadata": "false",
    }

    try:
        with zipfile.ZipFile(path) as archive:
            infos = archive.infolist()
    except zipfile.BadZipFile:
        row["zip_status"] = "bad_zip"
        return row

    extension_counts: Counter[str] = Counter()
    metadata_entry_count = 0
    has_tiff = False
    has_wms_xml = False
    has_category_metadata = False
    has_value_metadata = False
    entry_file_count = 0
    entry_dir_count = 0
    uncompressed_bytes = 0

    for info in infos:
        name = info.filename
        lower_name = name.lower()
        if info.is_dir():
            entry_dir_count += 1
        else:
            entry_file_count += 1
            extension_counts[Path(name).suffix.lower().lstrip(".") or "[none]"] += 1
            uncompressed_bytes += info.file_size
        if "metadata" in lower_name:
            metadata_entry_count += 1
        if lower_name.endswith((".tif", ".tiff")):
            has_tiff = True
        if lower_name.endswith(".wms.xml"):
            has_wms_xml = True
        if lower_name.startswith("category_metadata/") or "/category_metadata/" in lower_name:
            has_category_metadata = True
        if lower_name.startswith("value_metadata/") or "/value_metadata/" in lower_name:
            has_value_metadata = True

    row.update(
        {
            "entry_count": len(infos),
            "entry_file_count": entry_file_count,
            "entry_dir_count": entry_dir_count,
            "entry_uncompressed_bytes": uncompressed_bytes,
            "entry_extension_counts": json.dumps(
                dict(sorted(extension_counts.items())), sort_keys=True
            ),
            "has_tiff": str(has_tiff).lower(),
            "has_wms_xml": str(has_wms_xml).lower(),
            "metadata_entry_count": metadata_entry_count,
            "has_category_metadata": str(has_category_metadata).lower(),
            "has_value_metadata": str(has_value_metadata).lower(),
        }
    )
    return row


def build_summary(source: Path, zip_rows: list[dict[str, Any]]) -> dict[str, Any]:
    files = [path for path in source.rglob("*") if path.is_file()]
    dirs = [path for path in source.rglob("*") if path.is_dir()]
    extension_counts = Counter(file_extension(path) for path in files)
    family_counts = Counter(row["family"] for row in zip_rows)
    zip_status_counts = Counter(row["zip_status"] for row in zip_rows)

    root_files = []
    for path in sorted(source.iterdir(), key=lambda p: p.name):
        if path.is_file():
            root_files.append(
                {
                    "path": path.name,
                    "extension": file_extension(path),
                    "size_bytes": path.stat().st_size,
                }
            )

    return {
        "source_root": source.as_posix(),
        "total_size_bytes": sum(path.stat().st_size for path in files),
        "file_count": len(files),
        "directory_count_excluding_source_root": len(dirs),
        "extension_counts": dict(sorted(extension_counts.items())),
        "zip_count": len(zip_rows),
        "zip_family_counts": dict(sorted(family_counts.items())),
        "zip_status_counts": dict(sorted(zip_status_counts.items())),
        "root_files": root_files,
        "root_items": root_item_summary(source),
    }


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fieldnames = [
        "relative_path",
        "directory",
        "filename",
        "stem",
        "family",
        "name_prefix",
        "virtual_layer_id",
        "size_bytes",
        "zip_status",
        "entry_count",
        "entry_file_count",
        "entry_dir_count",
        "entry_uncompressed_bytes",
        "entry_extension_counts",
        "has_tiff",
        "has_wms_xml",
        "metadata_entry_count",
        "has_category_metadata",
        "has_value_metadata",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    args = parse_args()
    source = args.source
    output = args.output

    if not source.is_dir():
        print(f"source directory not found: {source}", file=sys.stderr)
        return 2

    output.mkdir(parents=True, exist_ok=True)

    zip_paths = sorted(source.rglob("*.zip"))
    zip_rows = [summarize_zip(path, source) for path in zip_paths]
    summary = build_summary(source, zip_rows)

    (output / "archive_summary.json").write_text(
        json.dumps(summary, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    write_csv(output / "zip_manifest.csv", zip_rows)

    print(f"wrote {output / 'archive_summary.json'}")
    print(f"wrote {output / 'zip_manifest.csv'}")
    print(f"zip rows: {len(zip_rows)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
