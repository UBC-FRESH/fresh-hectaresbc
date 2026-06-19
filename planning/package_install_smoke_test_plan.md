# Package Install And Smoke-Test Plan

## Purpose

Define repeatable Phase 8 commands for editable installs, local package builds, artifact inspection, and clean wheel install smoke checks.

This completes P8.2. The commands here are implementation targets for P8.3 through P8.6.

## Editable Install Checks

From the source checkout:

```bash
python3 -m pip install -e .
python3 -m pytest
fresh-hectaresbc --help
fresh-hectaresbc --version
```

Representative source-checkout smoke commands:

```bash
python3 - <<'PY'
from fresh_hectaresbc import HectaresBC
hbc = HectaresBC()
print(len(hbc.catalog))
print(hbc.get("dl_adminunits_bcts").title_candidate)
print(hbc.search("bull trout", limit=1)[0].dataset_id)
PY

fresh-hectaresbc catalog search "bull trout" --limit 1
fresh-hectaresbc catalog show dl_adminunits_bcts
fresh-hectaresbc data status dl_adminunits_bcts
fresh-hectaresbc diagnostics
fresh-hectaresbc fetch dl_adminunits_bcts --dry-run
```

Expected behavior:

- API import works;
- catalog count is `2183`;
- BCTS lookup returns `BCTS Operating Areas`;
- bull trout search returns `vl_virtualspecies_bulltroutsalvelinusconfluentus_1135`;
- CLI commands run without Arbutus credentials;
- dry-run fetch does not retrieve content.

## Build Commands

Build dependencies:

```bash
python3 -m pip install build
```

Build artifacts:

```bash
rm -rf dist/
python3 -m build
```

Expected artifacts:

```text
dist/fresh_hectaresbc-0.0.0-py3-none-any.whl
dist/fresh_hectaresbc-0.0.0.tar.gz
```

## Artifact Inspection

Wheel file list:

```bash
python3 - <<'PY'
from pathlib import Path
from zipfile import ZipFile

wheel = next(Path("dist").glob("fresh_hectaresbc-*.whl"))
with ZipFile(wheel) as archive:
    for name in sorted(archive.namelist()):
        print(name)
PY
```

Source distribution file list:

```bash
python3 - <<'PY'
from pathlib import Path
import tarfile

sdist = next(Path("dist").glob("fresh_hectaresbc-*.tar.gz"))
with tarfile.open(sdist) as archive:
    for name in sorted(archive.getnames()):
        print(name)
PY
```

Expected includes:

- `fresh_hectaresbc/__init__.py`;
- `fresh_hectaresbc/api.py`;
- `fresh_hectaresbc/cli.py`;
- `fresh_hectaresbc/catalog.py`;
- `fresh_hectaresbc/backends/datalad.py`;
- `fresh_hectaresbc/package_data/recovered_catalog/data_layer_records.csv`;
- `fresh_hectaresbc/package_data/recovered_catalog/virtual_layer_records.csv`;
- console entrypoint metadata for `fresh-hectaresbc`.

Forbidden artifact path fragments:

```text
tmp/
external/fresh-hectaresbc-data/raw/
.git/
.venv/
__pycache__/
aws
secret
bootstrap.md
.zip
```

The `.zip` check is intentionally broad. The package should not contain HectaresBC payload ZIPs.

## Clean Wheel Install

Create an isolated environment outside the source checkout:

```bash
tmpdir="$(mktemp -d)"
python3 -m venv "$tmpdir/venv"
"$tmpdir/venv/bin/python" -m pip install --upgrade pip
"$tmpdir/venv/bin/python" -m pip install dist/fresh_hectaresbc-0.0.0-py3-none-any.whl
```

Run smoke checks from outside the source checkout:

```bash
(
  cd "$tmpdir"
  "$tmpdir/venv/bin/python" - <<'PY'
from fresh_hectaresbc import HectaresBC
hbc = HectaresBC()
print(len(hbc.catalog))
print(hbc.get("dl_adminunits_bcts").title_candidate)
print(hbc.search("bull trout", limit=1)[0].dataset_id)
PY

  "$tmpdir/venv/bin/fresh-hectaresbc" --help
  "$tmpdir/venv/bin/fresh-hectaresbc" --version
  "$tmpdir/venv/bin/fresh-hectaresbc" catalog search "bull trout" --limit 1
  "$tmpdir/venv/bin/fresh-hectaresbc" catalog show dl_adminunits_bcts
  "$tmpdir/venv/bin/fresh-hectaresbc" fetch dl_adminunits_bcts --dry-run
)
```

Expected behavior:

- catalog API works from package data without repo-root `metadata/`;
- CLI catalog commands work from package data;
- `fetch --dry-run` returns a structured plan or local setup status without retrieving data;
- no Arbutus credentials are required.

## Default Network And Credential Boundary

These Phase 8 smoke checks must not:

- source `~/.config/fresh-hectaresbc/arbutus_env.sh`;
- read `tmp/aws-secrets`;
- run non-dry-run fetches;
- require object-store access;
- require local raw ZIP content.

Credentialed retrieval remains a separate operational validation path, not the default packaging smoke test.
