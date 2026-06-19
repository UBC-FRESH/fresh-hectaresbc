import json
import subprocess
import sys
from pathlib import Path

from scripts.generate_map_preview_artifacts import build_preview_manifest


def test_map_preview_manifest_records_fixture_provenance(tmp_path: Path) -> None:
    manifest = build_preview_manifest(tmp_path / "map_previews")

    assert manifest["schema_version"] == 1
    assert manifest["artifact_count"] == 1
    assert manifest["artifact_scope"] == "ui_fixture_pending_payload_derivation"
    assert manifest["representative_records"] == {
        "data_layer_candidate": "dl_water_cwb_canals",
        "unavailable_record": "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135",
    }

    artifact = manifest["artifacts"][0]
    assert artifact["dataset_id"] == "dl_water_cwb_canals"
    assert artifact["source_zip_path"] == "data_layers/water_cwb_canals.zip"
    assert artifact["raw_relative_path"] == (
        "raw/hectaresbc_2022_export/data_layers/water_cwb_canals.zip"
    )
    assert artifact["artifact_path"] == "dl_water_cwb_canals/preview.geojson"
    assert artifact["artifact_status"] == "fixture_pending_source_derivation"
    assert artifact["preview_eligibility_status"] == "candidate_missing_crs"
    assert artifact["preview_eligibility_blockers"] == [
        "missing_crs",
        "missing_extent",
    ]
    assert "not recovered HectaresBC canal geometry" in artifact["fixture_warning"]

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
