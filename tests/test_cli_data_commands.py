import json
from pathlib import Path

from typer.testing import CliRunner

from fresh_hectaresbc.cli import app


runner = CliRunner()


def test_data_path_outputs_representative_path() -> None:
    result = runner.invoke(app, ["data", "path", "dl_adminunits_bcts"])

    assert result.exit_code == 0
    assert "dataset_id: dl_adminunits_bcts" in result.output
    assert (
        "raw_relative_path: raw/hectaresbc_2022_export/data_layers/adminunits_bcts.zip"
        in result.output
    )


def test_data_path_json_parses() -> None:
    result = runner.invoke(
        app,
        ["data", "path", "dl_adminunits_bcts", "--format", "json"],
    )

    assert result.exit_code == 0
    resolved = json.loads(result.output)
    assert resolved["source_zip_path"] == "data_layers/adminunits_bcts.zip"
    assert resolved["raw_relative_path"] == (
        "raw/hectaresbc_2022_export/data_layers/adminunits_bcts.zip"
    )


def test_data_status_reports_local_state_without_fetching() -> None:
    result = runner.invoke(app, ["data", "status", "dl_adminunits_bcts"])

    assert result.exit_code == 0
    assert "dataset_id: dl_adminunits_bcts" in result.output
    assert "status: " in result.output
    assert "content_present: " in result.output


def test_data_status_missing_submodule_exits_4(tmp_path: Path) -> None:
    result = runner.invoke(
        app,
        [
            "data",
            "status",
            "dl_adminunits_bcts",
            "--data-repo-path",
            str(tmp_path / "missing-data-repo"),
        ],
    )

    assert result.exit_code == 4
    assert "status: missing_submodule" in result.output


def test_data_status_missing_path_exits_4(tmp_path: Path) -> None:
    data_repo = tmp_path / "fresh-hectaresbc-data"
    (data_repo / "raw" / "hectaresbc_2022_export").mkdir(parents=True)
    (data_repo / ".git").write_text("gitdir: ../not-a-real-git-dir\n", encoding="utf-8")

    result = runner.invoke(
        app,
        [
            "data",
            "status",
            "dl_adminunits_bcts",
            "--data-repo-path",
            str(data_repo),
            "--format",
            "json",
        ],
    )

    assert result.exit_code == 4
    status = json.loads(result.output)
    assert status["status"] == "missing_path"
    assert status["path_metadata_exists"] is False


def test_data_path_missing_dataset_exits_3() -> None:
    result = runner.invoke(app, ["data", "path", "not_a_dataset"])

    assert result.exit_code == 3
    assert "Dataset not found" in result.stderr
