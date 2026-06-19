"""Recovered HectaresBC catalog loading and query APIs."""

from __future__ import annotations

import csv
from collections.abc import Iterable, Iterator
from pathlib import Path

from fresh_hectaresbc.models import DatasetRecord
from fresh_hectaresbc.paths import default_metadata_root


class CatalogError(RuntimeError):
    """Base class for catalog API errors."""


class CatalogFileMissing(CatalogError, FileNotFoundError):
    """Raised when a required catalog CSV is missing."""


class CatalogHeaderInvalid(CatalogError):
    """Raised when a catalog CSV does not contain required columns."""


class DatasetNotFound(CatalogError, KeyError):
    """Raised when exact dataset lookup fails."""


class DuplicateDatasetId(CatalogError):
    """Raised when recovered catalog inputs contain duplicate IDs."""


class QueryInvalid(CatalogError, ValueError):
    """Raised when a query cannot be evaluated."""


REQUIRED_COLUMNS = {
    "dataset_id",
    "source_family",
    "source_zip_path",
    "source_filename",
    "source_stem",
}

SEARCH_FIELDS = (
    "dataset_id",
    "source_filename",
    "source_stem",
    "title_candidate",
    "parent_layer_title",
    "fixed_layer_name",
    "fixed_grid_name",
    "description",
    "coverage",
    "lineage",
    "layer_name",
    "hkey",
    "source_table",
    "source_column",
    "query",
    "hkey_query",
)


class Catalog:
    """In-memory view of recovered HectaresBC metadata records."""

    def __init__(self, records: Iterable[DatasetRecord], metadata_root: Path):
        self.metadata_root = Path(metadata_root)
        self._records = tuple(
            sorted(records, key=lambda record: (record.source_family, record.dataset_id))
        )
        self._by_id: dict[str, DatasetRecord] = {}
        for record in self._records:
            if record.dataset_id in self._by_id:
                raise DuplicateDatasetId(f"Duplicate dataset_id: {record.dataset_id}")
            self._by_id[record.dataset_id] = record

    @classmethod
    def from_default_paths(cls, start: Path | str | None = None) -> "Catalog":
        """Load recovered catalog records from the current source checkout."""

        return cls.from_metadata_root(default_metadata_root(start))

    @classmethod
    def from_metadata_root(cls, metadata_root: Path | str) -> "Catalog":
        """Load recovered catalog records from a metadata directory."""

        metadata_root = Path(metadata_root)
        records = [
            *cls._read_csv(metadata_root / "data_layer_records.csv"),
            *cls._read_csv(metadata_root / "virtual_layer_records.csv"),
        ]
        return cls(records, metadata_root=metadata_root)

    @staticmethod
    def _read_csv(path: Path) -> list[DatasetRecord]:
        if not path.exists():
            raise CatalogFileMissing(f"Catalog file not found: {path}")

        with path.open(newline="", encoding="utf-8") as stream:
            reader = csv.DictReader(stream)
            fieldnames = set(reader.fieldnames or [])
            missing = sorted(REQUIRED_COLUMNS - fieldnames)
            if missing:
                raise CatalogHeaderInvalid(
                    f"{path} is missing required columns: {', '.join(missing)}"
                )
            return [DatasetRecord.from_row(row) for row in reader]

    def __len__(self) -> int:
        return len(self._records)

    def __iter__(self) -> Iterator[DatasetRecord]:
        return iter(self._records)

    @property
    def records(self) -> tuple[DatasetRecord, ...]:
        return self._records

    def get(self, dataset_id: str) -> DatasetRecord:
        """Return exactly one record by recovered dataset ID."""

        try:
            return self._by_id[dataset_id]
        except KeyError as error:
            raise DatasetNotFound(f"Dataset not found: {dataset_id}") from error

    def exists(self, dataset_id: str) -> bool:
        """Return whether a recovered dataset ID exists."""

        return dataset_id in self._by_id

    def iter_records(
        self,
        *,
        family: str | None = None,
        verification_status: str | None = None,
        has_known_gaps: bool | None = None,
        has_uncertainty: bool | None = None,
    ) -> Iterator[DatasetRecord]:
        """Iterate records with basic catalog-contract filters."""

        for record in self._records:
            if family is not None and record.source_family != family:
                continue
            if (
                verification_status is not None
                and record.verification_status != verification_status
            ):
                continue
            if has_known_gaps is not None and bool(record.known_gaps) != has_known_gaps:
                continue
            if (
                has_uncertainty is not None
                and bool(record.uncertainty_notes) != has_uncertainty
            ):
                continue
            yield record

    def search(
        self,
        query: str,
        *,
        family: str | None = None,
        limit: int | None = None,
        allow_empty: bool = False,
    ) -> list[DatasetRecord]:
        """Search recovered source-backed text fields."""

        normalized = query.strip().lower()
        if not normalized and not allow_empty:
            raise QueryInvalid("Search query must not be empty.")

        candidates = self.iter_records(family=family) if family else iter(self._records)
        if not normalized:
            results = list(candidates)
            return results[:limit] if limit is not None else results

        scored: list[tuple[int, str, str, DatasetRecord]] = []
        for record in candidates:
            score = self._search_score(record, normalized)
            if score is None:
                continue
            scored.append((score, record.source_family, record.dataset_id, record))

        scored.sort(key=lambda item: (item[0], item[1], item[2]))
        results = [item[3] for item in scored]
        return results[:limit] if limit is not None else results

    @staticmethod
    def _search_score(record: DatasetRecord, query: str) -> int | None:
        if record.dataset_id.lower() == query:
            return 0
        if query in {
            record.source_filename.lower(),
            record.source_stem.lower(),
        }:
            return 1
        for field in ("title_candidate", "layer_name", "fixed_layer_name"):
            if query in record.field(field).lower():
                return 2
        for field in SEARCH_FIELDS:
            if query in record.field(field).lower():
                return 3
        return None

    def filter(
        self,
        *,
        family: str | None = None,
        dataset_id_prefix: str | None = None,
        source_path_prefix: str | None = None,
        name_prefix: str | None = None,
        virtual_layer_id: str | int | None = None,
        has_category_metadata: bool | None = None,
        has_value_metadata: bool | None = None,
        has_wms_xml: bool | None = None,
        has_tiff: bool | None = None,
        verification_status: str | None = None,
        zip_read_status: str | None = None,
        min_size_bytes: int | None = None,
        max_size_bytes: int | None = None,
    ) -> list[DatasetRecord]:
        """Return records matching structured recovered-catalog filters."""

        records: Iterable[DatasetRecord] = self.iter_records(
            family=family, verification_status=verification_status
        )
        results = []
        for record in records:
            if dataset_id_prefix and not record.dataset_id.startswith(dataset_id_prefix):
                continue
            if source_path_prefix and not record.source_zip_path.startswith(
                source_path_prefix
            ):
                continue
            if name_prefix and not self._matches_name_prefix(record, name_prefix):
                continue
            if virtual_layer_id is not None and record.field("original_layer_id") != str(
                virtual_layer_id
            ):
                continue
            if not self._matches_count_filter(
                record, "category_metadata_count", has_category_metadata
            ):
                continue
            if not self._matches_count_filter(
                record, "value_metadata_count", has_value_metadata
            ):
                continue
            if not self._matches_count_filter(record, "wms_member_paths", has_wms_xml):
                continue
            if not self._matches_count_filter(record, "raster_member_paths", has_tiff):
                continue
            if zip_read_status and record.field("zip_read_status") != zip_read_status:
                continue
            if (
                min_size_bytes is not None
                and (
                    record.manifest_size_bytes is None
                    or record.manifest_size_bytes < min_size_bytes
                )
            ):
                continue
            if (
                max_size_bytes is not None
                and (
                    record.manifest_size_bytes is None
                    or record.manifest_size_bytes > max_size_bytes
                )
            ):
                continue
            results.append(record)
        return results

    @staticmethod
    def _matches_name_prefix(record: DatasetRecord, prefix: str) -> bool:
        prefix = prefix.lower()
        return any(
            record.field(field).lower().startswith(prefix)
            for field in (
                "source_filename",
                "source_stem",
                "title_candidate",
                "layer_name",
                "fixed_layer_name",
            )
        )

    @staticmethod
    def _matches_count_filter(
        record: DatasetRecord, field_name: str, expected: bool | None
    ) -> bool:
        if expected is None:
            return True
        value = record.field(field_name)
        if field_name.endswith("_paths"):
            present = value.strip() not in {"", "[]"}
        else:
            count = record.int_field(field_name)
            present = count is not None and count > 0
        return present is expected
