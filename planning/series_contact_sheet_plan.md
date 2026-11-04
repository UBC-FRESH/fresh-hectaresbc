# Phase 37: Series Contact-Sheet PNG Export

Parent issue: #273

## Goal

Export all Series frames as one labeled grid PNG for reports, slide decks, and
quick visual comparison.

This complements:

- active-frame PNG;
- full-cycle WebM;
- the on-screen Series editor.

## Export Contract

Action: **Contact sheet** in the Series header beside PNG/WebM actions.

Output filename:

```text
hectaresbc-series-contact-sheet-<first_dataset_id>-<YYYY-MM-DD>.png
```

Layout:

- maximum output width: 1600 px;
- columns: `min(frame_count, 4)`;
- rows: `ceil(frame_count / columns)`;
- 12 px gaps, 14 px outer padding;
- header with “HectaresBC · Series contact sheet” and frame count;
- one tile per frame:
  - rendered map canvas, preserving the source aspect ratio;
  - frame number;
  - layer title;
  - dataset ID;
- footer with date and OpenStreetMap attribution;
- white background and light borders suitable for printing.

Long titles and IDs are ellipsized. Map images are scaled uniformly, not cropped or
stretched.

## Frame Sequencing

- Pause normal playback during export.
- Save the current frame and paused state.
- For each frame:
  - activate it through shared Series controls;
  - wait for source readiness up to 1.5 s;
  - wait one animation frame so MapLibre has painted;
  - draw the current map canvas into its grid cell.
- Restore the previous frame and playback state.
- Disable all Series export buttons while composing.
- The contact-sheet action reads `Contact sheet`.
- While exporting it reads `Exporting…`.
- Errors restore the UI and show a toast.

## Limits

- Support the existing 2–30-frame Series limit.
- 30 frames at 4 columns produces 8 rows and a tall but bounded image.
- Canvas memory scales with output width × height; no additional raster copies are
  retained after download.

## Non-Goals

- PDF output.
- Custom per-frame cropping or map extents.
- Including the Series editor or controls in the image.
- Changing PNG/WebM behavior.
- Server-side thumbnails.

## Verification

- Playwright on a 3-frame Series:
  - click Contact sheet;
  - receive a `.png` download;
  - verify PNG signature and non-trivial size;
  - parse IHDR dimensions and assert a landscape multi-column sheet;
  - assert button text returns to Contact sheet.
- Existing Series, video, performance, accessibility, Tours, Compare, and Map
  export smokes stay green.
- Sphinx `-W`.
- Public contact-sheet verification after deploy.
