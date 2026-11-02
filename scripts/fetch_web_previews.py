#!/usr/bin/env python3
"""Fetch published web-map preview payloads from the DataLad data repository.

The compact preview index and per-layer manifests are Git-tracked, but the
preview PNGs are git-annex payloads on the Arbutus S3 special remote. A cold
checkout therefore lists 2,163 previewable layers while every preview image is
absent. This command materializes the image payloads the browser needs.

Source the user-local Arbutus credentials first; this script never reads or
prints credential values:

    export PATH="$HOME/.local/bin:$PATH"
    source ~/.config/fresh-hectaresbc/arbutus_env.sh
    python scripts/fetch_web_previews.py

Use ``--dataset-id`` to fetch a single preview while developing.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_REPO = REPO_ROOT / "external" / "fresh-hectaresbc-data"
PREVIEW_ROOT = Path("derived/web_map_previews/v1/layers")


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Fetch preview PNG payloads from the DataLad data repository "
            "into the local checkout."
        )
    )
    parser.add_argument(
        "--dataset-id",
        help="Fetch one layer preview instead of the full preview set.",
    )
    parser.add_argument(
        "--jobs",
        type=int,
        default=8,
        help="Parallel DataLad download jobs (default: 8).",
    )
    args = parser.parse_args()

    if not (DATA_REPO / ".git").exists():
        print(
            "The data submodule is not initialized. Run:\n"
            "  git submodule update --init external/fresh-hectaresbc-data",
            flush=True,
        )
        return 2
    if shutil.which("datalad") is None:
        print(
            "datalad is not installed. Install the development extra with "
            "`pip install -e '.[dev]'` in the repo-local environment.",
            flush=True,
        )
        return 2

    target = PREVIEW_ROOT
    if args.dataset_id:
        if Path(args.dataset_id).name != args.dataset_id:
            print("--dataset-id must be a plain dataset ID, not a path.", flush=True)
            return 2
        target = PREVIEW_ROOT / args.dataset_id
        if not (DATA_REPO / target).exists():
            print(f"No preview directory found for {args.dataset_id}.", flush=True)
            return 2

    command = [
        "datalad",
        "get",
        "-J",
        str(max(1, args.jobs)),
        str(target),
    ]
    print(
        "Fetching preview payloads with DataLad. "
        "Arbutus credentials must already be sourced.",
        flush=True,
    )
    result = subprocess.run(command, cwd=DATA_REPO, check=False)
    if result.returncode != 0:
        print(
            "Preview fetch failed. Check the Arbutus credential environment and "
            "network access, then retry.",
            flush=True,
        )
        return result.returncode

    print(
        "Preview payloads fetched. Reload the browser map route.",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
