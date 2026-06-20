Browser Catalog And Map Preview
===============================

The repository includes a static browser app under ``web/``. Generate the
catalog with:

.. code-block:: bash

   python scripts/generate_web_catalog.py
   python scripts/smoke_test_web_static_app.py
   node scripts/smoke_test_web_catalog_ui.js web/data/catalog.json
   node scripts/smoke_test_web_app_dom.js web/data/catalog.json

The browser first looks for the published DataLad-backed preview index:

.. code-block:: text

   external/fresh-hectaresbc-data/derived/web_map_previews/v1/index.json

That publication currently indexes 2,183 recovered records, with 2,163
source-derived preview PNGs and 20 ``not_previewable`` records. Per-layer PNG
payloads are annexed in the data submodule and published to ``arbutus-s3``.
Per-layer manifests and the compact index are Git-tracked in the data
repository.

The older local BCTS preview generator remains available as a development
fallback and for the current NRS administrative basemap/reference artifact:

.. code-block:: bash

   python scripts/generate_map_preview_artifacts.py --dataset-id dl_adminunits_bcts
   python scripts/smoke_test_map_preview_artifacts.py

Serve the app with the project server when using the published preview index:

.. code-block:: bash

   python scripts/serve_web_app.py --host 0.0.0.0 --port 8023

Representative routes:

.. code-block:: text

   http://localhost:8023/web/#dl_adminunits_bcts
   http://localhost:8023/web/#map=dl_adminunits_bcts
   http://localhost:8023/web/#map=vl_virtualspecies_bulltroutsalvelinusconfluentus_1135
   http://localhost:8023/web/#map=dl_pinebeetle_pinekill1999

The project server redirects ``/`` to ``web/`` using a proxy-relative redirect,
serves only browser assets plus the published preview artifact tree, and
disables directory listings. Serving only the ``web/`` directory still works for
catalog browsing and the ignored local ``web/data/map_previews/`` fallback, but
it cannot read sibling paths under ``external/fresh-hectaresbc-data/``.

The browser renders source-derived PNG/RGBA overlays. ``dl_adminunits_bcts`` and
Bull Trout are representative previewable routes; ``dl_pinebeetle_pinekill1999``
is a representative ``not_previewable`` route. The local fallback can provide a
recovered administrative reference artifact derived from
``data_layers/adminunits_nrsab.zip!nrsab.tiff``. The app does not use external
map tiles, and the current previews are static image overlays rather than a tile
service or full GIS renderer.
