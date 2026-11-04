# Phase 34: Series Frame Prefetch And Loading Feedback

Parent issue: #255

## Goal

Make the first playback cycle of a long Series smoother:

- warm the next frame's raster source before it becomes active;
- show a visible loading state until the active frame's source is ready;
- avoid blocking or duplicating the active frame.

## Warm-Next Contract

`createSeries` already registers every frame as a hidden layer. Add a `prefetch`
step that:

1. makes the next frame layer visible;
2. sets its raster opacity to `0`;
3. keeps it there briefly so MapLibre requests and caches its tiles/image;
4. hides it again and restores opacity unless it became active in the meantime.

Rules:

- Warm only the next frame, not the whole sequence.
- Do not warm the active frame.
- Cancel and normalize any in-flight prefetch when `activate(index)` runs.
- Track warmed frames in memory to avoid repeated work.
- Prefetch begins after the map style is ready and after a short delay so active
  frame rendering takes priority.
- Prefetch failures are non-fatal.

## Frame Readiness Contract

Add to the map handle:

- `isFrameReady(index)` — whether the source has reported loaded at least once.
- `onFrameReady(callback)` — notify when a frame source becomes ready.

Readiness sources:

- MapLibre `sourcedata` events with `isSourceLoaded` for `series-<index>`.
- `idle` fallback for the active frame.
- A 1.2 s activation fallback so the UI never displays “loading…” indefinitely
  for a source that is already locally cached or does not emit the expected
  event.

## UI Contract

Series frame status:

```text
Frame 3 of 17 · % Forest Killed, 1999 to 2002 · dl_pinebeetle_allkill2002 · loading…
```

The `loading…` suffix disappears when the active frame is ready. The status uses
`aria-live="polite"` and a muted loading style.

## Interaction Rules

- Stepping and playback both call `activate()`, which cancels prefetch safely.
- Prefetch must not change the visible frame or its opacity.
- Reduced-motion starts paused but still warms the next frame.
- The prefetch timer is cleared when the map is destroyed.

## Non-Goals

- Warming multiple frames ahead.
- Service-side tile preloading.
- Offline caching or Service Workers.
- Changing the Series route or frame editor.
- Guaranteeing the first visual frame is instant on a cold network.

## Verification

- Series browser smoke:
  - status no longer shows `loading…` after readiness;
  - activation still switches frames and loops;
  - prefetch does not leave two visible layers.
- Map/service local test can count tile requests to confirm hidden prefetch does
  not multiply traffic beyond the next frame.
- Existing accessibility, compare, map export, and tour smokes stay green.
- Sphinx `-W`.
- Public Series verification after deploy.
