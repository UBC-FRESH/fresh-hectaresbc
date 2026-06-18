# Archive Reconnaissance Summary

Date: 2026-06-18

## Purpose

Record the first read-only reconnaissance pass over the rescued HectaresBC archive and use it to close the Phase 0 governance review.

This pass did not copy source data into tracked paths and did not extract payload files.

## Source Checked

```text
tmp/shared-data/hectaresbc
```

The directory is present and readable in the local working tree. It remains ignored by Git through `tmp/`.

## Commands Used

```bash
test -d tmp/shared-data/hectaresbc
find tmp/shared-data/hectaresbc -maxdepth 2 -mindepth 1 -printf '%y %p\n'
du -sh tmp/shared-data/hectaresbc tmp/shared-data/hectaresbc/*
find tmp/shared-data/hectaresbc -type f | wc -l
find tmp/shared-data/hectaresbc -type d | wc -l
find tmp/shared-data/hectaresbc -type f | awk '... extension count ...'
wc -l tmp/shared-data/hectaresbc/data_layers.txt tmp/shared-data/hectaresbc/virtual_layers.txt tmp/shared-data/hectaresbc/virtual_layers_metadata_all.csv
zipinfo -1 tmp/shared-data/hectaresbc/data_layers/adminunits_bcts.zip
zipinfo -1 tmp/shared-data/hectaresbc/data_layers/water_distancetocoast.zip
zipinfo -1 tmp/shared-data/hectaresbc/virtual_layers/virtualspecies.bulltroutsalvelinusconfluentus.1135.zip
```

The extension-count command was:

```bash
find tmp/shared-data/hectaresbc -type f |
  awk 'BEGIN{FS="/"} {name=$NF; ext="[none]"; if (name ~ /\./) { n=split(name,a,"."); ext=tolower(a[n]); } count[ext]++ } END{for (e in count) print count[e], e}' |
  sort -nr
```

## Top-Level Structure

The archive has a compact top-level layout:

```text
tmp/shared-data/hectaresbc/
  data_layers/
  virtual_layers/
  data_layers.txt
  virtual_layers.txt
  virtual_layers_metadata_all.csv
  hectaresbc_download_layers.ipynb
  .ipynb_checkpoints/
```

Top-level size summary:

```text
17G   tmp/shared-data/hectaresbc
15G   tmp/shared-data/hectaresbc/data_layers
2.2G  tmp/shared-data/hectaresbc/virtual_layers
3.6M  tmp/shared-data/hectaresbc/virtual_layers_metadata_all.csv
344K  tmp/shared-data/hectaresbc/virtual_layers.txt
304K  tmp/shared-data/hectaresbc/hectaresbc_download_layers.ipynb
32K   tmp/shared-data/hectaresbc/data_layers.txt
```

## Counts

File and directory counts:

```text
2,191 files
5 directories
```

Extension counts:

```text
2,183 zip
4 txt
2 ipynb
2 csv
```

ZIP counts by payload directory:

```text
418  data_layers/*.zip
1765 virtual_layers/*.zip
```

Metadata/control list line counts:

```text
417  data_layers.txt
1764 virtual_layers.txt
1766 virtual_layers_metadata_all.csv
```

`virtual_layers_metadata_all.csv` includes a header row, so it appears to describe 1,765 virtual layer records.

## Metadata Signals

The archive includes several compact metadata/control files at the root:

- `data_layers.txt`
- `virtual_layers.txt`
- `virtual_layers_metadata_all.csv`
- `hectaresbc_download_layers.ipynb`

`virtual_layers_metadata_all.csv` has columns including:

```text
layer_id, filename, hkey, layer_name, query, hkey_query, date_created,
tablename, ischanged, columnname, priority, columnindex,
element_subnational_id, ecolcomm, bclist, sara, endemics
```

The virtual layer metadata appears to preserve rule/query definitions and layer identity fields. This is high-value catalog/provenance input.

## Payload Signals

Representative ZIP listings show:

- data-layer ZIPs can contain TIFF payloads, WMS XML files, HTML metadata, CSV metadata, and nested `category_metadata/` or `value_metadata/` directories;
- virtual-layer ZIPs can contain a TIFF plus `metadata.txt`.

Examples:

```text
data_layers/adminunits_bcts.zip
  bcts.metadata.csv
  bcts.metadata.html
  bcts.tiff
  bcts.wms.xml
  category_metadata/...
  adminunits.metadata.html
```

```text
data_layers/water_distancetocoast.zip
  distancetocoast.metadata.html
  distancetocoast.tiff
  distancetocoast.wms.xml
  value_metadata/...
  water.metadata.html
```

```text
virtual_layers/virtualspecies.bulltroutsalvelinusconfluentus.1135.zip
  virtualspecies.bulltroutsalvelinusconfluentus.1135.tiff
  metadata.txt
```

## Largest Observed ZIPs

Largest data-layer ZIPs observed in this pass include:

```text
664 MB water_distancetocoast.zip
442 MB linearfeat_distancetowell.zip
340 MB linearfeat_distancetoroad.zip
226 MB misc_distancetopoo.zip
178 MB topography_rhsp.zip
174 MB misc_distancetopoa.zip
```

The largest virtual-layer ZIP observed was approximately 11 MB.

## Phase 0 Review

The current governance scaffold is appropriate, but the reconnaissance confirms that the project should stay strict about large-data boundaries:

- the source archive is already large enough that it must not be committed to the main repo;
- Phase 4's DataLad/git-annex data-repository lane is justified;
- Phase 1 should focus on compact inventories, ZIP manifest extraction, metadata mapping, and integrity checks before tooling choices;
- no CI, package scaffold, Sphinx docs, or schema implementation should be introduced yet;
- the strict issue/branch/PR workflow is useful now because future work will touch several coordinated repos and large-data workflows.

## Recommended Phase 1 Refinement

When Phase 1 is activated, create a parent issue and feature branch for archive reconnaissance. Initial child issues should likely cover:

- root inventory and ZIP manifest extraction without payload extraction;
- root metadata/control file parsing;
- representative ZIP integrity checks and payload-family classification;
- compact tracked inventory format design;
- decision on whether the data repo preserves the rescued layout exactly or adds a canonical layout with provenance mappings.

