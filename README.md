# fresh-hectaresbc

Recovering, inventorying, documenting, and modernizing the archived HectaresBC geospatial data collection.

## Data Repository

Large HectaresBC payloads are not stored directly in this repository. They live in the DataLad/git-annex data repository:

```text
UBC-FRESH/fresh-hectaresbc-data
```

This repository links that dataset as a Git submodule at:

```text
external/fresh-hectaresbc-data
```

Clone with submodules:

```bash
git clone --recurse-submodules https://github.com/UBC-FRESH/fresh-hectaresbc.git
cd fresh-hectaresbc
```

Or initialize the data submodule after cloning:

```bash
git submodule update --init --recursive external/fresh-hectaresbc-data
```

The submodule checkout contains Git and git-annex metadata only. Annexed file content is retrieved on demand from configured storage remotes.

## DataLad Retrieval

To retrieve annexed data from the Arbutus-backed special remote, source local credentials first:

```bash
export PATH="$HOME/.local/bin:$PATH"
source ~/.config/fresh-hectaresbc/arbutus_env.sh
cd external/fresh-hectaresbc-data
git annex enableremote arbutus-s3
datalad get metadata/validation/arbutus_s3_smoke_test.bin
```

Credentials are user-local and must not be committed. See `planning/arbutus_s3_special_remote_plan.md` and `external/fresh-hectaresbc-data/docs/arbutus_s3_remote.md`.
