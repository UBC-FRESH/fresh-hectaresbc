import subprocess
import sys


def test_python_api_quickstart_runs_without_network_retrieval() -> None:
    result = subprocess.run(
        [sys.executable, "examples/python_api_quickstart.py"],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    assert "catalog records: 2183" in result.stdout
    assert "dl_adminunits_bcts | BCTS Operating Areas" in result.stdout
    assert (
        "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135 | "
        "Bull Trout (Salvelinus confluentus)"
    ) in result.stdout
    assert "dry-run fetch plan" in result.stdout
