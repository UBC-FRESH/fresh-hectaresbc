"""Top-level public API facade.

This scaffold intentionally exposes only the stable entrypoint. Catalog,
resolution, and retrieval behavior are implemented in later P6.5 slices.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass(frozen=True)
class HectaresBC:
    """Convenience entrypoint for HectaresBC catalog and data access.

    Parameters are accepted now so callers can start wiring application code
    against the public facade before the catalog and backend layers are filled
    in by the next implementation issues.
    """

    metadata_root: Optional[Path | str] = None
    data_repo_path: Optional[Path | str] = None

    def __post_init__(self) -> None:
        if self.metadata_root is not None:
            object.__setattr__(self, "metadata_root", Path(self.metadata_root))
        if self.data_repo_path is not None:
            object.__setattr__(self, "data_repo_path", Path(self.data_repo_path))

    def get(self, dataset_id: str) -> object:
        """Return one dataset record by ID.

        Implemented in P6.5.2.
        """

        raise NotImplementedError("Catalog lookup is planned for P6.5.2.")

    def search(self, query: str, *, limit: int | None = None) -> list[object]:
        """Search recovered catalog records.

        Implemented in P6.5.2.
        """

        raise NotImplementedError("Catalog search is planned for P6.5.2.")

    def resolve(self, dataset_id: str) -> object:
        """Resolve a dataset ID to a data-repository path.

        Implemented in P6.5.3.
        """

        raise NotImplementedError("Dataset path resolution is planned for P6.5.3.")

    def diagnostics(self) -> list[object]:
        """Return backend diagnostics.

        Implemented in P6.5.4.
        """

        raise NotImplementedError("Backend diagnostics are planned for P6.5.4.")
