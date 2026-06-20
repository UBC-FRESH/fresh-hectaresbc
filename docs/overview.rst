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
* source-derived map-preview artifacts for the first recovered raster layer and
  a recovered administrative reference layer behind it.

Important current limits:

* only ``dl_adminunits_bcts`` has a source-derived browser preview artifact;
* raw HectaresBC payloads live outside this repository in a DataLad submodule;
* custom AOI masking, tile selection, and download-request processing are future
  service work, not implemented app behavior yet.
