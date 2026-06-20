from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

from scripts.generate_layer_preview_batch import generate_batch, read_feasibility_rows


def test_layer_preview_batch_generates_representative_artifacts(tmp_path: Path) -> None:
    rows_by_id = {
        row["dataset_id"]: row
        for row in read_feasibility_rows(
            Path("metadata/preview_feasibility/layer_preview_feasibility.csv")
        )
    }
    rows = [
        rows_by_id["dl_adminunits_bcts"],
        rows_by_id["vl_virtualspecies_bulltroutsalvelinusconfluentus_1135"],
    ]

    summary = generate_batch(rows, output_root=tmp_path, max_size=64, force=True)

    assert summary["requested_count"] == 2
    assert summary["processed_count"] == 2
    assert summary["artifact_count"] == 2
    assert summary["failure_count"] == 0

    index = json.loads((tmp_path / "index.json").read_text(encoding="utf-8"))
    assert len(index["layers"]) == 2

    bcts_manifest = json.loads(
        (tmp_path / "layers" / "dl_adminunits_bcts" / "manifest.json").read_text(
            encoding="utf-8"
        )
    )
    assert bcts_manifest["artifact_status"] == "source_derived_preview"
    assert bcts_manifest["artifact_path"] == "layers/dl_adminunits_bcts/preview.png"
    assert bcts_manifest["crs"] == "EPSG:3005"
    assert bcts_manifest["value_class_count"] == 12

    for row in rows:
        png_path = tmp_path / "layers" / row["dataset_id"] / "preview.png"
        assert png_path.exists()
        with Image.open(png_path) as image:
            assert image.mode == "RGBA"
            assert max(image.size) <= 64
            assert image.getchannel("A").getbbox() is not None


def test_layer_preview_batch_outputs_do_not_leak_private_paths(tmp_path: Path) -> None:
    rows = [
        row
        for row in read_feasibility_rows(
            Path("metadata/preview_feasibility/layer_preview_feasibility.csv")
        )
        if row["dataset_id"] == "dl_adminunits_bcts"
    ]

    generate_batch(rows, output_root=tmp_path, max_size=32, force=True)
    payload = "\n".join(path.read_text(encoding="utf-8") for path in tmp_path.rglob("*.json"))

    for forbidden in (
        "/home/",
        "tmp/shared-data/hectaresbc",
        "tmp/bootstrap",
        "aws-secrets",
    ):
        assert forbidden not in payload
