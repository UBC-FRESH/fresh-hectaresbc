"""Repository path helpers for source-checkout defaults."""

from __future__ import annotations

from pathlib import Path


DEFAULT_METADATA_ROOT = Path("metadata/recovered_catalog")
DEFAULT_DATA_REPO = Path("external/fresh-hectaresbc-data")
DEFAULT_RAW_PREFIX = Path("raw/hectaresbc_2022_export")


def find_repo_root(start: Path | str | None = None) -> Path:
    """Find the repository root containing recovered catalog metadata."""

    current = Path(start or Path.cwd()).resolve()
    if current.is_file():
        current = current.parent

    for candidate in (current, *current.parents):
        if (candidate / DEFAULT_METADATA_ROOT).is_dir():
            return candidate

    raise FileNotFoundError(
        f"Could not find repository root containing {DEFAULT_METADATA_ROOT}."
    )


def default_metadata_root(start: Path | str | None = None) -> Path:
    """Return the default recovered-catalog metadata directory."""

    return find_repo_root(start) / DEFAULT_METADATA_ROOT


def default_data_repo_path(start: Path | str | None = None) -> Path:
    """Return the default linked DataLad data-repository path."""

    return find_repo_root(start) / DEFAULT_DATA_REPO


def raw_relative_path(source_zip_path: str | Path) -> Path:
    """Map a recovered source ZIP path to the data repository raw prefix."""

    return DEFAULT_RAW_PREFIX / Path(source_zip_path)
