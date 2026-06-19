"""Data access backend adapters."""

from fresh_hectaresbc.backends.base import BackendAdapter
from fresh_hectaresbc.backends.datalad import DataladBackend

__all__ = ["BackendAdapter", "DataladBackend"]
