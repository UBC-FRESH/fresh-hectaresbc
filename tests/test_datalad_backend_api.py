from pathlib import Path

from fresh_hectaresbc import BackendDiagnostic, FetchResult, HectaresBC
from fresh_hectaresbc.backends import DataladBackend


SECRET_NAMES = {
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    "ARBUTUS_ACCESS_KEY_ID",
    "ARBUTUS_SECRET_ACCESS_KEY",
}


def _make_initialized_data_repo(tmp_path: Path, source_zip_path: str) -> Path:
    data_repo = tmp_path / "fresh-hectaresbc-data"
    raw_path = data_repo / "raw" / "hectaresbc_2022_export" / source_zip_path
    raw_path.parent.mkdir(parents=True)
    (data_repo / ".git").write_text("gitdir: ../not-a-real-git-dir\n", encoding="utf-8")
    raw_path.symlink_to(Path("../../../.git/annex/missing-content.zip"))
    return data_repo


def test_diagnostics_return_structured_secret_safe_checks() -> None:
    diagnostics = HectaresBC().diagnostics()

    assert diagnostics
    assert all(isinstance(item, BackendDiagnostic) for item in diagnostics)
    assert {item.check for item in diagnostics} >= {
        "git_annex_available",
        "datalad_available",
        "data_repo_exists",
        "data_repo_is_git_repo",
        "special_remote_configured",
    }
    assert all(item.secret_safe for item in diagnostics)
    joined = "\n".join(
        f"{item.message}\n{item.command_summary or ''}\n{item.remediation or ''}"
        for item in diagnostics
    )
    assert not any(secret_name in joined for secret_name in SECRET_NAMES)


def test_datalad_backend_reports_missing_tools_without_running_retrieval(tmp_path: Path) -> None:
    backend = DataladBackend(tmp_path / "missing-data-repo", env={"PATH": ""})

    diagnostics = backend.diagnostics()

    assert any(item.check == "git_annex_available" for item in diagnostics)
    assert any(item.status == "backend_unavailable" for item in diagnostics)
    assert all(item.secret_safe for item in diagnostics)


def test_fetch_dry_run_returns_plan_without_network_or_credentials(tmp_path: Path) -> None:
    data_repo = _make_initialized_data_repo(tmp_path, "data_layers/adminunits_bcts.zip")
    result = HectaresBC(data_repo_path=data_repo).fetch(
        "dl_adminunits_bcts", dry_run=True
    )

    assert isinstance(result, FetchResult)
    assert result.status == "dry_run"
    assert result.backend == "datalad"
    assert result.command_summary == (
        "datalad get raw/hectaresbc_2022_export/data_layers/adminunits_bcts.zip"
    )
    assert result.secret_safe is True
    assert result.verification_performed is False


def test_fetch_missing_submodule_returns_structured_result(tmp_path: Path) -> None:
    result = HectaresBC(data_repo_path=tmp_path / "missing-data-repo").fetch(
        "dl_adminunits_bcts"
    )

    assert result.status == "not_initialized"
    assert result.backend == "datalad"
    assert result.diagnostics
    assert all(item.secret_safe for item in result.diagnostics)


def test_fetch_many_preserves_input_order_for_dry_run(tmp_path: Path) -> None:
    data_repo = _make_initialized_data_repo(tmp_path, "data_layers/adminunits_bcts.zip")
    _make_initialized_data_repo(
        tmp_path,
        "virtual_layers/virtualspecies.bulltroutsalvelinusconfluentus.1135.zip",
    )

    results = HectaresBC(data_repo_path=data_repo).fetch_many(
        [
            "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135",
            "dl_adminunits_bcts",
        ],
        dry_run=True,
    )

    assert [result.dataset_id for result in results] == [
        "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135",
        "dl_adminunits_bcts",
    ]
    assert [result.status for result in results] == ["dry_run", "dry_run"]
