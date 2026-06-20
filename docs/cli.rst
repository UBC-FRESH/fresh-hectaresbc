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

Catalog command output is intentionally compact:

``catalog search`` and ``catalog list``
   Default ``table`` output is tab-separated with
   ``dataset_id``, ``source_family``, ``title_candidate``, and
   ``source_zip_path``. ``--format json`` returns a JSON list with the same
   summary fields.

``catalog show``
   Default ``text`` output returns one key-value block for the selected record,
   including identifier, source family, title, source ZIP path, source filename,
   manifest size, verification status, known gaps, and uncertainty notes.
   ``--format json`` returns the full recovered catalog record.

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

``data path`` output includes the dataset ID, source ZIP path, data repository
root, raw relative path, absolute expected path, submodule initialization flag,
path metadata flag, and local content-present flag.

``data status`` returns the same local path context plus a status code and
message. Missing submodules or missing expected paths are setup problems and
exit with status code ``4``.

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

Diagnostics report these backend readiness checks when available:

* ``git_annex_available``;
* ``datalad_available``;
* ``data_repo_exists``;
* ``data_repo_is_git_repo``;
* ``special_remote_configured``.

``fetch --dry-run`` reports the DataLad command that would be run, such as
``datalad get raw/hectaresbc_2022_export/data_layers/adminunits_bcts.zip``,
without retrieving the payload.

Overrides
---------

Most commands accept:

``--metadata-root PATH``
   Override the recovered catalog metadata root.

``--data-repo-path PATH``
   Override the linked data repository path.

These options are mainly for development, tests, and non-standard checkouts.

Output Formats
--------------

Supported output formats are command-specific:

.. list-table::
   :header-rows: 1

   * - Command
     - Default format
     - JSON support
   * - ``catalog search``
     - ``table``
     - ``--format json``
   * - ``catalog list``
     - ``table``
     - ``--format json``
   * - ``catalog show``
     - ``text``
     - ``--format json``
   * - ``data path``
     - ``text``
     - ``--format json``
   * - ``data status``
     - ``text``
     - ``--format json``
   * - ``diagnostics``
     - ``table``
     - ``--format json``
   * - ``fetch``
     - ``text``
     - ``--format json``

Use JSON output for scripts and automation. Text/table output is intended for
interactive terminal inspection.

Exit Codes
----------

The CLI uses stable non-zero exit codes for common failure classes:

.. list-table::
   :header-rows: 1

   * - Code
     - Meaning
   * - ``0``
     - Success, including valid empty result lists and dry-run fetch plans.
   * - ``2``
     - CLI usage error, invalid output format, invalid family filter, or invalid query.
   * - ``3``
     - Requested dataset ID was not found.
   * - ``4``
     - Local setup is incomplete, such as a missing data submodule, missing expected path, unavailable backend, or required credentials.
   * - ``5``
     - Backend or validation error.
   * - ``6``
     - Unsupported fetch operation.

Setup-dependent commands such as ``data status``, ``diagnostics``, and
non-dry-run ``fetch`` may exit ``4`` in a cold clone. That does not mean the
catalog record is invalid; it means local DataLad/git-annex state is not ready
for the inspected operation.

Safety Boundaries
-----------------

The CLI must not print secrets. Diagnostics and fetch results are designed to be
secret-safe and should not expose AWS or Arbutus credential values.

Catalog, path, status, diagnostics, and dry-run fetch commands do not retrieve
annexed payload content. A real ``fresh-hectaresbc fetch DATASET_ID`` delegates
to DataLad/git-annex for the explicit dataset requested.

Quickstart Script
-----------------

The repository includes a CLI quickstart that avoids network retrieval:

.. code-block:: bash

   bash examples/cli_quickstart.sh

The quickstart runs version, catalog, path, status, diagnostics, and dry-run
fetch commands. Setup-dependent diagnostics may report missing local repository
state without failing the quickstart unless an unexpected command error occurs.
