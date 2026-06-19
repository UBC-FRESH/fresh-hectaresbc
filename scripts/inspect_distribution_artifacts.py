"""Inspect local package distribution artifacts for expected and forbidden files."""

from __future__ import annotations

import argparse
import sys
import tarfile
from pathlib import Path
from zipfile import ZipFile


EXPECTED_WHEEL_PATHS = (
    "fresh_hectaresbc/__init__.py",
    "fresh_hectaresbc/api.py",
    "fresh_hectaresbc/catalog.py",
    "fresh_hectaresbc/cli.py",
    "fresh_hectaresbc/backends/datalad.py",
    "fresh_hectaresbc/package_data/recovered_catalog/data_layer_records.csv",
    "fresh_hectaresbc/package_data/recovered_catalog/virtual_layer_records.csv",
)

EXPECTED_SDIST_SUFFIXES = (
    "/pyproject.toml",
    "/README.md",
    "/src/fresh_hectaresbc/__init__.py",
    "/src/fresh_hectaresbc/api.py",
    "/src/fresh_hectaresbc/catalog.py",
    "/src/fresh_hectaresbc/cli.py",
    "/src/fresh_hectaresbc/backends/datalad.py",
    "/src/fresh_hectaresbc/package_data/recovered_catalog/data_layer_records.csv",
    "/src/fresh_hectaresbc/package_data/recovered_catalog/virtual_layer_records.csv",
)

FORBIDDEN_FRAGMENTS = (
    "tmp/",
    "external/fresh-hectaresbc-data/raw/",
    ".git/",
    ".venv/",
    "__pycache__/",
    "aws",
    "secret",
    "bootstrap.md",
    ".zip",
)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate fresh-hectaresbc wheel and sdist file lists."
    )
    parser.add_argument(
        "dist_dir",
        nargs="?",
        default="dist",
        type=Path,
        help="Directory containing local distribution artifacts.",
    )
    args = parser.parse_args(argv)

    try:
        wheel = _one_artifact(args.dist_dir, "*.whl")
        sdist = _one_artifact(args.dist_dir, "*.tar.gz")
        _validate_wheel(wheel)
        _validate_sdist(sdist)
    except ArtifactInspectionError as error:
        print(f"artifact inspection failed: {error}", file=sys.stderr)
        return 1

    print(f"validated wheel: {wheel}")
    print(f"validated sdist: {sdist}")
    return 0


class ArtifactInspectionError(RuntimeError):
    """Raised when local distribution artifacts fail inspection."""


def _one_artifact(dist_dir: Path, pattern: str) -> Path:
    artifacts = sorted(dist_dir.glob(pattern))
    if len(artifacts) != 1:
        raise ArtifactInspectionError(
            f"expected exactly one {pattern} artifact in {dist_dir}, found {len(artifacts)}"
        )
    return artifacts[0]


def _validate_wheel(wheel: Path) -> None:
    with ZipFile(wheel) as archive:
        names = sorted(archive.namelist())

    _reject_forbidden(names, wheel)
    _require_exact(names, EXPECTED_WHEEL_PATHS, wheel)
    if not any(name.endswith(".dist-info/entry_points.txt") for name in names):
        raise ArtifactInspectionError(f"{wheel} is missing console entrypoint metadata")
    if not any(name.endswith(".dist-info/METADATA") for name in names):
        raise ArtifactInspectionError(f"{wheel} is missing package metadata")


def _validate_sdist(sdist: Path) -> None:
    with tarfile.open(sdist) as archive:
        names = sorted(archive.getnames())

    _reject_forbidden(names, sdist)
    _require_suffixes(names, EXPECTED_SDIST_SUFFIXES, sdist)


def _reject_forbidden(names: list[str], artifact: Path) -> None:
    violations = [
        name
        for name in names
        for fragment in FORBIDDEN_FRAGMENTS
        if fragment in name.lower()
    ]
    if violations:
        raise ArtifactInspectionError(
            f"{artifact} contains forbidden paths: {', '.join(sorted(violations)[:10])}"
        )


def _require_exact(names: list[str], expected_paths: tuple[str, ...], artifact: Path) -> None:
    missing = sorted(set(expected_paths) - set(names))
    if missing:
        raise ArtifactInspectionError(
            f"{artifact} is missing expected paths: {', '.join(missing)}"
        )


def _require_suffixes(
    names: list[str], expected_suffixes: tuple[str, ...], artifact: Path
) -> None:
    missing = [
        suffix for suffix in expected_suffixes if not any(name.endswith(suffix) for name in names)
    ]
    if missing:
        raise ArtifactInspectionError(
            f"{artifact} is missing expected path suffixes: {', '.join(missing)}"
        )


if __name__ == "__main__":
    raise SystemExit(main())
