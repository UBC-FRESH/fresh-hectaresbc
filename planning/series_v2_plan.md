# Phase 30: Series v2 Editor And Year-Sequence Discovery

Parent issue: #231

## Goal

Make the Series workspace usable for real multi-decade layer families:

- one MapLibre map instead of one map per frame;
- add, remove, reorder, and jump between frames in place;
- detect year-suffixed previewable layer families and open them with one click.

The recovered catalog has two 17-year pine-beetle sequences
(`dl_pinebeetle_allkill1999`–`2015` and `dl_pinebeetle_pinekill1999`–`2015`).
These exceed the practical browser WebGL-context limit for one map per frame, so
the Series architecture must change before discovery is useful.

## Single-Map Architecture

- `createSeries` creates **one** MapLibre map with one raster source and layer per
  frame.
- Every frame source/layer is registered at startup; only the active frame has
  `visibility: visible`.
- `activate(index)` switches layer visibility without recreating the map, so
  pan/zoom, attribution, controls, and playback state remain stable.
- The map fits the union of all frame bounds.
- Inactive layers do not receive pointer input because there is only one canvas.
- PNG export captures the single active canvas.

Series route limit rises from six to **30 frames**. Map workspace context layers
remain capped at six. The tray still holds six layers for normal map work.

## Editor Contract

The Series workspace includes an editor below the playback controls:

- **Add layer** select and button for any previewable layer not already in the
  series.
- Ordered frame chips showing frame number, title, and dataset ID.
- **Jump** to a frame.
- **Move up/down** for each frame.
- **Remove** a frame, disabled at the two-frame minimum.
- Adding is disabled at the 30-frame maximum.
- Every edit rewrites the `#/series?layers=...` URL and rerenders the workspace;
  playback restarts at frame one with the current speed.
- Editing never modifies the tray.

## Year-Sequence Discovery

A sequence is detected when at least three previewable dataset IDs share a prefix
and end in a four-digit year:

```text
^(?<prefix>.+?)[_-]?(?<year>(?:19|20)\d{2})$
```

Rules:

- Use the loaded preview index; skip non-previewable records.
- Group by prefix; require at least three distinct years.
- Sort frames by year ascending.
- Label the sequence from the earliest layer's title with the year and trailing
  range removed, falling back to a humanized prefix.
- Show the year range and frame count.
- One click replaces the current series with that ordered family.
- Detection is explicitly heuristic and based on dataset IDs, not metadata
  date fields.

## UI Placement

- A compact **Year sequences** panel appears above the stage when suggestions
  exist.
- Each suggestion is a button with title, year range, and frame count.
- The active sequence is marked.
- If no suggestions exist, the panel is hidden.

## Non-Goals

- Parsing arbitrary dates from titles, metadata, or WMS time dimensions.
- Server-side sequence detection.
- Automatic detection of non-year families.
- Saving series definitions beyond the URL and existing tray storage.
- Changing Compare, Wipe, or Map context-layer behavior.

## Verification

- Route parsing/building with more than six series layers.
- Year-family detection with synthetic layers and real catalog IDs.
- Single-map browser test:
  - one canvas;
  - frame activation changes the visible layer;
  - editor add/remove/reorder/jump;
  - year-sequence suggestion opens 17 frames;
  - PNG export;
  - mobile layout.
- Compare browser smoke remains green.
- Sphinx `-W`.
- Public demo verification after deployment.
