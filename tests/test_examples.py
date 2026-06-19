import os
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


def test_cli_quickstart_runs_without_network_retrieval() -> None:
    env = os.environ.copy()
    env["FRESH_HECTARESBC_CLI"] = f"{sys.executable} -m fresh_hectaresbc.cli"

    result = subprocess.run(
        ["bash", "examples/cli_quickstart.sh"],
        check=True,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    assert "fresh-hectaresbc CLI quickstart" in result.stdout
    assert "fresh-hectaresbc 0.0.0" in result.stdout
    assert "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135" in result.stdout
    assert "BCTS Operating Areas" in result.stdout
    assert "Retrieval was planned but not executed." in result.stdout
