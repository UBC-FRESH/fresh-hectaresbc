from __future__ import annotations

import csv
import json
from pathlib import Path


FEASIBILITY_DIR = Path("metadata/preview_feasibility")


def test_preview_feasibility_summary_covers_recovered_catalog() -> None:
    summary = json.loads(
        (FEASIBILITY_DIR / "preview_feasibility_summary.json").read_text(
            encoding="utf-8"
        )
    )

    assert summary["record_count"] == 2183
    assert summary["family_counts"] == {"data_layer": 418, "virtual_layer": 1765}
    assert summary["status_counts"] == {"metadata_preview_candidate": 2183}
    assert summary["sample_size"] == 0


def test_preview_feasibility_csv_has_representative_source_metadata() -> None:
    rows = _rows_by_id()

    bcts = rows["dl_adminunits_bcts"]
    assert bcts["source_zip_path"] == "data_layers/adminunits_bcts.zip"
    assert bcts["raw_relative_path"] == (
        "raw/hectaresbc_2022_export/data_layers/adminunits_bcts.zip"
    )
    assert bcts["raster_member_path"] == "bcts.tiff"
    assert bcts["wms_member_path"] == "bcts.wms.xml"
    assert bcts["crs"] == "EPSG:3005"
    assert bcts["raster_width"] == "17216"
    assert bcts["raster_height"] == "15744"
    assert bcts["dtype"] == "int16"
    assert bcts["nodata"] == "-9999.0"
    assert bcts["visual_signal_status"] == "not_sampled_metadata_only"
    assert bcts["wms_value_class_count"] == "12"

    virtual = rows["vl_virtualspecies_bulltroutsalvelinusconfluentus_1135"]
    assert virtual["source_family"] == "virtual_layer"
    assert virtual["source_zip_path"] == (
        "virtual_layers/virtualspecies.bulltroutsalvelinusconfluentus.1135.zip"
    )
    assert (
        virtual["raster_member_path"]
        == "virtualspecies.bulltroutsalvelinusconfluentus.1135.tiff"
    )
    assert virtual["crs"] == "EPSG:3005"
    assert virtual["preview_feasibility_status"] == "metadata_preview_candidate"


def test_preview_feasibility_outputs_do_not_leak_private_paths() -> None:
    payload = "\n".join(
        path.read_text(encoding="utf-8")
        for path in (
            FEASIBILITY_DIR / "layer_preview_feasibility.csv",
            FEASIBILITY_DIR / "preview_feasibility_summary.json",
        )
    )

    for forbidden in (
        "/home/",
        "tmp/shared-data/hectaresbc",
        "tmp/bootstrap",
        "aws-secrets",
    ):
        assert forbidden not in payload


def _rows_by_id() -> dict[str, dict[str, str]]:
    with (FEASIBILITY_DIR / "layer_preview_feasibility.csv").open(
        newline="", encoding="utf-8"
    ) as stream:
        rows = list(csv.DictReader(stream))

    assert len(rows) == 2183
    return {row["dataset_id"]: row for row in rows}
