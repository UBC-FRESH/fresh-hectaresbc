#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const catalogPath = process.argv[2] || path.join("web", "data", "catalog.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const browser = require(path.join("..", "web", "catalog.js"));

const records = catalog.records;

assert.strictEqual(catalog.record_count, 2183);

const bullTrout = browser.filterRecords(records, {
  query: "bull trout",
  family: "all",
});
assert.strictEqual(
  bullTrout[0].dataset_id,
  "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135"
);

const dataLayers = browser.filterRecords(records, {
  query: "",
  family: "data_layer",
});
assert.strictEqual(dataLayers.length, 418);

const adminLayers = browser.filterRecords(records, {
  query: "administrative units",
  family: "data_layer",
});
assert(adminLayers.some((record) => record.dataset_id === "dl_adminunits_bcts"));

const sorted = browser.sortRecords(dataLayers, "dataset_id");
assert.strictEqual(sorted[0].dataset_id, "dl_adminunits_bcts");

const limited = browser.limitRecords(records, "25");
assert.strictEqual(limited.length, 25);

assert.strictEqual(browser.previewLabel(records.find((record) => record.dataset_id === "dl_adminunits_bcts")), "TIFF + WMS");
assert.strictEqual(
  browser.previewLabel(
    records.find(
      (record) =>
        record.dataset_id === "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135"
    )
  ),
  "TIFF"
);

console.log(`validated web catalog UI logic: ${catalogPath}`);
