"""Smoke-test a built wheel in a clean virtual environment."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
import venv
from pathlib import Path


DATASET_ID = "dl_adminunits_bcts"
EXPECTED_CATALOG_COUNT = "2183"
EXPECTED_TITLE = "BCTS Operating Areas"
EXPECTED_SEARCH_ID = "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Install the local wheel in a temporary venv and run API/CLI smoke checks."
    )
    parser.add_argument(
        "dist_dir",
        nargs="?",
        default="dist",
        type=Path,
        help="Directory containing the built wheel.",
    )
    args = parser.parse_args(argv)

    try:
        wheel = _one_wheel(args.dist_dir)
        with tempfile.TemporaryDirectory(prefix="fresh-hectaresbc-wheel-smoke-") as tmp:
            tmp_path = Path(tmp)
            venv_path = tmp_path / "venv"
            venv.EnvBuilder(with_pip=True).create(venv_path)
            python = _venv_python(venv_path)
            cli = _venv_executable(venv_path, "fresh-hectaresbc")
            env = _clean_env()

            _run([str(python), "-m", "pip", "install", "--upgrade", "pip"], tmp_path, env)
            _run([str(python), "-m", "pip", "install", str(wheel)], tmp_path, env)
            _run_api_smoke(python, tmp_path, env)
            _run_cli_smoke(cli, tmp_path, env)
    except SmokeTestError as error:
        print(f"wheel smoke test failed: {error}", file=sys.stderr)
        return 1

    print(f"validated clean wheel install: {wheel}")
    return 0


class SmokeTestError(RuntimeError):
    """Raised when the clean wheel install smoke test fails."""


def _one_wheel(dist_dir: Path) -> Path:
    wheels = sorted(dist_dir.glob("fresh_hectaresbc-*.whl"))
    if len(wheels) != 1:
        raise SmokeTestError(
            f"expected exactly one fresh_hectaresbc wheel in {dist_dir}, found {len(wheels)}"
        )
    return wheels[0].resolve()


def _venv_python(venv_path: Path) -> Path:
    return _venv_executable(venv_path, "python")


def _venv_executable(venv_path: Path, name: str) -> Path:
    bin_dir = "Scripts" if os.name == "nt" else "bin"
    suffix = ".exe" if os.name == "nt" else ""
    return venv_path / bin_dir / f"{name}{suffix}"


def _clean_env() -> dict[str, str]:
    env = os.environ.copy()
    env.pop("PYTHONPATH", None)
    return env


def _run(
    command: list[str],
    cwd: Path,
    env: dict[str, str],
    *,
    allowed_exit_codes: tuple[int, ...] = (0,),
) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        command,
        cwd=cwd,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode not in allowed_exit_codes:
        raise SmokeTestError(
            f"{' '.join(command)} exited {result.returncode}\n"
            f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
        )
    return result


def _run_api_smoke(python: Path, cwd: Path, env: dict[str, str]) -> None:
    script = f"""
from fresh_hectaresbc import HectaresBC

hbc = HectaresBC()
assert len(hbc.catalog) == {EXPECTED_CATALOG_COUNT}
assert hbc.get("{DATASET_ID}").title_candidate == "{EXPECTED_TITLE}"
assert hbc.search("bull trout", limit=1)[0].dataset_id == "{EXPECTED_SEARCH_ID}"
print("api smoke ok")
"""
    _run([str(python), "-c", script], cwd, env)


def _run_cli_smoke(cli: Path, cwd: Path, env: dict[str, str]) -> None:
    checks = (
        ([str(cli), "--help"], (0,)),
        ([str(cli), "--version"], (0,)),
        ([str(cli), "catalog", "search", "bull trout", "--limit", "1"], (0,)),
        ([str(cli), "catalog", "show", DATASET_ID], (0,)),
        ([str(cli), "catalog", "list", "--family", "virtual_layer", "--limit", "1"], (0,)),
        ([str(cli), "data", "path", DATASET_ID], (0,)),
        ([str(cli), "data", "status", DATASET_ID], (0, 4)),
        ([str(cli), "diagnostics"], (0, 4)),
        ([str(cli), "fetch", DATASET_ID, "--dry-run"], (0, 4)),
    )
    for command, allowed_exit_codes in checks:
        _run(command, cwd, env, allowed_exit_codes=allowed_exit_codes)


if __name__ == "__main__":
    raise SystemExit(main())
