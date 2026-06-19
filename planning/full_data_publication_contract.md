# Full Data Publication Contract

## Purpose

Define the Phase 5 contract for publishing the full rescued HectaresBC archive into the `UBC-FRESH/fresh-hectaresbc-data` DataLad/git-annex repository and its `arbutus-s3` special remote.

This document completes P5.1. It should be treated as the execution boundary for P5.2 through P5.7.

## Current Published State

Phase 4 published the data-repository architecture and representative validation set:

- data repository: `UBC-FRESH/fresh-hectaresbc-data`;
- main-repo submodule path: `external/fresh-hectaresbc-data`;
- object-storage special remote: `arbutus-s3`;
- representative annexed ZIP payloads published: 6;
- representative published size: 825,710,617 bytes;
- local source archive: `tmp/shared-data/hectaresbc`.

The full recovered ZIP manifest currently records:

| Scope | ZIP count | Compressed bytes |
| --- | ---: | ---: |
| data-layer ZIPs | 418 | included below |
| virtual-layer ZIPs | 1,765 | included below |
| all recovered ZIP payloads | 2,183 | 17,531,591,717 |
| already published representative ZIPs | 6 | 825,710,617 |
| remaining ZIPs to publish | 2,177 | 16,705,881,100 |

Remaining ZIPs by family:

| Family | Remaining ZIP count |
| --- | ---: |
| data layer | 414 |
| virtual layer | 1,763 |

## Publication Scope

Publish these source materials into the data repository:

- all ZIP payloads listed in `metadata/archive_inventory/zip_manifest.csv`;
- root control file `data_layers.txt`;
- root control file `virtual_layers.txt`;
- root metadata file `virtual_layers_metadata_all.csv`;
- compact metadata mirrored from this main repository where useful for validation and access.

Do not publish:

- `hectaresbc_download_layers.ipynb`;
- `.ipynb_checkpoints/`;
- `tmp/`;
- local credential files;
- local logs or command transcripts that may contain secrets;
- extracted rasters or derived products unless a later task explicitly defines a derived-data contract.

## Source-To-Data-Repo Mapping

Preserve the rescued archive layout under the raw export prefix.

| Local source path | Data-repo destination |
| --- | --- |
| `tmp/shared-data/hectaresbc/data_layers/*.zip` | `raw/hectaresbc_2022_export/data_layers/*.zip` |
| `tmp/shared-data/hectaresbc/virtual_layers/*.zip` | `raw/hectaresbc_2022_export/virtual_layers/*.zip` |
| `tmp/shared-data/hectaresbc/data_layers.txt` | `raw/hectaresbc_2022_export/data_layers.txt` |
| `tmp/shared-data/hectaresbc/virtual_layers.txt` | `raw/hectaresbc_2022_export/virtual_layers.txt` |
| `tmp/shared-data/hectaresbc/virtual_layers_metadata_all.csv` | `raw/hectaresbc_2022_export/virtual_layers_metadata_all.csv` |

Do not rename payload files during Phase 5. Any future canonical naming must be represented as metadata or derived products with explicit provenance back to the raw path.

## Tracking Rules

ZIP payloads must be git-annex files.

The data repo already contains `.gitattributes` rules requiring:

```text
raw/hectaresbc_2022_export/data_layers/*.zip annex.largefiles=anything
raw/hectaresbc_2022_export/virtual_layers/*.zip annex.largefiles=anything
```

Root control files and compact metadata should remain normal Git files when practical:

- `.txt`;
- `.csv`;
- `.md`;
- `.json`;
- `.yaml` or `.yml` if introduced later.

## Resumable Import Behavior

Bulk import must be resumable and auditable.

Required behavior:

- import files by manifest path, not by broad unreviewed directory copy;
- skip files already present in the data repo with matching size and checksum or matching annex key;
- preserve source file modification time where practical, but do not rely on timestamps for validation;
- commit data-repo Git metadata in coherent batches if a single all-at-once commit becomes operationally fragile;
- never delete local source files from `tmp/shared-data/hectaresbc` as part of publication;
- keep temporary logs outside tracked paths unless summarized into compact validation reports.

Suggested batch order:

1. root control files and compact metadata;
2. remaining data-layer ZIPs;
3. remaining virtual-layer ZIPs;
4. validation reports;
5. final submodule pointer update in the main repo.

## Resumable Upload Behavior

Upload annexed payload content to `arbutus-s3` using user-local credentials.

Credential setup:

```bash
export PATH="$HOME/.local/bin:$PATH"
source ~/.config/fresh-hectaresbc/arbutus_env.sh
```

Remote setup inside the data repo:

```bash
git annex enableremote arbutus-s3
```

Upload commands should be resumable. Prefer explicit path lists generated from the manifest or from `git annex find`, for example:

```bash
git annex copy --to arbutus-s3 --not --in arbutus-s3 --include='raw/hectaresbc_2022_export/data_layers/*.zip'
git annex copy --to arbutus-s3 --not --in arbutus-s3 --include='raw/hectaresbc_2022_export/virtual_layers/*.zip'
```

If glob or include behavior is ambiguous, use a generated path list and pass it to `git annex copy --to arbutus-s3`.

Do not use `embedcreds=yes`. Do not print credential values.

## Verification Outputs

Phase 5 should produce compact tracked validation outputs. The exact filenames may change, but the minimum reports are:

```text
metadata/validation/full_publication_inventory.md
metadata/validation/full_publication_whereis.md
metadata/validation/full_publication_retrieval_sampling.md
```

Required checks:

- every manifest ZIP path exists at the expected data-repo raw path;
- expected ZIP count is 2,183;
- expected data-layer ZIP count is 418;
- expected virtual-layer ZIP count is 1,765;
- every raw ZIP path is an annexed file, not a plain Git blob;
- every expected annexed ZIP reports availability from `arbutus-s3`;
- root control files are present and Git-tracked;
- excluded notebook/checkpoint/private paths are absent;
- fresh-clone retrieval succeeds for the Phase 4 representative set and an additional documented sample.

## Failure Handling

If a payload fails to import:

- leave the source file untouched;
- record the source path, intended destination path, file size, and error;
- do not silently skip it;
- do not close P5.3 until every failure is resolved or explicitly documented as deferred by the maintainer.

If a payload fails to upload:

- confirm `arbutus-s3` is enabled;
- confirm user-local credentials are current;
- retry with the same annex key/path;
- record unresolved failures in `metadata/validation/full_publication_whereis.md`;
- do not close P5.4 until every expected annexed ZIP is present in `arbutus-s3` or explicitly deferred by the maintainer.

If a validation mismatch appears:

- prefer correcting the import or documentation over editing historical manifests;
- if the manifest is wrong, document the evidence and update derived validation outputs only after review;
- do not normalize or rename source payloads to hide mismatches.

## Phase 5 Closeout Requirements

Before Phase 5 closes:

1. `fresh-hectaresbc-data` must contain all expected raw ZIP payloads as annexed files.
2. `arbutus-s3` must have copies of all expected annexed ZIP payload content.
3. The data repo must carry compact publication validation reports.
4. A fresh main-repo clone must initialize the data submodule and retrieve documented representative plus sampled payloads.
5. The main repo must update its submodule pointer to the final Phase 5 data-repo commit.
6. `ROADMAP.md`, `CHANGE_LOG.md`, PR #66, and parent issue #57 must reflect the final publication state.

## Phase 5 Closeout Status

Phase 5 publication requirements have been satisfied as of data-repo commit `360d277f723f7dd946c1dde19160a32efc7b74e7` and the corresponding main-repo Phase 5 branch update.

Validation reports:

- `metadata/validation/full_annex_import.md`
- `metadata/validation/full_publication_whereis.md`
- `metadata/validation/full_zip_inventory_coverage.md`
- `metadata/validation/full_publication_retrieval_sampling.md`
