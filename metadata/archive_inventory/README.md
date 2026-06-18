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

The script reads filesystem metadata and ZIP central directories only. It does not extract payload files.

Validation from the initial run:

```text
summary_file_count 2191
summary_zip_count 2183
summary_zip_family_counts {'data_layer': 418, 'virtual_layer': 1765}
manifest_rows 2183
bad_zip_rows 0
```

