# Data Repository Layout Recommendation

## Purpose

Recommend the initial layout strategy for the future `UBC-FRESH/fresh-hectaresbc-data` DataLad/git-annex repository based on Phase 1 archive reconnaissance.

## Recommendation

Use a hybrid layout:

1. Preserve the rescued HectaresBC export layout exactly under a raw archive prefix.
2. Keep compact manifests, catalog metadata, and future canonical/derived products separate from that raw archive prefix.
3. Exclude disposable local acquisition tooling that is not part of the archived data product.
4. Do not rename, unpack, normalize, or reorganize source ZIP payloads during the initial DataLad import.

Recommended initial data-repository layout:

```text
fresh-hectaresbc-data/
  README.md
  raw/
    hectaresbc_2022_export/
      data_layers/
      virtual_layers/
      data_layers.txt
      virtual_layers.txt
      virtual_layers_metadata_all.csv
  metadata/
    archive_inventory/
      archive_summary.json
      zip_manifest.csv
      root_metadata_files.md
      zip_payload_families.md
  derived/
    README.md
```

The `raw/hectaresbc_2022_export/` subtree should preserve the rescued data payload and root control/metadata files below that prefix.

Do not include `hectaresbc_download_layers.ipynb` or `.ipynb_checkpoints/` in the future public data repository. The notebook was a disposable 2022 acquisition script used to download the archive from the now-offline HectaresBC server. It is useful local historical context only, not a reproducible distribution artifact.

## Evidence

Phase 1 found a compact and internally consistent archive structure:

- `data_layers.txt` lists 418 data-layer ZIPs and matches the data-layer ZIP manifest.
- `virtual_layers.txt` lists 1,765 virtual-layer ZIPs and matches the virtual-layer ZIP manifest.
- `virtual_layers_metadata_all.csv` has 1,765 metadata rows and matches the virtual-layer ZIP manifest.
- All 2,183 ZIP central directories open successfully.
- Every data-layer ZIP has at least one TIFF and one WMS XML entry.
- Every virtual-layer ZIP has one TIFF and one TXT metadata entry.
- Root metadata/control files provide useful provenance and should remain adjacent to the raw archive.
- `hectaresbc_download_layers.ipynb` was observed in the local source tree, but it is obsolete acquisition tooling rather than archive content.

The source archive is about 17 GB compressed, while ZIP central-directory uncompressed totals are much larger. Initial import should therefore avoid unpacking payloads.

## Why Not Preserve The Export At Data Repository Root?

Keeping the raw export directly at the DataLad repository root would be simple, but it would mix rescued archive files with repository governance files such as `README.md`, `.gitattributes`, `.datalad/`, and future storage/config documentation.

Using `raw/hectaresbc_2022_export/` keeps the rescued data payload intact while leaving room for DataLad repository documentation, metadata, and future derived products.

## Why Not Start With A Canonical Clean Layout?

A canonical clean layout will probably be useful later, but Phase 1 is too early for irreversible normalization.

Reasons to defer canonical restructuring:

- data-layer catalog metadata still needs recovery from per-ZIP metadata files;
- virtual-layer query semantics need more detailed interpretation;
- CRS, raster readability, and geospatial metadata have not yet been inspected;
- nested ZIP cases need explicit handling;
- stable dataset IDs and naming rules have not yet been defined.

Any future canonical layout should be derived from the raw archive with explicit provenance mappings back to:

- original raw ZIP path;
- original root listing row;
- original virtual metadata row when applicable;
- generated ZIP manifest row;
- extraction or transformation command.

## Main Repo Versus Data Repo

Keep in this main repository:

- scripts and workflow code;
- compact inventory outputs needed for planning and review;
- catalog schema definitions once created;
- documentation and provenance rules.

Keep in `fresh-hectaresbc-data`:

- raw HectaresBC ZIP payloads;
- root control/metadata files that describe those payloads;
- DataLad/git-annex metadata;
- data-repository copy of compact manifests needed for cold-clone data access;
- future derived data products if they are large or annex-managed.

## Phase 4 Implications

When Phase 4 is activated:

1. Initialize `UBC-FRESH/fresh-hectaresbc-data` as a DataLad/git-annex dataset.
2. Create `raw/hectaresbc_2022_export/`.
3. Copy or move the rescued data payload and root control/metadata files into that prefix without renaming payload files.
4. Configure annex tracking so ZIP payloads are annexed.
5. Keep small text/CSV/Markdown metadata as plain Git where appropriate.
6. Add or mirror compact inventory outputs under `metadata/archive_inventory/`.
7. Exclude `hectaresbc_download_layers.ipynb` and `.ipynb_checkpoints/` from the public data repository.
8. Validate a cold clone can retrieve representative ZIPs with `datalad get`.

## Deferred Decisions

- Final object storage backend: DRAC Arbutus versus UBC ARC Chinook or another S3-compatible target.
- Whether large derived products live in the same DataLad repository or a later separate dataset.
- Whether canonical extracted rasters should be materialized at all, or generated on demand.
- How to version corrected metadata if recovered metadata conflicts with raw archive contents.
