import os
import shutil
import subprocess
import sys
from pathlib import Path


def _env() -> dict[str, str]:
    env = os.environ.copy()
    paths = ["src", "."]
    if env.get("PYTHONPATH"):
        paths.append(env["PYTHONPATH"])
    env["PYTHONPATH"] = os.pathsep.join(paths)
    return env


def test_web_catalog_ui_smoke_checks_representative_behavior(tmp_path: Path) -> None:
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
        env=_env(),
    )
    subprocess.run(
        [sys.executable, "scripts/generate_web_catalog.py"],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=_env(),
    )

    result = subprocess.run(
        [sys.executable, "scripts/smoke_test_web_static_app.py"],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=_env(),
    )
    assert "validated static web app" in result.stdout

    node = shutil.which("node")
    if node is not None:
        result = subprocess.run(
            [node, "scripts/smoke_test_web_catalog_ui.js", str(catalog_path)],
            check=True,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=_env(),
        )
        assert "validated web catalog UI logic" in result.stdout

    try:
        import playwright  # noqa: F401
    except ImportError:
        return

    result = subprocess.run(
        [sys.executable, "scripts/smoke_test_web_ui_browser.py"],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=_env(),
    )
    assert "validated browser UI smoke flow" in result.stdout or "skipped" in result.stdout

    result = subprocess.run(
        [sys.executable, "scripts/smoke_test_clip_aoi_browser.py"],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=_env(),
    )
    assert (
        "validated Clip AOI browser flow" in result.stdout or "skipped" in result.stdout
    )

    result = subprocess.run(
        [sys.executable, "scripts/smoke_test_tray_browser.py"],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=_env(),
    )
    assert "validated tray browser flow" in result.stdout or "skipped" in result.stdout
