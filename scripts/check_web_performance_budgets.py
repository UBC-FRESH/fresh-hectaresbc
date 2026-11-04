#!/usr/bin/env python3
"""Check raw/gzip budgets for browser assets and catalog payloads."""

from __future__ import annotations

import argparse
import gzip
import sys
from pathlib import Path

BUDGETS = {
    "web/app.js": {"gzip_kb": 80},
    "web/data/catalog.index.json": {"gzip_kb": 300},
    "web/data/catalog.details.json": {"gzip_kb": 350},
    "web/styles.css": {"gzip_kb": 20},
    "web/vendor/maplibre-gl.js": {"gzip_kb": 250},
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    root = Path(args.root)
    failures = []
    print(f"{'asset':38} {'raw KB':>9} {'gzip KB':>9} {'budget':>9}")
    for relative, limits in BUDGETS.items():
        path = root / relative
        if not path.exists():
            failures.append(f"missing {relative}")
            continue
        raw = path.read_bytes()
        gzip_size = len(gzip.compress(raw)) / 1024
        budget = limits["gzip_kb"]
        state = "PASS" if gzip_size <= budget else "FAIL"
        if state == "FAIL":
            failures.append(f"{relative}: {gzip_size:.1f} KB > {budget} KB")
        print(
            f"{relative:38} {len(raw) / 1024:9.1f} {gzip_size:9.1f} "
            f"{budget:7d} KB {state}"
        )
    if failures:
        print("\nBudget failures:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1
    print("\nAll browser asset budgets pass.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
