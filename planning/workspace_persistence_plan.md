# Phase 22: Saved And Shareable Workspaces

Parent issue: #173

## Goal

Let users capture and reopen a browser workspace without adding accounts or
server-side user storage:

- primary layer;
- tray/context layers;
- map center and zoom;
- AOI, when it can be represented safely;
- selected Clip layers.

Workspaces are encoded into a map URL and can also be saved by name in local
browser storage.

## Encoded Workspace Schema

Map routes accept a `w` query parameter containing URL-encoded JSON:

```text
#/dataset/<primary>/map?w=<encoded>
#/map?w=<encoded>
```

Schema version 1:

```json
{
  "v": 1,
  "primary": "dl_adminunits_bcts",
  "layers": ["dl_bec_becv10", "vl_example"],
  "view": {"center": [-123.5, 54.0], "zoom": 8},
  "aoi": {
    "name": "Drawn AOI",
    "query": null,
    "geometry": {"type": "Polygon", "coordinates": []},
    "area_ha": 12345.0
  },
  "clip_selected": ["dl_adminunits_bcts"]
}
```

Rules:

- `layers` is capped at six, matching the tray.
- Context rendering remains capped at three non-primary layers.
- A FEMIC/administrative AOI is stored as `query` + `name` and re-resolved when
  the workspace opens, avoiding a multi-megabyte URL.
- A drawn AOI is encoded as geometry only when compact (2,000 coordinate
  numbers or fewer); otherwise the AOI is omitted and the UI reports that it
  could not be shared.
- `clip_selected` is capped at the configured Clip layer limit.
- Invalid/old payloads are ignored safely; the map still opens.

## Route And Restore Contract

- `Catalog.parseRoute` and `buildRoute` retain the `workspace`/`w` value.
- `renderMap` applies a workspace once per encoded value.
- Map creation accepts an initial view; otherwise it fits the primary layer.
- Workspace AOI restore happens after map creation:
  - embedded geometry is applied directly;
  - boundary query/name is resolved through `/api/aoi/resolve` when available;
  - failure leaves the map usable and reports the issue.
- Clip selections are restored into Clip state but do not open the drawer.

## UI Contract

The tray drawer provides:

- **Save workspace** — prompts for a name and stores the encoded state in
  `localStorage` under `fresh-hectaresbc.workspaces.v1`;
- **Copy share link** — copies the current map URL with `w=`;
- saved workspace list with open/delete actions;
- workspace summary: primary layer, context count, AOI name, Clip selection count.

The UI never stores credentials or server data.

## Non-Goals

- Server-side accounts or cross-device workspace sync.
- Sharing permissions or workspace collaborators.
- Storing arbitrary raster data in workspace URLs.
- Replacing the tray, history, or Clip workflows.

## Verification

- Unit/browser checks for route encoding and restore.
- Browser smoke for save/share/open/delete.
- Sphinx `-W`.
- Public protected demo verification.
