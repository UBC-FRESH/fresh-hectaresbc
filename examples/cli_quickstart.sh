#!/usr/bin/env bash
set -u

# Quickstart for the fresh-hectaresbc CLI.
#
# Run from a source checkout or installed environment:
#
#   bash examples/cli_quickstart.sh
#
# The example avoids credentialed retrieval and network access. Setup-dependent
# diagnostics may report missing local data-repository state without failing the
# quickstart.

CLI=${FRESH_HECTARESBC_CLI:-fresh-hectaresbc}
DATA_LAYER_ID="dl_adminunits_bcts"

run() {
  echo
  echo "$ $CLI $*"
  $CLI "$@"
}

run_allow_setup_status() {
  echo
  echo "$ $CLI $*"
  set +e
  $CLI "$@"
  status=$?
  set -e
  if [ "$status" -ne 0 ] && [ "$status" -ne 4 ]; then
    echo "command failed with unexpected exit status: $status" >&2
    exit "$status"
  fi
}

set -e

echo "fresh-hectaresbc CLI quickstart"

run --version
run catalog search "bull trout" --limit 1
run catalog show "$DATA_LAYER_ID"
run catalog list --family data_layer --dataset-id-prefix dl_adminunits --limit 3
run data path "$DATA_LAYER_ID"
run_allow_setup_status data status "$DATA_LAYER_ID"
run_allow_setup_status diagnostics
run_allow_setup_status fetch "$DATA_LAYER_ID" --dry-run
