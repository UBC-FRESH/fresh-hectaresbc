"""Top-level public API facade."""

from __future__ import annotations

from dataclasses import dataclass
from functools import cached_property
from pathlib import Path
from typing import Optional

from fresh_hectaresbc.catalog import Catalog
from fresh_hectaresbc.models import ContentStatus, DatasetRecord, ResolvedDatasetPath
from fresh_hectaresbc.retrieval import Resolver


@dataclass(frozen=True)
class HectaresBC:
    """Convenience entrypoint for HectaresBC catalog and data access.

    The facade exposes catalog and local path/status behavior now. Backend
    diagnostics are implemented in a later P6.5 slice.
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

    @cached_property
    def resolver(self) -> Resolver:
        """Create the read-only data repository resolver on first use."""

        return Resolver(catalog=self.catalog, data_repo_path=self.data_repo_path)

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

    def resolve(self, dataset: str | DatasetRecord) -> ResolvedDatasetPath:
        """Resolve a dataset ID or record to a data-repository path."""

        return self.resolver.resolve(dataset)

    def content_status(self, dataset: str | DatasetRecord) -> ContentStatus:
        """Report local content status without fetching data."""

        return self.resolver.content_status(dataset)

    def local_path(self, dataset: str | DatasetRecord) -> Path:
        """Return the expected local filesystem path for a dataset."""

        return self.resolver.local_path(dataset)

    def diagnostics(self) -> list[object]:
        """Return backend diagnostics.

        Implemented in P6.5.4.
        """

        raise NotImplementedError("Backend diagnostics are planned for P6.5.4.")
