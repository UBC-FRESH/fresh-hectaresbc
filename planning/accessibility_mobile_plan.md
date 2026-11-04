# Phase 31: Accessibility And Mobile QA

Parent issue: #237

## Goal

Close concrete keyboard, focus, touch-target, contrast, and reduced-motion gaps
without redesigning the workspace. Every fix must have a browser regression check.

## Audited Surfaces

- Browse results table/cards, facets, saved searches, pagination
- Dataset actions and metadata disclosure
- Map layer panel, map toolbar, discovery panel
- Compare and Series controls
- Tray, Clip, Assistant, Help dialog
- Mobile layouts at 390 px wide

## Findings And Fixes

### Navigation Semantics

**Finding:** Header workspace links use `role="tablist"` / `role="tab"` and
`aria-selected`, but they navigate between routes and do not implement the ARIA
tabs keyboard model.

**Fix:** Use a normal navigation landmark with `aria-current="page"` on the
active workspace. Keep current styling through that attribute.

### Skip Link

**Finding:** The skip link uses `href="#content"`, which conflicts with the
hash-based router and would navigate to a legacy dataset route named `content`.

**Fix:** Intercept the skip-link activation, prevent the hash change, and focus
the workspace content region directly.

### Panel Focus

**Finding:** Tray, Clip, Discover, and Assistant panels open without moving focus
into the panel; closing them does not restore focus to the trigger. Clip,
Discover, and Assistant lack complete disclosure attributes.

**Fix:**

- Give panels `role="dialog"` and `aria-labelledby` headings.
- Move focus into the panel on open:
  - Tray / Discover: close button.
  - Clip: AOI query field when present.
  - Assistant: message input.
- Restore focus to the trigger on close.
- Mirror `aria-expanded` on Clip and Discover triggers.
- Add `aria-controls` / `aria-haspopup` where appropriate.

### Shortcut Isolation

**Finding:** Global single-key shortcuts remain active while a side panel or the
help dialog is open.

**Fix:** Ignore non-Escape shortcuts while any panel or the help dialog is open.
Keep Escape closing the top overlays as today.

### Mobile Filters

**Finding:** Opening the mobile filter rail by button or `f` does not move focus
into the rail, and closing it does not restore focus.

**Fix:** Focus the first facet control after opening; restore focus to the
Filters button after backdrop/Escape close.

### Touch Targets

**Finding:** Result-card add/favorite buttons and several map controls are below
24×24 CSS pixels at mobile width.

**Fix:**

- Raise result-card add/favorite targets to at least 28 px.
- Give map checkbox, range, and basemap select a 24 px minimum target.
- Preserve compact desktop visuals.

### Contrast

**Finding:** The tray count badge uses muted gray text on the dark accent
background.

**Fix:** Use white text on the accent background.

### Reduced Motion

**Finding:** Fit-to-layer and AOI fit animate for 400 ms regardless of
`prefers-reduced-motion`.

**Fix:** Set map fit duration to zero when reduced motion is requested.

## Verification Contract

Add `scripts/smoke_test_accessibility_browser.py` covering:

- active workspace uses `aria-current`;
- tray focus enters the panel and returns to the trigger on Escape;
- discover focus enters the panel and returns to its trigger;
- global shortcuts do not fire while a panel is open;
- skip link focuses content without changing the route hash;
- help dialog opens as a modal and returns focus;
- mobile filter rail focuses its first control and restores the Filters button;
- app-owned mobile controls are at least 24×24 px;
- no horizontal overflow at 390 px on Browse, Map, Compare, and Series;
- reduced-motion contexts start Series/Compare paused and use near-zero CSS transitions.

Existing Series, Compare, static, route, and Python tests must remain green.
Sphinx must build with `-W`.

## Non-Goals

- A full WCAG audit or third-party certification.
- Screen-reader testing on physical devices.
- Visual redesign.
- Making side panels modal or blocking map interaction.
- Changing MapLibre's own attribution-link layout.
