#!/usr/bin/env bash
# Start the protected HectaresBC demo service on a local port.
#
# The public origin is normally terminated by a cloudflared tunnel and
# Cloudflare Access (Zero Trust + Globus OAuth constrained to UBC CWL).
# This script only starts the origin service.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8030}"
PUBLIC_URL="${FRESH_HECTARESBC_PUBLIC_URL:-https://fresh-hectaresbc.01101.dev}"
ARCHIVE_ROOT="${FRESH_HECTARESBC_ARCHIVE_ROOT:-}"
FEMIC_SRC="${FRESH_HECTARESBC_FEMIC_SRC:-}"
BUNDLE_ROOT="${FRESH_HECTARESBC_BUNDLE_ROOT:-${REPO_ROOT}/var/bundles}"
TILE_CACHE_ROOT="${FRESH_HECTARESBC_TILE_CACHE_ROOT:-${REPO_ROOT}/var/tile-cache}"

args=(
  "--host" "0.0.0.0"
  "--port" "${PORT}"
  "--allow-remote"
  "--allow-agent"
  "--workspace" "${REPO_ROOT}"
  "--bundle-root" "${BUNDLE_ROOT}"
  "--tile-cache-root" "${TILE_CACHE_ROOT}"
  "--public-url" "${PUBLIC_URL}"
)
if [[ -n "${ARCHIVE_ROOT}" ]]; then
  args+=("--archive-root" "${ARCHIVE_ROOT}")
fi
if [[ -n "${FEMIC_SRC}" ]]; then
  args+=("--femic-src" "${FEMIC_SRC}")
fi

exec python "${REPO_ROOT}/scripts/run_web_service.py" "${args[@]}"
