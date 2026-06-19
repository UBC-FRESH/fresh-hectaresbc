import shutil
import subprocess
import sys
from pathlib import Path


def test_web_catalog_ui_smoke_checks_representative_behavior(tmp_path: Path) -> None:
    node = shutil.which("node")
    if node is None:
        return

    catalog_path = tmp_path / "catalog.json"
    subprocess.run(
        [
            sys.executable,
            "scripts/generate_web_catalog.py",
            "--output",
            str(catalog_path),
        ],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    result = subprocess.run(
        [node, "scripts/smoke_test_web_catalog_ui.js", str(catalog_path)],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    assert "validated web catalog UI logic" in result.stdout
