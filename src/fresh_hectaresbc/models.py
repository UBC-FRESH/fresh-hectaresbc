"""Shared catalog data models."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping


def _empty_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def _to_int(value: str | None) -> int | None:
    value = _empty_to_none(value)
    if value is None:
        return None
    return int(value)


def _to_bool(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "y"}


@dataclass(frozen=True)
class DatasetRecord:
    """One recovered HectaresBC catalog record."""

    dataset_id: str
    source_family: str
    source_zip_path: str
    source_filename: str
    source_stem: str
    title_candidate: str
    verification_status: str
    manifest_size_bytes: int | None
    known_gaps: str
    uncertainty_notes: str
    fields: Mapping[str, str]

    @classmethod
    def from_row(cls, row: Mapping[str, str]) -> "DatasetRecord":
        return cls(
            dataset_id=row["dataset_id"],
            source_family=row["source_family"],
            source_zip_path=row["source_zip_path"],
            source_filename=row["source_filename"],
            source_stem=row["source_stem"],
            title_candidate=row.get("title_candidate", ""),
            verification_status=row.get("verification_status", ""),
            manifest_size_bytes=_to_int(row.get("manifest_size_bytes")),
            known_gaps=row.get("known_gaps", ""),
            uncertainty_notes=row.get("uncertainty_notes", ""),
            fields=dict(row),
        )

    def field(self, name: str, default: str = "") -> str:
        """Return a raw recovered field without changing source names."""

        return self.fields.get(name, default)

    def bool_field(self, name: str) -> bool:
        """Return a recovered flag-like field as a boolean."""

        return _to_bool(self.fields.get(name))

    def int_field(self, name: str) -> int | None:
        """Return a recovered integer field when present."""

        return _to_int(self.fields.get(name))

    def to_dict(self) -> dict[str, object]:
        """Serialize the record while preserving all recovered source fields."""

        data: dict[str, object] = dict(self.fields)
        data["manifest_size_bytes"] = self.manifest_size_bytes
        return data
