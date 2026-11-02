#!/usr/bin/env python3
"""Small JSON tool surface for the HectaresBC web assistant.

The assistant runs these commands in the service workspace. Keeping the GIS and
catalogue work behind this CLI means the chat prompt does not need to know how to
import FEMIC, open DataLad payloads, or write GeoTIFFs.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = REPO_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))


def _print(payload: dict[str, Any]) -> int:
    print(json.dumps(payload, indent=2))
    return 0


def _layer_summary(record: Any) -> dict[str, Any]:
    return {
        "dataset_id": record.dataset_id,
        "title": record.title_candidate or record.source_stem,
        "family": record.source_family,
        "source_zip_path": record.source_zip_path,
        "manifest_size_bytes": record.manifest_size_bytes,
        "verification_status": record.verification_status,
        "raster_member_paths": record.field("raster_member_paths"),
    }


def cmd_search_layers(args: argparse.Namespace) -> int:
    from fresh_hectaresbc import HectaresBC

    hbc = HectaresBC()
    records = hbc.search(args.query, family=args.family, limit=args.limit)
    return _print(
        {
            "status": "ok",
            "query": args.query,
            "count": len(records),
            "records": [_layer_summary(record) for record in records],
        }
    )


def cmd_search_aoi(args: argparse.Namespace) -> int:
    from fresh_hectaresbc.femic_bridge import search_aoi_layers

    result = search_aoi_layers(
        args.query, limit=args.limit, femic_src=args.femic_src
    )
    compact = []
    for match in result.get("matches", []):
        resources = []
        for resource in match.get("resources", []):
            if resource.get("wfs_typename") or resource.get("format") in {
                "wfs",
                "wms",
                "geojson",
                "gpkg",
            }:
                resources.append(
                    {
                        "name": resource.get("name"),
                        "classification": resource.get("classification"),
                        "format": resource.get("format"),
                        "wfs_queryable": resource.get("wfs_queryable"),
                        "wfs_typename": resource.get("wfs_typename"),
                        "url": resource.get("url"),
                    }
                )
        compact.append(
            {
                "title": match.get("title"),
                "package_name": match.get("package_name"),
                "package_id": match.get("package_id"),
                "dataset_page_url": match.get("dataset_page_url"),
                "matched_by": match.get("matched_by"),
                "resources": resources[:6],
            }
        )
    return _print(
        {
            "status": "ok",
            "query": args.query,
            "matches": compact,
            "notes": result.get("notes", []),
        }
    )


def cmd_resolve_aoi(args: argparse.Namespace) -> int:
    from fresh_hectaresbc.femic_bridge import resolve_aoi

    output_root = Path(args.output_root).expanduser().resolve()
    result = resolve_aoi(
        args.query,
        name=args.name,
        limit=args.limit,
        output_dir=output_root,
        femic_src=args.femic_src,
    )
    if not args.include_geometry:
        result.pop("geometry", None)
    return _print(result)


def cmd_prepare_bundle(args: argparse.Namespace) -> int:
    from fresh_hectaresbc.bundle import prepare_bundle

    output_root = Path(args.output_root).expanduser().resolve()
    result = prepare_bundle(
        layer_ids=args.layer_id,
        output_root=output_root,
        aoi_query=args.aoi_query,
        aoi_name=args.aoi_name,
        aoi_geojson=args.aoi_geojson,
        archive_root=args.archive_root,
        femic_src=args.femic_src,
        max_layers=args.max_layers,
        max_area_ha=args.max_area_ha,
        public_url=args.public_url or os.environ.get("FRESH_HECTARESBC_PUBLIC_URL"),
    )
    return _print(result)


def cmd_list_bundles(args: argparse.Namespace) -> int:
    output_root = Path(args.output_root).expanduser().resolve()
    bundles = []
    if output_root.is_dir():
        for manifest_path in sorted(
            output_root.glob("*/manifest.json"), reverse=True
        )[: args.limit]:
            try:
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            bundles.append(
                {
                    "bundle_id": manifest.get("bundle_id"),
                    "status": manifest.get("status"),
                    "aoi": manifest.get("aoi"),
                    "layer_count": len(manifest.get("layers", [])),
                    "failures": len(manifest.get("failures", [])),
                    "manifest_path": str(manifest_path),
                }
            )
    return _print({"status": "ok", "bundles": bundles})


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--femic-src",
        default=os.environ.get("FRESH_HECTARESBC_FEMIC_SRC"),
        help="FEMIC src directory when FEMIC is not installed.",
    )
    parser.add_argument(
        "--archive-root",
        default=os.environ.get("FRESH_HECTARESBC_ARCHIVE_ROOT"),
        help="Recovered HectaresBC archive root containing data_layers/ and virtual_layers/.",
    )
    parser.add_argument(
        "--output-root",
        default=os.environ.get(
            "FRESH_HECTARESBC_BUNDLE_ROOT",
            str(REPO_ROOT / "var" / "bundles"),
        ),
        help="Directory for AOI and bundle outputs.",
    )
    parser.add_argument(
        "--public-url",
        default=os.environ.get("FRESH_HECTARESBC_PUBLIC_URL"),
        help="Public service URL used to build bundle download links.",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    search = subparsers.add_parser("search-layers", help="Search the HectaresBC catalog.")
    search.add_argument("--query", required=True)
    search.add_argument("--family", choices=["data_layer", "virtual_layer"])
    search.add_argument("--limit", type=int, default=10)
    search.set_defaults(func=cmd_search_layers)

    search_aoi = subparsers.add_parser(
        "search-aoi", help="Resolve BC Data Catalogue boundary layers."
    )
    search_aoi.add_argument("--query", required=True)
    search_aoi.add_argument("--limit", type=int, default=5)
    search_aoi.set_defaults(func=cmd_search_aoi)

    resolve = subparsers.add_parser(
        "resolve-aoi", help="Resolve a named boundary into a GeoJSON AOI."
    )
    resolve.add_argument("--query", required=True)
    resolve.add_argument("--name")
    resolve.add_argument("--limit", type=int, default=5)
    resolve.add_argument(
        "--include-geometry",
        action="store_true",
        help="Include the full AOI GeoJSON geometry in stdout (otherwise omit it).",
    )
    resolve.set_defaults(func=cmd_resolve_aoi)

    bundle = subparsers.add_parser(
        "prepare-bundle", help="Clip selected rasters to an AOI and ZIP them."
    )
    bundle.add_argument("--layer-id", action="append", required=True)
    bundle.add_argument("--aoi-query")
    bundle.add_argument("--aoi-name")
    bundle.add_argument("--aoi-geojson")
    bundle.add_argument("--max-layers", type=int, default=6)
    bundle.add_argument("--max-area-ha", type=float, default=10_000_000.0)
    bundle.set_defaults(func=cmd_prepare_bundle)

    list_bundles = subparsers.add_parser("list-bundles", help="List prepared bundles.")
    list_bundles.add_argument("--limit", type=int, default=20)
    list_bundles.set_defaults(func=cmd_list_bundles)

    args = parser.parse_args()
    try:
        return args.func(args)
    except Exception as exc:  # Keep the agent-facing surface structured.
        return _print({"status": "error", "error": str(exc)})


if __name__ == "__main__":
    raise SystemExit(main())
