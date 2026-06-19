const statusNode = document.querySelector("#status");
const recordCountNode = document.querySelector("#record-count");
const dataLayerCountNode = document.querySelector("#data-layer-count");
const virtualLayerCountNode = document.querySelector("#virtual-layer-count");
const resultCountNode = document.querySelector("#result-count");
const recordListNode = document.querySelector("#record-list");
const emptyStateNode = document.querySelector("#empty-state");
const detailStatusNode = document.querySelector("#detail-status");
const recordDetailNode = document.querySelector("#record-detail");
const mapStatusNode = document.querySelector("#map-status");
const mapPreviewNode = document.querySelector("#map-preview");
const controlsNode = document.querySelector("#catalog-controls");
const searchInputNode = document.querySelector("#search-input");
const sortSelectNode = document.querySelector("#sort-select");
const pageSizeSelectNode = document.querySelector("#page-size-select");

const state = {
  catalog: null,
  previewManifest: null,
  previewManifestStatus: "loading",
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
    await loadPreviewManifest();
    renderCatalogSummary(catalog);
    renderResults();
    renderRoute();
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

async function loadPreviewManifest() {
  try {
    const response = await fetch("data/map_previews/manifest.json");
    if (!response.ok) {
      throw new Error(`Preview manifest request failed with ${response.status}`);
    }
    state.previewManifest = await response.json();
    state.previewManifestStatus = "available";
  } catch (error) {
    state.previewManifest = null;
    state.previewManifestStatus = "unavailable";
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

function renderSelectedRecord() {
  if (!state.catalog) {
    return;
  }

  const datasetId = selectedDatasetId();
  if (!datasetId) {
    detailStatusNode.textContent = "No record selected";
    recordDetailNode.className = "record-detail";
    recordDetailNode.innerHTML = `
      <p class="empty-detail">Select a catalog record to inspect provenance and usage commands.</p>
    `;
    return;
  }

  const record = CatalogBrowser.findRecord(state.catalog.records, datasetId);
  if (!record) {
    detailStatusNode.textContent = "Record not found";
    recordDetailNode.className = "record-detail";
    recordDetailNode.innerHTML = `
      <p class="empty-detail">No recovered catalog record matches <code></code>.</p>
    `;
    recordDetailNode.querySelector("code").textContent = datasetId;
    return;
  }

  detailStatusNode.textContent = record.dataset_id;
  recordDetailNode.className = "record-detail has-record";
  recordDetailNode.replaceChildren(renderDetail(record));
}

function selectedDatasetId() {
  if (!window.location.hash || window.location.hash === "#") {
    return "";
  }
  if (window.location.hash.startsWith("#map=")) {
    return "";
  }
  return decodeURIComponent(window.location.hash.slice(1));
}

function selectedMapDatasetId() {
  if (!window.location.hash.startsWith("#map=")) {
    return "";
  }
  return decodeURIComponent(window.location.hash.slice("#map=".length));
}

function renderRoute() {
  renderSelectedRecord();
  renderMapPreview();
}

function renderDetail(record) {
  const wrapper = document.createElement("div");
  wrapper.className = "detail-layout";

  const summary = document.createElement("section");
  summary.className = "detail-panel detail-summary";
  summary.setAttribute("aria-labelledby", "selected-record-title");

  const heading = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = familyLabel(record.source_family);
  const title = document.createElement("h3");
  title.id = "selected-record-title";
  title.textContent = record.title;
  heading.append(eyebrow, title);

  summary.append(
    heading,
    definitionList([
      ["Dataset ID", record.dataset_id],
      ["Source ZIP", record.source_zip_path],
      ["Verification", record.verification_status],
      ["Preview", CatalogBrowser.previewLabel(record)],
      ["Map route", mapRouteLink(record)],
      ["Manifest size", CatalogBrowser.formatBytes(record.manifest_size_bytes)],
    ])
  );

  const metadata = detailPanel(
    "Metadata",
    definitionList(metadataRows(record.metadata), "metadata-list")
  );

  const provenance = detailPanel(
    "Provenance",
    definitionList(provenanceRows(record.provenance), "metadata-list")
  );

  const notes = detailPanel("Known Gaps And Uncertainty", noteList(record));
  const commands = detailPanel("API And CLI Commands", commandSnippets(record));

  wrapper.append(summary, metadata, provenance, notes, commands);
  return wrapper;
}

function mapRouteLink(record) {
  const wrapper = document.createElement("span");
  const link = document.createElement("a");
  link.href = `#map=${encodeURIComponent(record.dataset_id)}`;
  link.textContent = "Open map preview";
  wrapper.append(link);

  const status = document.createElement("span");
  status.className = "inline-status";
  status.textContent = ` ${previewStatusLabel(record)}`;
  wrapper.append(status);
  return wrapper;
}

function renderMapPreview() {
  if (!state.catalog) {
    return;
  }

  const datasetId = selectedMapDatasetId();
  if (!datasetId) {
    mapStatusNode.textContent = "No layer selected";
    mapPreviewNode.className = "map-preview";
    mapPreviewNode.innerHTML = `
      <p class="empty-detail">Open a map preview from a dataset detail route.</p>
    `;
    return;
  }

  const record = CatalogBrowser.findRecord(state.catalog.records, datasetId);
  if (!record) {
    mapStatusNode.textContent = "Record not found";
    mapPreviewNode.className = "map-preview";
    mapPreviewNode.innerHTML = `
      <p class="empty-detail">No recovered catalog record matches <code></code>.</p>
    `;
    mapPreviewNode.querySelector("code").textContent = datasetId;
    return;
  }

  const artifact = findPreviewArtifact(record.dataset_id);
  if (!artifact) {
    mapStatusNode.textContent = "Preview unavailable";
    mapPreviewNode.className = "map-preview";
    mapPreviewNode.replaceChildren(renderUnavailableMap(record));
    return;
  }

  mapStatusNode.textContent = record.dataset_id;
  mapPreviewNode.className = "map-preview has-record";
  mapPreviewNode.replaceChildren(renderMapScaffold(record, artifact));
}

function findPreviewArtifact(datasetId) {
  const artifacts = state.previewManifest?.artifacts || [];
  return artifacts.find((artifact) => artifact.dataset_id === datasetId) || null;
}

function renderMapScaffold(record, artifact) {
  const wrapper = document.createElement("div");
  wrapper.className = "map-layout";

  const viewport = document.createElement("section");
  viewport.className = "map-viewport";
  viewport.setAttribute("aria-label", `Map preview scaffold for ${record.title}`);
  const grid = document.createElement("div");
  grid.className = "map-grid";
  const label = document.createElement("div");
  label.className = "map-placeholder-label";
  label.textContent = "Preview artifact ready";
  viewport.append(grid, label);

  const panel = document.createElement("aside");
  panel.id = "map-layer-panel";
  panel.className = "map-layer-panel";
  panel.append(
    mapPanelHeading(record, "Available"),
    definitionList([
      ["Dataset ID", record.dataset_id],
      ["Source ZIP", record.source_zip_path],
      ["Artifact", artifact.artifact_path],
      ["Artifact status", artifact.artifact_status],
      ["CRS", artifact.crs],
      ["Bounds", artifact.bounds.join(", ")],
      ["Source content", artifact.source_content_status],
      ["Catalog detail", detailRouteLink(record)],
    ])
  );

  const warning = document.createElement("p");
  warning.className = "map-warning";
  warning.textContent = artifact.fixture_warning;
  panel.append(warning);

  wrapper.append(viewport, panel);
  return wrapper;
}

function renderUnavailableMap(record) {
  const panel = document.createElement("div");
  panel.className = "map-unavailable";
  panel.append(
    mapPanelHeading(record, "Unavailable"),
    definitionList([
      ["Dataset ID", record.dataset_id],
      ["Source ZIP", record.source_zip_path],
      ["Eligibility", record.preview?.eligibility_status || "unknown"],
      ["Reason", unavailableReason(record)],
      ["Blockers", (record.preview?.eligibility_blockers || []).join(", ") || "none"],
      ["Catalog detail", detailRouteLink(record)],
    ])
  );

  if (state.previewManifestStatus === "unavailable") {
    const missing = document.createElement("p");
    missing.className = "map-warning";
    missing.textContent = "Preview manifest unavailable. Generate it with python scripts/generate_map_preview_artifacts.py.";
    panel.append(missing);
  }
  return panel;
}

function mapPanelHeading(record, status) {
  const heading = document.createElement("div");
  heading.className = "map-panel-heading";
  const title = document.createElement("h3");
  title.textContent = record.title;
  const badge = document.createElement("span");
  badge.className = "map-status-badge";
  badge.textContent = status;
  heading.append(title, badge);
  return heading;
}

function detailRouteLink(record) {
  const link = document.createElement("a");
  link.href = `#${encodeURIComponent(record.dataset_id)}`;
  link.textContent = "Open catalog detail";
  return link;
}

function unavailableReason(record) {
  return (
    record.preview?.eligibility_reason ||
    "No generated preview artifact is available for this record."
  );
}

function previewStatusLabel(record) {
  if (findPreviewArtifact(record.dataset_id)) {
    return "(preview artifact available)";
  }
  return `(${record.preview?.eligibility_status || "preview unavailable"})`;
}

function detailPanel(title, contentNode) {
  const section = document.createElement("section");
  section.className = "detail-panel";
  const heading = document.createElement("h3");
  heading.textContent = title;
  section.append(heading, contentNode);
  return section;
}

function definitionList(rows, className = "") {
  const list = document.createElement("dl");
  list.className = `detail-list ${className}`.trim();

  for (const [term, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    renderValue(dd, value);
    list.append(dt, dd);
  }

  if (rows.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-detail";
    empty.textContent = "No recovered values.";
    return empty;
  }

  return list;
}

function renderValue(node, value) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      node.textContent = "none";
      return;
    }
    const list = document.createElement("ul");
    list.className = "inline-list";
    for (const item of value) {
      const listItem = document.createElement("li");
      renderValue(listItem, item);
      list.append(listItem);
    }
    node.append(list);
    return;
  }

  if (value && typeof value === "object") {
    if (value.nodeType || value.tagName) {
      node.append(value);
      return;
    }
    node.append(definitionList(Object.entries(value), "nested-list"));
    return;
  }

  const text = String(value ?? "");
  if (isLikelyLongQuery(text)) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Show preserved query text";
    const code = document.createElement("pre");
    code.textContent = text;
    details.append(summary, code);
    node.append(details);
    return;
  }

  node.textContent = text || "unknown";
}

function metadataRows(metadata) {
  return Object.entries(metadata || {}).filter(([, value]) => hasRecoveredValue(value));
}

function provenanceRows(provenance) {
  return Object.entries(provenance || {}).filter(([, value]) => hasRecoveredValue(value));
}

function hasRecoveredValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (value && typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function isLikelyLongQuery(value) {
  const lower = value.toLowerCase();
  return value.length > 240 && (
    lower.includes("select ") ||
    lower.includes(" from ") ||
    lower.includes(" where ")
  );
}

function noteList(record) {
  const notes = [
    ...(record.known_gaps || []).map((text) => ["Known gap", text]),
    ...(record.uncertainty_notes || []).map((text) => ["Uncertainty", text]),
  ];

  if (notes.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-detail";
    empty.textContent = "No known gaps or uncertainty notes are recorded.";
    return empty;
  }

  const list = document.createElement("ul");
  list.className = "note-list";
  for (const [label, text] of notes) {
    const item = document.createElement("li");
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    item.append(strong, text);
    list.append(item);
  }
  return list;
}

function commandSnippets(record) {
  const commands = document.createElement("div");
  commands.className = "command-list";
  const datasetId = record.dataset_id;

  commands.append(
    commandSnippet(
      "Python lookup",
      `from fresh_hectaresbc import HectaresBC\n\nrecord = HectaresBC().get("${datasetId}")\nprint(record.title_candidate)`
    ),
    commandSnippet("CLI metadata", `fresh-hectaresbc catalog show ${datasetId}`),
    commandSnippet("Dry-run fetch", `fresh-hectaresbc fetch ${datasetId} --dry-run`)
  );
  return commands;
}

function commandSnippet(label, command) {
  const snippet = document.createElement("div");
  snippet.className = "command-snippet";

  const heading = document.createElement("div");
  heading.className = "command-heading";
  const title = document.createElement("h4");
  title.textContent = label;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "copy-button";
  button.textContent = "Copy";
  button.dataset.copy = command;
  heading.append(title, button);

  const pre = document.createElement("pre");
  pre.textContent = command;
  snippet.append(heading, pre);
  return snippet;
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

window.addEventListener("hashchange", renderRoute);

recordDetailNode.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-copy]");
  if (!button) {
    return;
  }

  const originalText = button.textContent;
  try {
    await navigator.clipboard.writeText(button.dataset.copy);
    button.textContent = "Copied";
  } catch (error) {
    button.textContent = "Unavailable";
  }
  window.setTimeout(() => {
    button.textContent = originalText;
  }, 1600);
});

loadCatalog();
