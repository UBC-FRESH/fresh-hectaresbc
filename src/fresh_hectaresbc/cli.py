"""Typer command-line interface for fresh-hectaresbc."""

from __future__ import annotations

import json
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from typing import Annotated

import typer

from fresh_hectaresbc import HectaresBC
from fresh_hectaresbc.catalog import DatasetNotFound, QueryInvalid
from fresh_hectaresbc.models import (
    BackendDiagnostic,
    ContentStatus,
    DatasetRecord,
    FetchResult,
    ResolvedDatasetPath,
)


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
DIAGNOSTIC_FIELDS = ("check", "status", "message")
FETCH_FIELDS = (
    "dataset_id",
    "status",
    "backend",
    "local_path",
    "message",
    "command_summary",
    "verification_performed",
)
SETUP_FAILURE_STATUSES = {
    "not_initialized",
    "backend_unavailable",
    "credentials_required",
}
BACKEND_FAILURE_STATUSES = {"backend_error", "validation_error"}


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


def _resolved_path_dict(resolved: ResolvedDatasetPath) -> dict[str, object]:
    return {
        "dataset_id": resolved.dataset_id,
        "source_zip_path": resolved.source_zip_path,
        "data_repo_path": str(resolved.data_repo_path),
        "raw_relative_path": str(resolved.raw_relative_path),
        "absolute_path": str(resolved.absolute_path),
        "submodule_initialized": resolved.submodule_initialized,
        "path_metadata_exists": resolved.path_metadata_exists,
        "content_present": resolved.content_present,
    }


def _content_status_dict(status: ContentStatus) -> dict[str, object]:
    return {
        "dataset_id": status.dataset_id,
        "status": status.status,
        "local_path": str(status.local_path),
        "submodule_initialized": status.submodule_initialized,
        "path_metadata_exists": status.path_metadata_exists,
        "content_present": status.content_present,
        "message": status.message,
    }


def _diagnostic_dict(diagnostic: BackendDiagnostic) -> dict[str, object]:
    return {
        "backend": diagnostic.backend,
        "check": diagnostic.check,
        "status": diagnostic.status,
        "message": diagnostic.message,
        "command_summary": diagnostic.command_summary,
        "remediation": diagnostic.remediation,
        "secret_safe": diagnostic.secret_safe,
    }


def _fetch_result_dict(result: FetchResult) -> dict[str, object]:
    return {
        "dataset_id": result.dataset_id,
        "status": result.status,
        "backend": result.backend,
        "local_path": str(result.local_path),
        "message": result.message,
        "diagnostics": [_diagnostic_dict(item) for item in result.diagnostics],
        "command_summary": result.command_summary,
        "verification_performed": result.verification_performed,
        "secret_safe": result.secret_safe,
    }


def _emit_mapping_text(data: dict[str, object]) -> None:
    for key, value in data.items():
        typer.echo(f"{key}: {value}")


def _emit_diagnostics_table(diagnostics: tuple[BackendDiagnostic, ...]) -> None:
    typer.echo("\t".join(DIAGNOSTIC_FIELDS))
    for diagnostic in diagnostics:
        row = _diagnostic_dict(diagnostic)
        typer.echo("\t".join(str(row[field]) for field in DIAGNOSTIC_FIELDS))


def _emit_fetch_text(result: FetchResult) -> None:
    data = _fetch_result_dict(result)
    for field in FETCH_FIELDS:
        typer.echo(f"{field}: {data[field]}")
    if result.diagnostics:
        typer.echo("diagnostics:")
        for diagnostic in result.diagnostics:
            typer.echo(f"  {diagnostic.check}: {diagnostic.status}")


def _diagnostics_exit_code(diagnostics: tuple[BackendDiagnostic, ...]) -> int:
    statuses = {diagnostic.status for diagnostic in diagnostics}
    if "backend_error" in statuses:
        return 5
    if statuses.intersection({"backend_unavailable", "not_initialized"}):
        return 4
    return 0


def _fetch_exit_code(result: FetchResult) -> int:
    if result.status in {"ok", "already_present", "dry_run"}:
        return 0
    if result.status in SETUP_FAILURE_STATUSES:
        return 4
    if result.status in BACKEND_FAILURE_STATUSES:
        return 5
    if result.status == "unsupported":
        return 6
    return 1


@app.command("diagnostics")
def diagnostics(
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
    """Inspect local backend readiness."""

    if output_format not in {"table", "json"}:
        _fail(f"Invalid output format: {output_format}", code=2)
    checks = _hbc(metadata_root, data_repo_path).diagnostics()
    if output_format == "json":
        typer.echo(json.dumps([_diagnostic_dict(item) for item in checks], indent=2))
    else:
        _emit_diagnostics_table(checks)

    exit_code = _diagnostics_exit_code(checks)
    if exit_code:
        raise typer.Exit(exit_code)


@app.command("fetch")
def fetch(
    dataset_id: Annotated[str, typer.Argument(help="Recovered dataset ID.")],
    dry_run: Annotated[
        bool,
        typer.Option("--dry-run", help="Plan retrieval without running datalad get."),
    ] = False,
    force: Annotated[
        bool,
        typer.Option("--force", help="Attempt retrieval even if content is local."),
    ] = False,
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
    """Fetch, or dry-run fetch, one dataset payload."""

    if output_format not in {"text", "json"}:
        _fail(f"Invalid output format: {output_format}", code=2)
    try:
        result = _hbc(metadata_root, data_repo_path).fetch(
            dataset_id,
            dry_run=dry_run,
            force=force,
        )
    except DatasetNotFound as error:
        _fail(_error_message(error), code=3)

    if output_format == "json":
        typer.echo(json.dumps(_fetch_result_dict(result), indent=2))
    else:
        _emit_fetch_text(result)

    exit_code = _fetch_exit_code(result)
    if exit_code:
        raise typer.Exit(exit_code)


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


@data_app.command("path")
def data_path(
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
    """Resolve a dataset to its expected data-repository path."""

    if output_format not in {"text", "json"}:
        _fail(f"Invalid output format: {output_format}", code=2)
    try:
        resolved = _hbc(metadata_root, data_repo_path).resolve(dataset_id)
    except DatasetNotFound as error:
        _fail(_error_message(error), code=3)

    data = _resolved_path_dict(resolved)
    if output_format == "json":
        typer.echo(json.dumps(data, indent=2))
    else:
        _emit_mapping_text(data)


@data_app.command("status")
def data_status(
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
    """Inspect local content status without fetching data."""

    if output_format not in {"text", "json"}:
        _fail(f"Invalid output format: {output_format}", code=2)
    try:
        status = _hbc(metadata_root, data_repo_path).content_status(dataset_id)
    except DatasetNotFound as error:
        _fail(_error_message(error), code=3)

    data = _content_status_dict(status)
    if output_format == "json":
        typer.echo(json.dumps(data, indent=2))
    else:
        _emit_mapping_text(data)

    if status.status in {"missing_submodule", "missing_path"}:
        raise typer.Exit(4)
