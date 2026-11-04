# Phase 33: Curated Demo Tours

Parent issue: #249

## Goal

Add a discoverable **Tours** workspace that turns the app's strongest workflows
into short, actionable examples:

1. Browse/search recovered layers.
2. Compare two thematic layers in side-by-side, wipe, and flicker modes.
3. Play the 17-year pine-beetle series.
4. Open Clip with TSA 27 search fields prefilled.
5. Open spatial Discovery against the current map view.

The page should teach the workflow and provide primary actions, not duplicate the
underlying features.

## Route

```text
#/tours
```

- Add a **Tours** header tab.
- `renderTours` builds cards from a small in-app tour definition.
- Missing preview data or an unavailable service must degrade gracefully:
  - Series/Compare actions remain available when preview data exists.
  - Clip action is marked unavailable when the service is unavailable.
  - Discovery remains available whenever the map can open.

## Tour Cards

Each card contains:

- badge and title;
- one-sentence purpose;
- 3–5 short steps;
- a primary action;
- optional secondary actions.

### Browse

Primary action:

```text
#/catalog?q=old+growth&preview=available
```

### Compare

Primary action:

```text
#/compare?left=dl_adminunits_bcts&right=dl_adminunits_coaltenure&mode=split
```

Secondary actions for `mode=wipe` and `mode=flicker`.

### Series

Resolve the `dl_pinebeetle_allkill` year family at render time. The primary action
opens:

```text
#/series?layers=<year layers>&speed=1000
```

If the family is unavailable, show the generic Series/tray entry instead of a
broken link.

### Clip

Primary action opens the BCTS map with Clip state:

```text
#/dataset/dl_adminunits_bcts/map?clip=timber+supply+area&clipName=TSA+27
```

Behavior:

- after the map is ready, open the Clip panel;
- prefill the boundary query and AOI name;
- focus the query field;
- do not automatically run the FEMIC boundary search (the user reviews the
  query first);
- if the service is unavailable, retain the map action and explain that Clip
  requires the service.

### Discovery

Primary action opens:

```text
#/map?discover=view
```

Behavior:

- after the map is ready, open the Discover panel;
- run current-view discovery once;
- focus the Discover panel;
- do not add anything to the tray automatically.

## Route State

Add map route fields:

- `clip` — Clip boundary query.
- `clipName` — AOI name.
- `discover=view` — auto-open current-view discovery.

These fields are consumed after map creation. They remain shareable and do not
create server-side state.

## Styling

- Responsive card grid with one card on mobile.
- Reuse existing badges, buttons, and typography.
- Numbered steps use an ordered list.
- Cards must not horizontally overflow at 390 px.

## Non-Goals

- Automated FEMIC resolution from a tour link.
- Video/GIF walkthroughs.
- User-authored tours.
- Server-side analytics or progress tracking.
- Changing the underlying Compare, Series, Clip, or Discovery contracts.

## Verification

- Route parse/build roundtrip.
- Playwright:
  - Tours tab and route load;
  - card count and primary actions;
  - Series link resolves the real 17-year family;
  - Clip deep link opens the panel with prefilled query and name;
  - Discovery deep link opens the panel and runs;
  - mobile layout has no horizontal overflow.
- Existing accessibility, map export, Compare, and Series smokes stay green.
- Sphinx `-W`.
- Public tour verification after deploy.
