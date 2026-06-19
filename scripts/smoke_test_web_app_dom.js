#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const repoRoot = path.join(__dirname, "..");
const catalogPath = process.argv[2] || path.join(repoRoot, "web", "data", "catalog.json");
const previewManifestPath =
  process.argv[3] || path.join(repoRoot, "web", "data", "map_previews", "manifest.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const previewManifest = JSON.parse(fs.readFileSync(previewManifestPath, "utf8"));
const previewGeoJsonPath = path.join(
  path.dirname(previewManifestPath),
  "dl_water_cwb_canals",
  "preview.geojson"
);
const previewGeoJson = JSON.parse(fs.readFileSync(previewGeoJsonPath, "utf8"));
previewManifest.artifacts.push({
  ...previewManifest.artifacts[0],
  dataset_id: "dl_adminunits_bcts",
  title: "BCTS Operating Areas",
  artifact_path: "missing/preview.geojson",
});

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
    this.className = "";
    this.dataset = {};
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
    assert(
      [
        "data/catalog.json",
        "data/map_previews/manifest.json",
        "data/map_previews/dl_water_cwb_canals/preview.geojson",
        "data/map_previews/missing/preview.geojson",
      ].includes(url)
    );
    if (url === "data/map_previews/missing/preview.geojson") {
      return {
        ok: false,
        status: 404,
        async json() {
          throw new Error("missing preview artifact");
        },
      };
    }
    return {
      ok: true,
      async json() {
        if (url === "data/map_previews/manifest.json") {
          return previewManifest;
        }
        if (url === "data/map_previews/dl_water_cwb_canals/preview.geojson") {
          return previewGeoJson;
        }
        return catalog;
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

    window.location.hash = "#map=dl_water_cwb_canals";
    window.dispatchEvent({type: "hashchange"});
    await settleAsyncRender();
    assert.strictEqual(document.querySelector("#map-status").textContent, "dl_water_cwb_canals");
    const availableMap = document.querySelector("#map-preview").textContent;
    assert(availableMap.includes("Canals"));
    assert(availableMap.includes("Rendered preview artifact"));
    assert(availableMap.includes("dl_water_cwb_canals/preview.geojson"));
    assert(availableMap.includes("fixture_pending_source_derivation"));
    assert(availableMap.includes("Feature count1"));
    assert(availableMap.includes("Layer controls"));
    assert(availableMap.includes("Preview eligibilitycandidate_missing_crs"));
    assert(availableMap.includes("Preview blockersmissing_crs, missing_extent"));
    assert(availableMap.includes("not recovered HectaresBC canal geometry"));
    const renderedLayer = document.querySelector("#map-preview").querySelector(".map-geojson-layer");
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

    window.location.hash = "#dl_water_cwb_canals";
    window.dispatchEvent({type: "hashchange"});
    const linkedDetail = document.querySelector("#record-detail").textContent;
    assert.strictEqual(document.querySelector("#detail-status").textContent, "dl_water_cwb_canals");
    assert(linkedDetail.includes("Canals"));

    window.location.hash = "#map=vl_virtualspecies_bulltroutsalvelinusconfluentus_1135";
    window.dispatchEvent({type: "hashchange"});
    await settleAsyncRender();
    assert.strictEqual(document.querySelector("#map-status").textContent, "Preview unavailable");
    const unavailableMap = document.querySelector("#map-preview").textContent;
    assert(unavailableMap.includes("Bull Trout (Salvelinus confluentus)"));
    assert(unavailableMap.includes("not_supported"));
    assert(unavailableMap.includes("unsupported_family"));

    window.location.hash = "#map=dl_adminunits_bcts";
    window.dispatchEvent({type: "hashchange"});
    await settleAsyncRender();
    assert.strictEqual(document.querySelector("#map-status").textContent, "Preview artifact missing");
    const missingArtifactMap = document.querySelector("#map-preview").textContent;
    assert(missingArtifactMap.includes("Preview artifact could not be loaded."));
    assert(missingArtifactMap.includes("Preview artifact request failed with 404"));

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
