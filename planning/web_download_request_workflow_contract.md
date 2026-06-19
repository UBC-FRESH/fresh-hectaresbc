# Web Download Request Workflow Contract

## Purpose

Specify the custom download request workflow before implementing hosted processing, object-store writes, authentication, notifications, or prepared downloads.

This completes P9.5. The core rule is that an AOI intent is not automatically a download job. A hosted download request requires reviewable request state, validation gates, controlled execution, and cost/abuse boundaries.

## Workflow Position

The custom download workflow starts after a user has:

1. found one or more datasets in the catalog;
2. reviewed dataset metadata and provenance;
3. optionally opened map preview;
4. captured an AOI intent or selected a grid/tile set;
5. reviewed the request summary.

Only after review and validation should the system create a job-like request.

## Request Types

Initial request type:

- single dataset plus one AOI intent.

Future request types:

- multiple datasets plus one AOI intent;
- one dataset plus multiple AOIs;
- standard tile bundle request;
- raw payload request handoff to package/CLI instructions;
- curated collection request.

The first implementation should support one dataset at a time unless processing and output estimation are proven stable.

## Request Payload

Minimum request fields:

- `request_id`;
- `request_type`;
- `dataset_ids`;
- `aoi_intent`;
- `requested_outputs`;
- `validation_status`;
- `validation_messages`;
- `estimated_input_bytes`;
- `estimated_output_bytes`;
- `estimated_tile_count` or `estimated_area`;
- `created_at`;
- `created_by`, when authentication exists;
- `status`;
- `status_updated_at`;
- `expires_at`, when outputs or drafts are persisted.

The request should preserve references to catalog dataset IDs and AOI intent payloads rather than copying large catalog or geometry state unnecessarily.

## Review Before Submit

Users should see a review step before job creation.

The review should show:

- dataset title and ID;
- source payload path;
- AOI summary and validation state;
- requested output format;
- expected limitations;
- estimated size or an explicit `estimate_unavailable` state;
- authentication/access requirement for submission;
- expiration or retention policy for prepared outputs.

The review step should block submission when validation is failed or incomplete for required gates.

## Validation Gates

Required gates before job submission:

- dataset ID exists;
- dataset has a resolvable source payload path;
- AOI intent is syntactically valid;
- AOI is within configured project/domain limits;
- layer-specific CRS/extent compatibility is known or the request type explicitly supports pending validation;
- requested output format is supported for the dataset family and AOI type;
- estimated area, tile count, and output size are within configured limits;
- authenticated user or access token is present for hosted job creation;
- worker/storage backend is available, if the request will be submitted immediately.

If a gate cannot be evaluated, the request should remain in draft or blocked state rather than being silently submitted.

## Job Lifecycle States

Recommended states:

- `draft`: request being assembled, not submitted;
- `blocked`: request cannot be submitted because validation failed or required information is missing;
- `ready`: validation passed and user can submit;
- `submitted`: request accepted by the service;
- `queued`: waiting for worker capacity;
- `running`: processing has started;
- `succeeded`: outputs are ready;
- `failed`: processing failed with a user-safe reason;
- `expired`: outputs or request record expired;
- `cancelled`: user or operator cancelled the request.

Status messages should be user-safe and should not expose credentials, private local paths, full stack traces, or internal object-store configuration.

## Output Formats

First output candidates:

- clipped GeoTIFF for raster layers, once raster processing is validated;
- ZIP bundle containing one or more generated files plus metadata;
- request manifest JSON documenting dataset IDs, source paths, AOI, processing parameters, and provenance.

Deferred output formats:

- shapefile bundles;
- geopackage;
- cloud-optimized GeoTIFF publication;
- web tile packages;
- multi-layer analytical stacks;
- direct object-store signed write workflows.

Every generated output should include provenance metadata sufficient to reconstruct what was requested and which source dataset IDs were used.

## Output Storage And Lifecycle

Hosted outputs should be treated as temporary prepared artifacts.

Required policy decisions before implementation:

- storage backend;
- path/key naming convention;
- retention period;
- maximum output size;
- access control for collection;
- cleanup/lifecycle process;
- whether output URLs are authenticated routes or signed temporary URLs.

Default posture:

- do not make generated outputs permanent by default;
- do not expose bucket credentials to the browser;
- expire outputs automatically;
- keep enough request metadata to debug failures without retaining unnecessary user geometry forever.

## Cost And Abuse Controls

Job-creating workflows require controls before public exposure.

Minimum controls:

- authentication for submission;
- per-user request rate limits;
- per-user concurrent job limits;
- per-request area, tile count, vertex count, layer count, and estimated output size limits;
- queue capacity limits;
- maximum runtime per job;
- output retention limits;
- operator-visible logs and failure summaries.

Unauthenticated public users may browse catalog and metadata, but should not create processing jobs.

## Service/API Boundary

The request service should reuse:

- `HectaresBC().get()` for dataset identity;
- package path-resolution semantics for source payload paths;
- AOI intent payloads from P9.4;
- future preview/processing metadata for CRS, extent, and processing readiness.

The request service may add:

- request persistence;
- authentication/session checks;
- queue submission;
- worker orchestration;
- output manifest generation;
- output collection routes;
- operator diagnostics.

The browser should not:

- invoke DataLad directly;
- read raw ZIP/TIFF payloads;
- receive storage credentials;
- write directly to object storage;
- infer processing readiness from filename or payload existence alone.

## User-Facing Pages

Candidate routes:

```text
/request/new
/request/{request_id}
/request/{request_id}/outputs
```

The request status page should show the current state, last update time, user-safe validation or failure messages, and output collection controls when available.

## Testing Boundary

Default tests and smoke checks should not require:

- Arbutus or Chinook credentials;
- UBC CWL;
- DataLad network retrieval;
- raw ZIP/TIFF payload content;
- hosted workers;
- object-store writes;
- email or notification delivery;
- real clipping.

Routine verification can test:

- request payload shape;
- validation state transitions over synthetic AOI intents;
- blocked/ready/submitted status behavior using fake services;
- output manifest shape with synthetic paths;
- user-safe error rendering;
- integration with representative catalog records.

## Open Questions For P9.6

Questions for hosting/deployment:

- Which authentication layer should guard job creation first?
- Where should request records live?
- Where should temporary outputs live?
- What queue/worker system is appropriate for expected request volume?
- How should operators inspect failed jobs?
- What retention period is acceptable for AOI geometry and outputs?
- What is the smallest self-hostable deployment that still protects credentials?

## Implementation Deferrals

P9.5 does not implement:

- authentication;
- request persistence;
- queue submission;
- clipping;
- output generation;
- object-store upload;
- notification delivery;
- hosted status pages.

Those require the hosting/deployment plan in P9.6 and later implementation phases.
