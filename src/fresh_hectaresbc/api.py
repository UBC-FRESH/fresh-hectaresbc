"""Top-level public API facade."""

from __future__ import annotations

from dataclasses import dataclass
from functools import cached_property
from pathlib import Path
from typing import Optional

from fresh_hectaresbc.backends import BackendAdapter
from fresh_hectaresbc.catalog import Catalog
from fresh_hectaresbc.models import (
    BackendDiagnostic,
    ContentStatus,
    DatasetRecord,
    FetchResult,
    ResolvedDatasetPath,
)
from fresh_hectaresbc.retrieval import Resolver


@dataclass(frozen=True)
class HectaresBC:
    """Convenience entrypoint for HectaresBC catalog and data access.

    The facade exposes catalog, local path/status, diagnostics, and fetch
    behavior through structured result objects.
    """

    metadata_root: Optional[Path | str] = None
    data_repo_path: Optional[Path | str] = None
    backend: Optional[BackendAdapter] = None

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

        return Resolver(
            catalog=self.catalog,
            data_repo_path=self.data_repo_path,
            backend=self.backend,
        )

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

    def diagnostics(self) -> tuple[BackendDiagnostic, ...]:
        """Return backend diagnostics."""

        return self.resolver.diagnostics()

    def fetch(
        self,
        dataset: str | DatasetRecord,
        *,
        force: bool = False,
        dry_run: bool = False,
    ) -> FetchResult:
        """Retrieve or plan retrieval for one dataset."""

        return self.resolver.fetch(dataset, force=force, dry_run=dry_run)

    def fetch_many(
        self,
        datasets: list[str | DatasetRecord] | tuple[str | DatasetRecord, ...],
        *,
        force: bool = False,
        dry_run: bool = False,
    ) -> tuple[FetchResult, ...]:
        """Retrieve or plan retrieval for multiple datasets."""

        return self.resolver.fetch_many(datasets, force=force, dry_run=dry_run)
