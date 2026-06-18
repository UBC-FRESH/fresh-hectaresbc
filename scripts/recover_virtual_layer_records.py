#!/usr/bin/env python3
"""Recover compact virtual-layer catalog records from HectaresBC archive metadata.

This script reads root metadata/control files and virtual-layer ZIP central
directories. It reads ZIP metadata text members but does not extract payloads.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import zipfile
from collections import Counter
from datetime import date
from pathlib import Path


DEFAULT_SOURCE = Path("tmp/shared-data/hectaresbc")
DEFAULT_MANIFEST = Path("metadata/archive_inventory/zip_manifest.csv")
DEFAULT_OUTPUT = Path("metadata/recovered_catalog/virtual_layer_records.csv")
DEFAULT_SUMMARY = Path("metadata/recovered_catalog/virtual_layer_recovery_summary.md")

CSV_TO_TXT_KEYS = {
    "layer_name": "layer_name",
    "hkey": "hkey",
    "query": "db_query",
    "hkey_query": "hkey_query",
    "priority": "priority",
    "element_subnational_id": "element_subnational_id",
    "ecolcomm": "ecolcomm",
    "bclist": "beclist",
    "sara": "sara",
    "endemics": "endemics",
}

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--summary", type=Path, default=DEFAULT_SUMMARY)
    return parser.parse_args()


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return slug


def dataset_id(filename: str) -> str:
    stem = Path(filename).stem
    return f"vl_{slugify(stem)}"


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def read_listing(path: Path) -> dict[str, dict[str, str]]:
    rows: dict[str, dict[str, str]] = {}
    with path.open("r", encoding="utf-8", errors="replace") as handle:
        for raw_line in handle:
            line = raw_line.rstrip("\n")
            if not line.strip():
                continue
            parts = line.split()
            if len(parts) >= 6 and parts[0] == "[" and parts[1] == "]":
                filename = parts[2]
                listed_date = parts[3]
                listed_time = parts[4]
                listed_size = parts[5]
                parse_status = "ok"
            elif len(parts) >= 5:
                filename = parts[1]
                listed_date = parts[2]
                listed_time = parts[3]
                listed_size = parts[4]
                parse_status = "ok"
            else:
                continue
            rows[filename] = {
                "listed_date": listed_date,
                "listed_time": listed_time,
                "listed_size": listed_size,
                "listing_parse_status": parse_status,
                "listing_raw": line,
            }
    return rows


def read_manifest(path: Path) -> dict[str, dict[str, str]]:
    rows = read_csv_rows(path)
    return {
        row["filename"]: row
        for row in rows
        if row.get("family") == "virtual_layer" and row.get("filename")
    }


def parse_metadata_txt(raw: bytes) -> dict[str, str]:
    parsed: dict[str, str] = {}
    text = raw.decode("utf-8", errors="replace")
    for line in text.splitlines():
        if not line.strip() or ":" not in line:
            continue
        key, value = line.split(":", 1)
        parsed[key.strip()] = value.strip()
    return parsed


def inspect_zip(zip_path: Path) -> dict[str, object]:
    result: dict[str, object] = {
        "zip_read_status": "missing",
        "payload_members": [],
        "raster_member_paths": [],
        "metadata_member_paths": [],
        "zip_metadata": {},
        "zip_metadata_read_status": "missing",
    }
    if not zip_path.exists():
        return result

    try:
        with zipfile.ZipFile(zip_path) as zf:
            names = [info.filename for info in zf.infolist() if not info.is_dir()]
            metadata_members = [
                name for name in names if Path(name).name.lower() == "metadata.txt"
            ]
            result.update(
                {
                    "zip_read_status": "ok",
                    "payload_members": names,
                    "raster_member_paths": [
                        name
                        for name in names
                        if Path(name).suffix.lower() in {".tif", ".tiff"}
                    ],
                    "metadata_member_paths": metadata_members,
                }
            )
            if metadata_members:
                result["zip_metadata"] = parse_metadata_txt(zf.read(metadata_members[0]))
                result["zip_metadata_read_status"] = "ok"
            else:
                result["zip_metadata_read_status"] = "no_metadata_txt"
    except zipfile.BadZipFile:
        result["zip_read_status"] = "bad_zip"
    except OSError as exc:
        result["zip_read_status"] = f"os_error:{exc.__class__.__name__}"
    return result


def compare_sources(row: dict[str, str], zip_metadata: dict[str, str]) -> list[str]:
    mismatches: list[str] = []
    for csv_key, txt_key in CSV_TO_TXT_KEYS.items():
        csv_value = (row.get(csv_key) or "").strip()
        txt_value = (zip_metadata.get(txt_key) or "").strip()
        if txt_value and csv_value != txt_value:
            mismatches.append(f"{csv_key}!={txt_key}")
    return mismatches


def json_dumps(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def build_records(
    source: Path,
    metadata_rows: list[dict[str, str]],
    listing_by_filename: dict[str, dict[str, str]],
    manifest_by_filename: dict[str, dict[str, str]],
) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    seen_ids: set[str] = set()

    for row in metadata_rows:
        filename = row.get("filename", "")
        manifest = manifest_by_filename.get(filename, {})
        listing = listing_by_filename.get(filename, {})
        zip_rel_path = manifest.get("relative_path") or f"virtual_layers/{filename}"
        zip_info = inspect_zip(source / zip_rel_path)
        zip_metadata = zip_info["zip_metadata"]
        assert isinstance(zip_metadata, dict)

        record_id = dataset_id(filename)
        mismatches = compare_sources(row, zip_metadata)
        known_gaps: list[str] = []
        if not manifest:
            known_gaps.append("missing_manifest_row")
        if not listing:
            known_gaps.append("missing_root_listing_row")
        if zip_info["zip_read_status"] != "ok":
            known_gaps.append("zip_not_read")
        if zip_info["zip_metadata_read_status"] != "ok":
            known_gaps.append("missing_zip_metadata_txt")
        if not zip_info["raster_member_paths"]:
            known_gaps.append("missing_raster_member")
        if record_id in seen_ids:
            known_gaps.append("duplicate_dataset_id")
        seen_ids.add(record_id)

        if mismatches:
            verification_status = "conflict_detected"
        elif known_gaps:
            verification_status = "metadata_partial"
        else:
            verification_status = "metadata_recovered"

        uncertainty_notes: list[str] = []
        if mismatches:
            uncertainty_notes.append(
                "Root CSV and ZIP metadata.txt disagree for: " + ", ".join(mismatches)
            )
        if "query" in row and row["query"]:
            uncertainty_notes.append(
                "Source query is preserved as text only; source database semantics are not validated."
            )

        status_flags = {
            "ischanged": row.get("ischanged", ""),
            "ecolcomm": row.get("ecolcomm", ""),
            "bclist": row.get("bclist", ""),
            "sara": row.get("sara", ""),
            "endemics": row.get("endemics", ""),
        }

        payload_members = zip_info["payload_members"]
        raster_member_paths = zip_info["raster_member_paths"]
        metadata_member_paths = zip_info["metadata_member_paths"]
        assert isinstance(payload_members, list)
        assert isinstance(raster_member_paths, list)
        assert isinstance(metadata_member_paths, list)

        records.append(
            {
                "dataset_id": record_id,
                "source_family": "virtual_layer",
                "source_zip_path": zip_rel_path,
                "source_filename": filename,
                "source_stem": Path(filename).stem,
                "payload_members": json_dumps(payload_members),
                "metadata_member_paths": json_dumps(metadata_member_paths),
                "raster_member_paths": json_dumps(raster_member_paths),
                "title_candidate": row.get("layer_name", ""),
                "title_source": "virtual_layers_metadata_all.csv:layer_name",
                "original_layer_id": row.get("layer_id", ""),
                "hkey": row.get("hkey", ""),
                "layer_name": row.get("layer_name", ""),
                "query": row.get("query", ""),
                "hkey_query": row.get("hkey_query", ""),
                "date_created": row.get("date_created", ""),
                "source_table": row.get("tablename", ""),
                "source_column": row.get("columnname", ""),
                "source_column_index": row.get("columnindex", ""),
                "priority": row.get("priority", ""),
                "element_subnational_id": row.get("element_subnational_id", ""),
                "status_flags": json_dumps(status_flags),
                "zip_metadata_mismatches": json_dumps(mismatches),
                "zip_metadata_priority": zip_metadata.get("priority", ""),
                "manifest_row_source": (
                    f"metadata/archive_inventory/zip_manifest.csv:{zip_rel_path}"
                    if manifest
                    else ""
                ),
                "root_listing_source": (
                    f"tmp/shared-data/hectaresbc/virtual_layers.txt:{filename}"
                    if listing
                    else ""
                ),
                "root_metadata_source": (
                    "tmp/shared-data/hectaresbc/"
                    f"virtual_layers_metadata_all.csv:{filename}"
                ),
                "zip_metadata_source": (
                    f"{zip_rel_path}:{metadata_member_paths[0]}"
                    if metadata_member_paths
                    else ""
                ),
                "recovery_sources": json_dumps(
                    [
                        "metadata/archive_inventory/zip_manifest.csv",
                        "tmp/shared-data/hectaresbc/virtual_layers.txt",
                        "tmp/shared-data/hectaresbc/virtual_layers_metadata_all.csv",
                        zip_rel_path,
                    ]
                ),
                "recovery_method": "scripts/recover_virtual_layer_records.py",
                "recovered_at": date.today().isoformat(),
                "verification_status": verification_status,
                "known_gaps": json_dumps(known_gaps),
                "uncertainty_notes": json_dumps(uncertainty_notes),
                "zip_read_status": str(zip_info["zip_read_status"]),
                "zip_metadata_read_status": str(zip_info["zip_metadata_read_status"]),
                "manifest_zip_status": manifest.get("zip_status", ""),
                "manifest_size_bytes": manifest.get("size_bytes", ""),
                "listed_date": listing.get("listed_date", ""),
                "listed_time": listing.get("listed_time", ""),
                "listed_size": listing.get("listed_size", ""),
            }
        )
    return records


def write_records(path: Path, records: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(records[0].keys()) if records else []
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)


def format_counter(counter: Counter[str]) -> list[str]:
    return [f"- `{key}`: {value}" for key, value in counter.most_common()]


def write_summary(
    path: Path,
    source: Path,
    manifest: Path,
    output: Path,
    records: list[dict[str, str]],
    metadata_rows: list[dict[str, str]],
    listing_by_filename: dict[str, dict[str, str]],
    manifest_by_filename: dict[str, dict[str, str]],
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    filenames = {row.get("filename", "") for row in metadata_rows if row.get("filename")}
    listing_names = set(listing_by_filename)
    manifest_names = set(manifest_by_filename)

    verification_counts = Counter(row["verification_status"] for row in records)
    zip_counts = Counter(row["zip_read_status"] for row in records)
    zip_metadata_counts = Counter(row["zip_metadata_read_status"] for row in records)
    mismatch_counts = Counter()
    priority_mismatch_examples: list[str] = []
    for record in records:
        for mismatch in json.loads(record["zip_metadata_mismatches"]):
            mismatch_counts[mismatch] += 1
        if "priority!=priority" in json.loads(record["zip_metadata_mismatches"]):
            priority_mismatch_examples.append(
                "- `{filename}`: root CSV priority `{csv_priority}`, "
                "ZIP metadata priority `{txt_priority}`; title `{title}`".format(
                    filename=record["source_filename"],
                    csv_priority=record.get("priority", ""),
                    txt_priority=record.get("zip_metadata_priority", ""),
                    title=record["title_candidate"],
                )
            )

    lines = [
        "# Virtual Layer Recovery Summary",
        "",
        "## Purpose",
        "",
        "Summarize compact virtual-layer catalog recovery from root metadata, root listings, the ZIP manifest, and virtual-layer ZIP metadata text files.",
        "",
        "## Inputs",
        "",
        f"- Source root: `{source}`",
        f"- ZIP manifest: `{manifest}`",
        "- Root listing: `tmp/shared-data/hectaresbc/virtual_layers.txt`",
        "- Root metadata: `tmp/shared-data/hectaresbc/virtual_layers_metadata_all.csv`",
        "",
        "## Output",
        "",
        f"- Records: `{output}`",
        "",
        "## Counts",
        "",
        f"- Root metadata rows: {len(metadata_rows)}",
        f"- Recovered records: {len(records)}",
        f"- Unique source filenames: {len(filenames)}",
        f"- Filenames with root listing rows: {len(filenames & listing_names)}",
        f"- Filenames with manifest rows: {len(filenames & manifest_names)}",
        f"- Missing from root listing: {len(filenames - listing_names)}",
        f"- Missing from manifest: {len(filenames - manifest_names)}",
        "",
        "## Verification Status",
        "",
        *format_counter(verification_counts),
        "",
        "## ZIP Read Status",
        "",
        *format_counter(zip_counts),
        "",
        "## ZIP Metadata Read Status",
        "",
        *format_counter(zip_metadata_counts),
        "",
        "## Root CSV To ZIP Metadata Mismatches",
        "",
    ]
    if mismatch_counts:
        lines.extend(format_counter(mismatch_counts))
    else:
        lines.append("- No field mismatches found for compared fields.")

    if priority_mismatch_examples:
        lines.extend(
            [
                "",
                "### Priority Conflict Pattern",
                "",
                "All observed conflicts are rows where the root CSV priority is blank and the ZIP `metadata.txt` priority is `0`:",
                "",
                *priority_mismatch_examples,
            ]
        )

    lines.extend(
        [
            "",
            "## Notes",
            "",
            "- `query` values are preserved as source text only; source database semantics have not been validated.",
            "- TXT metadata uses `db_query` where the root CSV uses `query`, and `beclist` where the root CSV uses `bclist`.",
            "- CRS, extent, licensing, and biological/ecological interpretation are intentionally not inferred in this output.",
            "- `dataset_id` values are provisional and follow the P2.1 identity-model rule.",
            "",
            "## Command",
            "",
            "```bash",
            "python scripts/recover_virtual_layer_records.py",
            "```",
            "",
        ]
    )

    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    args = parse_args()
    metadata_rows = read_csv_rows(args.source / "virtual_layers_metadata_all.csv")
    listing_by_filename = read_listing(args.source / "virtual_layers.txt")
    manifest_by_filename = read_manifest(args.manifest)
    records = build_records(
        args.source,
        metadata_rows,
        listing_by_filename,
        manifest_by_filename,
    )
    write_records(args.output, records)
    write_summary(
        args.summary,
        args.source,
        args.manifest,
        args.output,
        records,
        metadata_rows,
        listing_by_filename,
        manifest_by_filename,
    )


if __name__ == "__main__":
    main()
