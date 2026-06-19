import shutil
import subprocess
import sys
from pathlib import Path


def test_web_catalog_ui_smoke_checks_representative_behavior(tmp_path: Path) -> None:
    node = shutil.which("node")

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

    subprocess.run(
        [sys.executable, "scripts/generate_web_catalog.py"],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    subprocess.run(
        [sys.executable, "scripts/generate_map_preview_artifacts.py"],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    result = subprocess.run(
        [sys.executable, "scripts/smoke_test_web_static_app.py"],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    assert "validated static web app" in result.stdout

    if node is None:
        return

    result = subprocess.run(
        [node, "scripts/smoke_test_web_catalog_ui.js", str(catalog_path)],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert "validated web catalog UI logic" in result.stdout

    result = subprocess.run(
        [node, "scripts/smoke_test_web_app_dom.js", str(catalog_path)],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert "validated browser app DOM smoke flow" in result.stdout
