#!/usr/bin/env python3
"""Generate browser map-preview fixture artifacts for Phase 11."""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fresh_hectaresbc import HectaresBC


DEFAULT_OUTPUT = Path("web/data/map_previews")
DATASET_ID = "dl_water_cwb_canals"
UNAVAILABLE_DATASET_ID = "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135"
SCHEMA_VERSION = 1
FIXTURE_CRS = "EPSG:4326"
FIXTURE_BOUNDS = [-123.4107, 49.0507, -122.6697, 49.3611]
FIXTURE_COORDINATES = [
    [-123.376, 49.239],
    [-123.191, 49.178],
    [-122.971, 49.146],
    [-122.781, 49.204],
]
FORBIDDEN_FRAGMENTS = (
    "/home/",
    "tmp/bootstrap",
    "tmp/shared-data/hectaresbc",
    "aws-secrets",
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate Phase 11 browser map-preview fixture artifacts."
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Output directory for generated preview artifacts.",
    )
    args = parser.parse_args()

    manifest = build_preview_manifest(args.output_dir)
    write_preview_artifacts(manifest, args.output_dir)
    print(
        "wrote map preview artifacts "
        f"{args.output_dir} ({manifest['artifact_count']} artifacts)"
    )
    return 0


def build_preview_manifest(output_dir: Path) -> dict[str, Any]:
    hbc = HectaresBC()
    candidate = hbc.get(DATASET_ID)
    unavailable = hbc.get(UNAVAILABLE_DATASET_ID)
    artifact_path = Path(DATASET_ID) / "preview.geojson"
    resolved = hbc.resolve(DATASET_ID)
    source_status = hbc.content_status(DATASET_ID)

    manifest: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(UTC).replace(microsecond=0).isoformat(),
        "artifact_count": 1,
        "artifact_format": "geojson",
        "artifact_scope": "ui_fixture_pending_payload_derivation",
        "output_root": _public_output_root(output_dir),
        "representative_records": {
            "data_layer_candidate": DATASET_ID,
            "unavailable_record": UNAVAILABLE_DATASET_ID,
        },
        "artifacts": [
            {
                "dataset_id": candidate.dataset_id,
                "title": candidate.title_candidate,
                "source_family": candidate.source_family,
                "source_zip_path": candidate.source_zip_path,
                "raw_relative_path": str(resolved.raw_relative_path),
                "source_content_status": source_status.status,
                "source_content_present": source_status.content_present,
                "artifact_kind": "geojson_fixture",
                "artifact_status": "fixture_pending_source_derivation",
                "artifact_path": artifact_path.as_posix(),
                "crs": FIXTURE_CRS,
                "bounds": FIXTURE_BOUNDS,
                "preview_eligibility_status": "candidate_missing_crs",
                "preview_eligibility_blockers": ["missing_crs", "missing_extent"],
                "fixture_warning": (
                    "This GeoJSON is a browser UI fixture, not recovered HectaresBC "
                    "canal geometry. It exists so the map UI can be built while P11 "
                    "derives authoritative preview artifacts from payload content."
                ),
                "provenance": {
                    "generated_by": "scripts/generate_map_preview_artifacts.py",
                    "source_dataset_id": candidate.dataset_id,
                    "source_title": candidate.title_candidate,
                    "source_zip_path": candidate.source_zip_path,
                    "unavailable_reference_dataset_id": unavailable.dataset_id,
                    "reason": (
                        "Recovered compact metadata identifies a raster/WMS candidate "
                        "but does not expose authoritative CRS or spatial extent."
                    ),
                },
            }
        ],
    }
    _validate_manifest(manifest)
    return manifest


def write_preview_artifacts(manifest: dict[str, Any], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    for artifact in manifest["artifacts"]:
        artifact_path = output_dir / artifact["artifact_path"]
        artifact_path.parent.mkdir(parents=True, exist_ok=True)
        artifact_path.write_text(
            json.dumps(_fixture_geojson(artifact), indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _fixture_geojson(artifact: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "FeatureCollection",
        "name": artifact["dataset_id"],
        "crs": {
            "type": "name",
            "properties": {"name": artifact["crs"]},
        },
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": FIXTURE_COORDINATES,
                },
                "properties": {
                    "dataset_id": artifact["dataset_id"],
                    "title": artifact["title"],
                    "artifact_status": artifact["artifact_status"],
                    "fixture": True,
                    "fixture_warning": artifact["fixture_warning"],
                    "source_zip_path": artifact["source_zip_path"],
                },
            }
        ],
    }


def _public_output_root(output_dir: Path) -> str:
    try:
        return output_dir.relative_to(Path.cwd()).as_posix()
    except ValueError:
        return output_dir.as_posix()


def _validate_manifest(manifest: dict[str, Any]) -> None:
    serialized = json.dumps(manifest, sort_keys=True).lower()
    matches = [fragment for fragment in FORBIDDEN_FRAGMENTS if fragment in serialized]
    if matches:
        raise ValueError(
            "map preview manifest contains forbidden fragments: "
            + ", ".join(sorted(matches))
        )


if __name__ == "__main__":
    raise SystemExit(main())
