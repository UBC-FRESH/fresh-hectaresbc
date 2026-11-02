Browser Catalog And Map Workspace
=================================

The repository includes a static browser app under ``web/``. It has a Browse
workspace, a dataset detail view, and a MapLibre map workspace. Generate the
catalog and its lazy detail/index artifacts with:

.. code-block:: bash

   python scripts/generate_web_catalog.py
   python scripts/smoke_test_web_static_app.py
   node scripts/smoke_test_web_catalog_ui.js web/data/catalog.json
   python scripts/smoke_test_web_ui_browser.py

The generator writes four ignored artifacts:

.. code-block:: text

   web/data/catalog.json          full compatibility payload
   web/data/catalog.index.json    compact Browse/search rows
   web/data/catalog.details.json  full records, loaded on dataset open
   web/data/catalog.meta.json     counts and generation timestamp

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

   http://localhost:8023/web/#/catalog
   http://localhost:8023/web/#/catalog?q=bull+trout
   http://localhost:8023/web/#/dataset/dl_adminunits_bcts
   http://localhost:8023/web/#/dataset/dl_adminunits_bcts/map
   http://localhost:8023/web/#/dataset/vl_virtualspecies_bulltroutsalvelinusconfluentus_1135

Legacy hashes redirect automatically:

.. code-block:: text

   #dl_adminunits_bcts    -> #/dataset/dl_adminunits_bcts
   #map=dl_adminunits_bcts -> #/dataset/dl_adminunits_bcts/map

The project server redirects ``/`` to ``web/`` using a proxy-relative redirect,
serves only browser assets plus the published preview artifact tree, disables
directory listings, compresses textual responses with gzip, and sets
conservative cache headers. Serving only the ``web/`` directory still works for
catalog browsing and the ignored local ``web/data/map_previews/`` fallback, but
it cannot read sibling paths under ``external/fresh-hectaresbc-data/``.

Browse shows compact result rows with a preview thumbnail, format, family, size,
verification, and preview badges. Facets cover family, preview availability,
verification status, and size. Search, filters, sort, and pagination are stored
in the hash so views are shareable and browser Back returns to the previous
result set.

The dataset view groups recovered metadata, provenance, known gaps/uncertainty,
preview evidence, and copyable Python/CLI commands. Raw record JSON is available
behind a technical-details disclosure.

The map route lazy-loads MapLibre and renders the published preview PNG as an
image overlay using its recovered WGS84 bounds. It includes layer visibility,
opacity, legend classes, an OpenStreetMap basemap, an offline basemap option,
and a static fallback when WebGL, bounds, or the preview index is unavailable.
The app does not use dynamic tile services or raw payload retrieval in the
browser.

Default tests and smoke checks do not require UBC CWL, hosted workers, DataLad
network retrieval, raw ZIP content, Arbutus/Chinook credentials, or an object
store. Reading annexed preview PNG payloads from a cold checkout requires
DataLad/git-annex retrieval from the configured storage remote before the browser
can display those local files.
