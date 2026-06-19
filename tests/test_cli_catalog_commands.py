import json

from typer.testing import CliRunner

from fresh_hectaresbc.cli import app


runner = CliRunner()


def test_catalog_search_finds_bull_trout() -> None:
    result = runner.invoke(app, ["catalog", "search", "bull trout", "--limit", "1"])

    assert result.exit_code == 0
    assert "dataset_id" in result.output
    assert "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135" in result.output


def test_catalog_search_json_parses() -> None:
    result = runner.invoke(
        app,
        ["catalog", "search", "bull trout", "--limit", "1", "--format", "json"],
    )

    assert result.exit_code == 0
    records = json.loads(result.output)
    assert records[0]["dataset_id"] == (
        "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135"
    )


def test_catalog_show_outputs_representative_record() -> None:
    result = runner.invoke(app, ["catalog", "show", "dl_adminunits_bcts"])

    assert result.exit_code == 0
    assert "dataset_id: dl_adminunits_bcts" in result.output
    assert "title_candidate: BCTS Operating Areas" in result.output


def test_catalog_show_json_preserves_source_path() -> None:
    result = runner.invoke(
        app, ["catalog", "show", "dl_adminunits_bcts", "--format", "json"]
    )

    assert result.exit_code == 0
    record = json.loads(result.output)
    assert record["source_zip_path"] == "data_layers/adminunits_bcts.zip"
    assert record["manifest_size_bytes"] == 1092878


def test_catalog_list_filters_virtual_layers() -> None:
    result = runner.invoke(
        app,
        ["catalog", "list", "--family", "virtual_layer", "--limit", "2"],
    )

    assert result.exit_code == 0
    assert "dataset_id" in result.output
    rows = [line.split("\t") for line in result.output.strip().splitlines()]
    assert [row[1] for row in rows[1:]] == ["virtual_layer", "virtual_layer"]


def test_catalog_list_virtual_layer_id_filter() -> None:
    result = runner.invoke(
        app,
        ["catalog", "list", "--virtual-layer-id", "10077", "--format", "json"],
    )

    assert result.exit_code == 0
    records = json.loads(result.output)
    assert [record["dataset_id"] for record in records] == [
        "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135"
    ]


def test_catalog_show_missing_dataset_exits_3() -> None:
    result = runner.invoke(app, ["catalog", "show", "not_a_dataset"])

    assert result.exit_code == 3
    assert "Dataset not found" in result.stderr
