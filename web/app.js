const statusNode = document.querySelector("#status");
const recordCountNode = document.querySelector("#record-count");
const dataLayerCountNode = document.querySelector("#data-layer-count");
const virtualLayerCountNode = document.querySelector("#virtual-layer-count");
const recordListNode = document.querySelector("#record-list");

async function loadCatalog() {
  try {
    const response = await fetch("data/catalog.json");
    if (!response.ok) {
      throw new Error(`Catalog request failed with ${response.status}`);
    }
    const catalog = await response.json();
    renderCatalog(catalog);
  } catch (error) {
    statusNode.textContent = "Catalog data unavailable. Run the generator first.";
    recordListNode.innerHTML = `
      <p class="empty-state">
        Generate <code>web/data/catalog.json</code> with
        <code>python3 scripts/generate_web_catalog.py</code>, then serve the
        <code>web/</code> directory with a local static server.
      </p>
    `;
  }
}

function renderCatalog(catalog) {
  statusNode.textContent = `Catalog generated ${catalog.generated_at}`;
  recordCountNode.textContent = catalog.record_count.toLocaleString();
  dataLayerCountNode.textContent = (catalog.family_counts.data_layer || 0).toLocaleString();
  virtualLayerCountNode.textContent = (
    catalog.family_counts.virtual_layer || 0
  ).toLocaleString();

  const records = catalog.records.slice(0, 12);
  recordListNode.replaceChildren(...records.map(renderRecord));
}

function renderRecord(record) {
  const item = document.createElement("article");
  item.className = "record-item";

  const title = document.createElement("h3");
  title.textContent = record.title;

  const meta = document.createElement("p");
  meta.className = "record-meta";
  meta.textContent = `${record.source_family} | ${record.dataset_id}`;

  const path = document.createElement("p");
  path.className = "record-path";
  path.textContent = record.source_zip_path;

  item.append(title, meta, path);
  return item;
}

loadCatalog();
