#!/usr/bin/env python3
"""Recover compact data-layer catalog records from HectaresBC archive metadata.

This script reads root listings, the ZIP manifest, and metadata-like members
inside data-layer ZIPs. It does not extract raster payloads.
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter
from datetime import date
from html.parser import HTMLParser
from pathlib import Path


DEFAULT_SOURCE = Path("tmp/shared-data/hectaresbc")
DEFAULT_MANIFEST = Path("metadata/archive_inventory/zip_manifest.csv")
DEFAULT_OUTPUT = Path("metadata/recovered_catalog/data_layer_records.csv")
DEFAULT_SUMMARY = Path("metadata/recovered_catalog/data_layer_recovery_summary.md")


class MetadataHTMLParser(HTMLParser):
    """Extract compact metadata signals from HectaresBC metadata HTML."""

    def __init__(self) -> None:
        super().__init__()
        self.meta: dict[str, str] = {}
        self.h1: list[str] = []
        self.h2: list[str] = []
        self.sections: dict[str, str] = {}
        self._capture: str | None = None
        self._buffer: list[str] = []
        self._current_section: str | None = None
        self._section_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = dict(attrs)
        if tag.lower() == "meta" and attr.get("name"):
            self.meta[attr["name"] or ""] = html.unescape(attr.get("content") or "")
        elif tag.lower() in {"h1", "h2"}:
            self._flush_section_text()
            self._capture = tag.lower()
            self._buffer = []

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag == self._capture:
            text = normalize_text(" ".join(self._buffer))
            if tag == "h1" and text:
                self.h1.append(text)
            elif tag == "h2" and text:
                self.h2.append(text)
                self._current_section = text
                self.sections.setdefault(text, "")
            self._capture = None
            self._buffer = []
        elif tag in {"p", "li"}:
            self._flush_section_text()

    def handle_data(self, data: str) -> None:
        if self._capture:
            self._buffer.append(data)
        elif self._current_section:
            text = normalize_text(data)
            if text:
                self._section_text.append(text)

    def _flush_section_text(self) -> None:
        if self._current_section and self._section_text:
            previous = self.sections.get(self._current_section, "")
            addition = normalize_text(" ".join(self._section_text))
            self.sections[self._current_section] = normalize_text(
                " ".join(part for part in [previous, addition] if part)
            )
            self._section_text = []

    def close(self) -> None:
        self._flush_section_text()
        super().close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--summary", type=Path, default=DEFAULT_SUMMARY)
    return parser.parse_args()


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def dataset_id(filename: str) -> str:
    return f"dl_{slugify(Path(filename).stem)}"


def json_dumps(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


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
            elif len(parts) >= 5:
                filename = parts[1]
                listed_date = parts[2]
                listed_time = parts[3]
                listed_size = parts[4]
            else:
                continue
            rows[filename] = {
                "listed_date": listed_date,
                "listed_time": listed_time,
                "listed_size": listed_size,
                "listing_raw": line,
            }
    return rows


def read_manifest(path: Path) -> list[dict[str, str]]:
    return [row for row in read_csv_rows(path) if row.get("family") == "data_layer"]


def parse_metadata_html(raw: bytes) -> dict[str, object]:
    parser = MetadataHTMLParser()
    parser.feed(raw.decode("utf-8", errors="replace"))
    parser.close()
    return {
        "meta": parser.meta,
        "h1": parser.h1,
        "h2": parser.h2,
        "sections": parser.sections,
    }


def parse_wms_xml(raw: bytes) -> dict[str, str]:
    try:
        root = ET.fromstring(raw.decode("utf-8", errors="replace"))
    except ET.ParseError:
        return {
            "wms_xml_status": "parse_error",
            "wms_root_tag": "",
            "wms_entry_count": "",
        }
    return {
        "wms_xml_status": "ok",
        "wms_root_tag": root.tag,
        "wms_entry_count": str(len(root.findall(".//entry"))),
    }


def parse_metadata_csv(raw: bytes) -> dict[str, str]:
    text = raw.decode("utf-8", errors="replace")
    reader = csv.DictReader(text.splitlines())
    rows = list(reader)
    return {
        "category_csv_columns": json_dumps(reader.fieldnames or []),
        "category_csv_row_count": str(len(rows)),
    }


def inspect_zip(source: Path, manifest: dict[str, str]) -> dict[str, object]:
    zip_rel_path = manifest["relative_path"]
    zip_path = source / zip_rel_path
    result: dict[str, object] = {
        "zip_read_status": "missing",
        "payload_members": [],
        "metadata_member_paths": [],
        "root_metadata_html_paths": [],
        "category_metadata_paths": [],
        "value_metadata_paths": [],
        "metadata_csv_paths": [],
        "raster_member_paths": [],
        "wms_member_paths": [],
        "nested_zip_paths": [],
        "primary_grid_metadata_path": "",
        "layer_metadata_path": "",
        "category_csv_path": "",
        "primary_metadata": {"meta": {}, "h1": [], "h2": [], "sections": {}},
        "layer_metadata": {"meta": {}, "h1": [], "h2": [], "sections": {}},
        "wms_info": {"wms_xml_status": "", "wms_root_tag": "", "wms_entry_count": ""},
        "category_csv_info": {"category_csv_columns": "[]", "category_csv_row_count": ""},
    }
    if not zip_path.exists():
        return result

    try:
        with zipfile.ZipFile(zip_path) as zf:
            names = [info.filename for info in zf.infolist() if not info.is_dir()]
            html_members = [name for name in names if name.lower().endswith(".html")]
            metadata_members = [
                name
                for name in names
                if name.lower().endswith((".html", ".csv", ".xml", ".txt"))
            ]
            root_html = [
                name
                for name in html_members
                if "/" not in name and name.lower().endswith(".metadata.html")
            ]
            metadata_csv = [
                name
                for name in names
                if "/" not in name and name.lower().endswith(".metadata.csv")
            ]
            raster_members = [
                name
                for name in names
                if Path(name).suffix.lower() in {".tif", ".tiff"}
            ]
            wms_members = [
                name for name in names if name.lower().endswith(".wms.xml")
            ]
            nested_zip_paths = [
                name for name in names if name.lower().endswith(".zip")
            ]
            category_paths = [
                name for name in html_members if name.startswith("category_metadata/")
            ]
            value_paths = [
                name for name in html_members if name.startswith("value_metadata/")
            ]

            primary_stem = Path(raster_members[0]).stem if raster_members else ""
            primary_grid_metadata = (
                f"{primary_stem}.metadata.html" if primary_stem else ""
            )
            if primary_grid_metadata not in root_html:
                primary_grid_metadata = root_html[0] if root_html else ""

            layer_metadata = ""
            layer_member = f"{manifest.get('name_prefix', '')}.metadata.html"
            if layer_member in root_html and layer_member != primary_grid_metadata:
                layer_metadata = layer_member
            else:
                for member in root_html:
                    if member != primary_grid_metadata:
                        layer_metadata = member
                        break

            result.update(
                {
                    "zip_read_status": "ok",
                    "payload_members": names,
                    "metadata_member_paths": metadata_members,
                    "root_metadata_html_paths": root_html,
                    "category_metadata_paths": category_paths,
                    "value_metadata_paths": value_paths,
                    "metadata_csv_paths": metadata_csv,
                    "raster_member_paths": raster_members,
                    "wms_member_paths": wms_members,
                    "nested_zip_paths": nested_zip_paths,
                    "primary_grid_metadata_path": primary_grid_metadata,
                    "layer_metadata_path": layer_metadata,
                    "category_csv_path": metadata_csv[0] if metadata_csv else "",
                }
            )
            if primary_grid_metadata:
                result["primary_metadata"] = parse_metadata_html(
                    zf.read(primary_grid_metadata)
                )
            if layer_metadata:
                result["layer_metadata"] = parse_metadata_html(zf.read(layer_metadata))
            if wms_members:
                result["wms_info"] = parse_wms_xml(zf.read(wms_members[0]))
            if metadata_csv:
                result["category_csv_info"] = parse_metadata_csv(zf.read(metadata_csv[0]))
    except zipfile.BadZipFile:
        result["zip_read_status"] = "bad_zip"
    except OSError as exc:
        result["zip_read_status"] = f"os_error:{exc.__class__.__name__}"
    return result


def pick_section(sections: dict[str, str], names: list[str]) -> str:
    lowered = {key.lower(): value for key, value in sections.items()}
    for name in names:
        if name.lower() in lowered:
            return lowered[name.lower()]
    return ""


def build_record(
    source: Path,
    manifest: dict[str, str],
    listing: dict[str, str],
    seen_ids: set[str],
) -> dict[str, str]:
    filename = manifest["filename"]
    record_id = dataset_id(filename)
    zip_info = inspect_zip(source, manifest)

    primary = zip_info["primary_metadata"]
    layer = zip_info["layer_metadata"]
    wms = zip_info["wms_info"]
    csv_info = zip_info["category_csv_info"]
    assert isinstance(primary, dict)
    assert isinstance(layer, dict)
    assert isinstance(wms, dict)
    assert isinstance(csv_info, dict)

    primary_meta = primary.get("meta", {})
    primary_sections = primary.get("sections", {})
    layer_meta = layer.get("meta", {})
    assert isinstance(primary_meta, dict)
    assert isinstance(primary_sections, dict)
    assert isinstance(layer_meta, dict)

    primary_h1 = primary.get("h1", [])
    primary_h2 = primary.get("h2", [])
    layer_h1 = layer.get("h1", [])
    assert isinstance(primary_h1, list)
    assert isinstance(primary_h2, list)
    assert isinstance(layer_h1, list)

    mismatches: list[str] = []
    if primary_meta.get("fixed_layer_name") and (
        primary_meta.get("fixed_layer_name") != manifest.get("name_prefix")
    ):
        mismatches.append("fixed_layer_name!=manifest_name_prefix")
    raster_members = zip_info["raster_member_paths"]
    assert isinstance(raster_members, list)
    if raster_members and primary_meta.get("fixed_grid_name") and (
        primary_meta.get("fixed_grid_name") != Path(str(raster_members[0])).stem
    ):
        mismatches.append("fixed_grid_name!=raster_stem")
    if record_id in seen_ids:
        mismatches.append("duplicate_dataset_id")
    seen_ids.add(record_id)

    known_gaps: list[str] = []
    if not listing:
        known_gaps.append("missing_root_listing_row")
    if zip_info["zip_read_status"] != "ok":
        known_gaps.append("zip_not_read")
    if not zip_info["primary_grid_metadata_path"]:
        known_gaps.append("missing_primary_grid_metadata_html")
    if not raster_members:
        known_gaps.append("missing_raster_member")
    if not zip_info["wms_member_paths"]:
        known_gaps.append("missing_wms_xml_member")

    if mismatches:
        verification_status = "conflict_detected"
    elif known_gaps:
        verification_status = "metadata_partial"
    else:
        verification_status = "metadata_recovered"

    title_candidate = (
        str(primary_meta.get("gui_grid_name") or "")
        or (str(primary_h1[0]) if primary_h1 else "")
    )
    parent_layer_title = (
        str(layer_meta.get("gui_layer_name") or "")
        or (str(layer_h1[0]) if layer_h1 else "")
    )

    uncertainty_notes = [
        "CRS and spatial extent are not populated because data-layer HTML/WMS metadata did not provide authoritative CRS or bounds."
    ]
    if mismatches:
        uncertainty_notes.append(
            "Detected metadata consistency issues: " + ", ".join(mismatches)
        )
    if zip_info["nested_zip_paths"]:
        uncertainty_notes.append("ZIP contains nested ZIP payload members.")

    description = str(primary_meta.get("description") or "")
    if not description:
        description = pick_section(primary_sections, ["Description"])

    recovery_sources = [
        "metadata/archive_inventory/zip_manifest.csv",
        "tmp/shared-data/hectaresbc/data_layers.txt",
        manifest["relative_path"],
    ]

    compact_payload_members = [
        str(path)
        for path in [
            zip_info["primary_grid_metadata_path"],
            zip_info["layer_metadata_path"],
            zip_info["category_csv_path"],
            *raster_members,
            *zip_info["wms_member_paths"],
            *zip_info["nested_zip_paths"],
        ]
        if path
    ]
    metadata_member_paths = [
        str(path)
        for path in [
            zip_info["primary_grid_metadata_path"],
            zip_info["layer_metadata_path"],
            zip_info["category_csv_path"],
            *zip_info["wms_member_paths"],
        ]
        if path
    ]

    category_metadata_paths = zip_info["category_metadata_paths"]
    value_metadata_paths = zip_info["value_metadata_paths"]
    assert isinstance(category_metadata_paths, list)
    assert isinstance(value_metadata_paths, list)

    return {
        "dataset_id": record_id,
        "source_family": "data_layer",
        "source_zip_path": manifest["relative_path"],
        "source_filename": filename,
        "source_stem": Path(filename).stem,
        "payload_members": json_dumps(compact_payload_members),
        "payload_member_count": str(len(zip_info["payload_members"])),
        "metadata_member_paths": json_dumps(metadata_member_paths),
        "metadata_member_count": str(len(zip_info["metadata_member_paths"])),
        "root_metadata_html_paths": json_dumps(zip_info["root_metadata_html_paths"]),
        "primary_grid_metadata_path": str(zip_info["primary_grid_metadata_path"]),
        "layer_metadata_path": str(zip_info["layer_metadata_path"]),
        "metadata_csv_paths": json_dumps(zip_info["metadata_csv_paths"]),
        "category_metadata_count": str(len(category_metadata_paths)),
        "category_metadata_sample_paths": json_dumps(category_metadata_paths[:10]),
        "value_metadata_count": str(len(value_metadata_paths)),
        "value_metadata_sample_paths": json_dumps(value_metadata_paths[:10]),
        "raster_member_paths": json_dumps(raster_members),
        "wms_member_paths": json_dumps(zip_info["wms_member_paths"]),
        "nested_zip_paths": json_dumps(zip_info["nested_zip_paths"]),
        "title_candidate": title_candidate,
        "title_source": (
            f"{zip_info['primary_grid_metadata_path']}:gui_grid_name"
            if primary_meta.get("gui_grid_name")
            else f"{zip_info['primary_grid_metadata_path']}:h1"
        ),
        "parent_layer_title": parent_layer_title,
        "fixed_layer_name": str(primary_meta.get("fixed_layer_name", "")),
        "fixed_grid_name": str(primary_meta.get("fixed_grid_name", "")),
        "gui_order": str(primary_meta.get("gui_order", "")),
        "description": description,
        "scale_factor": str(primary_meta.get("scale_factor", "")),
        "indexed": str(primary_meta.get("indexed", "")),
        "isregional": str(primary_meta.get("isregional", "")),
        "html_h1": json_dumps(primary_h1),
        "html_h2": json_dumps(primary_h2),
        "creation_date": pick_section(primary_sections, ["Creation Date"]),
        "load_date": pick_section(primary_sections, ["Load Date"]),
        "coverage": pick_section(primary_sections, ["Coverage"]),
        "creator": pick_section(primary_sections, ["Creator"]),
        "publisher": pick_section(primary_sections, ["Publisher"]),
        "rights": pick_section(primary_sections, ["Rights"]),
        "units": pick_section(primary_sections, ["Units"]),
        "lineage": pick_section(primary_sections, ["Lineage", "Source"]),
        "license_or_use_constraints": pick_section(
            primary_sections, ["Rights", "Use Constraints"]
        ),
        "crs": "",
        "spatial_extent": "",
        "format_signals": json_dumps(["tiff", "wms_xml"]),
        "wms_xml_status": str(wms.get("wms_xml_status", "")),
        "wms_root_tag": str(wms.get("wms_root_tag", "")),
        "wms_entry_count": str(wms.get("wms_entry_count", "")),
        "category_csv_path": str(zip_info["category_csv_path"]),
        "category_csv_columns": str(csv_info.get("category_csv_columns", "[]")),
        "category_csv_row_count": str(csv_info.get("category_csv_row_count", "")),
        "manifest_row_source": (
            "metadata/archive_inventory/zip_manifest.csv:"
            f"{manifest['relative_path']}"
        ),
        "root_listing_source": (
            f"tmp/shared-data/hectaresbc/data_layers.txt:{filename}"
            if listing
            else ""
        ),
        "zip_metadata_source": str(zip_info["primary_grid_metadata_path"]),
        "recovery_sources": json_dumps(recovery_sources),
        "recovery_method": "scripts/recover_data_layer_records.py",
        "recovered_at": date.today().isoformat(),
        "verification_status": verification_status,
        "known_gaps": json_dumps(known_gaps),
        "metadata_mismatches": json_dumps(mismatches),
        "uncertainty_notes": json_dumps(uncertainty_notes),
        "zip_read_status": str(zip_info["zip_read_status"]),
        "manifest_zip_status": manifest.get("zip_status", ""),
        "manifest_size_bytes": manifest.get("size_bytes", ""),
        "listed_date": listing.get("listed_date", ""),
        "listed_time": listing.get("listed_time", ""),
        "listed_size": listing.get("listed_size", ""),
    }


def build_records(
    source: Path,
    manifests: list[dict[str, str]],
    listing_by_filename: dict[str, dict[str, str]],
) -> list[dict[str, str]]:
    seen_ids: set[str] = set()
    return [
        build_record(
            source,
            manifest,
            listing_by_filename.get(manifest["filename"], {}),
            seen_ids,
        )
        for manifest in manifests
    ]


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
    manifest_path: Path,
    output: Path,
    records: list[dict[str, str]],
    manifests: list[dict[str, str]],
    listing_by_filename: dict[str, dict[str, str]],
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    manifest_names = {row["filename"] for row in manifests}
    listing_names = set(listing_by_filename)
    verification_counts = Counter(row["verification_status"] for row in records)
    zip_counts = Counter(row["zip_read_status"] for row in records)
    wms_counts = Counter(row["wms_xml_status"] for row in records)
    category_csv_counts = Counter(
        "present" if row["category_csv_path"] else "absent" for row in records
    )
    nested_zip_records = [row for row in records if json.loads(row["nested_zip_paths"])]
    mismatch_counts = Counter()
    known_gap_counts = Counter()
    for row in records:
        for mismatch in json.loads(row["metadata_mismatches"]):
            mismatch_counts[mismatch] += 1
        for gap in json.loads(row["known_gaps"]):
            known_gap_counts[gap] += 1

    lines = [
        "# Data Layer Recovery Summary",
        "",
        "## Purpose",
        "",
        "Summarize compact data-layer catalog recovery from root listings, the ZIP manifest, and data-layer ZIP metadata members.",
        "",
        "## Inputs",
        "",
        f"- Source root: `{source}`",
        f"- ZIP manifest: `{manifest_path}`",
        "- Root listing: `tmp/shared-data/hectaresbc/data_layers.txt`",
        "",
        "## Output",
        "",
        f"- Records: `{output}`",
        "",
        "## Counts",
        "",
        f"- Manifest data-layer rows: {len(manifests)}",
        f"- Recovered records: {len(records)}",
        f"- Unique source filenames: {len({row['source_filename'] for row in records})}",
        f"- Filenames with root listing rows: {len(manifest_names & listing_names)}",
        f"- Missing from root listing: {len(manifest_names - listing_names)}",
        "",
        "## Verification Status",
        "",
        *format_counter(verification_counts),
        "",
        "## ZIP Read Status",
        "",
        *format_counter(zip_counts),
        "",
        "## WMS XML Parse Status",
        "",
        *format_counter(wms_counts),
        "",
        "## Category CSV Presence",
        "",
        *format_counter(category_csv_counts),
        "",
        "## Known Gaps",
        "",
    ]
    if known_gap_counts:
        lines.extend(format_counter(known_gap_counts))
    else:
        lines.append("- No known record-level gaps detected by the recovery script.")

    lines.extend(["", "## Metadata Mismatches", ""])
    if mismatch_counts:
        lines.extend(format_counter(mismatch_counts))
    else:
        lines.append("- No metadata consistency mismatches detected.")

    lines.extend(["", "## Nested ZIP Members", ""])
    if nested_zip_records:
        for row in nested_zip_records:
            lines.append(
                f"- `{row['source_zip_path']}` contains {row['nested_zip_paths']}"
            )
    else:
        lines.append("- No nested ZIP members detected.")

    lines.extend(
        [
            "",
            "## Notes",
            "",
            "- Primary grid metadata is selected from the root-level HTML member matching the raster stem when available.",
            "- Layer metadata is selected from the root-level HTML member matching the manifest name prefix when available.",
            "- `.wms.xml` files are treated as legend/value styling metadata, not authoritative WMS service capabilities.",
            "- CRS and spatial extent are intentionally blank because the inspected HTML and WMS XML metadata did not provide authoritative CRS or bounds.",
            "- `dataset_id` values are provisional and follow the P2.1 identity-model rule.",
            "",
            "## Command",
            "",
            "```bash",
            "python scripts/recover_data_layer_records.py",
            "```",
            "",
        ]
    )

    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    args = parse_args()
    manifests = read_manifest(args.manifest)
    listing_by_filename = read_listing(args.source / "data_layers.txt")
    records = build_records(args.source, manifests, listing_by_filename)
    write_records(args.output, records)
    write_summary(
        args.summary,
        args.source,
        args.manifest,
        args.output,
        records,
        manifests,
        listing_by_filename,
    )


if __name__ == "__main__":
    main()
