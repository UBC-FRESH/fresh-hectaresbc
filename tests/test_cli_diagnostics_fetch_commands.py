import json
from pathlib import Path

from typer.testing import CliRunner

from fresh_hectaresbc.cli import app


SECRET_NAMES = {
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    "ARBUTUS_ACCESS_KEY_ID",
    "ARBUTUS_SECRET_ACCESS_KEY",
}

runner = CliRunner()


def _make_initialized_data_repo(tmp_path: Path, source_zip_path: str) -> Path:
    data_repo = tmp_path / "fresh-hectaresbc-data"
    raw_path = data_repo / "raw" / "hectaresbc_2022_export" / source_zip_path
    raw_path.parent.mkdir(parents=True)
    (data_repo / ".git").write_text("gitdir: ../not-a-real-git-dir\n", encoding="utf-8")
    raw_path.symlink_to(Path("../../../.git/annex/missing-content.zip"))
    return data_repo


def test_diagnostics_table_is_secret_safe() -> None:
    result = runner.invoke(app, ["diagnostics"])

    assert result.exit_code == 0
    assert "check\tstatus\tmessage" in result.output
    assert "git_annex_available" in result.output
    assert not any(secret_name in result.output for secret_name in SECRET_NAMES)


def test_diagnostics_json_parses() -> None:
    result = runner.invoke(app, ["diagnostics", "--format", "json"])

    assert result.exit_code == 0
    diagnostics = json.loads(result.output)
    assert {item["check"] for item in diagnostics} >= {
        "git_annex_available",
        "datalad_available",
        "data_repo_exists",
        "data_repo_is_git_repo",
        "special_remote_configured",
    }
    assert all(item["secret_safe"] for item in diagnostics)


def test_diagnostics_missing_submodule_exits_4(tmp_path: Path) -> None:
    result = runner.invoke(
        app,
        ["diagnostics", "--data-repo-path", str(tmp_path / "missing-data-repo")],
    )

    assert result.exit_code == 4
    assert "not_initialized" in result.output


def test_fetch_dry_run_is_secret_safe(tmp_path: Path) -> None:
    data_repo = _make_initialized_data_repo(tmp_path, "data_layers/adminunits_bcts.zip")
    result = runner.invoke(
        app,
        [
            "fetch",
            "dl_adminunits_bcts",
            "--dry-run",
            "--data-repo-path",
            str(data_repo),
        ],
    )

    assert result.exit_code == 0
    assert "status: dry_run" in result.output
    assert "backend: datalad" in result.output
    assert (
        "command_summary: datalad get "
        "raw/hectaresbc_2022_export/data_layers/adminunits_bcts.zip"
    ) in result.output
    assert not any(secret_name in result.output for secret_name in SECRET_NAMES)


def test_fetch_dry_run_json_parses(tmp_path: Path) -> None:
    data_repo = _make_initialized_data_repo(tmp_path, "data_layers/adminunits_bcts.zip")
    result = runner.invoke(
        app,
        [
            "fetch",
            "dl_adminunits_bcts",
            "--dry-run",
            "--data-repo-path",
            str(data_repo),
            "--format",
            "json",
        ],
    )

    assert result.exit_code == 0
    fetch_result = json.loads(result.output)
    assert fetch_result["status"] == "dry_run"
    assert fetch_result["backend"] == "datalad"
    assert fetch_result["secret_safe"] is True


def test_fetch_missing_submodule_exits_4(tmp_path: Path) -> None:
    result = runner.invoke(
        app,
        [
            "fetch",
            "dl_adminunits_bcts",
            "--data-repo-path",
            str(tmp_path / "missing-data-repo"),
        ],
    )

    assert result.exit_code == 4
    assert "status: not_initialized" in result.output
    assert not any(secret_name in result.output for secret_name in SECRET_NAMES)


def test_fetch_missing_dataset_exits_3() -> None:
    result = runner.invoke(app, ["fetch", "not_a_dataset", "--dry-run"])

    assert result.exit_code == 3
    assert "Dataset not found" in result.stderr
