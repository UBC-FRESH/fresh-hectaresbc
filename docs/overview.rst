Overview
========

HectaresBC was a geospatial data platform for British Columbia. This repository
does not try to recreate the old service exactly. It preserves the recovered
data assets and rebuilds access around reproducible catalog metadata, a
DataLad/git-annex data repository, and small user-facing tools.

Current capabilities include:

* catalog lookup, search, and filtering through the Python API;
* a thin Typer CLI over the same API;
* local path resolution, content-status checks, backend diagnostics, and dry-run
  retrieval planning;
* a static browser catalog with stable detail and map-preview routes;
* a DataLad-backed source-derived browser preview publication covering 2,183
  recovered catalog records, with 2,163 preview PNGs and 20 records marked
  ``not_previewable``;
* a recovered administrative reference layer that can be used as map context
  behind preview overlays.

Important current limits:

* raw HectaresBC payloads live outside this repository in a DataLad submodule;
* browser previews are static PNG overlays, not a tile service or full GIS
  renderer;
* custom AOI masking, tile selection, and download-request processing are future
  service work, not implemented app behavior yet.
