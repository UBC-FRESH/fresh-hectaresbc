# Phase 29: Multi-Layer Flicker Series

Parent issue: #223

## Goal

Add a dedicated Series workspace that cycles through two to six previewable
layers in tray order. It extends flicker comparison beyond two layers without
changing the existing Side-by-side or Wipe comparison modes.

Typical uses:

- year-by-year pine-beetle or forest-cover sequences;
- thematic stacks such as BEC, BCTS, and old-growth layers;
- quick visual screening before building a Clip bundle.

## Route Contract

```text
#/series?layers=<dataset_id_1>,<dataset_id_2>,<dataset_id_3>&speed=1000
```

- `layers` is an ordered, de-duplicated list of two to six dataset IDs.
- Tray order is the playback order. Reordering the tray changes the sequence.
- `speed` is one of `500`, `1000`, or `2000` milliseconds; default `1000`.
- A route with fewer than two usable previewable layers shows a missing-series
  state with links back to Browse and the tray.
- Unavailable layers are skipped; the remaining ordered layers still play.

## Workspace Contract

- One full-width stage with one synchronized MapLibre map per layer.
- All maps share the union of layer bounds, WGS84 extent, bearing `0`, and pitch
  `0`.
- Panning or zooming the active map synchronizes every other map.
- Only the active frame is visible and accepts pointer input.
- The workspace exposes:
  - play/pause;
  - previous/next frame (stepping pauses playback);
  - fast/normal/slow speed;
  - frame counter, current title, and dataset ID;
  - **Download PNG** for the active frame with label, date, and attribution.
- Reduced-motion users start paused.
- Keyboard users can operate every control; the current frame is announced
  through an `aria-live` status.

## Entry Points

- Tray: **Flicker series** action using the ordered tray contents.
- Compare: **Open series** when the tray contains three or more layers.
- Direct URL for sharing and reproducible references.

## Limits

- Two to six layers, matching the existing tray limit.
- Static previews or on-demand raster tiles only; no new server endpoint.
- Each frame creates its own MapLibre map, so the six-layer cap is a practical
  browser-resource boundary.

## Non-Goals

- Server-side GIF/video rendering.
- Automatic time-series detection or title/year parsing.
- Editing layer order inside the Series route (use the tray).
- Changes to Side-by-side, Wipe, or two-layer Flicker behavior.
- Persisting a series beyond the URL and existing tray storage.

## Verification

- JavaScript route parsing/building checks.
- Playwright series test with three layers:
  - three map canvases;
  - frame advances and wraps;
  - previous/next works;
  - speed/pause state;
  - active-frame PNG download;
  - responsive layout and no horizontal overflow.
- Sphinx `-W`.
- Public demo verification after deployment.
