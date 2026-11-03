# Phase 23: Reusable AOI Library

Parent issue: #179

## Goal

Make AOIs reusable across Clip sessions without accounts or server-side AOI
storage. The library stores named AOIs and automatically remembers recent AOIs in
local browser storage.

## Stored AOI Schema

Local storage key: `fresh-hectaresbc.aois.v1`

```json
{
  "id": "timestamp-random",
  "name": "Revelstoke TSA",
  "named": true,
  "query": "timber supply area boundary",
  "geometry": null,
  "area_ha": 758443.7,
  "geometry_omitted": false,
  "created_utc": "...",
  "updated_utc": "..."
}
```

Rules:

- A FEMIC/administrative AOI stores `query` + `name`; geometry is re-resolved
  when applied, avoiding multi-megabyte local storage records.
- A drawn AOI stores geometry only when compact (2,000 coordinate numbers or
  fewer); larger geometries are omitted with a clear message.
- Named AOIs are explicitly saved by the user.
- Recent AOIs are recorded automatically after successful boundary resolution
  or area inspection of a drawn AOI.
- Max 20 records; named and recent are deduplicated by name/query or compact
  geometry.
- Invalid stored records are ignored safely.

## Restore Contract

Selecting an AOI from the Clip library:

- applies compact geometry directly;
- resolves query/name through `/api/aoi/resolve` when the service is available;
- updates area, limit status, map overlay, and Clip status;
- leaves the map usable if restore fails.

## UI Contract

Inside the Clip AOI section:

- **Save current AOI** prompts for a name and stores the current AOI.
- A compact library list shows name, area, and named/recent state.
- Each record has Apply and Delete actions.
- Empty and too-large states are explicit.
- No credentials or server data are stored.

## Non-Goals

- Server-side AOI storage or cross-device sync.
- Sharing AOI permissions.
- Storing full FEMIC geometries in localStorage.
- Replacing workspace persistence.

## Verification

- Browser smoke for save/apply/delete/recent behavior.
- Existing Clip/workspace smokes.
- Sphinx `-W`.
- Public protected demo verification.
