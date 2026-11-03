Python API Reference
====================

The public package entrypoint is ``fresh_hectaresbc.HectaresBC``. It exposes
catalog search and lookup, local path/status inspection, backend diagnostics,
and fetch planning/retrieval methods.

Public Package
--------------

.. automodule:: fresh_hectaresbc

API Facade
----------

.. automodule:: fresh_hectaresbc.api
   :members:
   :undoc-members:

Catalog
-------

.. automodule:: fresh_hectaresbc.catalog
   :members:
   :undoc-members:

Models
------

.. automodule:: fresh_hectaresbc.models
   :members:
   :undoc-members:

Retrieval
---------

.. automodule:: fresh_hectaresbc.retrieval
   :members:
   :undoc-members:

Backends
--------

.. automodule:: fresh_hectaresbc.backends.base
   :members:
   :undoc-members:

.. automodule:: fresh_hectaresbc.backends.datalad
   :members:
   :undoc-members:

Service And GIS Helpers
-----------------------

.. automodule:: fresh_hectaresbc.web_service
   :members: ServiceConfig, create_app

.. automodule:: fresh_hectaresbc.aoi
   :members: validate_aoi_geometry, inspect_aoi_geometry, geometry_feature_collection

.. automodule:: fresh_hectaresbc.clip
   :members: resolve_source_zip, pick_raster_member, clip_raster_to_aoi

.. automodule:: fresh_hectaresbc.bundle
   :members: prepare_bundle, BundleError, BundleCancelled

.. automodule:: fresh_hectaresbc.bundle_retention
   :members: prune_bundle_outputs

.. automodule:: fresh_hectaresbc.femic_bridge
   :members: search_aoi_layers, resolve_aoi

.. automodule:: fresh_hectaresbc.jobs
   :members: BundleJobManager

.. automodule:: fresh_hectaresbc.tiles
   :members: layer_metadata, render_tile, identify_pixel, prune_tile_cache, configure_tile_cog_root, tile_usage_stats
