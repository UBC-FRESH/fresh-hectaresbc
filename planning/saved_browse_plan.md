# Phase 26: Saved Browse Searches And Favorites

Parent issue: #197

## Goal

Let users save named Browse views and favorite datasets without accounts or
server-side state.

## Storage Contract

Local storage keys:

- `fresh-hectaresbc.saved-searches.v1`
- `fresh-hectaresbc.favorites.v1`

Saved search:

```json
{
  "id": "timestamp-random",
  "name": "Bull trout layers",
  "hash": "#/catalog?q=bull+trout",
  "created_utc": "..."
}
```

Favorite:

```json
{
  "dataset_id": "dl_adminunits_bcts",
  "created_utc": "..."
}
```

Rules:

- Save the current Browse route hash, including query/filter/sort/page state.
- Only catalog routes are saveable.
- Limit saved searches to 30 and favorites to 100.
- Invalid stored records are ignored.
- Favorites and saved searches are local to the browser.

## UI Contract

The Browse filter rail gains a **Saved** section:

- Save current search with a name prompt.
- List saved searches with open/delete.
- List favorite datasets with open/remove.
- Empty-state hint when no records exist.

Favorite star controls appear on:

- result rows;
- result cards;
- dataset detail actions.

The rail updates immediately after a favorite toggle.

## Non-Goals

- Server-side saved searches or cross-device sync.
- Sharing permissions.
- Automatic search recommendations.
- Favoriting non-catalog URLs.

## Verification

- Browser smoke for save/open/delete search and favorite toggle/remove.
- Existing tray/workspace/discovery smokes.
- Sphinx `-W`.
- Public protected verification.
