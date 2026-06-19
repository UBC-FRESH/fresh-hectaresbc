(function initCatalogBrowser(globalScope) {
  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function flattenValue(value) {
    if (value === null || value === undefined) {
      return "";
    }
    if (Array.isArray(value)) {
      return value.map(flattenValue).join(" ");
    }
    if (typeof value === "object") {
      return Object.values(value).map(flattenValue).join(" ");
    }
    return String(value);
  }

  function searchableText(record) {
    return normalizeText(
      [
        record.dataset_id,
        record.source_family,
        record.title,
        record.source_zip_path,
        record.source_filename,
        record.source_stem,
        flattenValue(record.metadata),
      ].join(" ")
    );
  }

  function filterRecords(records, state) {
    const query = normalizeText(state.query);
    const family = state.family || "all";

    return records.filter((record) => {
      if (family !== "all" && record.source_family !== family) {
        return false;
      }
      if (query && !searchableText(record).includes(query)) {
        return false;
      }
      return true;
    });
  }

  function sortRecords(records, sortKey) {
    const sorted = [...records];
    const key = sortKey || "title";

    sorted.sort((left, right) => {
      if (key === "size_desc") {
        return (
          (right.manifest_size_bytes || -1) - (left.manifest_size_bytes || -1) ||
          compareText(left.title, right.title)
        );
      }
      if (key === "family") {
        return (
          compareText(left.source_family, right.source_family) ||
          compareText(left.title, right.title) ||
          compareText(left.dataset_id, right.dataset_id)
        );
      }
      if (key === "dataset_id") {
        return compareText(left.dataset_id, right.dataset_id);
      }
      return (
        compareText(left.title, right.title) ||
        compareText(left.dataset_id, right.dataset_id)
      );
    });

    return sorted;
  }

  function compareText(left, right) {
    return String(left || "").localeCompare(String(right || ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }

  function limitRecords(records, pageSize) {
    if (pageSize === "all") {
      return records;
    }
    const limit = Number.parseInt(pageSize, 10);
    return records.slice(0, Number.isFinite(limit) ? limit : 50);
  }

  function findRecord(records, datasetId) {
    const normalizedId = String(datasetId || "").trim();
    if (!normalizedId) {
      return null;
    }
    return records.find((record) => record.dataset_id === normalizedId) || null;
  }

  function formatBytes(value) {
    if (!Number.isFinite(value) || value < 0) {
      return "unknown";
    }
    if (value < 1024) {
      return `${value} B`;
    }
    const units = ["KB", "MB", "GB", "TB"];
    let size = value / 1024;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
  }

  function previewLabel(record) {
    const preview = record.preview || {};
    if (preview.has_raster && preview.has_wms) {
      return "TIFF + WMS";
    }
    if (preview.has_raster) {
      return "TIFF";
    }
    if (preview.has_wms) {
      return "WMS";
    }
    return "none";
  }

  const api = {
    filterRecords,
    sortRecords,
    limitRecords,
    findRecord,
    formatBytes,
    previewLabel,
  };

  globalScope.CatalogBrowser = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
