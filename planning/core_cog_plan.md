# Phase 40: Core Administrative COG Coverage

Parent issue: #291

## Goal

Build COG derivatives for core administrative layers that users commonly open in
the Map, Series, and Compare workspaces, and make the set reproducible.

BCTS already has a COG pilot. Add:

- `dl_adminunits_coaltenure`
- `dl_adminunits_firezone`
- `dl_adminunits_forestdistrict`
- `dl_adminunits_healthunits`
- `dl_adminunits_ilmbregions`
- `dl_adminunits_municipalities`

## Builder Contract

Extend `scripts/build_tile_cog.py`:

- `--preset core-admin` expands the six-layer preset.
- `--dataset-id` remains repeatable and can be combined with the preset.
- Deduplicate IDs while preserving order.
- Require at least one dataset ID or a preset.
- `--dry-run` prints the resolved plan as JSON without opening the archive.
- Existing skip/force/overview/resampling behavior is unchanged.

## Build And Measurement

Build into the demo clone:

```text
/srv/shared-data/gep/ws4/fresh-hectaresbc-demo/var/tile-cogs
```

After building:

- restart the demo service;
- verify `tile_cogs` count rises from 1 to 7;
- verify the `/api/stats` `cog_datasets` list contains the new layers;
- measure a first high-zoom tile for a representative layer with a fresh tile
  cache before and after the COG exists;
- record the latency and COG size in the phase notes/handoff.

## Verification

- Dry-run preset expands to six IDs.
- Build output reports `status: ok` or `skipped` for every layer.
- Service health reports the new COG count.
- Representative z9 tile render improves after COG creation.
- Existing service tests, browser smokes, Sphinx, and asset budgets stay green.

## Non-Goals

- Archive-wide COG conversion.
- Changing tile styling or legends.
- Replacing the source archive.
- Committing generated COGs to Git.
