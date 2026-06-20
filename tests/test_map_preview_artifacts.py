import json
import subprocess
import sys
from pathlib import Path

import pytest
from PIL import Image

from scripts.generate_map_preview_artifacts import build_preview_manifest


REPO_ROOT = Path(__file__).resolve().parents[1]


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
    reference_layer = manifest["reference_layers"][0]
    assert reference_layer["role"] == "source_derived_basemap_reference"
    assert reference_layer["dataset_id"] == "dl_adminunits_nrsab"
    assert reference_layer["source_zip_path"] == "data_layers/adminunits_nrsab.zip"
    assert reference_layer["raw_relative_path"] == (
        "raw/hectaresbc_2022_export/data_layers/adminunits_nrsab.zip"
    )
    assert reference_layer["artifact_path"] == "context/bc_admin_reference.png"
    assert reference_layer["artifact_status"] == "source_derived_basemap_reference"
    assert reference_layer["internal_raster_path"] == "nrsab.tiff"
    assert reference_layer["internal_wms_path"] == "nrsab.wms.xml"
    assert reference_layer["crs"] == "EPSG:3005"
    assert reference_layer["raster_width"] == 17216
    assert reference_layer["raster_height"] == 15744
    assert reference_layer["dtype"] == "int16"
    assert reference_layer["nodata"] == -9999.0
    assert reference_layer["value_count"] == 8

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
    assert artifact["native_bounds"] == [159587.5, 173787.5, 1881187.5, 1748187.5]
    assert artifact["wgs84_bounds"] == pytest.approx(
        [-141.0962892349142, 45.9344383046823, -110.19483972116899, 60.71688156515922]
    )
    assert artifact["raster_width"] == 17216
    assert artifact["raster_height"] == 15744
    assert artifact["dtype"] == "int16"
    assert artifact["nodata"] == -9999.0
    assert artifact["value_class_count"] == 12
    assert [item["value"] for item in artifact["value_classes"]] == list(range(1, 13))
    assert artifact["value_classes"][0]["label"] == "TBA (Babine)"
    assert artifact["value_classes"][0]["rgba"] == [131, 171, 38, 220]
    assert artifact["preview_eligibility_status"] == "source_derived_preview"
    assert artifact["preview_eligibility_blockers"] == []

    with Image.open(output_dir / artifact["artifact_path"]) as image:
        assert image.mode == "RGBA"
        assert image.size == (artifact["preview_width"], artifact["preview_height"])
        assert image.getchannel("A").getbbox() is not None
        colors = image.getcolors(maxcolors=image.size[0] * image.size[1])
        assert colors is not None
        assert len({color for _count, color in colors if color[3] > 0}) == 12

    with Image.open(output_dir / reference_layer["artifact_path"]) as image:
        assert image.mode == "RGBA"
        assert image.size == (
            reference_layer["preview_width"],
            reference_layer["preview_height"],
        )
        assert image.getchannel("A").getbbox() is not None

    serialized = json.dumps(manifest, sort_keys=True)
    assert "/home/" not in serialized
    assert "tmp/shared-data/hectaresbc" not in serialized
    assert "tmp/bootstrap" not in serialized
    assert "aws-secrets" not in serialized


def test_map_preview_artifact_scripts_generate_and_validate(tmp_path: Path) -> None:
    output_dir = tmp_path / "map_previews"

    generate = subprocess.run(
        [
            sys.executable,
            str(REPO_ROOT / "scripts/generate_map_preview_artifacts.py"),
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
            str(REPO_ROOT / "scripts/smoke_test_map_preview_artifacts.py"),
            str(output_dir),
        ],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert "validated map preview artifacts" in smoke.stdout


def test_map_preview_generator_fails_clearly_without_source_payload(tmp_path: Path) -> None:
    output_dir = tmp_path / "map_previews"
    empty_archive_root = tmp_path / "empty-archive"

    result = subprocess.run(
        [
            sys.executable,
            str(REPO_ROOT / "scripts/generate_map_preview_artifacts.py"),
            "--max-size",
            "64",
            "--output-dir",
            str(output_dir),
            "--local-archive-root",
            str(empty_archive_root),
        ],
        cwd=tmp_path,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    assert result.returncode != 0
    assert "source ZIP content is unavailable" in result.stderr
    assert "raw/hectaresbc_2022_export/data_layers/adminunits_bcts.zip" in result.stderr
    assert str(empty_archive_root / "data_layers" / "adminunits_bcts.zip") in result.stderr
    assert "/home/" not in result.stderr
    assert not (output_dir / "manifest.json").exists()
