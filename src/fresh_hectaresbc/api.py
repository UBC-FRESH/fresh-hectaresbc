"""Top-level public API facade."""

from __future__ import annotations

from dataclasses import dataclass
from functools import cached_property
from pathlib import Path
from typing import Optional

from fresh_hectaresbc.catalog import Catalog
from fresh_hectaresbc.models import DatasetRecord


@dataclass(frozen=True)
class HectaresBC:
    """Convenience entrypoint for HectaresBC catalog and data access.

    The facade exposes catalog behavior now. Path resolution and backend
    diagnostics are implemented in later P6.5 slices.
    """

    metadata_root: Optional[Path | str] = None
    data_repo_path: Optional[Path | str] = None

    def __post_init__(self) -> None:
        if self.metadata_root is not None:
            object.__setattr__(self, "metadata_root", Path(self.metadata_root))
        if self.data_repo_path is not None:
            object.__setattr__(self, "data_repo_path", Path(self.data_repo_path))

    @cached_property
    def catalog(self) -> Catalog:
        """Load the recovered catalog on first use."""

        if self.metadata_root is not None:
            return Catalog.from_metadata_root(self.metadata_root)
        return Catalog.from_default_paths()

    def get(self, dataset_id: str) -> DatasetRecord:
        """Return one dataset record by exact recovered ID."""

        return self.catalog.get(dataset_id)

    def search(
        self,
        query: str,
        *,
        family: str | None = None,
        limit: int | None = None,
        allow_empty: bool = False,
    ) -> list[DatasetRecord]:
        """Search recovered catalog records."""

        return self.catalog.search(
            query, family=family, limit=limit, allow_empty=allow_empty
        )

    def filter(self, **filters: object) -> list[DatasetRecord]:
        """Filter recovered catalog records."""

        return self.catalog.filter(**filters)

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
