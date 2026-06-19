"""Public package interface for fresh-hectaresbc."""

from fresh_hectaresbc.api import HectaresBC
from fresh_hectaresbc.backends import DataladBackend
from fresh_hectaresbc.catalog import Catalog, DatasetNotFound
from fresh_hectaresbc.models import (
    BackendDiagnostic,
    ContentStatus,
    DatasetRecord,
    FetchResult,
    ResolvedDatasetPath,
)

__all__ = [
    "BackendDiagnostic",
    "Catalog",
    "ContentStatus",
    "DataladBackend",
    "DatasetNotFound",
    "DatasetRecord",
    "FetchResult",
    "HectaresBC",
    "ResolvedDatasetPath",
]
