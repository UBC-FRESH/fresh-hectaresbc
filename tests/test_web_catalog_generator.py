import json
from pathlib import Path

from scripts.generate_web_catalog import build_catalog_payload, write_catalog_payload


def test_web_catalog_payload_uses_package_catalog() -> None:
    payload = build_catalog_payload()

    assert payload["schema_version"] == 1
    assert payload["record_count"] == 2183
    assert payload["family_counts"] == {"data_layer": 418, "virtual_layer": 1765}

    records = {record["dataset_id"]: record for record in payload["records"]}
    assert records["dl_adminunits_bcts"]["title"] == "BCTS Operating Areas"
    assert records["dl_adminunits_bcts"]["preview"]["has_wms"] is True
    assert (
        records["vl_virtualspecies_bulltroutsalvelinusconfluentus_1135"]["title"]
        == "Bull Trout (Salvelinus confluentus)"
    )


def test_web_catalog_payload_excludes_private_fragments(tmp_path: Path) -> None:
    output = tmp_path / "catalog.json"
    write_catalog_payload(build_catalog_payload(), output)

    data = json.loads(output.read_text(encoding="utf-8"))
    serialized = json.dumps(data, sort_keys=True).lower()

    assert "tmp/" not in serialized
    assert "secret" not in serialized
    assert "bootstrap.md" not in serialized
    assert "external/fresh-hectaresbc-data/raw/" not in serialized
