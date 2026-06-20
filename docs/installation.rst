Installation And Local Use
==========================

Developer setup uses a repo-local virtual environment:

.. code-block:: bash

   bash scripts/setup_dev_venv.sh
   source .venv/bin/activate

The setup script creates ``.venv/``, installs the package in editable mode with
development dependencies, and smoke-checks package import, pytest, and
Python-side DataLad availability.

After activation, run the test suite and basic CLI checks with:

.. code-block:: bash

   python -m pytest
   fresh-hectaresbc --help
   fresh-hectaresbc --version

Catalog operations do not require raw ZIP payload retrieval:

.. code-block:: bash

   fresh-hectaresbc catalog search "bull trout" --limit 1
   fresh-hectaresbc catalog show dl_adminunits_bcts
   fresh-hectaresbc fetch dl_adminunits_bcts --dry-run

The equivalent Python entrypoint is:

.. code-block:: python

   from fresh_hectaresbc import HectaresBC

   hbc = HectaresBC()
   record = hbc.get("dl_adminunits_bcts")
   matches = hbc.search("bull trout", limit=5)
   plan = hbc.fetch("dl_adminunits_bcts", dry_run=True)
