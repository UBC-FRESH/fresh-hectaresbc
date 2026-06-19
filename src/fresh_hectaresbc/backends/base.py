"""Backend adapter protocol."""

from __future__ import annotations

from typing import Protocol

from fresh_hectaresbc.models import (
    BackendDiagnostic,
    ContentStatus,
    FetchResult,
    ResolvedDatasetPath,
)


class BackendAdapter(Protocol):
    """Minimal interface for dataset retrieval backends."""

    name: str

    def diagnostics(self) -> tuple[BackendDiagnostic, ...]:
        """Return non-mutating backend readiness diagnostics."""

    def content_status(self, resolved_path: ResolvedDatasetPath) -> ContentStatus:
        """Return local content status for a resolved path."""

    def fetch(
        self,
        resolved_path: ResolvedDatasetPath,
        *,
        force: bool = False,
        dry_run: bool = False,
    ) -> FetchResult:
        """Retrieve or plan retrieval for one resolved path."""
