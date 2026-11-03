#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const catalogPath = process.argv[2] || path.join("web", "data", "catalog.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const indexPath = path.join(path.dirname(catalogPath), "catalog.index.json");
const index = fs.existsSync(indexPath)
  ? JSON.parse(fs.readFileSync(indexPath, "utf8"))
  : { records: catalog.records };
const browser = require(path.join("..", "web", "catalog.js"));

const records = catalog.records;
const dataLayerDetail = browser.findRecord(records, "dl_adminunits_bcts");
const previewCandidate = browser.findRecord(records, "dl_adminunits_bcts");
const virtualLayerDetail = browser.findRecord(
  records,
  "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135"
);

assert.strictEqual(catalog.record_count, 2183);
assert.strictEqual(index.record_count, 2183);
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
  preview: "all",
  verification: "all",
  size: "all",
});
assert.strictEqual(
  bullTrout[0].dataset_id,
  "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135"
);

const dataLayers = browser.filterRecords(records, {
  query: "",
  family: "data_layer",
  preview: "all",
  verification: "all",
  size: "all",
});
assert.strictEqual(dataLayers.length, 418);

const adminLayers = browser.filterRecords(records, {
  query: "administrative units",
  family: "data_layer",
  preview: "all",
  verification: "all",
  size: "all",
});
assert(adminLayers.some((record) => record.dataset_id === "dl_adminunits_bcts"));

const sorted = browser.sortRecords(dataLayers, "dataset_id");
assert.strictEqual(sorted[0].dataset_id, "dl_adminunits_bcts");

const limited = browser.limitRecords(records, "25");
assert.strictEqual(limited.length, 25);

const page = browser.paginate(records, 2, 25);
assert.strictEqual(page.page, 2);
assert.strictEqual(page.items.length, 25);
assert.strictEqual(page.totalPages, Math.ceil(2183 / 25));

assert.strictEqual(browser.findRecord(records, "missing-dataset-id"), null);
assert.strictEqual(browser.previewLabel(dataLayerDetail), "TIFF + WMS");
assert.strictEqual(browser.previewLabel(virtualLayerDetail), "TIFF");

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

// Browse index and routes.
const indexRow = index.records.find(
  (record) => record.dataset_id === "dl_adminunits_bcts"
);
assert(indexRow);
assert.strictEqual(indexRow.format_label, "TIFF + WMS");
assert(indexRow.search_text.includes("bcts operating areas"));
assert(!("metadata" in indexRow));
assert(!("provenance" in indexRow));

const route = browser.parseRoute(
  "#/catalog?q=bull+trout&family=virtual_layer&preview=available&verify=metadata_recovered&size=medium&sort=title&page=2&rows=25"
);
assert.strictEqual(route.view, "catalog");
assert.strictEqual(route.query, "bull trout");
assert.strictEqual(route.family, "virtual_layer");
assert.strictEqual(route.preview, "available");
assert.strictEqual(route.verification, "metadata_recovered");
assert.strictEqual(route.size, "medium");
assert.strictEqual(route.sort, "title");
assert.strictEqual(route.page, 2);
assert.strictEqual(route.pageSize, 25);

const rebuilt = browser.parseRoute(browser.buildRoute(route));
assert.deepStrictEqual(rebuilt, route);

const malformed = browser.parseRoute(
  "#/catalog?family=bogus&preview=bogus&verify=bogus&size=bogus&sort=bogus&page=-2&rows=999"
);
assert.strictEqual(malformed.family, "all");
assert.strictEqual(malformed.preview, "all");
assert.strictEqual(malformed.verification, "all");
assert.strictEqual(malformed.size, "all");
assert.strictEqual(malformed.sort, "relevance");
assert.strictEqual(malformed.page, 1);
assert.strictEqual(malformed.pageSize, 50);

const mapRoute = browser.parseRoute("#/map");
assert.strictEqual(mapRoute.view, "map");
assert.strictEqual(mapRoute.map, true);
assert.strictEqual(mapRoute.datasetId, null);
assert.strictEqual(browser.buildRoute(mapRoute), "#/map");

const seriesRoute = browser.parseRoute(
  "#/series?layers=dl_adminunits_bcts,vl_virtualspecies_bulltroutsalvelinusconfluentus_1135&speed=500"
);
assert.strictEqual(seriesRoute.view, "series");
assert.deepStrictEqual(seriesRoute.seriesLayers, [
  "dl_adminunits_bcts",
  "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135",
]);
assert.strictEqual(seriesRoute.seriesSpeed, 500);
assert.strictEqual(
  browser.buildRoute(seriesRoute),
  "#/series?layers=dl_adminunits_bcts%2Cvl_virtualspecies_bulltroutsalvelinusconfluentus_1135&speed=500"
);
const malformedSeriesSpeed = browser.parseRoute(
  "#/series?layers=dl_adminunits_bcts&speed=bogus"
);
assert.strictEqual(malformedSeriesSpeed.seriesSpeed, 1000);

const legacyDetail = browser.parseRoute("#dl_adminunits_bcts");
assert.strictEqual(legacyDetail.view, "dataset");
assert.strictEqual(legacyDetail.datasetId, "dl_adminunits_bcts");
assert.strictEqual(browser.buildRoute(legacyDetail), "#/dataset/dl_adminunits_bcts");

const legacyMap = browser.parseRoute("#map=dl_adminunits_bcts");
assert.strictEqual(legacyMap.view, "dataset");
assert.strictEqual(legacyMap.map, true);
assert.strictEqual(
  browser.buildRoute(legacyMap),
  "#/dataset/dl_adminunits_bcts/map"
);

// Preview status and facets with a representative preview index.
const previewIndex = new Map([
  [
    "dl_adminunits_bcts",
    {
      dataset_id: "dl_adminunits_bcts",
      artifact_status: "source_derived_preview",
      artifact_path: "dl_adminunits_bcts/preview.png",
    },
  ],
  [
    "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135",
    {
      dataset_id: "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135",
      artifact_status: "not_previewable",
    },
  ],
]);
assert.strictEqual(
  browser.previewStatus(
    browser.findRecord(index.records, "dl_adminunits_bcts"),
    previewIndex
  ).status,
  "available"
);
assert.strictEqual(
  browser.previewStatus(
    browser.findRecord(
      index.records,
      "vl_virtualspecies_bulltroutsalvelinusconfluentus_1135"
    ),
    previewIndex
  ).status,
  "not_previewable"
);

const state = {
  query: "",
  family: "all",
  preview: "all",
  verification: "all",
  size: "all",
};
const previewOnly = browser.filterRecords(
  index.records,
  { ...state, preview: "available" },
  previewIndex
);
assert.strictEqual(previewOnly.length, 1);
assert.strictEqual(previewOnly[0].dataset_id, "dl_adminunits_bcts");

const facets = browser.computeFacets(index.records, state, previewIndex);
assert.strictEqual(
  facets.preview.find((item) => item.value === "available").count,
  1
);
assert.strictEqual(
  facets.preview.find((item) => item.value === "not_previewable").count,
  1
);
assert.strictEqual(facets.family.find((item) => item.value === "data_layer").count, 418);
assert.strictEqual(
  facets.verification.find((item) => item.value === "conflict_detected").count,
  12
);
assert.strictEqual(facets.size.find((item) => item.value === "small").count, 49);

assert(browser.formatDate("2026-11-02T08:35:00+00:00").length > 0);
assert.strictEqual(browser.formatBytes(1092878), "1.0 MB");

console.log(`validated web catalog UI logic: ${catalogPath}`);
