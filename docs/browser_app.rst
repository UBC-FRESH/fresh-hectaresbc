Browser Catalog And Map Preview
===============================

The repository includes a static browser app under ``web/``. Generate the
catalog and source-derived map-preview artifacts with:

.. code-block:: bash

   python scripts/generate_web_catalog.py
   python scripts/generate_map_preview_artifacts.py --dataset-id dl_adminunits_bcts
   python scripts/smoke_test_web_static_app.py
   python scripts/smoke_test_map_preview_artifacts.py

Serve the static app locally:

.. code-block:: bash

   python -m http.server --directory web 8000

Representative routes:

.. code-block:: text

   http://localhost:8000/#dl_adminunits_bcts
   http://localhost:8000/#map=dl_adminunits_bcts

The current map preview uses a PNG/RGBA overlay derived from
``data_layers/adminunits_bcts.zip!bcts.tiff`` and a recovered administrative
reference artifact derived from ``data_layers/adminunits_nrsab.zip!nrsab.tiff``.
It does not use external map tiles.

Preview coverage is intentionally narrow. The browser renderer can display more
raster preview artifacts once they are generated, but each additional layer
needs a source-readability audit and explicit generator configuration.
