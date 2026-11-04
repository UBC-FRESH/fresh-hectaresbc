"""Check the curated COG preset and dry-run planner."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]


def _dry_run(*args: str) -> dict:
    completed = subprocess.run(
        [
            sys.executable,
            str(REPO_ROOT / "scripts" / "build_tile_cog.py"),
            "--dry-run",
            *args,
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(completed.stdout.strip().splitlines()[-1])


def test_core_admin_preset_expands_to_unique_layers(tmp_path: Path) -> None:
    plan = _dry_run(
        "--preset",
        "core-admin",
        "--output-root",
        str(tmp_path),
        "--dataset-id",
        "dl_adminunits_bcts",
    )
    assert plan["status"] == "dry-run"
    assert plan["output_root"] == str(tmp_path.resolve())
    dataset_ids = [item["dataset_id"] for item in plan["datasets"]]
    assert dataset_ids == [
        "dl_adminunits_bcts",
        "dl_adminunits_coaltenure",
        "dl_adminunits_firezone",
        "dl_adminunits_forestdistrict",
        "dl_adminunits_healthunits",
        "dl_adminunits_ilmbregions",
        "dl_adminunits_municipalities",
    ]
    assert len(dataset_ids) == len(set(dataset_ids))
