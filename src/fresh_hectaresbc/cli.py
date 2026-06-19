"""Typer command-line interface for fresh-hectaresbc."""

from __future__ import annotations

from importlib.metadata import PackageNotFoundError, version
from typing import Annotated

import typer


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
