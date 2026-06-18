# Archive Inventory Outputs

These files are compact, tracked Phase 1 reconnaissance outputs generated from the ignored local HectaresBC archive.

Source:

```text
tmp/shared-data/hectaresbc
```

Regenerate:

```bash
python scripts/archive_inventory.py
```

Outputs:

- `archive_summary.json`: top-level counts, sizes, extension counts, root files, and root item summaries.
- `zip_manifest.csv`: one row per ZIP file with path, size, inferred family, naming fields, ZIP status, entry counts, entry extension counts, and metadata/payload-family flags.
- `root_metadata_files.md`: row counts, schema/column notes, consistency checks, and catalog-relevant field notes for root metadata/control files.
- `zip_payload_families.md`: payload-family classification, representative ZIP entry structures, notable signals, and Phase 1 integrity checks.

The script reads filesystem metadata and ZIP central directories only. It does not extract payload files.

Validation from the initial run:

```text
summary_file_count 2191
summary_zip_count 2183
summary_zip_family_counts {'data_layer': 418, 'virtual_layer': 1765}
manifest_rows 2183
bad_zip_rows 0
```

Root metadata/control validation from the initial run:

```text
data_layers.txt rows 418, matching 418 data-layer ZIP manifest rows
virtual_layers.txt rows 1765, matching 1765 virtual-layer ZIP manifest rows
virtual_layers_metadata_all.csv rows 1765, matching 1765 virtual-layer ZIP manifest rows
duplicate virtual metadata filenames 0
duplicate virtual metadata layer IDs 0
```

ZIP payload-family validation from the initial run:

```text
data-layer ZIPs 418, all with TIFF and WMS XML entries
virtual-layer ZIPs 1765, all with TIFF and TXT metadata entries
ZIP central-directory open failures 0
data-layer ZIPs with nested ZIP entries 2
```
