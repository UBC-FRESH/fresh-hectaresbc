#!/usr/bin/env python3
"""Generate high-resolution local preview overlays for the browser map.

The published DataLad preview set is intentionally compact (256 px), which is
sharp at thumbnail scale but visibly soft on a full-screen map. This wrapper
runs the existing batch preview generator at a larger size and writes ignored
local overrides under ``web/data/map_previews_highres/v1``. The browser prefers
those overrides when they are present and falls back to the published previews
otherwise.

The source HectaresBC ZIPs must be available through the DataLad submodule or a
local recovered archive root. Example:

    python scripts/generate_highres_web_previews.py \
        --max-size 2048 --workers 8 \
        --local-archive-root /path/to/hectaresbc

Use ``--dataset-id`` (repeatable) to regenerate selected layers.
"""

from __future__ import annotations

import argparse
import csv
import json
import subprocess
import sys
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_ROOT = REPO_ROOT / "web" / "data" / "map_previews_highres" / "v1"
FEASIBILITY_CSV = (
    REPO_ROOT / "metadata" / "preview_feasibility" / "layer_preview_feasibility.csv"
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate high-resolution local browser preview overrides."
    )
    parser.add_argument(
        "--max-size",
        type=int,
        default=2048,
        help="Maximum preview width or height (default: 2048).",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=8,
        help="Parallel preview generator workers (default: 8).",
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=DEFAULT_OUTPUT_ROOT,
        help="Local high-resolution preview root.",
    )
    parser.add_argument(
        "--local-archive-root",
        type=Path,
        default=None,
        help="Recovered HectaresBC archive root; defaults to the generator default.",
    )
    parser.add_argument(
        "--dataset-id",
        action="append",
        default=[],
        help="Generate a specific dataset ID; may be supplied multiple times.",
    )
    parser.add_argument(
        "--family",
        choices=["data_layer", "virtual_layer"],
        help="Generate every layer in a catalog family from the feasibility CSV.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate existing previews instead of skipping them.",
    )
    parser.add_argument(
        "--reindex-only",
        action="store_true",
        help="Rebuild index.json from existing per-layer manifests without generating.",
    )
    args = parser.parse_args()

    if args.reindex_only:
        count = write_index_from_manifests(args.output_root)
        print(f"Reindexed {count} high-resolution preview manifests.", flush=True)
        return 0

    command = [
        sys.executable,
        str(REPO_ROOT / "scripts" / "generate_layer_preview_batch.py"),
        "--max-size",
        str(args.max_size),
        "--workers",
        str(max(1, args.workers)),
        "--output-root",
        str(args.output_root),
    ]
    if args.local_archive_root:
        command.extend(["--local-archive-root", str(args.local_archive_root)])
    dataset_ids = list(args.dataset_id)
    if not dataset_ids and args.family:
        with FEASIBILITY_CSV.open(encoding="utf-8", newline="") as handle:
            dataset_ids = [
                row["dataset_id"]
                for row in csv.DictReader(handle)
                if row.get("source_family") == args.family
            ]
        if not dataset_ids:
            print(f"No {args.family} rows found in {FEASIBILITY_CSV}.", flush=True)
            return 2
    for dataset_id in dataset_ids:
        command.extend(["--dataset-id", dataset_id])
    if args.force:
        command.append("--force")

    print("Generating local high-resolution preview overrides:", flush=True)
    print("  " + " ".join(command), flush=True)
    result = subprocess.run(command, cwd=REPO_ROOT, check=False)
    if result.returncode != 0:
        print(
            "High-resolution preview generation failed. Check the source archive "
            "root and the generator output above.",
            flush=True,
        )
        return result.returncode
    count = write_index_from_manifests(args.output_root)
    print(
        f"High-resolution previews written under {args.output_root} "
        f"({count} indexed). Reload the browser map route.",
        flush=True,
    )
    return 0


def write_index_from_manifests(output_root: Path) -> int:
    """Rebuild index.json from whatever per-layer manifests are present.

    The batch generator writes its index only after a complete run. A partial or
    interrupted high-resolution run still has useful per-layer manifests, so the
    browser-facing index is rebuilt from those manifests.
    """

    layers_dir = output_root / "layers"
    layers: list[dict[str, object]] = []
    if layers_dir.is_dir():
        for manifest_path in sorted(layers_dir.glob("*/manifest.json")):
            try:
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            dataset_id = str(manifest.get("dataset_id") or manifest_path.parent.name)
            preview_path = manifest_path.parent / "preview.png"
            artifact_path = (
                f"layers/{dataset_id}/preview.png" if preview_path.is_file() else ""
            )
            layers.append(
                {
                    "dataset_id": dataset_id,
                    "title": manifest.get("title", dataset_id),
                    "source_family": manifest.get("source_family", ""),
                    "source_zip_path": manifest.get("source_zip_path", ""),
                    "artifact_kind": manifest.get("artifact_kind", "raster_png"),
                    "artifact_status": manifest.get("artifact_status", "source_derived_preview"),
                    "artifact_path": artifact_path,
                    "manifest_path": f"layers/{dataset_id}/manifest.json",
                    "wgs84_bounds": manifest.get("wgs84_bounds", []),
                    "preview_eligibility_blockers": manifest.get(
                        "preview_eligibility_blockers", []
                    ),
                }
            )

    status_counts = Counter(str(layer["artifact_status"]) for layer in layers)
    previewable = sum(
        1
        for layer in layers
        if layer["artifact_status"]
        in {"source_derived_preview", "already_present"}
    )
    max_size = 0
    for manifest_path in layers_dir.glob("*/manifest.json"):
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        max_size = max(
            max_size,
            int(manifest.get("preview_width") or 0),
            int(manifest.get("preview_height") or 0),
        )

    generated_at = datetime.now(UTC).replace(microsecond=0).isoformat()
    index = {
        "schema_version": 1,
        "generated_at": generated_at,
        "started_at": generated_at,
        "artifact_root": ".",
        "max_size": max_size,
        "requested_count": len(layers),
        "processed_count": len(layers),
        "artifact_count": previewable,
        "failure_count": len(layers) - previewable,
        "status_counts": dict(sorted(status_counts.items())),
        "reference_layers": [],
        "layers": layers,
    }
    output_root.mkdir(parents=True, exist_ok=True)
    (output_root / "index.json").write_text(
        json.dumps(index, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return len(layers)


if __name__ == "__main__":
    raise SystemExit(main())
