from pathlib import Path

import fresh_hectaresbc
from fresh_hectaresbc import HectaresBC


def test_package_exports_public_facade() -> None:
    assert fresh_hectaresbc.HectaresBC is HectaresBC


def test_public_facade_accepts_paths_without_side_effects(tmp_path: Path) -> None:
    api = HectaresBC(
        metadata_root=tmp_path / "metadata",
        data_repo_path=tmp_path / "external" / "fresh-hectaresbc-data",
    )

    assert api.metadata_root == tmp_path / "metadata"
    assert api.data_repo_path == tmp_path / "external" / "fresh-hectaresbc-data"


def test_unimplemented_methods_fail_explicitly() -> None:
    api = HectaresBC()

    for method, args in [
        (api.resolve, ("dl_adminunits_bcts",)),
        (api.diagnostics, ()),
    ]:
        try:
            method(*args)
        except NotImplementedError as error:
            assert "P6.5" in str(error)
        else:
            raise AssertionError(f"{method.__name__} should not be implemented yet")
