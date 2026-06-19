const statusNode = document.querySelector("#status");
const recordCountNode = document.querySelector("#record-count");
const dataLayerCountNode = document.querySelector("#data-layer-count");
const virtualLayerCountNode = document.querySelector("#virtual-layer-count");
const resultCountNode = document.querySelector("#result-count");
const recordListNode = document.querySelector("#record-list");
const emptyStateNode = document.querySelector("#empty-state");
const controlsNode = document.querySelector("#catalog-controls");
const searchInputNode = document.querySelector("#search-input");
const sortSelectNode = document.querySelector("#sort-select");
const pageSizeSelectNode = document.querySelector("#page-size-select");

const state = {
  catalog: null,
  query: "",
  family: "all",
  sort: "title",
  pageSize: "50",
};

async function loadCatalog() {
  try {
    const response = await fetch("data/catalog.json");
    if (!response.ok) {
      throw new Error(`Catalog request failed with ${response.status}`);
    }
    const catalog = await response.json();
    state.catalog = catalog;
    renderCatalogSummary(catalog);
    renderResults();
  } catch (error) {
    statusNode.textContent = "Catalog data unavailable. Run the generator first.";
    emptyStateNode.hidden = false;
    emptyStateNode.innerHTML = `
      Generate <code>web/data/catalog.json</code> with
      <code>python3 scripts/generate_web_catalog.py</code>, then serve the
      <code>web/</code> directory with a local static server.
    `;
  }
}

function renderCatalogSummary(catalog) {
  statusNode.textContent = `Catalog generated ${catalog.generated_at}`;
  recordCountNode.textContent = catalog.record_count.toLocaleString();
  dataLayerCountNode.textContent = (catalog.family_counts.data_layer || 0).toLocaleString();
  virtualLayerCountNode.textContent = (
    catalog.family_counts.virtual_layer || 0
  ).toLocaleString();
}

function renderResults() {
  if (!state.catalog) {
    return;
  }

  const filtered = CatalogBrowser.filterRecords(state.catalog.records, state);
  const sorted = CatalogBrowser.sortRecords(filtered, state.sort);
  const visible = CatalogBrowser.limitRecords(sorted, state.pageSize);

  resultCountNode.textContent = `${filtered.length.toLocaleString()} matching records`;
  recordListNode.replaceChildren(...visible.map(renderRecord));
  emptyStateNode.hidden = filtered.length !== 0;
  if (filtered.length === 0) {
    emptyStateNode.textContent = "No matching records.";
  }
}

function renderRecord(record) {
  const row = document.createElement("tr");

  const titleCell = document.createElement("td");
  const title = document.createElement("a");
  title.href = `#${encodeURIComponent(record.dataset_id)}`;
  title.className = "record-title";
  title.textContent = record.title;
  const path = document.createElement("span");
  path.className = "record-path";
  path.textContent = record.source_zip_path;
  titleCell.append(title, path);

  const familyCell = document.createElement("td");
  familyCell.textContent = familyLabel(record.source_family);

  const idCell = document.createElement("td");
  idCell.className = "dataset-id";
  idCell.textContent = record.dataset_id;

  const previewCell = document.createElement("td");
  previewCell.textContent = CatalogBrowser.previewLabel(record);

  const sizeCell = document.createElement("td");
  sizeCell.textContent = CatalogBrowser.formatBytes(record.manifest_size_bytes);

  row.append(titleCell, familyCell, idCell, previewCell, sizeCell);
  return row;
}

function familyLabel(family) {
  if (family === "data_layer") {
    return "Data layer";
  }
  if (family === "virtual_layer") {
    return "Virtual layer";
  }
  return family;
}

controlsNode.addEventListener("input", () => {
  const form = new FormData(controlsNode);
  state.query = searchInputNode.value;
  state.family = form.get("family") || "all";
  state.sort = sortSelectNode.value;
  state.pageSize = pageSizeSelectNode.value;
  renderResults();
});

loadCatalog();
