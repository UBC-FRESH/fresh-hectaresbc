"""Typer command-line interface for fresh-hectaresbc."""

from __future__ import annotations

import json
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from typing import Annotated

import typer

from fresh_hectaresbc import HectaresBC
from fresh_hectaresbc.catalog import DatasetNotFound, QueryInvalid
from fresh_hectaresbc.models import DatasetRecord


VALID_FAMILIES = {"data_layer", "virtual_layer"}
SUMMARY_FIELDS = ("dataset_id", "source_family", "title_candidate", "source_zip_path")
SHOW_FIELDS = (
    "dataset_id",
    "source_family",
    "title_candidate",
    "source_zip_path",
    "source_filename",
    "manifest_size_bytes",
    "verification_status",
    "known_gaps",
    "uncertainty_notes",
)


def _package_version() -> str:
    try:
        return version("fresh-hectaresbc")
    except PackageNotFoundError:
        return "0.0.0"


def _version_callback(value: bool) -> None:
    if value:
        typer.echo(f"fresh-hectaresbc {_package_version()}")
        raise typer.Exit()


app = typer.Typer(
    name="fresh-hectaresbc",
    no_args_is_help=True,
    help="Access the recovered HectaresBC catalog and data repository.",
    pretty_exceptions_show_locals=False,
)
catalog_app = typer.Typer(
    no_args_is_help=True,
    help="Search and inspect recovered catalog records.",
    pretty_exceptions_show_locals=False,
)
data_app = typer.Typer(
    no_args_is_help=True,
    help="Resolve dataset paths and inspect local data status.",
    pretty_exceptions_show_locals=False,
)


@app.callback()
def main(
    version_flag: Annotated[
        bool,
        typer.Option(
            "--version",
            callback=_version_callback,
            help="Show the installed package version and exit.",
            is_eager=True,
        ),
    ] = False,
) -> None:
    """Access the recovered HectaresBC catalog and data repository."""


app.add_typer(catalog_app, name="catalog")
app.add_typer(data_app, name="data")


def _hbc(metadata_root: Path | None, data_repo_path: Path | None) -> HectaresBC:
    return HectaresBC(metadata_root=metadata_root, data_repo_path=data_repo_path)


def _validate_family(family: str | None) -> str | None:
    if family is not None and family not in VALID_FAMILIES:
        _fail(f"Invalid family: {family}", code=2)
    return family


def _fail(message: str, *, code: int) -> None:
    typer.echo(message, err=True)
    raise typer.Exit(code)


def _error_message(error: Exception) -> str:
    if error.args:
        return str(error.args[0])
    return str(error)


def _record_summary(record: DatasetRecord) -> dict[str, object]:
    return {field: getattr(record, field) for field in SUMMARY_FIELDS}


def _emit_summary_table(records: list[DatasetRecord]) -> None:
    typer.echo("\t".join(SUMMARY_FIELDS))
    for record in records:
        row = _record_summary(record)
        typer.echo("\t".join(str(row[field]) for field in SUMMARY_FIELDS))


def _emit_records_json(records: list[DatasetRecord]) -> None:
    typer.echo(json.dumps([_record_summary(record) for record in records], indent=2))


def _emit_record_text(record: DatasetRecord) -> None:
    for field in SHOW_FIELDS:
        value = (
            record.manifest_size_bytes
            if field == "manifest_size_bytes"
            else record.field(field)
        )
        typer.echo(f"{field}: {value}")


@catalog_app.command("search")
def catalog_search(
    query: Annotated[str, typer.Argument(help="Case-insensitive search query.")],
    family: Annotated[
        str | None,
        typer.Option("--family", help="Restrict results to data_layer or virtual_layer."),
    ] = None,
    limit: Annotated[int, typer.Option("--limit", min=1, help="Maximum rows.")] = 20,
    output_format: Annotated[
        str,
        typer.Option("--format", help="Output format: table or json."),
    ] = "table",
    metadata_root: Annotated[
        Path | None,
        typer.Option("--metadata-root", help="Override recovered catalog metadata root."),
    ] = None,
    data_repo_path: Annotated[
        Path | None,
        typer.Option("--data-repo-path", help="Override linked data repository path."),
    ] = None,
) -> None:
    """Search recovered catalog records."""

    if output_format not in {"table", "json"}:
        _fail(f"Invalid output format: {output_format}", code=2)
    try:
        records = _hbc(metadata_root, data_repo_path).search(
            query,
            family=_validate_family(family),
            limit=limit,
        )
    except QueryInvalid as error:
        _fail(str(error), code=2)

    if output_format == "json":
        _emit_records_json(records)
    else:
        _emit_summary_table(records)


@catalog_app.command("show")
def catalog_show(
    dataset_id: Annotated[str, typer.Argument(help="Recovered dataset ID.")],
    output_format: Annotated[
        str,
        typer.Option("--format", help="Output format: text or json."),
    ] = "text",
    metadata_root: Annotated[
        Path | None,
        typer.Option("--metadata-root", help="Override recovered catalog metadata root."),
    ] = None,
    data_repo_path: Annotated[
        Path | None,
        typer.Option("--data-repo-path", help="Override linked data repository path."),
    ] = None,
) -> None:
    """Show one recovered catalog record."""

    if output_format not in {"text", "json"}:
        _fail(f"Invalid output format: {output_format}", code=2)
    try:
        record = _hbc(metadata_root, data_repo_path).get(dataset_id)
    except DatasetNotFound as error:
        _fail(_error_message(error), code=3)

    if output_format == "json":
        typer.echo(json.dumps(record.to_dict(), indent=2))
    else:
        _emit_record_text(record)


@catalog_app.command("list")
def catalog_list(
    family: Annotated[
        str | None,
        typer.Option("--family", help="Restrict results to data_layer or virtual_layer."),
    ] = None,
    dataset_id_prefix: Annotated[
        str | None,
        typer.Option("--dataset-id-prefix", help="Filter by dataset ID prefix."),
    ] = None,
    source_path_prefix: Annotated[
        str | None,
        typer.Option("--source-path-prefix", help="Filter by source ZIP path prefix."),
    ] = None,
    name_prefix: Annotated[
        str | None,
        typer.Option("--name-prefix", help="Filter by source/display name prefix."),
    ] = None,
    virtual_layer_id: Annotated[
        str | None,
        typer.Option("--virtual-layer-id", help="Filter by recovered virtual-layer ID."),
    ] = None,
    limit: Annotated[int, typer.Option("--limit", min=1, help="Maximum rows.")] = 50,
    output_format: Annotated[
        str,
        typer.Option("--format", help="Output format: table or json."),
    ] = "table",
    metadata_root: Annotated[
        Path | None,
        typer.Option("--metadata-root", help="Override recovered catalog metadata root."),
    ] = None,
    data_repo_path: Annotated[
        Path | None,
        typer.Option("--data-repo-path", help="Override linked data repository path."),
    ] = None,
) -> None:
    """List recovered catalog records with structured filters."""

    if output_format not in {"table", "json"}:
        _fail(f"Invalid output format: {output_format}", code=2)
    records = _hbc(metadata_root, data_repo_path).filter(
        family=_validate_family(family),
        dataset_id_prefix=dataset_id_prefix,
        source_path_prefix=source_path_prefix,
        name_prefix=name_prefix,
        virtual_layer_id=virtual_layer_id,
    )[:limit]

    if output_format == "json":
        _emit_records_json(records)
    else:
        _emit_summary_table(records)
