# Phase 35: Animated Series WebM Export

Parent issue: #261

## Goal

Add **Export video** to the Series workspace so one playback can be downloaded as
a WebM with frame labels, date, and attribution.

Use browser-native APIs only:

- `canvas.captureStream(30)`
- `MediaRecorder`
- a composed 2D canvas

No GIF encoder dependency and no server-side rendering.

## Video Contract

- Format: WebM (`video/webm;codecs=vp9` when supported, then VP8, then generic
  WebM).
- Frame rate target: 30 fps.
- Output width: at most 1280 px, preserving the map canvas aspect ratio.
- Frame hold: current Series speed (500/1000/2000 ms).
- One complete cycle from frame 1 through frame N.
- Header:
  - “HectaresBC · Series”
  - active layer title
  - dataset ID
  - `Frame X of N`
- Footer:
  - date
  - `Map data © OpenStreetMap contributors`
- Filename:

```text
hectaresbc-series-<first_dataset_id>-<YYYY-MM-DD>.webm
```

## Recording Rules

- Pause normal Series playback during export.
- Save the current frame and paused state; restore both after recording.
- For each frame:
  - activate it through the shared Series frame controls;
  - wait for `isFrameReady` up to 1.5 s;
  - compose/draw for the configured hold duration.
- Draw the composed canvas continuously with `requestAnimationFrame` so
  `captureStream` receives changing frames.
- Capture on a dedicated canvas; the MapLibre canvas is only a source.
- Stop all stream tracks after recording.
- Disable the export action while recording.
- If `MediaRecorder` or `captureStream` is unavailable, show a clear toast and
  leave the Series usable.
- Recording errors restore playback state and surface a toast.

## UI

- Add **Export video** beside **Download PNG** in the Series header.
- While recording, the button reads **Recording…** and is disabled.
- A toast announces success or failure.
- Export uses the current speed; the user can change it before recording.

## Non-Goals

- GIF output.
- Audio.
- Trimming or custom frame ranges.
- Server-side rendering.
- Guaranteeing identical frame timing across browsers.
- Capturing MapLibre DOM controls or the editor panel.

## Verification

- Playwright test on a short 3-frame Series:
  - click Export video;
  - wait for a `.webm` download;
  - verify the EBML/WebM signature and non-trivial size;
  - verify the button returns from Recording state.
- Unsupported-API path should be guarded in code; no test environment dependency.
- Existing Series, accessibility, tours, compare, and Map export smokes stay green.
- Sphinx `-W`.
- Public export verification after deploy.
