# Virtual Layer Recovery Summary

## Purpose

Summarize compact virtual-layer catalog recovery from root metadata, root listings, the ZIP manifest, and virtual-layer ZIP metadata text files.

## Inputs

- Source root: `tmp/shared-data/hectaresbc`
- ZIP manifest: `metadata/archive_inventory/zip_manifest.csv`
- Root listing: `tmp/shared-data/hectaresbc/virtual_layers.txt`
- Root metadata: `tmp/shared-data/hectaresbc/virtual_layers_metadata_all.csv`

## Output

- Records: `metadata/recovered_catalog/virtual_layer_records.csv`

## Counts

- Root metadata rows: 1765
- Recovered records: 1765
- Unique source filenames: 1765
- Filenames with root listing rows: 1765
- Filenames with manifest rows: 1765
- Missing from root listing: 0
- Missing from manifest: 0

## Verification Status

- `metadata_recovered`: 1753
- `conflict_detected`: 12

## ZIP Read Status

- `ok`: 1765

## ZIP Metadata Read Status

- `ok`: 1765

## Root CSV To ZIP Metadata Mismatches

- `priority!=priority`: 12

### Priority Conflict Pattern

All observed conflicts are rows where the root CSV priority is blank and the ZIP `metadata.txt` priority is `0`:

- `virtualspecies.grainphysa.260.zip`: root CSV priority ``, ZIP metadata priority `0`; title `Grain Physa`
- `virtualspecies.tarpaulintarpaperlichen.1037.zip`: root CSV priority ``, ZIP metadata priority `0`; title `Tarpaulin Tarpaper Lichen`
- `virtualspecies.sockeyesalmoncultuslake.81.zip`: root CSV priority ``, ZIP metadata priority `0`; title `Sockeye Salmon - Cultus Lake`
- `virtualspecies.sockeyesalmonsakinawlake.196.zip`: root CSV priority ``, ZIP metadata priority `0`; title `Sockeye Salmon - Sakinaw Lake`
- `virtualspecies.northerngoshawkatricapillussubspecies.36.zip`: root CSV priority ``, ZIP metadata priority `0`; title `Northern Goshawk, Atricapillus Subspecies`
- `virtualspecies.sharptailedgrousejamesisubspecies.53.zip`: root CSV priority ``, ZIP metadata priority `0`; title `Sharp-tailed Grouse, Jamesi Subspecies`
- `virtualspecies.americanblackbearkermodeisubspecies.1033.zip`: root CSV priority ``, ZIP metadata priority `0`; title `American Black Bear, Kermodei Subspecies`
- `virtualspecies.steelhead.518.zip`: root CSV priority ``, ZIP metadata priority `0`; title `Steelhead`
- `virtualspecies.sharpshinnedhawkperobscurussubspecies.79.zip`: root CSV priority ``, ZIP metadata priority `0`; title `Sharp-shinned Hawk, perobscurus subspecies`
- `virtualspecies.columbiadunemoth.524.zip`: root CSV priority ``, ZIP metadata priority `0`; title `Columbia Dune Moth`
- `virtualspecies.redcrossbillcalltypevii.1103.zip`: root CSV priority ``, ZIP metadata priority `0`; title `Red Crossbill Call Type VII`
- `virtualspecies.redcrossbillcalltypev.1104.zip`: root CSV priority ``, ZIP metadata priority `0`; title `Red Crossbill Call Type V`

## Notes

- `query` values are preserved as source text only; source database semantics have not been validated.
- TXT metadata uses `db_query` where the root CSV uses `query`, and `beclist` where the root CSV uses `bclist`.
- CRS, extent, licensing, and biological/ecological interpretation are intentionally not inferred in this output.
- `dataset_id` values are provisional and follow the P2.1 identity-model rule.

## Command

```bash
python scripts/recover_virtual_layer_records.py
```
