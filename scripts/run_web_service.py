#!/usr/bin/env python3
"""Run the optional HectaresBC web service and assistant API."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = REPO_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from fresh_hectaresbc.web_service import (  # noqa: E402
    DEFAULT_AGENT_MODEL,
    ServiceConfig,
    run_server,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8030)
    parser.add_argument("--root-path", default="")
    parser.add_argument(
        "--allow-remote",
        action="store_true",
        help="Allow a non-loopback bind. Use an authenticating proxy in front.",
    )
    parser.add_argument(
        "--allow-agent",
        action="store_true",
        help="Enable the OpenCode-backed assistant and its shell tools.",
    )
    parser.add_argument("--agent-model", default=DEFAULT_AGENT_MODEL)
    parser.add_argument("--agent-timeout", type=float, default=300.0)
    parser.add_argument("--workspace", type=Path, default=REPO_ROOT)
    parser.add_argument(
        "--archive-root",
        type=Path,
        default=Path(os.environ["FRESH_HECTARESBC_ARCHIVE_ROOT"])
        if os.environ.get("FRESH_HECTARESBC_ARCHIVE_ROOT")
        else None,
        help="Recovered HectaresBC archive root for clipping.",
    )
    parser.add_argument(
        "--femic-src",
        type=Path,
        default=Path(os.environ["FRESH_HECTARESBC_FEMIC_SRC"])
        if os.environ.get("FRESH_HECTARESBC_FEMIC_SRC")
        else None,
        help="FEMIC src directory when FEMIC is not installed.",
    )
    parser.add_argument(
        "--bundle-root",
        type=Path,
        default=REPO_ROOT / "var" / "bundles",
    )
    parser.add_argument(
        "--tile-cache-root",
        type=Path,
        default=REPO_ROOT / "var" / "tile-cache",
    )
    parser.add_argument(
        "--tile-cache-max-bytes",
        type=int,
        default=4 * 1024**3,
        help="Prune least-recently-used tile files above this cache size.",
    )
    parser.add_argument("--max-layers", type=int, default=6)
    parser.add_argument("--max-area-ha", type=float, default=10_000_000.0)
    parser.add_argument(
        "--job-history-limit",
        type=int,
        default=100,
        help="Keep at most this many terminal bundle job records.",
    )
    parser.add_argument(
        "--job-history-max-age-days",
        type=float,
        default=30.0,
        help="Remove terminal bundle job records older than this; 0 disables.",
    )
    parser.add_argument(
        "--public-url",
        default=os.environ.get("FRESH_HECTARESBC_PUBLIC_URL"),
        help="Public origin used for bundle download links.",
    )
    args = parser.parse_args()

    config = ServiceConfig(
        host=args.host,
        port=args.port,
        root_path=args.root_path,
        allow_remote=args.allow_remote,
        allow_agent=args.allow_agent,
        agent_model=args.agent_model,
        agent_timeout=args.agent_timeout,
        workspace=args.workspace,
        archive_root=args.archive_root,
        femic_src=args.femic_src,
        bundle_root=args.bundle_root,
        tile_cache_root=args.tile_cache_root,
        tile_cache_max_bytes=args.tile_cache_max_bytes,
        max_layers=args.max_layers,
        max_area_ha=args.max_area_ha,
        job_history_limit=args.job_history_limit,
        job_history_max_age_days=args.job_history_max_age_days,
        public_url=args.public_url,
    )
    scheme = "http"
    print(
        f"HectaresBC service origin: {scheme}://{config.host}:{config.port}"
        f"{config.root_path or ''}/web/",
        flush=True,
    )
    print(
        f"assistant: {'enabled' if config.allow_agent else 'disabled'} "
        f"(model {config.agent_model})",
        flush=True,
    )
    print(
        f"archive root: {config.archive_root or 'not configured'}",
        flush=True,
    )
    run_server(config)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
