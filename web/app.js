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

const DEFAULT_LAYER_OPTIONS = {
  visible: true,
  opacity: 0.85,
};
const PUBLISHED_PREVIEW_ROOT = "../external/fresh-hectaresbc-data/derived/web_map_previews/v1";
const LOCAL_PREVIEW_ROOT = "data/map_previews";

const state = {
  catalog: null,
  previewManifest: null,
  localPreviewManifest: null,
  previewManifestStatus: "loading",
  previewArtifactCache: new Map(),
  previewManifestCache: new Map(),
  previewRenderToken: 0,
  mapLayerOptions: new Map(),
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
    syncRouteState();
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
  const published = await fetchJson(`${PUBLISHED_PREVIEW_ROOT}/index.json`);
  const local = await fetchJson(`${LOCAL_PREVIEW_ROOT}/manifest.json`);

  state.localPreviewManifest = local ? adaptPreviewManifest(local, LOCAL_PREVIEW_ROOT, "local") : null;
  if (published) {
    state.previewManifest = adaptPreviewManifest(published, PUBLISHED_PREVIEW_ROOT, "published");
    state.previewManifestStatus = "published";
    return;
  }
  if (state.localPreviewManifest) {
    state.previewManifest = state.localPreviewManifest;
    state.previewManifestStatus = "local";
    return;
  }

  state.previewManifest = null;
  state.previewManifestStatus = "unavailable";
}

async function fetchJson(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (error) {
    return null;
  }
}

function adaptPreviewManifest(manifest, baseUrl, sourceKind) {
  if (Array.isArray(manifest.artifacts)) {
    return {
      ...manifest,
      source_kind: sourceKind,
      base_url: baseUrl,
      artifacts: manifest.artifacts.map((artifact) => adaptArtifact(artifact, baseUrl, sourceKind)),
      reference_layers: (manifest.reference_layers || []).map((layer) => adaptArtifact(layer, baseUrl, sourceKind)),
    };
  }

  return {
    ...manifest,
    source_kind: sourceKind,
    base_url: baseUrl,
    artifacts: (manifest.layers || []).map((artifact) => adaptArtifact(artifact, baseUrl, sourceKind)),
    reference_layers: (manifest.reference_layers || []).map((layer) => adaptArtifact(layer, baseUrl, sourceKind)),
  };
}

function adaptArtifact(artifact, baseUrl, sourceKind) {
  return {
    ...artifact,
    artifact_source: sourceKind,
    artifact_base_url: baseUrl,
  };
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

function syncRouteState() {
  if (!state.catalog) {
    return;
  }
  const datasetId = selectedMapDatasetId() || selectedDatasetId();
  if (!datasetId) {
    return;
  }
  const record = CatalogBrowser.findRecord(state.catalog.records, datasetId);
  if (!record) {
    return;
  }
  state.query = record.dataset_id;
  searchInputNode.value = record.dataset_id;
  state.family = "all";
  state.sort = "title";
  state.pageSize = "50";
  sortSelectNode.value = state.sort;
  pageSizeSelectNode.value = state.pageSize;
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
    return decodeURIComponent(window.location.hash.slice("#map=".length));
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
  syncRouteState();
  renderResults();
  renderSelectedRecord();
  void renderMapPreview();
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

async function renderMapPreview() {
  if (!state.catalog) {
    return;
  }

  const renderToken = state.previewRenderToken + 1;
  state.previewRenderToken = renderToken;
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
  if (!isAvailablePreviewArtifact(artifact)) {
    mapStatusNode.textContent = "Preview unavailable";
    mapPreviewNode.className = "map-preview";
    mapPreviewNode.replaceChildren(renderUnavailableMap(record, artifact));
    return;
  }

  mapStatusNode.textContent = record.dataset_id;
  mapPreviewNode.className = "map-preview has-record";
  mapPreviewNode.replaceChildren(renderMapScaffold(record, artifact, {status: "loading"}));

  if (artifact.artifact_kind === "raster_png") {
    try {
      const detailedArtifact = await loadPreviewManifestDetails(artifact);
      if (state.previewRenderToken !== renderToken) {
        return;
      }
      mapPreviewNode.replaceChildren(renderMapScaffold(record, detailedArtifact, {raster: true}));
    } catch (error) {
      if (state.previewRenderToken !== renderToken) {
        return;
      }
      mapStatusNode.textContent = "Preview manifest missing";
      mapPreviewNode.replaceChildren(renderMapScaffold(record, artifact, {error}));
    }
    return;
  }

  try {
    const geojson = await loadPreviewArtifact(artifact);
    if (state.previewRenderToken !== renderToken) {
      return;
    }
    mapPreviewNode.replaceChildren(renderMapScaffold(record, artifact, {geojson}));
  } catch (error) {
    if (state.previewRenderToken !== renderToken) {
      return;
    }
    mapStatusNode.textContent = "Preview artifact missing";
    mapPreviewNode.replaceChildren(renderMapScaffold(record, artifact, {error}));
  }
}

function findPreviewArtifact(datasetId) {
  const artifacts = state.previewManifest?.artifacts || [];
  return artifacts.find((artifact) => artifact.dataset_id === datasetId) || null;
}

function isAvailablePreviewArtifact(artifact) {
  return Boolean(
    artifact?.artifact_path &&
      artifact?.manifest_path &&
      ["already_present", "source_derived_preview"].includes(artifact.artifact_status)
  );
}

async function loadPreviewManifestDetails(artifact) {
  if (hasDetailedRasterMetadata(artifact)) {
    return artifact;
  }

  const path = artifactUrl(artifact, artifact.manifest_path);
  if (state.previewManifestCache.has(path)) {
    return state.previewManifestCache.get(path);
  }

  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Preview manifest request failed with ${response.status}`);
  }
  const manifest = adaptArtifact(await response.json(), artifact.artifact_base_url, artifact.artifact_source);
  state.previewManifestCache.set(path, manifest);
  return manifest;
}

function hasDetailedRasterMetadata(artifact) {
  return Boolean(
    artifact &&
      artifact.crs &&
      artifact.raster_width &&
      artifact.preview_width &&
      Array.isArray(artifact.value_classes)
  );
}

async function loadPreviewArtifact(artifact) {
  const path = artifactUrl(artifact, artifact.artifact_path);
  if (state.previewArtifactCache.has(path)) {
    return state.previewArtifactCache.get(path);
  }

  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Preview artifact request failed with ${response.status}`);
  }
  const geojson = await response.json();
  validateGeoJson(geojson, path);
  state.previewArtifactCache.set(path, geojson);
  return geojson;
}

function validateGeoJson(geojson, path) {
  if (
    !geojson ||
    geojson.type !== "FeatureCollection" ||
    !Array.isArray(geojson.features)
  ) {
    throw new Error(`Preview artifact is not a GeoJSON FeatureCollection: ${path}`);
  }
}

function renderMapScaffold(record, artifact, options = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "map-layout";
  const referenceLayer = findReferenceLayer();

  const viewport = document.createElement("section");
  viewport.className = "map-viewport";
  viewport.setAttribute("aria-label", `Map preview for ${record.title}`);
  const grid = document.createElement("div");
  grid.className = "map-grid";
  const label = document.createElement("div");
  label.className = "map-placeholder-label";
  if (options.raster) {
    viewport.append(grid, renderRasterLayer(artifact), renderReferenceBasemap(referenceLayer), label);
    label.textContent = "Rendered source preview";
  } else if (options.geojson) {
    viewport.append(
      grid,
      renderGeoJsonLayer(options.geojson, artifact),
      renderReferenceBasemap(referenceLayer),
      label
    );
    label.textContent = "Rendered preview artifact";
  } else if (options.error) {
    viewport.append(grid, renderMapError(options.error), renderReferenceBasemap(referenceLayer), label);
    label.textContent = "Preview artifact missing";
  } else {
    viewport.append(grid, renderReferenceBasemap(referenceLayer), label);
    label.textContent = "Loading preview artifact";
  }

  const panel = document.createElement("aside");
  panel.id = "map-layer-panel";
  panel.className = "map-layer-panel";
  panel.append(
    mapPanelHeading(record, options.raster || options.geojson ? "Rendered" : "Available"),
    mapLayerControls(record),
    definitionList(mapArtifactRows(record, artifact, {...options, referenceLayer}))
  );

  if (artifact.fixture_warning) {
    const warning = document.createElement("p");
    warning.className = "map-warning";
    warning.textContent = artifact.fixture_warning;
    panel.append(warning);
  }

  wrapper.append(viewport, panel);
  return wrapper;
}

function mapArtifactRows(record, artifact, options) {
  const rows = [
    ["Dataset ID", record.dataset_id],
    ["Title", record.title],
    ["Source ZIP", record.source_zip_path],
    ["Artifact", artifact.artifact_path],
    ["Artifact source", artifactSourceLabel(artifact)],
    ["Artifact status", artifact.artifact_status],
    ["Artifact kind", artifact.artifact_kind],
    ["CRS", artifact.crs],
  ];

  if (artifact.artifact_kind === "raster_png") {
    rows.push(
      ["WGS84 bounds", formatBounds(artifact.wgs84_bounds)],
      ["Native bounds", formatBounds(artifact.native_bounds)],
      ["Raster size", `${artifact.raster_width} x ${artifact.raster_height}`],
      ["Preview size", `${artifact.preview_width} x ${artifact.preview_height}`],
      ["Internal raster", artifact.internal_raster_path],
      ["Legend source", artifact.internal_wms_path],
      ["Legend classes", legendList(artifact.value_classes || [])],
      ["Basemap", basemapDescription(options.referenceLayer)]
    );
  } else {
    rows.push(
      ["Bounds", renderBounds(artifact, options.geojson)],
      ["Feature count", featureCount(options.geojson)]
    );
  }

  rows.push(
    ["Source content", artifact.source_content_status],
    ["Preview eligibility", artifact.preview_eligibility_status],
    ["Preview blockers", artifact.preview_eligibility_blockers?.join(", ") || "none"],
    ["Generated by", artifact.provenance?.generated_by],
    ["Catalog detail", detailRouteLink(record)]
  );
  return rows;
}

function basemapDescription(referenceLayer) {
  if (!referenceLayer) {
    return "unavailable";
  }
  return `${referenceLayer.title} (${referenceLayer.source_zip_path})`;
}

function findReferenceLayer() {
  const layers = [
    ...(state.previewManifest?.reference_layers || []),
    ...(state.localPreviewManifest?.reference_layers || []),
  ];
  return (
    layers.find((layer) => layer.role === "source_derived_basemap_reference") ||
    null
  );
}

function renderReferenceBasemap(referenceLayer) {
  if (!referenceLayer) {
    const missing = document.createElement("div");
    missing.className = "map-reference-basemap map-reference-missing";
    missing.textContent = "Basemap reference unavailable";
    return missing;
  }

  const image = document.createElement("img");
  image.className = "map-reference-basemap";
  image.src = artifactUrl(referenceLayer, referenceLayer.artifact_path);
  image.alt = `${referenceLayer.title} source-derived basemap reference`;
  image.dataset.basemap = "source-derived-reference";
  image.dataset.layerDatasetId = referenceLayer.dataset_id;
  image.dataset.sourceZipPath = referenceLayer.source_zip_path;
  image.dataset.wgs84Bounds = formatBounds(referenceLayer.wgs84_bounds);
  image.addEventListener("error", () => {
    image.className = "map-reference-basemap map-reference-missing";
    image.removeAttribute("src");
    image.alt = "Basemap reference unavailable";
  });
  return image;
}

function renderRasterLayer(artifact) {
  const image = document.createElement("img");
  image.className = "map-render-layer map-raster-layer";
  image.src = artifactUrl(artifact, artifact.artifact_path);
  image.alt = `${artifact.title} source-derived raster preview`;
  image.dataset.layerDatasetId = artifact.dataset_id;
  image.dataset.wgs84Bounds = formatBounds(artifact.wgs84_bounds);
  image.addEventListener("error", () => {
    mapStatusNode.textContent = "Preview artifact missing";
  });
  applyLayerOptionsToNode(image, layerOptions(artifact.dataset_id));
  return image;
}

function renderGeoJsonLayer(geojson, artifact) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.className = "map-render-layer map-geojson-layer";
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-label", `${artifact.dataset_id} preview geometry`);
  svg.dataset.layerDatasetId = artifact.dataset_id;
  applyLayerOptionsToNode(svg, layerOptions(artifact.dataset_id));

  const bounds = validBounds(artifact.bounds) || geoJsonBounds(geojson);
  for (const feature of geojson.features) {
    for (const line of lineStrings(feature.geometry)) {
      const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      polyline.className = "map-feature-line";
      polyline.setAttribute(
        "points",
        line.map((coordinate) => projectCoordinate(coordinate, bounds)).join(" ")
      );
      svg.append(polyline);
    }
  }
  return svg;
}

function mapLayerControls(record) {
  const controls = document.createElement("section");
  controls.className = "map-layer-controls";
  controls.setAttribute("aria-label", "Map layer controls");

  const options = layerOptions(record.dataset_id);

  const heading = document.createElement("h4");
  heading.textContent = "Layer controls";

  const visibleLabel = document.createElement("label");
  visibleLabel.className = "map-checkbox-control";
  const visibleInput = document.createElement("input");
  visibleInput.id = "map-layer-visible";
  visibleInput.type = "checkbox";
  visibleInput.checked = options.visible;
  visibleInput.dataset.mapControl = "visibility";
  visibleInput.dataset.datasetId = record.dataset_id;
  const visibleText = document.createElement("span");
  visibleText.textContent = "Layer visible";
  visibleLabel.append(visibleInput, visibleText);

  const opacityLabel = document.createElement("label");
  opacityLabel.className = "map-range-control";
  opacityLabel.setAttribute("for", "map-layer-opacity");
  opacityLabel.textContent = "Opacity";
  const opacityInput = document.createElement("input");
  opacityInput.id = "map-layer-opacity";
  opacityInput.type = "range";
  opacityInput.min = "0";
  opacityInput.max = "1";
  opacityInput.step = "0.05";
  opacityInput.value = String(options.opacity);
  opacityInput.dataset.mapControl = "opacity";
  opacityInput.dataset.datasetId = record.dataset_id;
  const opacityValue = document.createElement("output");
  opacityValue.id = "map-layer-opacity-value";
  opacityValue.setAttribute("for", "map-layer-opacity");
  opacityValue.textContent = opacityLabelText(options.opacity);

  controls.append(heading, visibleLabel, opacityLabel, opacityInput, opacityValue);
  return controls;
}

function layerOptions(datasetId) {
  if (!state.mapLayerOptions.has(datasetId)) {
    state.mapLayerOptions.set(datasetId, {...DEFAULT_LAYER_OPTIONS});
  }
  return state.mapLayerOptions.get(datasetId);
}

function applyLayerControl(input) {
  const datasetId = input.dataset.datasetId;
  if (!datasetId) {
    return;
  }
  const options = layerOptions(datasetId);
  if (input.dataset.mapControl === "visibility") {
    options.visible = input.checked;
  }
  if (input.dataset.mapControl === "opacity") {
    options.opacity = boundedOpacity(input.value);
    input.value = String(options.opacity);
    const output = mapPreviewNode.querySelector("#map-layer-opacity-value");
    if (output) {
      output.textContent = opacityLabelText(options.opacity);
    }
  }
  const layer = mapPreviewNode.querySelector(".map-render-layer");
  if (layer?.dataset.layerDatasetId === datasetId) {
    applyLayerOptionsToNode(layer, options);
  }
}

function applyLayerOptionsToNode(node, options) {
  const opacity = options.visible ? String(options.opacity) : "0";
  node.setAttribute("opacity", opacity);
  node.setAttribute("data-visible", String(options.visible));
  node.setAttribute("data-opacity", String(options.opacity));
  if (node.style) {
    node.style.opacity = opacity;
  }
}

function boundedOpacity(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_LAYER_OPTIONS.opacity;
  }
  return Math.min(1, Math.max(0, Math.round(parsed * 100) / 100));
}

function opacityLabelText(opacity) {
  return `${Math.round(opacity * 100)}%`;
}

function legendList(classes) {
  const list = document.createElement("ul");
  list.className = "map-legend-list";
  for (const item of classes) {
    const row = document.createElement("li");
    const swatch = document.createElement("span");
    swatch.className = "map-legend-swatch";
    swatch.style.backgroundColor = `rgb(${item.rgb.join(", ")})`;
    const label = document.createElement("span");
    label.textContent = `${item.value}: ${item.label}`;
    row.append(swatch, label);
    list.append(row);
  }
  return list;
}

function formatBounds(bounds) {
  if (!Array.isArray(bounds)) {
    return "unknown";
  }
  return bounds.map((value) => Number(value).toFixed(4)).join(", ");
}

function renderMapError(error) {
  const message = document.createElement("div");
  message.className = "map-error";
  const heading = document.createElement("strong");
  heading.textContent = "Preview artifact could not be loaded.";
  const detail = document.createElement("span");
  detail.textContent = ` ${error.message}`;
  message.append(heading, detail);
  return message;
}

function lineStrings(geometry) {
  if (!geometry) {
    return [];
  }
  if (geometry.type === "LineString") {
    return [geometry.coordinates];
  }
  if (geometry.type === "MultiLineString") {
    return geometry.coordinates;
  }
  if (geometry.type === "Polygon") {
    return geometry.coordinates;
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.flat();
  }
  return [];
}

function projectCoordinate(coordinate, bounds) {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const [lon, lat] = coordinate;
  const width = maxLon - minLon || 1;
  const height = maxLat - minLat || 1;
  const padding = 8;
  const x = padding + ((lon - minLon) / width) * (100 - padding * 2);
  const y = 100 - padding - ((lat - minLat) / height) * (100 - padding * 2);
  return `${x.toFixed(2)},${y.toFixed(2)}`;
}

function renderBounds(artifact, geojson) {
  const bounds = validBounds(artifact.bounds) || geoJsonBounds(geojson);
  return bounds.map((value) => Number(value).toFixed(4)).join(", ");
}

function validBounds(bounds) {
  if (
    Array.isArray(bounds) &&
    bounds.length === 4 &&
    bounds.every((value) => Number.isFinite(Number(value)))
  ) {
    return bounds.map(Number);
  }
  return null;
}

function geoJsonBounds(geojson) {
  const coordinates = [];
  for (const feature of geojson?.features || []) {
    collectCoordinates(feature.geometry?.coordinates, coordinates);
  }
  if (coordinates.length === 0) {
    return [0, 0, 1, 1];
  }
  const lons = coordinates.map((coordinate) => Number(coordinate[0]));
  const lats = coordinates.map((coordinate) => Number(coordinate[1]));
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

function collectCoordinates(value, output) {
  if (!Array.isArray(value)) {
    return;
  }
  if (
    value.length >= 2 &&
    Number.isFinite(Number(value[0])) &&
    Number.isFinite(Number(value[1]))
  ) {
    output.push(value);
    return;
  }
  for (const item of value) {
    collectCoordinates(item, output);
  }
}

function featureCount(geojson) {
  if (!geojson) {
    return "not loaded";
  }
  return geojson.features.length.toLocaleString();
}

function renderUnavailableMap(record, artifact) {
  const panel = document.createElement("div");
  panel.className = "map-unavailable";
  panel.append(
    mapPanelHeading(record, "Unavailable"),
    definitionList([
      ["Dataset ID", record.dataset_id],
      ["Source ZIP", record.source_zip_path],
      ["Artifact source", artifact ? artifactSourceLabel(artifact) : previewManifestStatusLabel()],
      ["Artifact status", artifact?.artifact_status || "missing"],
      ["Eligibility", record.preview?.eligibility_status || "unknown"],
      ["Reason", unavailableReason(record, artifact)],
      ["Blockers", previewBlockers(record, artifact).join(", ") || "none"],
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

function artifactUrl(artifact, relativePath) {
  const baseUrl = artifact?.artifact_base_url || state.previewManifest?.base_url || LOCAL_PREVIEW_ROOT;
  return `${baseUrl}/${relativePath}`;
}

function artifactSourceLabel(artifact) {
  if (artifact?.artifact_source === "published") {
    return "DataLad published preview index";
  }
  if (artifact?.artifact_source === "local") {
    return "local generated preview artifacts";
  }
  return previewManifestStatusLabel();
}

function previewManifestStatusLabel() {
  if (state.previewManifestStatus === "published") {
    return "DataLad published preview index";
  }
  if (state.previewManifestStatus === "local") {
    return "local generated preview artifacts";
  }
  return "preview index unavailable";
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

function unavailableReason(record, artifact = null) {
  if (artifact?.artifact_status === "not_previewable") {
    return "The published preview batch inspected this layer but did not find visible preview pixels.";
  }
  if (artifact?.artifact_status) {
    return `Published preview artifact status is ${artifact.artifact_status}.`;
  }
  return (
    record.preview?.eligibility_reason ||
    "No generated preview artifact is available for this record."
  );
}

function previewBlockers(record, artifact = null) {
  if (Array.isArray(artifact?.preview_eligibility_blockers)) {
    return artifact.preview_eligibility_blockers;
  }
  return record.preview?.eligibility_blockers || [];
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

mapPreviewNode.addEventListener("input", (event) => {
  const input = event.target.closest("[data-map-control]");
  if (input) {
    applyLayerControl(input);
  }
});

mapPreviewNode.addEventListener("change", (event) => {
  const input = event.target.closest("[data-map-control]");
  if (input) {
    applyLayerControl(input);
  }
});

loadCatalog();
