Command Line Interface
======================

``fresh-hectaresbc`` installs a Typer command-line interface for catalog
discovery, local data-path inspection, backend diagnostics, and DataLad-backed
retrieval.

The CLI is a thin wrapper over the public ``fresh_hectaresbc.HectaresBC`` API.
Catalog commands do not read bulky ZIP payloads or require Arbutus credentials.
Status and dry-run fetch commands inspect local repository state and report what
would happen without retrieving data unless a non-dry-run fetch is requested.

Basic Commands
--------------

Show the installed version and top-level help:

.. code-block:: bash

   fresh-hectaresbc --version
   fresh-hectaresbc --help

The implemented command groups are:

.. list-table::
   :header-rows: 1

   * - Command
     - Purpose
   * - ``fresh-hectaresbc catalog search QUERY``
     - Search recovered catalog records by text.
   * - ``fresh-hectaresbc catalog show DATASET_ID``
     - Show one recovered catalog record.
   * - ``fresh-hectaresbc catalog list``
     - List catalog records with structured filters.
   * - ``fresh-hectaresbc data path DATASET_ID``
     - Resolve a dataset to its expected path in the linked data repository.
   * - ``fresh-hectaresbc data status DATASET_ID``
     - Inspect local metadata/content status without fetching data.
   * - ``fresh-hectaresbc diagnostics``
     - Inspect local DataLad/git-annex backend readiness.
   * - ``fresh-hectaresbc fetch DATASET_ID``
     - Fetch or dry-run fetch one dataset payload through the configured backend.

Catalog Commands
----------------

Search returns a compact table by default:

.. code-block:: bash

   fresh-hectaresbc catalog search "bull trout" --limit 1

Use ``--format json`` for automation:

.. code-block:: bash

   fresh-hectaresbc catalog search "bull trout" --limit 1 --format json

Show one record by recovered dataset ID:

.. code-block:: bash

   fresh-hectaresbc catalog show dl_adminunits_bcts
   fresh-hectaresbc catalog show dl_adminunits_bcts --format json

List records with structured filters:

.. code-block:: bash

   fresh-hectaresbc catalog list --family virtual_layer --limit 2
   fresh-hectaresbc catalog list --family data_layer --dataset-id-prefix dl_adminunits --limit 5
   fresh-hectaresbc catalog list --virtual-layer-id 10077 --format json

Current family filters are ``data_layer`` and ``virtual_layer``.

Data Path And Status Commands
-----------------------------

Resolve a recovered catalog record to its expected raw ZIP path in the linked
data repository:

.. code-block:: bash

   fresh-hectaresbc data path dl_adminunits_bcts
   fresh-hectaresbc data path dl_adminunits_bcts --format json

Inspect local content status without fetching:

.. code-block:: bash

   fresh-hectaresbc data status dl_adminunits_bcts
   fresh-hectaresbc data status dl_adminunits_bcts --format json

Status output distinguishes initialized submodule metadata from materialized
annexed content. Missing local content is expected in a cold clone until the
user retrieves the relevant payload.

Diagnostics And Fetch Commands
------------------------------

Run backend diagnostics:

.. code-block:: bash

   fresh-hectaresbc diagnostics
   fresh-hectaresbc diagnostics --format json

Plan a fetch without retrieving content:

.. code-block:: bash

   fresh-hectaresbc fetch dl_adminunits_bcts --dry-run
   fresh-hectaresbc fetch dl_adminunits_bcts --dry-run --format json

Run a real fetch only when DataLad/git-annex and storage remotes are configured:

.. code-block:: bash

   fresh-hectaresbc fetch dl_adminunits_bcts

Real fetches delegate to DataLad/git-annex for the one requested dataset. They
may require initialized submodules, the external ``git-annex`` binary, enabled
storage remotes, and user-local credentials for private or controlled remotes.

Overrides
---------

Most commands accept:

``--metadata-root PATH``
   Override the recovered catalog metadata root.

``--data-repo-path PATH``
   Override the linked data repository path.

These options are mainly for development, tests, and non-standard checkouts.

Quickstart Script
-----------------

The repository includes a CLI quickstart that avoids network retrieval:

.. code-block:: bash

   bash examples/cli_quickstart.sh

The quickstart runs version, catalog, path, status, diagnostics, and dry-run
fetch commands. Setup-dependent diagnostics may report missing local repository
state without failing the quickstart unless an unexpected command error occurs.
