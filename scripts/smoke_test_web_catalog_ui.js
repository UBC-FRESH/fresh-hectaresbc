#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const catalogPath = process.argv[2] || path.join("web", "data", "catalog.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const browser = require(path.join("..", "web", "catalog.js"));

const records = catalog.records;
const dataLayerDetail = browser.findRecord(records, "dl_adminunits_bcts");
const previewCandidate = browser.findRecord(records, "dl_adminunits_bcts");
const virtualLayerDetail = browser.findRecord(
  records,
  "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135"
);

assert.strictEqual(catalog.record_count, 2183);
assert.deepStrictEqual(catalog.preview_eligibility_counts, {
  candidate_missing_crs: 418,
  not_supported: 1765,
});
assert.deepStrictEqual(catalog.representative_preview_records, {
  data_layer_candidate: "dl_adminunits_bcts",
  unavailable_record: "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135",
});
assert(dataLayerDetail);
assert(previewCandidate);
assert(virtualLayerDetail);

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

assert.strictEqual(browser.findRecord(records, "missing-dataset-id"), null);
assert.strictEqual(browser.previewLabel(dataLayerDetail), "TIFF + WMS");
assert.strictEqual(
  browser.previewLabel(virtualLayerDetail),
  "TIFF"
);

assert.strictEqual(dataLayerDetail.source_zip_path, "data_layers/adminunits_bcts.zip");
assert.strictEqual(dataLayerDetail.verification_status, "metadata_recovered");
assert.strictEqual(dataLayerDetail.metadata.parent_layer_title, "Administrative Units and Tenures");
assert.strictEqual(dataLayerDetail.provenance.zip_read_status, "ok");
assert(
  dataLayerDetail.uncertainty_notes.some((note) =>
    note.includes("CRS and spatial extent")
  )
);

assert.strictEqual(previewCandidate.title, "BCTS Operating Areas");
assert.strictEqual(previewCandidate.source_zip_path, "data_layers/adminunits_bcts.zip");
assert.strictEqual(previewCandidate.preview.eligibility_status, "candidate_missing_crs");
assert.deepStrictEqual(previewCandidate.preview.eligibility_blockers, [
  "missing_crs",
  "missing_extent",
]);
assert.strictEqual(previewCandidate.preview.has_crs_metadata, false);
assert.strictEqual(previewCandidate.preview.has_extent_metadata, false);

assert.strictEqual(
  virtualLayerDetail.source_zip_path,
  "virtual_layers/virtualspecies.bulltroutsalvelinusconfluentus.1135.zip"
);
assert.strictEqual(virtualLayerDetail.preview.eligibility_status, "not_supported");
assert.deepStrictEqual(virtualLayerDetail.preview.eligibility_blockers, [
  "unsupported_family",
]);
assert.strictEqual(
  virtualLayerDetail.metadata.layer_name,
  "Bull Trout (Salvelinus confluentus)"
);
assert.strictEqual(
  virtualLayerDetail.provenance.root_metadata_source,
  "rescued_archive/virtual_layers_metadata_all.csv:virtualspecies.bulltroutsalvelinusconfluentus.1135.zip"
);
assert(
  virtualLayerDetail.uncertainty_notes.some((note) =>
    note.includes("Source query")
  )
);

console.log(`validated web catalog UI logic: ${catalogPath}`);
