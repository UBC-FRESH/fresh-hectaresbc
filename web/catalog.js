(function initCatalogBrowser(globalScope) {
  const FAMILY_LABELS = {
    data_layer: "Data layer",
    virtual_layer: "Virtual layer",
  };

  const VERIFICATION_LABELS = {
    metadata_recovered: "Metadata recovered",
    conflict_detected: "Conflict detected",
  };

  const PREVIEW_LABELS = {
    available: "Preview ready",
    not_previewable: "Not previewable",
    unavailable: "Preview unavailable",
    missing: "No preview",
    unknown: "Preview unknown",
  };

  const ELIGIBILITY_LABELS = {
    candidate_missing_crs: "Preview candidate — CRS not recovered",
    candidate_missing_extent: "Preview candidate — extent not recovered",
    metadata_only: "Raster metadata only",
    not_supported: "Preview not supported",
    preview_ready: "Preview metadata complete",
  };

  const SIZE_BUCKETS = [
    { value: "small", label: "Under 1 MB", max: 1_000_000 },
    { value: "medium", label: "1–10 MB", max: 10_000_000 },
    { value: "large", label: "10–100 MB", max: 100_000_000 },
    { value: "xlarge", label: "Over 100 MB", max: Infinity },
  ];

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
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

  function recordSearchText(record) {
    if (record.search_text) {
      return record.search_text;
    }
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

  function titleLabel(record) {
    return record.title || record.source_stem || record.dataset_id || "Untitled layer";
  }

  function familyLabel(family) {
    return FAMILY_LABELS[family] || family || "Unknown family";
  }

  function verificationLabel(status) {
    return VERIFICATION_LABELS[status] || status || "Unknown verification";
  }

  function previewEligibilityLabel(status) {
    return ELIGIBILITY_LABELS[status] || status || "Unknown preview eligibility";
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
    return record.format_label || "Other";
  }

  function formatLabel(record) {
    return record.format_label || previewLabel(record);
  }

  function previewArtifact(record, previewIndex) {
    if (!previewIndex) {
      return null;
    }
    if (previewIndex instanceof Map) {
      return previewIndex.get(record.dataset_id) || null;
    }
    return previewIndex[record.dataset_id] || null;
  }

  function previewStatus(record, previewIndex) {
    if (!previewIndex) {
      return {
        status: "unknown",
        label: PREVIEW_LABELS.unknown,
        tone: "muted",
        artifact: null,
      };
    }
    const artifact = previewArtifact(record, previewIndex);
    if (!artifact) {
      return {
        status: "missing",
        label: PREVIEW_LABELS.missing,
        tone: "muted",
        artifact: null,
      };
    }
    const status = artifact.artifact_status || artifact.status || "unknown";
    if (status === "source_derived_preview" || status === "already_present") {
      return {
        status: "available",
        label: PREVIEW_LABELS.available,
        tone: "ok",
        artifact,
      };
    }
    if (status === "not_previewable") {
      return {
        status: "not_previewable",
        label: PREVIEW_LABELS.not_previewable,
        tone: "warn",
        artifact,
      };
    }
    return {
      status: "unavailable",
      label: PREVIEW_LABELS.unavailable,
      tone: "warn",
      artifact,
    };
  }

  function sizeBucket(value) {
    if (!Number.isFinite(value)) {
      return "unknown";
    }
    for (const bucket of SIZE_BUCKETS) {
      if (value < bucket.max) {
        return bucket.value;
      }
    }
    return "xlarge";
  }

  function sizeBucketLabel(value) {
    const bucket = SIZE_BUCKETS.find((item) => item.value === value);
    return bucket ? bucket.label : "Any size";
  }

  function hasConflict(record) {
    return record.verification_status === "conflict_detected";
  }

  function hasKnownGap(record) {
    return Boolean(record.has_known_gaps ?? (record.known_gaps || []).length);
  }

  function matchesFacet(record, state, facet, previewIndex) {
    if (facet !== "family" && state.family && state.family !== "all") {
      if (record.source_family !== state.family) {
        return false;
      }
    }
    if (facet !== "preview" && state.preview && state.preview !== "all") {
      if (previewStatus(record, previewIndex).status !== state.preview) {
        return false;
      }
    }
    if (
      facet !== "verification" &&
      state.verification &&
      state.verification !== "all"
    ) {
      if (record.verification_status !== state.verification) {
        return false;
      }
    }
    if (facet !== "size" && state.size && state.size !== "all") {
      if (sizeBucket(record.manifest_size_bytes) !== state.size) {
        return false;
      }
    }
    return true;
  }

  function queryTokens(query) {
    return normalizeText(query).split(" ").filter(Boolean);
  }

  function matchesQuery(record, tokens) {
    if (tokens.length === 0) {
      return true;
    }
    const text = recordSearchText(record);
    return tokens.every((token) => text.includes(token));
  }

  function searchScore(record, query) {
    const normalized = normalizeText(query);
    if (!normalized) {
      return 0;
    }
    const tokens = queryTokens(normalized);
    if (!matchesQuery(record, tokens)) {
      return 0;
    }

    const id = normalizeText(record.dataset_id);
    const title = normalizeText(record.title);
    const stem = normalizeText(record.source_stem);
    let score = 0;

    if (id === normalized) {
      score += 1200;
    } else if (id.startsWith(normalized)) {
      score += 700;
    } else if (id.includes(normalized)) {
      score += 260;
    }

    if (title === normalized) {
      score += 900;
    } else if (title.startsWith(normalized)) {
      score += 500;
    } else if (title.includes(normalized)) {
      score += 320;
    }

    if (stem === normalized) {
      score += 420;
    } else if (stem.includes(normalized)) {
      score += 150;
    }

    for (const token of tokens) {
      if (title.includes(token)) {
        score += 40;
      }
      if (id.includes(token)) {
        score += 30;
      }
    }
    return score;
  }

  function filterRecords(records, state, previewIndex) {
    const tokens = queryTokens(state.query);
    return records.filter(
      (record) =>
        matchesQuery(record, tokens) &&
        matchesFacet(record, state, "", previewIndex)
    );
  }

  function compareText(left, right) {
    return String(left || "").localeCompare(String(right || ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }

  function sortRecords(records, sortKey, query) {
    const sorted = [...records];
    const key = sortKey || "relevance";

    sorted.sort((left, right) => {
      if (key === "size_desc") {
        return (
          (right.manifest_size_bytes || -1) - (left.manifest_size_bytes || -1) ||
          compareText(left.title, right.title)
        );
      }
      if (key === "size_asc") {
        return (
          (left.manifest_size_bytes || Number.MAX_SAFE_INTEGER) -
            (right.manifest_size_bytes || Number.MAX_SAFE_INTEGER) ||
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
      if (key === "relevance" && query) {
        return (
          searchScore(right, query) - searchScore(left, query) ||
          compareText(left.title, right.title) ||
          compareText(left.dataset_id, right.dataset_id)
        );
      }
      return (
        compareText(left.title, right.title) ||
        compareText(left.dataset_id, right.dataset_id)
      );
    });

    return sorted;
  }

  function countFacet(records, state, facet, value, previewIndex) {
    return records.filter((record) => {
      if (!matchesFacet(record, state, facet, previewIndex)) {
        return false;
      }
      if (facet === "family") {
        return value === "all" || record.source_family === value;
      }
      if (facet === "preview") {
        return (
          value === "all" ||
          previewStatus(record, previewIndex).status === value
        );
      }
      if (facet === "verification") {
        return value === "all" || record.verification_status === value;
      }
      if (facet === "size") {
        return (
          value === "all" || sizeBucket(record.manifest_size_bytes) === value
        );
      }
      return true;
    }).length;
  }

  function computeFacets(records, state, previewIndex) {
    const facets = {
      family: [
        { value: "all", label: "All layers", count: 0 },
        { value: "data_layer", label: "Data layers", count: 0 },
        { value: "virtual_layer", label: "Virtual layers", count: 0 },
      ],
      preview: null,
      verification: [
        { value: "all", label: "Any verification", count: 0 },
        { value: "metadata_recovered", label: "Metadata recovered", count: 0 },
        { value: "conflict_detected", label: "Conflict detected", count: 0 },
      ],
      size: [
        { value: "all", label: "Any size", count: 0 },
        ...SIZE_BUCKETS.map((bucket) => ({
          value: bucket.value,
          label: bucket.label,
          count: 0,
        })),
      ],
    };

    for (const facet of ["family", "verification", "size"]) {
      for (const option of facets[facet]) {
        option.count = countFacet(records, state, facet, option.value, previewIndex);
      }
    }

    if (previewIndex) {
      facets.preview = [
        { value: "all", label: "Any preview", count: 0 },
        { value: "available", label: "Preview ready", count: 0 },
        { value: "not_previewable", label: "Not previewable", count: 0 },
        { value: "missing", label: "No preview", count: 0 },
      ];
      for (const option of facets.preview) {
        option.count = countFacet(records, state, "preview", option.value, previewIndex);
      }
    }

    return facets;
  }

  function paginate(records, page, pageSize) {
    const total = records.length;
    const size = pageSize === "all" ? total : Number.parseInt(pageSize, 10) || 50;
    const totalPages = size > 0 ? Math.max(1, Math.ceil(total / size)) : 1;
    const current = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const start = (current - 1) * size;
    return {
      items: records.slice(start, start + size),
      total,
      page: current,
      pageSize: size,
      totalPages,
      start: total === 0 ? 0 : start + 1,
      end: Math.min(start + size, total),
    };
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

  function formatDate(value) {
    if (!value) {
      return "unknown";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString();
  }

  function limitRecords(records, pageSize) {
    return paginate(records, 1, pageSize).items;
  }

  function findRecord(records, datasetId) {
    const normalizedId = String(datasetId || "").trim();
    if (!normalizedId) {
      return null;
    }
    return records.find((record) => record.dataset_id === normalizedId) || null;
  }

  function defaultState() {
    return {
      view: "catalog",
      datasetId: null,
      map: false,
      query: "",
      family: "all",
      preview: "all",
      verification: "all",
      size: "all",
      sort: "relevance",
      page: 1,
      pageSize: 50,
      layers: [],
      workspace: null,
      compareLeft: null,
      compareRight: null,
      compareMode: "split",
      seriesLayers: [],
      seriesSpeed: 1000,
    };
  }

  function firstValue(params, key, fallback) {
    const value = params.get(key);
    return value === null || value === "" ? fallback : value;
  }

  function safeDecode(value) {
    try {
      return decodeURIComponent(value);
    } catch (error) {
      return value;
    }
  }

  function oneOf(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
  }

  function parseLayerIds(params) {
    const raw = params.get("layers");
    if (!raw) {
      return [];
    }
    return [
      ...new Set(
        raw
          .split(",")
          .map((value) => safeDecode(value.trim()))
          .filter(Boolean)
      ),
    ].slice(0, 6);
  }

  function parseRoute(hash) {
    const state = defaultState();
    let raw = String(hash || "").replace(/^#/, "");
    if (!raw) {
      return state;
    }

    if (raw.startsWith("map=")) {
      state.view = "dataset";
      state.map = true;
      state.datasetId = safeDecode(raw.slice("map=".length));
      return state;
    }

    if (raw.startsWith("/")) {
      raw = raw.slice(1);
    }

    const [path, queryString = ""] = raw.split("?", 2);
    const params = new URLSearchParams(queryString);

    if (path === "dataset" || path.startsWith("dataset/")) {
      const parts = path.split("/").filter(Boolean);
      state.view = "dataset";
      state.datasetId = parts[1] ? safeDecode(parts[1]) : null;
      state.map = parts[2] === "map";
      if (state.map) {
        state.layers = parseLayerIds(params);
        state.workspace = params.get("w") || null;
      }
      return state;
    }

    if (path === "map") {
      state.view = "map";
      state.map = true;
      state.datasetId = params.get("id") || null;
      state.layers = parseLayerIds(params);
      state.workspace = params.get("w") || null;
      return state;
    }

    if (path === "bundles") {
      state.view = "bundles";
      return state;
    }

    if (path === "admin") {
      state.view = "admin";
      return state;
    }

    if (path === "series") {
      state.view = "series";
      state.seriesLayers = parseLayerIds(params);
      state.seriesSpeed = [500, 1000, 2000].includes(
        Number(params.get("speed"))
      )
        ? Number(params.get("speed"))
        : 1000;
      return state;
    }

    if (path === "compare") {
      state.view = "compare";
      state.compareLeft = params.get("left") || null;
      state.compareRight = params.get("right") || null;
      state.compareMode = ["wipe", "flicker"].includes(params.get("mode"))
        ? params.get("mode")
        : "split";
      return state;
    }

    if (path === "catalog" || path === "") {
      const rows = firstValue(params, "rows", "50");
      state.query = firstValue(params, "q", "");
      state.family = oneOf(
        firstValue(params, "family", "all"),
        ["all", "data_layer", "virtual_layer"],
        "all"
      );
      state.preview = oneOf(
        firstValue(params, "preview", "all"),
        ["all", "available", "not_previewable", "missing"],
        "all"
      );
      state.verification = oneOf(
        firstValue(params, "verify", "all"),
        ["all", "metadata_recovered", "conflict_detected"],
        "all"
      );
      state.size = oneOf(
        firstValue(params, "size", "all"),
        ["all", "small", "medium", "large", "xlarge"],
        "all"
      );
      state.sort = oneOf(
        firstValue(params, "sort", "relevance"),
        ["relevance", "title", "dataset_id", "family", "size_desc", "size_asc"],
        "relevance"
      );
      state.page = Math.max(
        1,
        Number.parseInt(firstValue(params, "page", "1"), 10) || 1
      );
      if (rows === "all") {
        state.pageSize = "all";
      } else {
        const parsed = Number.parseInt(rows, 10);
        state.pageSize = [25, 50, 100].includes(parsed) ? parsed : 50;
      }
      return state;
    }

    // Legacy #<dataset_id> route.
    state.view = "dataset";
    state.datasetId = safeDecode(path);
    return state;
  }

  function buildRoute(state) {
    const mapParams = new URLSearchParams();
    if (state.layers?.length) {
      mapParams.set("layers", state.layers.join(","));
    }
    if (state.workspace) {
      mapParams.set("w", state.workspace);
    }
    const mapQuery = mapParams.toString();
    if (state.view === "bundles") {
      return "#/bundles";
    }
    if (state.view === "admin") {
      return "#/admin";
    }
    if (state.view === "series") {
      const params = new URLSearchParams();
      if (state.seriesLayers?.length) {
        params.set("layers", state.seriesLayers.join(","));
      }
      if ([500, 1000, 2000].includes(Number(state.seriesSpeed))) {
        params.set("speed", String(state.seriesSpeed));
      }
      const query = params.toString();
      return `#/series${query ? `?${query}` : ""}`;
    }
    if (state.view === "compare") {
      const params = new URLSearchParams();
      if (state.compareLeft) params.set("left", state.compareLeft);
      if (state.compareRight) params.set("right", state.compareRight);
      if (state.compareMode === "wipe") params.set("mode", "wipe");
      if (state.compareMode === "flicker") params.set("mode", "flicker");
      const query = params.toString();
      return `#/compare${query ? `?${query}` : ""}`;
    }
    if (state.view === "dataset" && state.datasetId) {
      const suffix = state.map ? "/map" : "";
      const query = state.map && mapQuery ? `?${mapQuery}` : "";
      return `#/dataset/${encodeURIComponent(state.datasetId)}${suffix}${query}`;
    }

    if (state.view === "map") {
      if (state.datasetId) {
        const query = mapQuery ? `?${mapQuery}` : "";
        return `#/dataset/${encodeURIComponent(state.datasetId)}/map${query}`;
      }
      return mapQuery ? `#/map?${mapQuery}` : "#/map";
    }

    const params = new URLSearchParams();
    if (state.query) {
      params.set("q", state.query);
    }
    if (state.family && state.family !== "all") {
      params.set("family", state.family);
    }
    if (state.preview && state.preview !== "all") {
      params.set("preview", state.preview);
    }
    if (state.verification && state.verification !== "all") {
      params.set("verify", state.verification);
    }
    if (state.size && state.size !== "all") {
      params.set("size", state.size);
    }
    if (state.sort && state.sort !== "relevance") {
      params.set("sort", state.sort);
    }
    if (state.page && Number(state.page) > 1) {
      params.set("page", String(state.page));
    }
    if (state.pageSize && String(state.pageSize) !== "50") {
      params.set("rows", String(state.pageSize));
    }
    const query = params.toString();
    return `#/catalog${query ? `?${query}` : ""}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function highlightText(value, query) {
    const text = String(value ?? "");
    const tokens = queryTokens(query);
    if (tokens.length === 0) {
      return escapeHtml(text);
    }
    const escaped = escapeHtml(text);
    const pattern = tokens
      .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .filter(Boolean)
      .join("|");
    if (!pattern) {
      return escaped;
    }
    return escaped.replace(new RegExp(`(${pattern})`, "gi"), "<mark>$1</mark>");
  }

  function previewEligibilityTone(status) {
    if (status === "preview_ready") {
      return "ok";
    }
    if (status === "not_supported" || status === "metadata_only") {
      return "muted";
    }
    return "warn";
  }

  const api = {
    FAMILY_LABELS,
    VERIFICATION_LABELS,
    PREVIEW_LABELS,
    SIZE_BUCKETS,
    normalizeText,
    titleLabel,
    familyLabel,
    verificationLabel,
    previewEligibilityLabel,
    previewLabel,
    formatLabel,
    previewArtifact,
    previewStatus,
    previewEligibilityTone,
    sizeBucket,
    sizeBucketLabel,
    hasConflict,
    hasKnownGap,
    filterRecords,
    sortRecords,
    searchScore,
    computeFacets,
    paginate,
    limitRecords,
    formatBytes,
    formatDate,
    formatNumber,
    findRecord,
    defaultState,
    parseRoute,
    buildRoute,
    escapeHtml,
    highlightText,
  };

  globalScope.CatalogBrowser = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
