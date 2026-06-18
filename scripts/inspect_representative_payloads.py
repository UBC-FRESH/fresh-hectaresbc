#!/usr/bin/env python3
"""Inspect representative HectaresBC source payloads.

This script performs small, read-only source checks. If rasterio is available,
it temporarily extracts representative TIFFs under ignored tmp/ for raster
metadata inspection and deletes them after reading.
"""

from __future__ import annotations

import argparse
import csv
import json
import shutil
import tempfile
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path


DEFAULT_SOURCE = Path("tmp/shared-data/hectaresbc")
DEFAULT_DATA = Path("metadata/recovered_catalog/data_layer_records.csv")
DEFAULT_VIRTUAL = Path("metadata/recovered_catalog/virtual_layer_records.csv")
DEFAULT_OUTPUT = Path("metadata/validation/representative_payload_validation.md")
DEFAULT_TMP = Path("tmp/validation_payloads")

REPRESENTATIVE_ZIPS = [
    (
        "typical data layer with category metadata",
        "data_layers/adminunits_bcts.zip",
    ),
    (
        "typical data layer with value metadata",
        "data_layers/climatedecade_ahm.zip",
    ),
    (
        "data layer with nested ZIP member",
        "data_layers/climatercp452050_tmaxsp.zip",
    ),
    (
        "large data-layer ZIP",
        "data_layers/water_distancetocoast.zip",
    ),
    (
        "typical virtual layer",
        "virtual_layers/virtualecocomm.alaskanmountainheatherdwarfshrublandharrimanellastellerianadwarfshrubland.425.zip",
    ),
    (
        "large virtual layer",
        "virtual_layers/virtualspecies.bulltroutsalvelinusconfluentus.1135.zip",
    ),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--virtual", type=Path, default=DEFAULT_VIRTUAL)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--tmp-dir", type=Path, default=DEFAULT_TMP)
    return parser.parse_args()


def read_csv_by_path(path: Path) -> dict[str, dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return {
            row["source_zip_path"]: row
            for row in csv.DictReader(handle)
            if row.get("source_zip_path")
        }


def list_field(row: dict[str, str], field: str) -> list[str]:
    try:
        value = json.loads(row.get(field, "[]"))
    except json.JSONDecodeError:
        return []
    return value if isinstance(value, list) else []


def rasterio_status() -> tuple[object | None, str]:
    try:
        import rasterio  # type: ignore

        return rasterio, f"available {rasterio.__version__}"
    except Exception as exc:  # pragma: no cover - environment dependent
        return None, f"unavailable: {exc.__class__.__name__}: {exc}"


def inspect_raster_with_rasterio(
    rasterio_module: object,
    zip_file: zipfile.ZipFile,
    member: str,
    tmp_dir: Path,
) -> dict[str, str]:
    tmp_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        suffix=Path(member).suffix or ".tif",
        dir=tmp_dir,
        delete=False,
    ) as handle:
        tmp_path = Path(handle.name)
        with zip_file.open(member) as source:
            shutil.copyfileobj(source, handle)
    try:
        with rasterio_module.open(tmp_path) as dataset:  # type: ignore[attr-defined]
            bounds = dataset.bounds
            return {
                "raster_inspection_status": "ok",
                "raster_driver": str(dataset.driver),
                "raster_width": str(dataset.width),
                "raster_height": str(dataset.height),
                "raster_count": str(dataset.count),
                "raster_dtype": ",".join(str(dtype) for dtype in dataset.dtypes),
                "raster_crs": str(dataset.crs or ""),
                "raster_bounds": (
                    f"{bounds.left},{bounds.bottom},{bounds.right},{bounds.top}"
                ),
                "raster_nodata": str(dataset.nodata),
            }
    except Exception as exc:
        return {
            "raster_inspection_status": f"error:{exc.__class__.__name__}",
            "raster_driver": "",
            "raster_width": "",
            "raster_height": "",
            "raster_count": "",
            "raster_dtype": "",
            "raster_crs": "",
            "raster_bounds": "",
            "raster_nodata": "",
        }
    finally:
        tmp_path.unlink(missing_ok=True)


def inspect_xml(zip_file: zipfile.ZipFile, member: str) -> str:
    try:
        ET.fromstring(zip_file.read(member).decode("utf-8", errors="replace"))
    except ET.ParseError as exc:
        return f"parse_error:{exc.__class__.__name__}"
    return "ok"


def inspect_representatives(
    source: Path,
    data_rows: dict[str, dict[str, str]],
    virtual_rows: dict[str, dict[str, str]],
    tmp_dir: Path,
) -> tuple[list[dict[str, str]], str]:
    rasterio_module, rasterio_note = rasterio_status()
    all_rows = {**data_rows, **virtual_rows}
    results: list[dict[str, str]] = []

    for purpose, rel_path in REPRESENTATIVE_ZIPS:
        row = all_rows.get(rel_path, {})
        zip_path = source / rel_path
        result = {
            "purpose": purpose,
            "source_zip_path": rel_path,
            "source_exists": str(zip_path.exists()).lower(),
            "record_found": str(bool(row)).lower(),
            "zip_status": "missing",
            "metadata_members_read": "0",
            "raster_member": "",
            "raster_member_found": "false",
            "nested_zip_members": "[]",
            "metadata_parse_status": "",
            "raster_inspection_status": "not_run",
            "raster_driver": "",
            "raster_width": "",
            "raster_height": "",
            "raster_count": "",
            "raster_dtype": "",
            "raster_crs": "",
            "raster_bounds": "",
            "raster_nodata": "",
        }
        if not zip_path.exists():
            results.append(result)
            continue

        try:
            with zipfile.ZipFile(zip_path) as zf:
                names = {info.filename for info in zf.infolist() if not info.is_dir()}
                result["zip_status"] = "ok"
                metadata_members = [
                    member
                    for member in list_field(row, "metadata_member_paths")
                    if member in names
                ]
                result["metadata_members_read"] = str(len(metadata_members))

                raster_members = [
                    member
                    for member in list_field(row, "raster_member_paths")
                    if member in names
                ]
                if raster_members:
                    result["raster_member"] = raster_members[0]
                    result["raster_member_found"] = "true"

                nested_members = [
                    member for member in names if member.lower().endswith(".zip")
                ]
                result["nested_zip_members"] = json.dumps(sorted(nested_members))

                if rel_path.startswith("data_layers/"):
                    wms_members = [
                        member
                        for member in list_field(row, "wms_member_paths")
                        if member in names
                    ]
                    if wms_members:
                        result["metadata_parse_status"] = inspect_xml(zf, wms_members[0])
                    else:
                        result["metadata_parse_status"] = "missing_wms_xml"
                else:
                    if "metadata.txt" in names:
                        data = zf.read("metadata.txt").decode(
                            "utf-8", errors="replace"
                        )
                        result["metadata_parse_status"] = (
                            "ok" if "layer_name:" in data else "missing_layer_name"
                        )
                    else:
                        result["metadata_parse_status"] = "missing_metadata_txt"

                if rasterio_module and raster_members:
                    raster_info = inspect_raster_with_rasterio(
                        rasterio_module, zf, raster_members[0], tmp_dir
                    )
                    result.update(raster_info)
                elif raster_members:
                    result["raster_inspection_status"] = "deferred_no_rasterio"
        except zipfile.BadZipFile:
            result["zip_status"] = "bad_zip"
        results.append(result)

    return results, rasterio_note


def write_report(output: Path, source: Path, results: list[dict[str, str]], rasterio_note: str) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    pass_count = sum(
        1
        for row in results
        if row["source_exists"] == "true"
        and row["record_found"] == "true"
        and row["zip_status"] == "ok"
        and row["raster_member_found"] == "true"
        and row["metadata_parse_status"] == "ok"
        and row["raster_inspection_status"] == "ok"
    )
    lines = [
        "# Representative Payload Validation",
        "",
        "## Inputs",
        "",
        f"- Source root: `{source}`",
        "- Data-layer records: `metadata/recovered_catalog/data_layer_records.csv`",
        "- Virtual-layer records: `metadata/recovered_catalog/virtual_layer_records.csv`",
        "",
        "## Environment",
        "",
        f"- rasterio: {rasterio_note}",
        "",
        "## Summary",
        "",
        f"- Representative payloads inspected: {len(results)}",
        f"- Fully passed representative checks: {pass_count}",
        "",
        "## Results",
        "",
        "| Purpose | Source ZIP | ZIP | Metadata | Raster | CRS | Dimensions | Nested ZIPs |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for row in results:
        dimensions = (
            f"{row['raster_width']}x{row['raster_height']}"
            if row["raster_width"] and row["raster_height"]
            else ""
        )
        lines.append(
            "| {purpose} | `{source_zip_path}` | {zip_status} | {metadata_parse_status} | "
            "{raster_inspection_status} | `{raster_crs}` | {dimensions} | `{nested_zip_members}` |".format(
                **row,
                dimensions=dimensions,
            )
        )

    lines.extend(
        [
            "",
            "## Notes",
            "",
            "- TIFF members were inspected through temporary files under ignored `tmp/` and deleted after reading.",
            "- Nested ZIP members are reported but not extracted.",
            "- These are representative checks only; they do not replace full archive CRC or full raster readability validation.",
            "",
            "## Command",
            "",
            "```bash",
            "python scripts/inspect_representative_payloads.py",
            "```",
            "",
        ]
    )
    output.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    args = parse_args()
    data_rows = read_csv_by_path(args.data)
    virtual_rows = read_csv_by_path(args.virtual)
    results, rasterio_note = inspect_representatives(
        args.source, data_rows, virtual_rows, args.tmp_dir
    )
    write_report(args.output, args.source, results, rasterio_note)
    failures = [
        row
        for row in results
        if row["source_exists"] != "true"
        or row["record_found"] != "true"
        or row["zip_status"] != "ok"
        or row["raster_member_found"] != "true"
        or row["metadata_parse_status"] != "ok"
        or row["raster_inspection_status"] not in {"ok", "deferred_no_rasterio"}
    ]
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

