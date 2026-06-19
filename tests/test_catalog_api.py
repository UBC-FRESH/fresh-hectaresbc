import csv
import shutil
from pathlib import Path

import pytest

from fresh_hectaresbc import Catalog, DatasetNotFound, HectaresBC
from fresh_hectaresbc.catalog import DuplicateDatasetId, QueryInvalid


def test_catalog_loads_all_recovered_records() -> None:
    catalog = Catalog.from_default_paths()

    assert len(catalog) == 2183
    assert len(list(catalog.iter_records(family="data_layer"))) == 418
    assert len(list(catalog.iter_records(family="virtual_layer"))) == 1765
    assert len({record.dataset_id for record in catalog}) == 2183


def test_default_catalog_falls_back_to_package_data(tmp_path: Path) -> None:
    catalog = Catalog.from_default_paths(start=tmp_path)

    assert len(catalog) == 2183
    assert catalog.get("dl_adminunits_bcts").title_candidate == "BCTS Operating Areas"
    assert catalog.search("bull trout", limit=1)[0].dataset_id == (
        "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135"
    )
    assert "package_data/recovered_catalog" in str(catalog.metadata_root).replace(
        "\\", "/"
    )


def test_exact_lookup_preserves_recovered_fields() -> None:
    record = HectaresBC().get("dl_adminunits_bcts")

    assert record.dataset_id == "dl_adminunits_bcts"
    assert record.source_family == "data_layer"
    assert record.source_zip_path == "data_layers/adminunits_bcts.zip"
    assert record.source_filename == "adminunits_bcts.zip"
    assert record.title_candidate == "BCTS Operating Areas"
    assert record.manifest_size_bytes == 1092878
    assert record.field("category_metadata_count") == "13"
    assert record.to_dict()["source_zip_path"] == "data_layers/adminunits_bcts.zip"


def test_missing_lookup_and_empty_search_are_structured_errors() -> None:
    catalog = Catalog.from_default_paths()

    with pytest.raises(DatasetNotFound):
        catalog.get("not_a_dataset")

    with pytest.raises(QueryInvalid):
        catalog.search("  ")


def test_search_is_case_insensitive_and_deterministic() -> None:
    results = HectaresBC().search("bull trout", limit=5)

    assert results
    assert results[0].dataset_id == (
        "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135"
    )
    assert results[0].title_candidate == "Bull Trout (Salvelinus confluentus)"


def test_catalog_filters_cover_families_paths_and_metadata_flags() -> None:
    catalog = Catalog.from_default_paths()

    assert [record.dataset_id for record in catalog.filter(virtual_layer_id=10077)] == [
        "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135"
    ]
    assert {record.source_family for record in catalog.filter(family="data_layer")} == {
        "data_layer"
    }
    assert len(catalog.filter(source_path_prefix="virtual_layers/")) == 1765
    assert catalog.filter(
        family="data_layer",
        dataset_id_prefix="dl_adminunits",
        has_category_metadata=True,
        has_wms_xml=True,
        has_tiff=True,
    )[0].dataset_id == "dl_adminunits_bcts"
    assert catalog.filter(
        family="data_layer", dataset_id_prefix="dl_climatedecade", has_value_metadata=True
    )[0].dataset_id == "dl_climatedecade_ahm"


def test_duplicate_dataset_ids_fail_loudly(tmp_path: Path) -> None:
    source = Path("metadata/recovered_catalog")
    metadata_root = tmp_path / "recovered_catalog"
    shutil.copytree(source, metadata_root)

    data_layer_path = metadata_root / "data_layer_records.csv"
    with data_layer_path.open(newline="", encoding="utf-8") as stream:
        rows = list(csv.DictReader(stream))
        fieldnames = list(rows[0])
    rows[1]["dataset_id"] = rows[0]["dataset_id"]
    with data_layer_path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    with pytest.raises(DuplicateDatasetId):
        Catalog.from_metadata_root(metadata_root)
