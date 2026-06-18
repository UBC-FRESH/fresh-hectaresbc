# Recovered Catalog Metadata

This directory contains compact metadata records recovered from the local HectaresBC archive under `tmp/shared-data/hectaresbc`.

The files here are source-backed project metadata, not normalized final catalog products. They should preserve provenance, uncertainty, and original HectaresBC identifiers before later ingestion or API design work introduces canonical names.

## Current Files

- `virtual_layer_records.csv`: one recovered record for each virtual-layer ZIP listed by the archive.
- `virtual_layer_recovery_summary.md`: counts, checks, and source-conflict notes for the virtual-layer recovery pass.
- `data_layer_records.csv`: one recovered record for each data-layer ZIP listed by the archive.
- `data_layer_recovery_summary.md`: counts, checks, and metadata notes for the data-layer recovery pass.
- `recovery_summary.md`: Phase 2 recovery summary and Phase 3 handoff notes.

## Regeneration

```bash
python scripts/recover_virtual_layer_records.py
python scripts/recover_data_layer_records.py
```
