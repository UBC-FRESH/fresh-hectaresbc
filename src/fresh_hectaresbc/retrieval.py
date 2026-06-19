"""Read-only dataset resolution and local content-status APIs."""

from __future__ import annotations

import os
from pathlib import Path

from fresh_hectaresbc.backends import BackendAdapter, DataladBackend
from fresh_hectaresbc.catalog import Catalog
from fresh_hectaresbc.models import (
    BackendDiagnostic,
    ContentStatus,
    DatasetRecord,
    FetchResult,
    ResolvedDatasetPath,
)
from fresh_hectaresbc.paths import default_data_repo_path, raw_relative_path


class Resolver:
    """Resolve catalog records to paths in the linked data repository."""

    def __init__(
        self,
        catalog: Catalog,
        data_repo_path: Path | str | None = None,
        backend: BackendAdapter | None = None,
    ) -> None:
        self.catalog = catalog
        self.data_repo_path = (
            Path(data_repo_path)
            if data_repo_path is not None
            else default_data_repo_path()
        )
        self.backend = backend or DataladBackend(self.data_repo_path)

    def resolve(self, dataset: str | DatasetRecord) -> ResolvedDatasetPath:
        """Resolve a dataset ID or record to the expected raw ZIP path."""

        record = self._coerce_record(dataset)
        relative_path = raw_relative_path(record.source_zip_path)
        absolute_path = self.data_repo_path / relative_path
        submodule_initialized = self._submodule_initialized()
        path_metadata_exists = os.path.lexists(absolute_path)
        content_present = absolute_path.is_file()

        return ResolvedDatasetPath(
            dataset_id=record.dataset_id,
            source_zip_path=record.source_zip_path,
            data_repo_path=self.data_repo_path,
            raw_relative_path=relative_path,
            absolute_path=absolute_path,
            submodule_initialized=submodule_initialized,
            path_metadata_exists=path_metadata_exists,
            content_present=content_present,
        )

    def content_status(self, dataset: str | DatasetRecord) -> ContentStatus:
        """Report local availability without fetching content."""

        resolved = self.resolve(dataset)
        return self.backend.content_status(resolved)

    def local_path(self, dataset: str | DatasetRecord) -> Path:
        """Return the expected local filesystem path for a dataset."""

        return self.resolve(dataset).absolute_path

    def diagnostics(self) -> tuple[BackendDiagnostic, ...]:
        """Return backend diagnostics."""

        return self.backend.diagnostics()

    def fetch(
        self,
        dataset: str | DatasetRecord,
        *,
        force: bool = False,
        dry_run: bool = False,
    ) -> FetchResult:
        """Retrieve or plan retrieval for one dataset."""

        return self.backend.fetch(self.resolve(dataset), force=force, dry_run=dry_run)

    def fetch_many(
        self,
        datasets: list[str | DatasetRecord] | tuple[str | DatasetRecord, ...],
        *,
        force: bool = False,
        dry_run: bool = False,
    ) -> tuple[FetchResult, ...]:
        """Retrieve or plan retrieval for multiple datasets in input order."""

        return tuple(
            self.fetch(dataset, force=force, dry_run=dry_run) for dataset in datasets
        )

    def _coerce_record(self, dataset: str | DatasetRecord) -> DatasetRecord:
        if isinstance(dataset, DatasetRecord):
            return dataset
        return self.catalog.get(dataset)

    def _submodule_initialized(self) -> bool:
        git_marker = self.data_repo_path / ".git"
        raw_root = self.data_repo_path / "raw" / "hectaresbc_2022_export"
        return self.data_repo_path.is_dir() and git_marker.exists() and raw_root.is_dir()
