from typer.testing import CliRunner

from fresh_hectaresbc.cli import app


runner = CliRunner()


def test_cli_help_renders_without_credentials_or_data_downloads() -> None:
    result = runner.invoke(app, ["--help"])

    assert result.exit_code == 0
    assert "fresh-hectaresbc" in result.output
    assert "catalog" in result.output
    assert "data" in result.output


def test_cli_version_renders() -> None:
    result = runner.invoke(app, ["--version"])

    assert result.exit_code == 0
    assert result.output.strip().startswith("fresh-hectaresbc ")


def test_catalog_namespace_help_renders() -> None:
    result = runner.invoke(app, ["catalog", "--help"])

    assert result.exit_code == 0
    assert "Search and inspect recovered catalog records." in result.output


def test_data_namespace_help_renders() -> None:
    result = runner.invoke(app, ["data", "--help"])

    assert result.exit_code == 0
    assert "Resolve dataset paths and inspect local data status." in result.output
