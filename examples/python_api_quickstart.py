"""Quickstart for the fresh-hectaresbc Python API.

Run from a source checkout or installed environment:

    python3 examples/python_api_quickstart.py

The example avoids credentialed retrieval and network access. It demonstrates
catalog discovery, metadata lookup, path resolution, local status checks,
backend diagnostics, and dry-run fetch planning.
"""

from __future__ import annotations

from fresh_hectaresbc import HectaresBC


DATA_LAYER_ID = "dl_adminunits_bcts"
VIRTUAL_LAYER_ID = "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135"


def main() -> int:
    hbc = HectaresBC()

    print("fresh-hectaresbc Python API quickstart")
    print(f"catalog records: {len(hbc.catalog)}")

    data_layer = hbc.get(DATA_LAYER_ID)
    virtual_layer = hbc.get(VIRTUAL_LAYER_ID)

    print("\nexact lookup")
    print(f"data layer: {data_layer.dataset_id} | {data_layer.title_candidate}")
    print(f"virtual layer: {virtual_layer.dataset_id} | {virtual_layer.title_candidate}")

    print("\nsearch")
    for record in hbc.search("bull trout", limit=3):
        print(f"- {record.dataset_id} | {record.title_candidate}")

    print("\nfilter")
    admin_layers = hbc.filter(
        family="data_layer",
        dataset_id_prefix="dl_adminunits",
        has_tiff=True,
        has_wms_xml=True,
    )
    print(f"admin data layers with TIFF/WMS signals: {len(admin_layers)}")

    print("\npath resolution")
    resolved = hbc.resolve(DATA_LAYER_ID)
    print(f"raw relative path: {resolved.raw_relative_path}")
    print(f"expected local path: {resolved.absolute_path}")

    print("\nlocal content status")
    status = hbc.content_status(DATA_LAYER_ID)
    print(f"status: {status.status}")
    print(f"message: {status.message}")

    print("\nbackend diagnostics")
    for diagnostic in hbc.diagnostics():
        print(f"- {diagnostic.check}: {diagnostic.status}")

    print("\ndry-run fetch plan")
    plan = hbc.fetch(DATA_LAYER_ID, dry_run=True)
    print(f"status: {plan.status}")
    print(f"backend: {plan.backend}")
    print(f"message: {plan.message}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
