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
TILE_CACHE_MAX_BYTES="${FRESH_HECTARESBC_TILE_CACHE_MAX_BYTES:-4294967296}"
TILE_COG_ROOT="${FRESH_HECTARESBC_TILE_COG_ROOT:-${REPO_ROOT}/var/tile-cogs}"
JOB_HISTORY_LIMIT="${FRESH_HECTARESBC_JOB_HISTORY_LIMIT:-100}"
JOB_HISTORY_MAX_AGE_DAYS="${FRESH_HECTARESBC_JOB_HISTORY_MAX_AGE_DAYS:-30}"
BUNDLE_HISTORY_LIMIT="${FRESH_HECTARESBC_BUNDLE_HISTORY_LIMIT:-50}"
BUNDLE_HISTORY_MAX_AGE_DAYS="${FRESH_HECTARESBC_BUNDLE_HISTORY_MAX_AGE_DAYS:-30}"
BUNDLE_AOI_MAX_AGE_DAYS="${FRESH_HECTARESBC_BUNDLE_AOI_MAX_AGE_DAYS:-7}"
BUNDLE_AOI_MAX_FILES="${FRESH_HECTARESBC_BUNDLE_AOI_MAX_FILES:-500}"

args=(
  "--host" "0.0.0.0"
  "--port" "${PORT}"
  "--allow-remote"
  "--allow-agent"
  "--workspace" "${REPO_ROOT}"
  "--bundle-root" "${BUNDLE_ROOT}"
  "--tile-cache-root" "${TILE_CACHE_ROOT}"
  "--tile-cache-max-bytes" "${TILE_CACHE_MAX_BYTES}"
  "--tile-cog-root" "${TILE_COG_ROOT}"
  "--job-history-limit" "${JOB_HISTORY_LIMIT}"
  "--job-history-max-age-days" "${JOB_HISTORY_MAX_AGE_DAYS}"
  "--bundle-history-limit" "${BUNDLE_HISTORY_LIMIT}"
  "--bundle-history-max-age-days" "${BUNDLE_HISTORY_MAX_AGE_DAYS}"
  "--bundle-aoi-max-age-days" "${BUNDLE_AOI_MAX_AGE_DAYS}"
  "--bundle-aoi-max-files" "${BUNDLE_AOI_MAX_FILES}"
  "--public-url" "${PUBLIC_URL}"
)
if [[ -n "${ARCHIVE_ROOT}" ]]; then
  args+=("--archive-root" "${ARCHIVE_ROOT}")
fi
if [[ -n "${FEMIC_SRC}" ]]; then
  args+=("--femic-src" "${FEMIC_SRC}")
fi

exec python "${REPO_ROOT}/scripts/run_web_service.py" "${args[@]}"
