Development Docs Workflow
=========================

Install the docs dependencies through the repo-local development environment:

.. code-block:: bash

   bash scripts/setup_dev_venv.sh
   source .venv/bin/activate

Build docs locally with warnings treated as errors:

.. code-block:: bash

   python -m sphinx -b html -W --keep-going docs docs/_build/html

Generated Sphinx output under ``docs/_build/`` is ignored.

GitHub Actions builds the docs on pull requests. Pushes to ``main`` build the
same Sphinx site and publish it to GitHub Pages.
