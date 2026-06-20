#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const repoRoot = path.join(__dirname, "..");
const catalogPath = process.argv[2] || path.join(repoRoot, "web", "data", "catalog.json");
const previewIndexPath =
  process.argv[3] ||
  path.join(
    repoRoot,
    "external",
    "fresh-hectaresbc-data",
    "derived",
    "web_map_previews",
    "v1",
    "index.json"
  );
const localPreviewManifestPath =
  process.argv[4] || path.join(repoRoot, "web", "data", "map_previews", "manifest.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const previewIndex = JSON.parse(fs.readFileSync(previewIndexPath, "utf8"));
const localPreviewManifest = fs.existsSync(localPreviewManifestPath)
  ? JSON.parse(fs.readFileSync(localPreviewManifestPath, "utf8"))
  : null;
const publishedPreviewRoot = "../external/fresh-hectaresbc-data/derived/web_map_previews/v1";

class Element {
  constructor(tagName, id = "") {
    this.tagName = tagName.toLowerCase();
    this.id = id;
    this.name = "";
    this.type = "";
    this.value = "";
    this.checked = false;
    this.hidden = false;
    this.href = "";
    this.src = "";
    this.alt = "";
    this.className = "";
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.children = [];
    this.parentNode = null;
    this.listeners = {};
    this._textContent = "";
  }

  set textContent(value) {
    this._textContent = String(value ?? "");
    this.children = [];
  }

  get textContent() {
    return [
      this._textContent,
      ...this.children.map((child) => child.textContent),
    ].join("");
  }

  set innerHTML(value) {
    this._textContent = stripTags(String(value ?? "")).trim();
    this.children = [];
    if (String(value).includes("<code")) {
      const code = new Element("code");
      this.append(code);
    }
  }

  get innerHTML() {
    return this.textContent;
  }

  append(...items) {
    for (const item of items) {
      const node = typeof item === "string" ? new TextNode(item) : item;
      node.parentNode = this;
      this.children.push(node);
    }
  }

  replaceChildren(...items) {
    this.children = [];
    this._textContent = "";
    this.append(...items);
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "id") {
      this.id = String(value);
    }
  }

  getAttribute(name) {
    return this.attributes[name];
  }

  addEventListener(type, callback) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(callback);
  }

  dispatchEvent(event) {
    const callbacks = this.listeners[event.type] || [];
    for (const callback of callbacks) {
      callback({...event, target: event.target || this});
    }
  }

  querySelector(selector) {
    if (selector.startsWith("#")) {
      return findDescendant(this, (node) => node.id === selector.slice(1));
    }
    if (selector.startsWith(".")) {
      return findDescendant(this, (node) => hasClass(node, selector.slice(1)));
    }
    if (selector === "[data-copy]") {
      return findDescendant(this, (node) => Boolean(node.dataset.copy));
    }
    if (selector === "[data-map-control]") {
      return findDescendant(this, (node) => Boolean(node.dataset.mapControl));
    }
    return findDescendant(this, (node) => node.tagName === selector.toLowerCase());
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (selector === "[data-copy]" && node.dataset.copy) {
        return node;
      }
      if (selector === "[data-map-control]" && node.dataset.mapControl) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }
}

class TextNode {
  constructor(value) {
    this.textContent = String(value ?? "");
    this.parentNode = null;
  }
}

class FakeDocument {
  constructor() {
    this.nodes = new Map();
    for (const id of [
      "status",
      "record-count",
      "data-layer-count",
      "virtual-layer-count",
      "result-count",
      "record-list",
      "empty-state",
      "detail-status",
      "record-detail",
      "map-status",
      "map-preview",
      "catalog-controls",
      "search-input",
      "sort-select",
      "page-size-select",
    ]) {
      this.nodes.set(id, new Element("div", id));
    }
    this.nodes.get("search-input").value = "";
    this.nodes.get("sort-select").value = "title";
    this.nodes.get("page-size-select").value = "50";
  }

  querySelector(selector) {
    if (!selector.startsWith("#")) {
      throw new Error(`unsupported selector in fake document: ${selector}`);
    }
    return this.nodes.get(selector.slice(1)) || null;
  }

  createElement(tagName) {
    return new Element(tagName);
  }

  createElementNS(_namespace, tagName) {
    return new Element(tagName);
  }
}

class FakeFormData {
  constructor() {}

  get(name) {
    if (name === "family") {
      return fakeState.family;
    }
    if (name === "sort") {
      return document.querySelector("#sort-select").value;
    }
    if (name === "limit") {
      return document.querySelector("#page-size-select").value;
    }
    return "";
  }
}

const fakeState = {family: "all"};
const document = new FakeDocument();
const window = {
  location: {hash: ""},
  listeners: {},
  addEventListener(type, callback) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(callback);
  },
  dispatchEvent(event) {
    for (const callback of this.listeners[event.type] || []) {
      callback(event);
    }
  },
  setTimeout,
};

const context = {
  assert,
  console,
  document,
  window,
  globalThis: null,
  FormData: FakeFormData,
  navigator: {
    clipboard: {
      async writeText(value) {
        fakeState.copied = value;
      },
    },
  },
  fetch: async (url) => {
    const payload = jsonPayloadForUrl(url);
    assert(payload !== undefined, `unexpected fetch URL: ${url}`);
    return {
      ok: payload !== null,
      async json() {
        return payload;
      },
    };
  },
  setTimeout,
};
context.globalThis = context;

vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(repoRoot, "web", "catalog.js"), "utf8"), context);
context.CatalogBrowser = context.window.CatalogBrowser;
vm.runInContext(fs.readFileSync(path.join(repoRoot, "web", "app.js"), "utf8"), context);

setImmediate(async () => {
  try {
    await settleAsyncRender();
    assert.strictEqual(document.querySelector("#record-count").textContent, "2,183");
    assert.strictEqual(document.querySelector("#data-layer-count").textContent, "418");
    assert.strictEqual(document.querySelector("#virtual-layer-count").textContent, "1,765");

    const searchInput = document.querySelector("#search-input");
    const sortSelect = document.querySelector("#sort-select");
    const pageSizeSelect = document.querySelector("#page-size-select");
    const controls = document.querySelector("#catalog-controls");

    searchInput.value = "bull trout";
    sortSelect.value = "title";
    pageSizeSelect.value = "50";
    fakeState.family = "all";
    controls.dispatchEvent({type: "input"});

    assert.strictEqual(document.querySelector("#result-count").textContent, "1 matching records");
    assert(
      document
        .querySelector("#record-list")
        .textContent.includes("vl_virtualspecies_bulltroutsalvelinusconfluentus_1135")
    );

    window.location.hash = "#dl_adminunits_bcts";
    window.dispatchEvent({type: "hashchange"});
    const detail = document.querySelector("#record-detail").textContent;
    assert.strictEqual(document.querySelector("#detail-status").textContent, "dl_adminunits_bcts");
    assert(detail.includes("BCTS Operating Areas"));
    assert(detail.includes("data_layers/adminunits_bcts.zip"));
    assert(detail.includes("metadata_recovered"));
    assert(detail.includes("Open map preview"));
    assert(detail.includes("fresh-hectaresbc catalog show dl_adminunits_bcts"));
    assert(detail.includes("fresh-hectaresbc fetch dl_adminunits_bcts --dry-run"));

    window.location.hash = "#vl_virtualspecies_bulltroutsalvelinusconfluentus_1135";
    window.dispatchEvent({type: "hashchange"});
    const virtualDetail = document.querySelector("#record-detail").textContent;
    assert(virtualDetail.includes("Bull Trout (Salvelinus confluentus)"));
    assert(virtualDetail.includes("Source query is preserved as text only"));

    window.location.hash = "#missing-dataset-id";
    window.dispatchEvent({type: "hashchange"});
    assert.strictEqual(document.querySelector("#detail-status").textContent, "Record not found");
    assert(document.querySelector("#record-detail").textContent.includes("missing-dataset-id"));

    searchInput.value = "";
    fakeState.family = "all";
    window.location.hash = "#map=dl_adminunits_bcts";
    window.dispatchEvent({type: "hashchange"});
    await settleAsyncRender();
    assert.strictEqual(document.querySelector("#map-status").textContent, "dl_adminunits_bcts");
    assert.strictEqual(searchInput.value, "dl_adminunits_bcts");
    assert.strictEqual(document.querySelector("#result-count").textContent, "1 matching records");
    assert.strictEqual(document.querySelector("#detail-status").textContent, "dl_adminunits_bcts");
    assert(document.querySelector("#record-detail").textContent.includes("BCTS Operating Areas"));
    const availableMap = document.querySelector("#map-preview").textContent;
    assert(availableMap.includes("BCTS Operating Areas"));
    assert(availableMap.includes("Rendered source preview"));
    assert(availableMap.includes("layers/dl_adminunits_bcts/preview.png"));
    assert(availableMap.includes("Artifact sourceDataLad published preview index"));
    assert(availableMap.includes("source_derived_preview"));
    assert(availableMap.includes("EPSG:3005"));
    assert(availableMap.includes("bcts.tiff"));
    assert(availableMap.includes("bcts.wms.xml"));
    assert(availableMap.includes("TBA (Babine)"));
    assert(availableMap.includes("Legend classes"));
    assert(availableMap.includes("Layer controls"));
    assert(availableMap.includes("BasemapNatural Resource Sector Administrative Regions"));
    assert(availableMap.includes("Preview eligibilitymetadata_preview_candidate"));
    assert(availableMap.includes("Preview blockersnone"));
    const basemap = document.querySelector("#map-preview").querySelector(".map-reference-basemap");
    assert.strictEqual(basemap.dataset.basemap, "source-derived-reference");
    assert.strictEqual(basemap.dataset.layerDatasetId, "dl_adminunits_nrsab");
    assert.strictEqual(basemap.dataset.sourceZipPath, "data_layers/adminunits_nrsab.zip");
    assert.strictEqual(
      basemap.src,
      "data/map_previews/context/bc_admin_reference.png"
    );
    assert.strictEqual(
      basemap.alt,
      "Natural Resource Sector Administrative Regions & SubRegsion source-derived basemap reference"
    );
    const renderedLayer = document.querySelector("#map-preview").querySelector(".map-render-layer");
    assert.strictEqual(
      renderedLayer.src,
      `${publishedPreviewRoot}/layers/dl_adminunits_bcts/preview.png`
    );
    assert.strictEqual(
      renderedLayer.alt,
      "BCTS Operating Areas source-derived raster preview"
    );
    assert.strictEqual(renderedLayer.dataset.layerDatasetId, "dl_adminunits_bcts");
    assert.strictEqual(
      renderedLayer.dataset.wgs84Bounds,
      manifestForDataset("dl_adminunits_bcts").wgs84_bounds
        .map((value) => Number(value).toFixed(4))
        .join(", ")
    );
    assert.strictEqual(renderedLayer.getAttribute("opacity"), "0.85");
    assert.strictEqual(renderedLayer.getAttribute("data-visible"), "true");

    const opacityInput = document.querySelector("#map-preview").querySelector("#map-layer-opacity");
    opacityInput.value = "0.35";
    document.querySelector("#map-preview").dispatchEvent({type: "input", target: opacityInput});
    assert.strictEqual(renderedLayer.getAttribute("opacity"), "0.35");
    assert.strictEqual(renderedLayer.getAttribute("data-opacity"), "0.35");
    assert.strictEqual(
      document.querySelector("#map-preview").querySelector("#map-layer-opacity-value").textContent,
      "35%"
    );

    const visibilityInput = document
      .querySelector("#map-preview")
      .querySelector("#map-layer-visible");
    visibilityInput.checked = false;
    document.querySelector("#map-preview").dispatchEvent({type: "change", target: visibilityInput});
    assert.strictEqual(renderedLayer.getAttribute("opacity"), "0");
    assert.strictEqual(renderedLayer.getAttribute("data-visible"), "false");

    window.location.hash = "#dl_adminunits_bcts";
    window.dispatchEvent({type: "hashchange"});
    const linkedDetail = document.querySelector("#record-detail").textContent;
    assert.strictEqual(document.querySelector("#detail-status").textContent, "dl_adminunits_bcts");
    assert(linkedDetail.includes("BCTS Operating Areas"));

    window.location.hash = "#map=vl_virtualspecies_bulltroutsalvelinusconfluentus_1135";
    window.dispatchEvent({type: "hashchange"});
    await settleAsyncRender();
    assert.strictEqual(
      document.querySelector("#map-status").textContent,
      "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135"
    );
    const virtualMap = document.querySelector("#map-preview").textContent;
    assert(virtualMap.includes("Bull Trout (Salvelinus confluentus)"));
    assert(virtualMap.includes("Rendered source preview"));
    assert(virtualMap.includes("layers/vl_virtualspecies_bulltroutsalvelinusconfluentus_1135/preview.png"));

    window.location.hash = "#map=dl_pinebeetle_pinekill1999";
    window.dispatchEvent({type: "hashchange"});
    await settleAsyncRender();
    assert.strictEqual(document.querySelector("#map-status").textContent, "Preview unavailable");
    const unavailableMap = document.querySelector("#map-preview").textContent;
    assert(unavailableMap.includes("% Pne Killed, 1999"));
    assert(unavailableMap.includes("not_previewable"));
    assert(unavailableMap.includes("not_previewable_empty_preview"));

    window.location.hash = "#map=missing-dataset-id";
    window.dispatchEvent({type: "hashchange"});
    await settleAsyncRender();
    assert.strictEqual(document.querySelector("#map-status").textContent, "Record not found");
    assert(document.querySelector("#map-preview").textContent.includes("missing-dataset-id"));

    console.log(`validated browser app DOM smoke flow: ${catalogPath}`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
});

async function settleAsyncRender() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

function findDescendant(root, predicate) {
  for (const child of root.children) {
    if (predicate(child)) {
      return child;
    }
    if (child.children) {
      const found = findDescendant(child, predicate);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, "");
}

function hasClass(node, className) {
  return String(node.className || "")
    .split(/\s+/)
    .filter(Boolean)
    .includes(className);
}

function jsonPayloadForUrl(url) {
  if (url === "data/catalog.json") {
    return catalog;
  }
  if (url === `${publishedPreviewRoot}/index.json`) {
    return previewIndex;
  }
  if (url === "data/map_previews/manifest.json") {
    return localPreviewManifest;
  }
  if (url.startsWith(`${publishedPreviewRoot}/layers/`) && url.endsWith("/manifest.json")) {
    const datasetId = path.basename(path.dirname(url));
    return manifestForDataset(datasetId);
  }
  return undefined;
}

function manifestForDataset(datasetId) {
  const manifestPath = path.join(
    repoRoot,
    "external",
    "fresh-hectaresbc-data",
    "derived",
    "web_map_previews",
    "v1",
    "layers",
    datasetId,
    "manifest.json"
  );
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}
