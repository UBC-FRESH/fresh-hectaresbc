from pathlib import Path

from fresh_hectaresbc import ContentStatus, HectaresBC, ResolvedDatasetPath


def test_resolve_data_layer_to_raw_data_repo_path() -> None:
    resolved = HectaresBC().resolve("dl_adminunits_bcts")

    assert isinstance(resolved, ResolvedDatasetPath)
    assert resolved.dataset_id == "dl_adminunits_bcts"
    assert resolved.source_zip_path == "data_layers/adminunits_bcts.zip"
    assert resolved.raw_relative_path == Path(
        "raw/hectaresbc_2022_export/data_layers/adminunits_bcts.zip"
    )
    assert resolved.absolute_path == resolved.data_repo_path / resolved.raw_relative_path
    assert resolved.submodule_initialized is True
    assert resolved.path_metadata_exists is True
    assert isinstance(resolved.content_present, bool)


def test_resolve_virtual_layer_from_record_object() -> None:
    hbc = HectaresBC()
    record = hbc.get("vl_virtualspecies_bulltroutsalvelinusconfluentus_1135")

    resolved = hbc.resolve(record)

    assert resolved.dataset_id == record.dataset_id
    assert resolved.raw_relative_path == Path(
        "raw/hectaresbc_2022_export/virtual_layers/"
        "virtualspecies.bulltroutsalvelinusconfluentus.1135.zip"
    )


def test_content_status_reports_local_state_without_fetching() -> None:
    status = HectaresBC().content_status("dl_adminunits_bcts")

    assert isinstance(status, ContentStatus)
    assert status.dataset_id == "dl_adminunits_bcts"
    assert status.status in {"present", "missing_content"}
    assert status.submodule_initialized is True
    assert status.path_metadata_exists is True
    assert isinstance(status.content_present, bool)
    assert "content" in status.message.lower()


def test_local_path_returns_expected_path_without_fetching() -> None:
    hbc = HectaresBC()

    assert hbc.local_path("dl_adminunits_bcts") == hbc.resolve(
        "dl_adminunits_bcts"
    ).absolute_path


def test_missing_submodule_is_status_not_exception(tmp_path: Path) -> None:
    status = HectaresBC(data_repo_path=tmp_path / "missing-data-repo").content_status(
        "dl_adminunits_bcts"
    )

    assert status.status == "missing_submodule"
    assert status.submodule_initialized is False
    assert status.path_metadata_exists is False
    assert status.content_present is False


def test_missing_expected_path_is_status_not_exception(tmp_path: Path) -> None:
    data_repo = tmp_path / "fresh-hectaresbc-data"
    (data_repo / "raw" / "hectaresbc_2022_export").mkdir(parents=True)
    (data_repo / ".git").write_text("gitdir: ../not-a-real-git-dir\n", encoding="utf-8")

    status = HectaresBC(data_repo_path=data_repo).content_status("dl_adminunits_bcts")

    assert status.status == "missing_path"
    assert status.submodule_initialized is True
    assert status.path_metadata_exists is False
    assert status.content_present is False
