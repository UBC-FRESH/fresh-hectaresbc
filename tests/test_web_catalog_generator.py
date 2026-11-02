import json
from pathlib import Path

from scripts.generate_web_catalog import (
    build_catalog_details,
    build_catalog_index,
    build_catalog_meta,
    build_catalog_payload,
    write_catalog_artifacts,
    write_catalog_payload,
)


def test_web_catalog_payload_uses_package_catalog() -> None:
    payload = build_catalog_payload()

    assert payload["schema_version"] == 1
    assert payload["record_count"] == 2183
    assert payload["family_counts"] == {"data_layer": 418, "virtual_layer": 1765}
    assert payload["preview_eligibility_counts"] == {
        "candidate_missing_crs": 418,
        "not_supported": 1765,
    }
    assert payload["representative_preview_records"] == {
        "data_layer_candidate": "dl_adminunits_bcts",
        "unavailable_record": "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135",
    }

    records = {record["dataset_id"]: record for record in payload["records"]}
    assert records["dl_adminunits_bcts"]["title"] == "BCTS Operating Areas"
    assert records["dl_adminunits_bcts"]["preview"]["has_wms"] is True
    assert (
        records["dl_adminunits_bcts"]["preview"]["eligibility_status"]
        == "candidate_missing_crs"
    )
    assert records["dl_adminunits_bcts"]["preview"]["eligibility_blockers"] == [
        "missing_crs",
        "missing_extent",
    ]
    assert (
        records["vl_virtualspecies_bulltroutsalvelinusconfluentus_1135"]["preview"][
            "eligibility_status"
        ]
        == "not_supported"
    )
    assert (
        records["vl_virtualspecies_bulltroutsalvelinusconfluentus_1135"]["title"]
        == "Bull Trout (Salvelinus confluentus)"
    )


def test_web_catalog_payload_excludes_private_fragments(tmp_path: Path) -> None:
    output = tmp_path / "catalog.json"
    payload = build_catalog_payload()
    write_catalog_payload(payload, output)
    write_catalog_artifacts(payload, output)

    for path in (
        output,
        tmp_path / "catalog.index.json",
        tmp_path / "catalog.details.json",
        tmp_path / "catalog.meta.json",
    ):
        data = json.loads(path.read_text(encoding="utf-8"))
        serialized = json.dumps(data, sort_keys=True).lower()
        assert "tmp/" not in serialized
        assert "secret" not in serialized
        assert "bootstrap.md" not in serialized
        assert "external/fresh-hectaresbc-data/raw/" not in serialized


def test_web_catalog_artifacts_split_browse_index_from_details() -> None:
    payload = build_catalog_payload()
    index = build_catalog_index(payload)
    details = build_catalog_details(payload)
    meta = build_catalog_meta(payload)

    assert index["schema_version"] == 1
    assert index["record_count"] == 2183
    assert len(index["records"]) == 2183
    assert details["record_count"] == 2183
    assert len(details["records"]) == 2183
    assert meta["record_count"] == 2183

    row = next(
        record
        for record in index["records"]
        if record["dataset_id"] == "dl_adminunits_bcts"
    )
    assert row["format_label"] == "TIFF + WMS"
    assert row["preview_eligibility_status"] == "candidate_missing_crs"
    assert "bcts operating areas" in row["search_text"]
    assert "metadata" not in row
    assert "provenance" not in row

    detail = details["records"]["dl_adminunits_bcts"]
    assert detail["metadata"]["parent_layer_title"] == (
        "Administrative Units and Tenures"
    )
    assert detail["provenance"]["zip_read_status"] == "ok"
