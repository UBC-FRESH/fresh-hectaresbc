#!/usr/bin/env python3
"""Summarize HectaresBC root metadata/control files.

This script reads compact root control files and the generated ZIP manifest. It
does not inspect or extract ZIP payloads.
"""

from __future__ import annotations

import argparse
import csv
from collections import Counter
from pathlib import Path


DEFAULT_SOURCE = Path("tmp/shared-data/hectaresbc")
DEFAULT_MANIFEST = Path("metadata/archive_inventory/zip_manifest.csv")
DEFAULT_OUTPUT = Path("metadata/archive_inventory/root_metadata_files.md")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def read_listing(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    with path.open("r", encoding="utf-8", errors="replace") as handle:
        for raw_line in handle:
            line = raw_line.rstrip("\n")
            if not line.strip():
                continue
            parts = line.split()
            if len(parts) >= 6 and parts[0] == "[" and parts[1] == "]":
                filename = parts[2]
                date = parts[3]
                time = parts[4]
                listed_size = parts[5]
            elif len(parts) >= 5:
                filename = parts[1]
                date = parts[2]
                time = parts[3]
                listed_size = parts[4]
            else:
                rows.append(
                    {
                        "filename": "",
                        "date": "",
                        "time": "",
                        "listed_size": "",
                        "raw": line,
                        "parse_status": "unparsed",
                    }
                )
                continue
            rows.append(
                {
                    "filename": filename,
                    "date": date,
                    "time": time,
                    "listed_size": listed_size,
                    "raw": line,
                    "parse_status": "ok",
                }
            )
    return rows


def read_manifest(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def read_virtual_metadata(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def counter_values(rows: list[dict[str, str]], field: str) -> Counter[str]:
    return Counter(row.get(field, "") or "[blank]" for row in rows)


def format_counter(counter: Counter[str], limit: int | None = None) -> list[str]:
    items = counter.most_common(limit)
    return [f"- `{key}`: {value}" for key, value in items]


def set_summary(listing_filenames: set[str], manifest_filenames: set[str]) -> dict[str, int]:
    return {
        "listing_count": len(listing_filenames),
        "manifest_count": len(manifest_filenames),
        "missing_from_manifest": len(listing_filenames - manifest_filenames),
        "missing_from_listing": len(manifest_filenames - listing_filenames),
    }


def write_report(
    output: Path,
    source: Path,
    manifest: Path,
    data_listing: list[dict[str, str]],
    virtual_listing: list[dict[str, str]],
    metadata_columns: list[str],
    virtual_metadata: list[dict[str, str]],
    manifest_rows: list[dict[str, str]],
) -> None:
    data_manifest = [row for row in manifest_rows if row["family"] == "data_layer"]
    virtual_manifest = [row for row in manifest_rows if row["family"] == "virtual_layer"]

    data_listing_names = {row["filename"] for row in data_listing if row["filename"]}
    virtual_listing_names = {row["filename"] for row in virtual_listing if row["filename"]}
    data_manifest_names = {row["filename"] for row in data_manifest}
    virtual_manifest_names = {row["filename"] for row in virtual_manifest}
    metadata_names = {row["filename"] for row in virtual_metadata if row.get("filename")}

    data_match = set_summary(data_listing_names, data_manifest_names)
    virtual_match = set_summary(virtual_listing_names, virtual_manifest_names)
    metadata_match = set_summary(metadata_names, virtual_manifest_names)

    duplicate_metadata_filenames = [
        filename
        for filename, count in counter_values(virtual_metadata, "filename").items()
        if filename != "[blank]" and count > 1
    ]
    duplicate_layer_ids = [
        layer_id
        for layer_id, count in counter_values(virtual_metadata, "layer_id").items()
        if layer_id != "[blank]" and count > 1
    ]

    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as handle:
        handle.write("# Root Metadata And Control Files\n\n")
        handle.write("## Purpose\n\n")
        handle.write(
            "Summarize the compact root-level HectaresBC metadata/control files "
            "and cross-check them against the generated ZIP manifest.\n\n"
        )
        handle.write("## Inputs\n\n")
        handle.write(f"- Source root: `{source.as_posix()}`\n")
        handle.write(f"- ZIP manifest: `{manifest.as_posix()}`\n")
        handle.write("- Root files inspected:\n")
        handle.write("  - `data_layers.txt`\n")
        handle.write("  - `virtual_layers.txt`\n")
        handle.write("  - `virtual_layers_metadata_all.csv`\n\n")

        handle.write("## Listing Files\n\n")
        handle.write("| File | Parsed Rows | Parse Failures | Unique Filenames |\n")
        handle.write("| --- | ---: | ---: | ---: |\n")
        handle.write(
            f"| `data_layers.txt` | {len(data_listing)} | "
            f"{sum(1 for row in data_listing if row['parse_status'] != 'ok')} | "
            f"{len(data_listing_names)} |\n"
        )
        handle.write(
            f"| `virtual_layers.txt` | {len(virtual_listing)} | "
            f"{sum(1 for row in virtual_listing if row['parse_status'] != 'ok')} | "
            f"{len(virtual_listing_names)} |\n\n"
        )

        handle.write("## Listing To Manifest Checks\n\n")
        handle.write("| Check | Listing Count | Manifest Count | Missing From Manifest | Missing From Listing |\n")
        handle.write("| --- | ---: | ---: | ---: | ---: |\n")
        handle.write(
            f"| data layers | {data_match['listing_count']} | {data_match['manifest_count']} | "
            f"{data_match['missing_from_manifest']} | {data_match['missing_from_listing']} |\n"
        )
        handle.write(
            f"| virtual layers | {virtual_match['listing_count']} | {virtual_match['manifest_count']} | "
            f"{virtual_match['missing_from_manifest']} | {virtual_match['missing_from_listing']} |\n\n"
        )

        handle.write("## Virtual Layer Metadata CSV\n\n")
        handle.write(f"- Row count: {len(virtual_metadata)}\n")
        handle.write(f"- Column count: {len(metadata_columns)}\n")
        handle.write("- Columns:\n")
        for column in metadata_columns:
            handle.write(f"  - `{column}`\n")
        handle.write("\n")

        handle.write("### CSV To Manifest Check\n\n")
        handle.write("| CSV Filename Count | Manifest Virtual ZIP Count | Missing From Manifest | Missing From CSV |\n")
        handle.write("| ---: | ---: | ---: | ---: |\n")
        handle.write(
            f"| {metadata_match['listing_count']} | {metadata_match['manifest_count']} | "
            f"{metadata_match['missing_from_manifest']} | {metadata_match['missing_from_listing']} |\n\n"
        )

        handle.write("### Field Value Signals\n\n")
        handle.write("`tablename` values:\n\n")
        handle.write("\n".join(format_counter(counter_values(virtual_metadata, "tablename"))))
        handle.write("\n\n`columnname` values:\n\n")
        handle.write("\n".join(format_counter(counter_values(virtual_metadata, "columnname"))))
        handle.write("\n\n`priority` values:\n\n")
        handle.write("\n".join(format_counter(counter_values(virtual_metadata, "priority"))))
        handle.write("\n\nBoolean/listing flag columns:\n\n")
        for field in ["ischanged", "ecolcomm", "bclist", "sara", "endemics"]:
            handle.write(f"`{field}`:\n")
            handle.write("\n".join(format_counter(counter_values(virtual_metadata, field))))
            handle.write("\n\n")

        handle.write("## Duplicate Checks\n\n")
        handle.write(f"- Duplicate `filename` values: {len(duplicate_metadata_filenames)}\n")
        handle.write(f"- Duplicate `layer_id` values: {len(duplicate_layer_ids)}\n\n")

        handle.write("## Catalog-Relevant Fields For Phase 2\n\n")
        handle.write(
            "- `layer_id`: stable-looking virtual layer numeric identifier.\n"
            "- `filename`: direct join key to virtual layer ZIP payloads.\n"
            "- `hkey`: hierarchical/category key that may help reconstruct the catalog tree.\n"
            "- `layer_name`: human-readable title candidate.\n"
            "- `query`: SQL-like source rule definition for virtual layers.\n"
            "- `hkey_query`: human-readable/hierarchical query expression.\n"
            "- `date_created`: original virtual layer creation timestamp.\n"
            "- `tablename`, `columnname`, `columnindex`: source table/field hints.\n"
            "- `element_subnational_id`, `ecolcomm`, `bclist`, `sara`, `endemics`: biodiversity/status fields.\n\n"
        )

        handle.write("## Notes\n\n")
        handle.write(
            "- The root listing files appear to be generated directory indexes with filename, timestamp, and display size.\n"
            "- `virtual_layers_metadata_all.csv` is the strongest root-level source for virtual layer catalog/provenance recovery.\n"
            "- Data-layer catalog metadata likely needs to be recovered from per-ZIP metadata files in a later phase.\n"
        )


def main() -> int:
    args = parse_args()
    source = args.source
    data_listing = read_listing(source / "data_layers.txt")
    virtual_listing = read_listing(source / "virtual_layers.txt")
    columns, virtual_metadata = read_virtual_metadata(source / "virtual_layers_metadata_all.csv")
    manifest_rows = read_manifest(args.manifest)
    write_report(
        args.output,
        source,
        args.manifest,
        data_listing,
        virtual_listing,
        columns,
        virtual_metadata,
        manifest_rows,
    )
    print(f"wrote {args.output}")
    print(f"data_listing_rows {len(data_listing)}")
    print(f"virtual_listing_rows {len(virtual_listing)}")
    print(f"virtual_metadata_rows {len(virtual_metadata)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
