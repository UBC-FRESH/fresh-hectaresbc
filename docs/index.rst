fresh-hectaresbc Documentation
==============================

``fresh-hectaresbc`` recovers, inventories, documents, and modernizes the
archived HectaresBC geospatial data collection after the original provincial
platform was decommissioned.

The project currently provides a Python API, Typer CLI, DataLad-backed data
repository linkage, a responsive browser catalog/map workspace, and an optional
FastAPI GIS assistant with AOI clipping and bundle jobs. These docs describe
implemented behavior; design notes for future work remain in ``planning/``.

.. toctree::
   :maxdepth: 2
   :caption: User Guide

   overview
   installation
   cli
   data_repository
   browser_app

.. toctree::
   :maxdepth: 2
   :caption: Reference

   api/index

.. toctree::
   :maxdepth: 1
   :caption: Project

   development
   release_readiness
