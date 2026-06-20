Data Repository
===============

Large HectaresBC payloads are not stored directly in this repository. They live
in ``UBC-FRESH/fresh-hectaresbc-data``, a DataLad/git-annex dataset linked as a
Git submodule at:

.. code-block:: text

   external/fresh-hectaresbc-data

Clone with submodules:

.. code-block:: bash

   git clone --recurse-submodules https://github.com/UBC-FRESH/fresh-hectaresbc.git
   cd fresh-hectaresbc

Or initialize the submodule after cloning:

.. code-block:: bash

   git submodule update --init --recursive external/fresh-hectaresbc-data

The submodule stores Git and git-annex metadata. Annexed file content is
retrieved on demand from configured storage remotes. Current user-facing API and
CLI workflows wrap these details with status, diagnostics, and dry-run fetch
planning so normal catalog use does not require learning git-annex internals.

The recovered ZIP payload publication currently includes:

* 2,183 raw ZIP payloads;
* 418 data-layer ZIPs;
* 1,765 virtual-layer ZIPs;
* 17,531,591,717 published ZIP bytes;
* the ``arbutus-s3`` storage remote.
