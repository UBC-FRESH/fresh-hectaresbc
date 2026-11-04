#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
export PYTHONPATH="${PWD}/src:${PWD}${PYTHONPATH:+:${PYTHONPATH}}"

printf '\n== Browser asset budgets ==\n'
python3 scripts/check_web_performance_budgets.py

printf '\n== Static app and catalog logic ==\n'
python3 scripts/smoke_test_web_static_app.py
node scripts/smoke_test_web_catalog_ui.js web/data/catalog.json

printf '\n== Targeted Python tests ==\n'
python3 -m pytest \
  tests/test_build_tile_cog_preset.py \
  tests/test_agent_gis.py \
  tests/test_web_catalog_ui.py \
  -q

printf '\n== Browser workspace smokes ==\n'
python3 scripts/smoke_test_accessibility_browser.py
python3 scripts/smoke_test_cold_checkout_browser.py
python3 scripts/smoke_test_admin_browser.py
python3 scripts/smoke_test_tours_browser.py
python3 scripts/smoke_test_compare_browser.py
python3 scripts/smoke_test_series_browser.py
python3 scripts/smoke_test_series_video_browser.py
python3 scripts/smoke_test_series_contact_sheet_browser.py
python3 scripts/smoke_test_map_export_browser.py
python3 scripts/smoke_test_performance_browser.py

printf '\n== Sphinx ==\n'
python3 -m sphinx -b html -W --keep-going docs docs/_build/html

printf '\n== Diff hygiene ==\n'
git diff --check

printf '\nAll release checks passed.\n'
