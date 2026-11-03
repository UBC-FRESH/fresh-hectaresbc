Development Docs Workflow
=========================

Install the docs dependencies through the repo-local development environment:

.. code-block:: bash

   bash scripts/setup_dev_venv.sh
   source .venv/bin/activate

Build docs locally with warnings treated as errors:

.. code-block:: bash

   python -m sphinx -b html -W --keep-going docs docs/_build/html

Run the browser checks that document-facing changes should keep passing:

.. code-block:: bash

   python scripts/smoke_test_web_static_app.py
   node scripts/smoke_test_web_catalog_ui.js web/data/catalog.json
   python scripts/smoke_test_web_ui_browser.py
   python scripts/smoke_test_clip_aoi_browser.py
   python scripts/smoke_test_tray_browser.py
   python scripts/smoke_test_bundles_browser.py
   python scripts/smoke_test_identify_browser.py
   python scripts/smoke_test_workspace_browser.py

Generated Sphinx output under ``docs/_build/`` is ignored.

GitHub Actions builds the docs on pull requests. Pushes to ``main`` build the
same Sphinx site and publish it to GitHub Pages at
``https://ubc-fresh.github.io/fresh-hectaresbc/``.
