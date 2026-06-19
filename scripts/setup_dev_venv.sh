#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip setuptools wheel
.venv/bin/python -m pip install -e '.[dev]'

.venv/bin/python -c "from fresh_hectaresbc import HectaresBC; print(HectaresBC().__class__.__name__)"
.venv/bin/python -m pytest --version
.venv/bin/python -m datalad --version
