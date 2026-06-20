import json
import subprocess
import sys
from pathlib import Path

from PIL import Image

from scripts.generate_map_preview_artifacts import build_preview_manifest


def test_map_preview_manifest_records_source_derived_provenance(tmp_path: Path) -> None:
    output_dir = tmp_path / "map_previews"
    manifest = build_preview_manifest(output_dir, write_artifacts=True, max_size=256)

    assert manifest["schema_version"] == 2
    assert manifest["artifact_count"] == 1
    assert manifest["artifact_format"] == "raster_png"
    assert manifest["artifact_scope"] == "source_derived_payload_preview"
    assert manifest["representative_records"] == {
        "data_layer_candidate": "dl_adminunits_bcts",
        "unavailable_record": "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135",
    }

    artifact = manifest["artifacts"][0]
    assert artifact["dataset_id"] == "dl_adminunits_bcts"
    assert artifact["source_zip_path"] == "data_layers/adminunits_bcts.zip"
    assert artifact["raw_relative_path"] == (
        "raw/hectaresbc_2022_export/data_layers/adminunits_bcts.zip"
    )
    assert artifact["artifact_path"] == "dl_adminunits_bcts/preview.png"
    assert artifact["artifact_status"] == "source_derived_preview"
    assert artifact["artifact_kind"] == "raster_png"
    assert artifact["internal_raster_path"] == "bcts.tiff"
    assert artifact["internal_wms_path"] == "bcts.wms.xml"
    assert artifact["crs"] == "EPSG:3005"
    assert artifact["dtype"] == "int16"
    assert artifact["nodata"] == -9999.0
    assert artifact["value_class_count"] == 12
    assert [item["value"] for item in artifact["value_classes"]] == list(range(1, 13))
    assert artifact["preview_eligibility_status"] == "source_derived_preview"
    assert artifact["preview_eligibility_blockers"] == []

    with Image.open(output_dir / artifact["artifact_path"]) as image:
        assert image.mode == "RGBA"
        assert image.size == (artifact["preview_width"], artifact["preview_height"])
        assert image.getchannel("A").getbbox() is not None

    serialized = json.dumps(manifest, sort_keys=True)
    assert "/home/" not in serialized
    assert "tmp/shared-data/hectaresbc" not in serialized
    assert "aws-secrets" not in serialized


def test_map_preview_artifact_scripts_generate_and_validate(tmp_path: Path) -> None:
    output_dir = tmp_path / "map_previews"

    generate = subprocess.run(
        [
            sys.executable,
            "scripts/generate_map_preview_artifacts.py",
            "--max-size",
            "256",
            "--output-dir",
            str(output_dir),
        ],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert "wrote map preview artifacts" in generate.stdout

    smoke = subprocess.run(
        [
            sys.executable,
            "scripts/smoke_test_map_preview_artifacts.py",
            str(output_dir),
        ],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert "validated map preview artifacts" in smoke.stdout
