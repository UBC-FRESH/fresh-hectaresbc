(function initHectaresApp() {
  const Catalog = window.CatalogBrowser;
  const PublishedPreviewRoot =
    "../external/fresh-hectaresbc-data/derived/web_map_previews/v1";
  const LocalPreviewRoot = "data/map_previews";
  const NarrowInspectorQuery = "(max-width: 1080px)";
  const SeriesMax = 30;
  let compareOptionsCache = null;
  let seriesSequencesCache = null;

  const METADATA_LABELS = {
    parent_layer_title: "Parent layer",
    fixed_layer_name: "Layer name",
    fixed_grid_name: "Grid",
    description: "Description",
    coverage: "Coverage",
    creator: "Creator",
    publisher: "Publisher",
    rights: "Rights",
    units: "Units",
    lineage: "Lineage",
    license_or_use_constraints: "License / use constraints",
    crs: "CRS",
    spatial_extent: "Spatial extent",
    original_layer_id: "Original layer ID",
    hkey: "HKEY",
    layer_name: "Layer name",
    date_created: "Date created",
    source_table: "Source table",
    source_column: "Source column",
    priority: "Priority",
    element_subnational_id: "Element subnational ID",
    status_flags: "Status flags",
  };

  const PROVENANCE_LABELS = {
    manifest_row_source: "Manifest row",
    root_listing_source: "Root listing",
    root_metadata_source: "Root metadata",
    zip_metadata_source: "ZIP metadata",
    recovery_sources: "Recovery sources",
    recovery_method: "Recovery method",
    recovered_at: "Recovered at",
    zip_read_status: "ZIP read status",
    manifest_zip_status: "Manifest ZIP status",
    zip_metadata_read_status: "ZIP metadata status",
  };

  const SORT_OPTIONS = [
    { value: "relevance", label: "Relevance" },
    { value: "title", label: "Title" },
    { value: "dataset_id", label: "Dataset ID" },
    { value: "family", label: "Family" },
    { value: "size_desc", label: "Size (largest)" },
    { value: "size_asc", label: "Size (smallest)" },
  ];

  const state = {
    ready: false,
    loadingError: null,
    records: [],
    meta: null,
    details: null,
    detailsError: false,
    detailsPromise: null,
    previewIndex: null,
    previewMeta: null,
    previewKind: "loading",
    mapPreviewVersion: "",
    referenceLayers: [],
    route: Catalog.defaultState(),
    lastBrowseHash: "#/catalog",
    filtersReturnFocus: null,
    selectedId: null,
    browseScroll: 0,
    renderToken: 0,
    searchTimer: null,
    searchRaf: null,
    assistant: {
      enabled: false,
      available: false,
      session: null,
      busy: false,
    },
    serviceAvailable: false,
    mapHandle: null,
    tray: {
      ids: [],
      open: false,
    },
    history: {
      jobs: [],
      bundles: [],
      timer: null,
      loading: false,
    },
    workspaces: {
      items: [],
    },
    saved: {
      searches: [],
      favorites: [],
    },
    aois: {
      items: [],
    },
    discover: {
      open: false,
      source: "view",
      results: [],
      family: "all",
      query: "",
    },
    workspace: {
      applied: null,
      view: null,
      aoi: null,
      aoiApplied: false,
    },
    compareFlicker: {
      timer: null,
      paused: false,
      speed: 1000,
      activeLeft: true,
    },
    series: {
      timer: null,
      paused: false,
      speed: 1000,
      index: 0,
      count: 0,
      layers: [],
      sequences: [],
      mapReady: false,
      exporting: false,
      setFrame: null,
      setPaused: null,
    },
    preflight: {
      busy: false,
      result: null,
      error: false,
    },
    identify: {
      enabled: false,
      busy: false,
      datasetId: null,
      result: null,
    },
    clip: {
      open: false,
      datasetId: null,
      query: "timber supply area boundary",
      name: "",
      aoi: null,
      geometry: null,
      candidates: [],
      selected: new Set(),
      search: "",
      busy: false,
      jobId: null,
      job: null,
      progress: 0,
      pollTimer: null,
      message: "",
      error: false,
      areaHa: null,
      areaWithinLimit: null,
      areaPending: false,
      areaToken: 0,
      maxAreaHa: 10_000_000,
      maxLayers: 6,
      lastResult: null,
      recent: [],
    },
  };

  let els = null;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    syncHeaderHeight();
    window.addEventListener("resize", syncHeaderHeight);
    els = {
      status: document.querySelector("#status"),
      liveStatus: document.querySelector("#live-status"),
      previewStatus: document.querySelector("#preview-status"),
      searchForm: document.querySelector("#search-form"),
      searchInput: document.querySelector("#search-input"),
      tabBrowse: document.querySelector("#tab-browse"),
      tabTours: document.querySelector("#tab-tours"),
      tabMap: document.querySelector("#tab-map"),
      tabBundles: document.querySelector("#tab-bundles"),
      tabAdmin: document.querySelector("#tab-admin"),
      filterRail: document.querySelector("#filter-rail"),
      facets: document.querySelector("#facets"),
      previewNote: document.querySelector("#preview-note"),
      savedBrowse: document.querySelector("#saved-browse"),
      clearFilters: document.querySelector("#clear-filters"),
      content: document.querySelector("#content"),
      inspector: document.querySelector("#inspector"),
      sheetBackdrop: document.querySelector("#sheet-backdrop"),
      toast: document.querySelector("#toast"),
      helpButton: document.querySelector("#help-button"),
      helpDialog: document.querySelector("#help-dialog"),
      helpClose: document.querySelector("#help-close"),
      assistantButton: document.querySelector("#assistant-button"),
      assistantPanel: document.querySelector("#assistant-panel"),
      assistantModel: document.querySelector("#assistant-model"),
      assistantLog: document.querySelector("#assistant-log"),
      assistantQuick: document.querySelector("#assistant-quick"),
      assistantForm: document.querySelector("#assistant-form"),
      assistantInput: document.querySelector("#assistant-input"),
      assistantSend: document.querySelector("#assistant-send"),
      assistantStatus: document.querySelector("#assistant-status"),
      assistantNew: document.querySelector("#assistant-new"),
      assistantClose: document.querySelector("#assistant-close"),
      clipPanel: document.querySelector("#clip-panel"),
      clipBody: document.querySelector("#clip-body"),
      clipClose: document.querySelector("#clip-close"),
      trayButton: document.querySelector("#tray-button"),
      trayCount: document.querySelector("#tray-count"),
      trayPanel: document.querySelector("#tray-panel"),
      trayBody: document.querySelector("#tray-body"),
      trayClose: document.querySelector("#tray-close"),
      discoverPanel: document.querySelector("#discover-panel"),
      discoverBody: document.querySelector("#discover-body"),
      discoverClose: document.querySelector("#discover-close"),
    };
    bindEvents();
    loadTray();
    loadWorkspaces();
    loadAoiLibrary();
    loadSavedBrowse();
    const header = document.querySelector(".app-header");
    if (header && window.ResizeObserver) {
      new ResizeObserver(() => syncHeaderHeight()).observe(header);
    }
    renderLoading();
    loadCatalog();
    void loadAssistantInfo();
    void loadServiceInfo();
  }

  /* --------------------------------------------------------------- loading */

  async function loadCatalog() {
    state.loadingError = null;
    try {
      const [meta, index] = await Promise.all([
        fetchJson("data/catalog.meta.json"),
        fetchJson("data/catalog.index.json"),
      ]);
      if (index?.records?.length) {
        state.records = index.records;
        state.meta = meta || index;
      } else {
        const full = await fetchJson("data/catalog.json");
        if (!full?.records?.length) {
          throw new Error("The generated catalog could not be loaded.");
        }
        state.records = indexFromFullCatalog(full);
        state.meta = full;
      }
      state.ready = true;
      syncFromLocation();
      void loadPreviewIndex();
    } catch (error) {
      state.loadingError = error;
      renderLoadError(error);
    }
  }

  function indexFromFullCatalog(catalog) {
    return catalog.records.map((record) => ({
      dataset_id: record.dataset_id,
      title: Catalog.titleLabel(record),
      source_family: record.source_family,
      source_stem: record.source_stem,
      source_filename: record.source_filename,
      source_zip_path: record.source_zip_path,
      manifest_size_bytes: record.manifest_size_bytes,
      verification_status: record.verification_status,
      has_known_gaps: Boolean((record.known_gaps || []).length),
      has_uncertainty: Boolean((record.uncertainty_notes || []).length),
      format_label: Catalog.formatLabel(record),
      preview_eligibility_status: record.preview?.eligibility_status || "unknown",
      preview_eligibility_blockers: record.preview?.eligibility_blockers || [],
      search_text: Catalog.normalizeText(
        [
          record.dataset_id,
          record.title,
          record.source_family,
          record.source_stem,
          record.source_filename,
          record.source_zip_path,
          flatten(record.metadata),
        ].join(" ")
      ),
    }));
  }

  async function loadDetails() {
    if (state.details) {
      return state.details;
    }
    if (state.detailsPromise) {
      return state.detailsPromise;
    }
    state.detailsPromise = (async () => {
      const document = await fetchJson("data/catalog.details.json");
      if (document?.records) {
        state.details = new Map(Object.entries(document.records));
        state.detailsError = false;
      } else {
        state.detailsError = true;
      }
      return state.details;
    })();
    try {
      return await state.detailsPromise;
    } finally {
      state.detailsPromise = null;
    }
  }

  async function loadPreviewIndex() {
    const [published, local, highres, mercator] = await Promise.all([
      fetchJson(`${PublishedPreviewRoot}/index.json`),
      fetchJson(`${LocalPreviewRoot}/manifest.json`),
      fetchJson("data/map_previews_highres/v1/index.json"),
      fetchJson("data/map_previews_3857/index.json"),
    ]);
    const manifest = published || local || highres;
    if (!manifest) {
      state.previewKind = "unavailable";
      state.previewIndex = null;
      state.previewMeta = null;
      state.referenceLayers = [];
      updateHeader();
      if (state.ready) {
        renderCurrent();
      }
      return;
    }

    const manifestKind = published ? "published" : local ? "local" : "highres";
    const base = published
      ? PublishedPreviewRoot
      : local
        ? LocalPreviewRoot
        : "data/map_previews_highres/v1";
    const layers = manifest.layers || manifest.artifacts || [];
    const references = manifest.reference_layers || [];
    state.previewKind = manifestKind;
    state.previewIndex = new Map(
      layers.map((layer) => [
        layer.dataset_id,
        { ...layer, _base: base, _source: manifestKind },
      ])
    );

    // Local 2048-pixel previews override the published 256-pixel images when
    // they exist. A failed high-resolution generation never hides a published
    // preview: only usable high-resolution artifacts are merged.
    let highresCount = 0;
    for (const layer of highres?.layers || []) {
      const status = layer.artifact_status || layer.status;
      if (
        !["source_derived_preview", "already_present"].includes(status) ||
        !layer.artifact_path
      ) {
        continue;
      }
      state.previewIndex.set(layer.dataset_id, {
        ...layer,
        _base: "data/map_previews_highres/v1",
        _source: "highres",
      });
      highresCount += 1;
    }

    // Map overlays are reprojected to EPSG:3857 so they align with the
    // OpenStreetMap/Web-Mercator basemap. Native previews remain the
    // thumbnails; only the map route swaps to the reprojected image.
    let mercatorCount = 0;
    for (const layer of mercator?.layers || []) {
      if (!layer.map_path || !layer.map_bounds_wgs84) {
        continue;
      }
      const current = state.previewIndex.get(layer.dataset_id);
      if (!current) {
        continue;
      }
      current._map_path = layer.map_path;
      current._map_base = "data/map_previews_3857";
      current._map_bounds_wgs84 = layer.map_bounds_wgs84;
      current._map_crs = layer.map_crs || "EPSG:3857";
      current._map_width = layer.map_width;
      current._map_height = layer.map_height;
      current._map_source = layer.source || "mercator";
      if (Array.isArray(layer.value_classes) && layer.value_classes.length) {
        current.value_classes = layer.value_classes;
      }
      mercatorCount += 1;
    }
    state.mapPreviewVersion = mercator?.generated_at || "";

    state.referenceLayers = references.map((layer) => ({
      ...layer,
      _base: base,
      _source: manifestKind,
    }));
    const available = [...state.previewIndex.values()].filter((layer) =>
      ["source_derived_preview", "already_present"].includes(
        layer.artifact_status || layer.status
      )
    ).length;
    state.previewMeta = {
      kind: manifestKind,
      generatedAt: manifest.generated_at,
      total: state.previewIndex.size,
      available,
      highresCount,
      mercatorCount,
      document: manifest,
    };
    updateHeader();
    renderTray();
    renderSavedBrowse();
    if (state.ready) {
      renderCurrent();
    }
  }

  async function loadArtifactDetails(artifact) {
    if (!artifact || artifact._detailed || !artifact.manifest_path) {
      return artifact;
    }
    const document = await fetchJson(artifactUrl(artifact, artifact.manifest_path));
    if (!document) {
      return artifact;
    }
    const merged = {
      ...artifact,
      ...document,
      _base: artifact._base,
      _source: artifact._source,
      _detailed: true,
    };
    state.previewIndex?.set(artifact.dataset_id, merged);
    return merged;
  }

  function fetchJson(path) {
    return fetch(path, { cache: "no-cache" })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
  }

  function flatten(value) {
    if (value === null || value === undefined) {
      return "";
    }
    if (Array.isArray(value)) {
      return value.map(flatten).join(" ");
    }
    if (typeof value === "object") {
      return Object.values(value).map(flatten).join(" ");
    }
    return String(value);
  }

  /* ---------------------------------------------------------------- routing */

  function syncFromLocation() {
    if (!state.ready) {
      return;
    }
    const route = Catalog.parseRoute(window.location.hash);
    const canonical = Catalog.buildRoute(route);
    if (window.location.hash !== canonical) {
      window.history.replaceState({}, "", canonical);
    }
    applyRoute(route);
  }

  function navigate(route, { replace = false } = {}) {
    const hash = Catalog.buildRoute(route);
    if (hash !== window.location.hash) {
      if (replace) {
        window.history.replaceState({}, "", hash);
      } else {
        window.history.pushState({}, "", hash);
      }
    }
    if (route.view === "catalog") {
      state.lastBrowseHash = hash;
    }
    applyRoute(route);
  }

  function applyRoute(route) {
    state.route = route;
    if (route.datasetId) {
      state.selectedId = route.datasetId;
    }
    if (route.view === "catalog") {
      state.lastBrowseHash = Catalog.buildRoute(route);
      renderBrowse();
      return;
    }
    if (route.view === "map" || route.map) {
      void renderMap();
    } else if (route.view === "tours") {
      void renderTours();
    } else if (route.view === "bundles") {
      void renderBundles();
    } else if (route.view === "admin") {
      void renderAdmin();
    } else if (route.view === "compare") {
      void renderCompare();
    } else if (route.view === "series") {
      void renderSeries();
    } else {
      void renderDataset();
    }
  }

  function renderCurrent() {
    if (!state.ready) {
      return;
    }
    applyRoute(state.route);
  }

  /* ----------------------------------------------------------------- browse */

  function renderBrowse() {
    stopHistoryPolling();
    clearCompareResize();
    closeDiscover();
    resetIdentifyState();
    window.HectaresBCMap?.destroy();
    closeClipPanel();
    document.body.dataset.view = "catalog";
    document.body.classList.remove("filters-open", "inspector-open");
    renderSavedBrowse();
    if (!state.ready) {
      renderLoading();
      return;
    }

    const route = state.route;
    state.lastBrowseHash = Catalog.buildRoute(route);
    const focusKey = document.activeElement?.dataset?.focusKey;
    const filtered = filteredRecords();
    const sorted = Catalog.sortRecords(filtered, route.sort, route.query);
    const page = Catalog.paginate(sorted, route.page, route.pageSize);
    const facets = Catalog.computeFacets(state.records, route, state.previewIndex);
    const scroll = state.browseScroll || 0;

    renderFacets(facets, route);
    els.content.innerHTML = browseTemplate(page, route, filtered.length);
    renderResults(page, route);
    renderInspector();
    updateHeader(page.total);
    updateTabs();
    if (els.liveStatus) {
      els.liveStatus.textContent = `${Catalog.formatNumber(page.total)} matching records. Showing ${page.start} to ${page.end}.`;
    }
    document.title =
      page.total === state.records.length
        ? "HectaresBC — Recovered Catalog"
        : `${Catalog.formatNumber(page.total)} matching layers · HectaresBC`;

    if (els.searchInput.value !== route.query) {
      els.searchInput.value = route.query;
    }
    els.content.scrollTop = scroll;
    if (focusKey) {
      document.querySelector(`[data-focus-key="${focusKey}"]`)?.focus();
    }
  }

  function filteredRecords() {
    if (!state.previewIndex && state.route.preview !== "all") {
      return [];
    }
    return Catalog.filterRecords(state.records, state.route, state.previewIndex);
  }

  function browseTemplate(page, route, filteredCount) {
    const noPreviewIndex = !state.previewIndex;
    const previewBlocked = noPreviewIndex && route.preview !== "all";
    const countText = previewBlocked
      ? "Preview filter unavailable"
      : page.total === state.records.length
        ? `${Catalog.formatNumber(page.total)} records · showing ${page.start}–${page.end}`
        : `${Catalog.formatNumber(page.total)} matching · showing ${page.start}–${page.end} of ${Catalog.formatNumber(state.records.length)}`;

    return `
      <div class="browse-view">
        <div class="result-toolbar">
          <p class="result-count" id="result-count">${countText}</p>
          <span class="toolbar-spacer"></span>
          <button class="filter-toggle" type="button" data-open-filters>Filters</button>
          <label class="toolbar-control sort-control">Sort
            <select id="sort-select" data-sort-select data-focus-key="sort" aria-label="Sort results">
              ${SORT_OPTIONS.map(
                (option) =>
                  `<option value="${option.value}" ${route.sort === option.value ? "selected" : ""}>${option.label}</option>`
              ).join("")}
            </select>
          </label>
          <label class="toolbar-control">Rows
            <select id="page-size-select" data-page-size data-focus-key="rows" aria-label="Rows per page">
              ${["25", "50", "100", "all"]
                .map(
                  (value) =>
                    `<option value="${value}" ${String(route.pageSize) === value ? "selected" : ""}>${value === "all" ? "All" : value}</option>`
                )
                .join("")}
            </select>
          </label>
        </div>
        <div class="active-filters" id="active-filters"></div>
        <div class="results${page.items.length ? "" : " is-empty"}" id="results">
          <div class="table-wrap" ${page.items.length ? "" : "hidden"}>
            <table class="result-table">
              <caption class="sr-only">Catalog results</caption>
              <thead>
                <tr>
                  <th scope="col" ${sortAria(route, "title")}><button type="button" data-sort="title">Title</button></th>
                  <th scope="col" class="col-family" ${sortAria(route, "family")}><button type="button" data-sort="family">Family</button></th>
                  <th scope="col" class="col-format">Format</th>
                  <th scope="col" class="col-size" ${sortAria(route, "size")}><button type="button" data-sort="size">Size</button></th>
                </tr>
              </thead>
              <tbody id="result-body"></tbody>
            </table>
          </div>
          <div class="result-cards" id="result-cards"></div>
          <div id="empty-state"></div>
        </div>
        <nav class="pagination" id="pagination" aria-label="Result pages"></nav>
      </div>
    `;
  }

  function sortAria(route, column) {
    if (column === "title" && route.sort === "title") {
      return 'aria-sort="ascending"';
    }
    if (column === "family" && route.sort === "family") {
      return 'aria-sort="ascending"';
    }
    if (column === "size" && route.sort === "size_desc") {
      return 'aria-sort="descending"';
    }
    if (column === "size" && route.sort === "size_asc") {
      return 'aria-sort="ascending"';
    }
    return 'aria-sort="none"';
  }

  function renderResults(page, route) {
    const body = document.querySelector("#result-body");
    const cards = document.querySelector("#result-cards");
    const empty = document.querySelector("#empty-state");
    const tableWrap = document.querySelector(".table-wrap");
    if (!body || !cards || !empty) {
      return;
    }

    const previewBlocked = !state.previewIndex && route.preview !== "all";
    if (page.items.length === 0) {
      if (tableWrap) {
        tableWrap.hidden = true;
      }
      cards.hidden = true;
      empty.innerHTML = emptyTemplate(previewBlocked, route);
    } else {
      if (tableWrap) {
        tableWrap.hidden = false;
      }
      cards.hidden = false;
      empty.innerHTML = "";
      body.innerHTML = page.items.map((record) => rowTemplate(record, route)).join("");
      cards.innerHTML = page.items
        .map((record) => cardTemplate(record, route))
        .join("");
    }

    document.querySelectorAll("img[data-thumb]").forEach((image) => {
      image.addEventListener(
        "error",
        () => {
          image.remove();
        },
        { once: true }
      );
    });

    renderPagination(page);
    renderActiveFilters(route);
  }

  function rowTemplate(record, route) {
    const preview = Catalog.previewStatus(record, state.previewIndex);
    const selected = state.selectedId === record.dataset_id ? " is-selected" : "";
    const href = `#/dataset/${encodeURIComponent(record.dataset_id)}`;
    return `
      <tr class="result-row${selected}" data-dataset-id="${Catalog.escapeHtml(record.dataset_id)}">
        <td>
          <div class="result-title-cell">
            ${thumbnailTemplate(record, preview)}
            <div class="result-title">
              <a href="${href}" data-result-link title="${Catalog.escapeHtml(Catalog.titleLabel(record))}">
                ${Catalog.highlightText(Catalog.titleLabel(record), route.query)}
              </a>
              <button class="tray-add" type="button" data-tray-add="${Catalog.escapeHtml(record.dataset_id)}" aria-label="Add ${Catalog.escapeHtml(Catalog.titleLabel(record))} to tray">+</button>
              <button class="favorite-toggle" type="button" data-favorite-toggle="${Catalog.escapeHtml(record.dataset_id)}" aria-pressed="${isFavorite(record.dataset_id) ? "true" : "false"}" aria-label="${isFavorite(record.dataset_id) ? "Remove" : "Add"} ${Catalog.escapeHtml(Catalog.titleLabel(record))} ${isFavorite(record.dataset_id) ? "from" : "to"} favorites">${isFavorite(record.dataset_id) ? "★" : "☆"}</button>
              <span class="result-subtitle">${Catalog.escapeHtml(record.dataset_id)}</span>
              <span class="result-badges">${badgesTemplate(record, preview)}</span>
            </div>
          </div>
        </td>
        <td>${Catalog.escapeHtml(Catalog.familyLabel(record.source_family))}</td>
        <td class="col-format">${Catalog.escapeHtml(Catalog.formatLabel(record))}</td>
        <td class="col-size">${Catalog.formatBytes(record.manifest_size_bytes)}</td>
      </tr>
    `;
  }

  function cardTemplate(record, route) {
    const preview = Catalog.previewStatus(record, state.previewIndex);
    const href = `#/dataset/${encodeURIComponent(record.dataset_id)}`;
    return `
      <div class="result-card-wrap">
        <a class="result-card" href="${href}" data-dataset-id="${Catalog.escapeHtml(record.dataset_id)}">
          <div class="result-card-head">
            ${thumbnailTemplate(record, preview)}
            <div style="min-width:0">
              <div class="result-card-title">${Catalog.highlightText(Catalog.titleLabel(record), route.query)}</div>
              <div class="result-subtitle">${Catalog.escapeHtml(record.dataset_id)}</div>
              <div class="result-badges">${badgesTemplate(record, preview)}</div>
            </div>
          </div>
          <div class="result-card-meta">
            <span>${Catalog.escapeHtml(Catalog.familyLabel(record.source_family))}</span>
            <span>${Catalog.escapeHtml(Catalog.formatLabel(record))}</span>
            <span>${Catalog.formatBytes(record.manifest_size_bytes)}</span>
          </div>
        </a>
        <button class="tray-add result-card-tray" type="button" data-tray-add="${Catalog.escapeHtml(record.dataset_id)}" aria-label="Add ${Catalog.escapeHtml(Catalog.titleLabel(record))} to tray">+</button>
        <button class="favorite-toggle result-card-favorite" type="button" data-favorite-toggle="${Catalog.escapeHtml(record.dataset_id)}" aria-pressed="${isFavorite(record.dataset_id) ? "true" : "false"}" aria-label="${isFavorite(record.dataset_id) ? "Remove" : "Add"} ${Catalog.escapeHtml(Catalog.titleLabel(record))} ${isFavorite(record.dataset_id) ? "from" : "to"} favorites">${isFavorite(record.dataset_id) ? "★" : "☆"}</button>
      </div>
    `;
  }

  function thumbnailTemplate(record, preview) {
    const artifact = preview.artifact;
    if (preview.status === "available" && artifact?.artifact_path) {
      const url = artifactUrl(artifact, artifact.artifact_path);
      if (url) {
        return `<span class="result-thumb"><img data-thumb loading="lazy" decoding="async" src="${Catalog.escapeHtml(url)}" alt=""></span>`;
      }
    }
    const abbreviation = record.source_family === "data_layer" ? "DL" : "VL";
    return `<span class="result-thumb" aria-hidden="true">${abbreviation}</span>`;
  }

  function badgesTemplate(record, preview) {
    const badges = [
      `<span class="badge badge-muted badge-family">${Catalog.escapeHtml(Catalog.familyLabel(record.source_family))}</span>`,
    ];
    const completeIndex =
      state.previewMeta && state.previewMeta.total >= state.records.length * 0.9;
    if (preview.status === "available") {
      badges.push('<span class="badge badge-ok">Preview ready</span>');
    } else if (preview.status === "not_previewable") {
      badges.push('<span class="badge badge-warn">Not previewable</span>');
    } else if (preview.status === "missing" && completeIndex) {
      badges.push('<span class="badge badge-muted">No preview</span>');
    }
    if (Catalog.hasConflict(record)) {
      badges.push('<span class="badge badge-danger badge-conflict">Conflict</span>');
    }
    if (Catalog.hasKnownGap(record)) {
      badges.push('<span class="badge badge-warn">Known gap</span>');
    }
    return badges.join("");
  }

  function emptyTemplate(previewBlocked, route) {
    if (previewBlocked) {
      return `
        <div class="empty-state">
          <h3>Preview index unavailable</h3>
          <p>The preview filter cannot be applied in this checkout because the published preview index is not reachable.</p>
          <button class="secondary-button" type="button" data-clear-facet="preview">Clear preview filter</button>
        </div>
      `;
    }
    const query = route.query ? ` for “${Catalog.escapeHtml(route.query)}”` : "";
    return `
      <div class="empty-state">
        <h3>No layers match${query}</h3>
        <p>Try a shorter search, clear a filter, or browse all recovered layers.</p>
        <button class="secondary-button" type="button" data-clear-all>Clear all filters</button>
      </div>
    `;
  }

  function renderPagination(page) {
    const node = document.querySelector("#pagination");
    if (!node) {
      return;
    }
    const items = paginationItems(page.page, page.totalPages);
    const buttons = items
      .map((item) => {
        if (item === "…") {
          return '<span class="page-ellipsis" aria-hidden="true">…</span>';
        }
        return `<button class="page-button" type="button" data-page="${item}" ${item === page.page ? 'aria-current="page"' : ""} aria-label="Page ${item}">${item}</button>`;
      })
      .join("");
    node.innerHTML = `
      <span class="pagination-info">Showing ${page.start}–${page.end} of ${Catalog.formatNumber(page.total)}</span>
      <div class="pagination-pages">
        <button class="page-button" type="button" data-page="${page.page - 1}" ${page.page <= 1 ? "disabled" : ""} aria-label="Previous page">‹</button>
        ${buttons}
        <button class="page-button" type="button" data-page="${page.page + 1}" ${page.page >= page.totalPages ? "disabled" : ""} aria-label="Next page">›</button>
      </div>
    `;
  }

  function paginationItems(current, total) {
    if (total <= 7) {
      return Array.from({ length: total }, (_, index) => index + 1);
    }
    const items = new Set([1, total, current - 1, current, current + 1]);
    if (current <= 3) {
      items.add(2);
      items.add(3);
      items.add(4);
    }
    if (current >= total - 2) {
      items.add(total - 1);
      items.add(total - 2);
      items.add(total - 3);
    }
    const sorted = [...items].filter((item) => item >= 1 && item <= total).sort((a, b) => a - b);
    const result = [];
    for (let index = 0; index < sorted.length; index += 1) {
      if (index > 0 && sorted[index] - sorted[index - 1] > 1) {
        result.push("…");
      }
      result.push(sorted[index]);
    }
    return result;
  }

  function renderActiveFilters(route) {
    const node = document.querySelector("#active-filters");
    if (!node) {
      return;
    }
    const chips = [];
    if (route.query) {
      chips.push(filterChip(`Search: “${Catalog.escapeHtml(route.query)}”`, "query"));
    }
    if (route.family && route.family !== "all") {
      chips.push(filterChip(Catalog.familyLabel(route.family), "family"));
    }
    if (route.preview && route.preview !== "all") {
      chips.push(filterChip(Catalog.PREVIEW_LABELS[route.preview] || route.preview, "preview"));
    }
    if (route.verification && route.verification !== "all") {
      chips.push(filterChip(Catalog.verificationLabel(route.verification), "verification"));
    }
    if (route.size && route.size !== "all") {
      chips.push(filterChip(`Size: ${Catalog.sizeBucketLabel(route.size)}`, "size"));
    }
    node.innerHTML = chips.join("");
  }

  function filterChip(label, facet) {
    return `<span class="filter-chip">${label}<button type="button" data-clear-facet="${facet}" aria-label="Remove ${Catalog.escapeHtml(label)} filter">×</button></span>`;
  }

  /* ---------------------------------------------------------------- facets */

  function renderFacets(facets, route) {
    const active = document.activeElement;
    const activeFacet = active?.dataset?.facet;
    const activeValue = active?.value;

    const groups = [
      facetGroup("family", "Family", facets.family, route.family),
    ];
    if (facets.preview) {
      groups.push(facetGroup("preview", "Preview", facets.preview, route.preview));
    }
    groups.push(
      facetGroup("verification", "Verification", facets.verification, route.verification),
      facetGroup("size", "Size", facets.size, route.size)
    );
    els.facets.innerHTML = groups.join("");

    if (state.previewIndex) {
      els.previewNote.hidden = true;
      els.previewNote.textContent = "";
    } else {
      els.previewNote.hidden = false;
      els.previewNote.textContent =
        state.previewKind === "unavailable"
          ? "Preview availability is unavailable in this checkout. Browse and metadata still work; preview filters and thumbnails appear when the published preview index is reachable."
          : "Loading preview availability…";
    }
    els.clearFilters.disabled = !hasActiveFilters(route);

    if (activeFacet) {
      const selector = `[data-facet="${activeFacet}"][value="${cssEscape(activeValue)}"]`;
      document.querySelector(selector)?.focus();
    }
  }

  function facetGroup(name, label, options, selected) {
    return `
      <section class="facet-group" aria-labelledby="facet-${name}">
        <h3 id="facet-${name}">${label}</h3>
        ${options
          .map((option) => {
            const checked = String(selected || "all") === String(option.value);
            const disabled = option.count === 0 && !checked;
            return `<label class="facet-option${disabled ? " is-disabled" : ""}">
              <input type="radio" name="${name}" value="${Catalog.escapeHtml(option.value)}" data-facet="${name}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}>
              <span class="facet-label">${Catalog.escapeHtml(option.label)}</span>
              <span class="facet-count">${Catalog.formatNumber(option.count)}</span>
            </label>`;
          })
          .join("")}
      </section>
    `;
  }

  function hasActiveFilters(route) {
    return Boolean(
      route.query ||
        (route.family && route.family !== "all") ||
        (route.preview && route.preview !== "all") ||
        (route.verification && route.verification !== "all") ||
        (route.size && route.size !== "all")
    );
  }

  function cssEscape(value) {
    if (window.CSS?.escape) {
      return window.CSS.escape(String(value));
    }
    return String(value).replace(/["\\]/g, "\\$&");
  }

  /* ------------------------------------------------------------- inspector */

  function renderInspector() {
    if (!state.selectedId) {
      els.inspector.hidden = false;
      els.inspector.innerHTML = `
        <div class="inspector-inner">
          <div class="inspector-empty">
            <div>
              <strong>Select a layer</strong>
              <p>Click a result to inspect its metadata, provenance, and preview status without leaving the catalog.</p>
            </div>
          </div>
        </div>
      `;
      return;
    }
    const record = getRecordSync(state.selectedId);
    if (!record) {
      els.inspector.hidden = true;
      els.inspector.innerHTML = "";
      return;
    }
    const preview = Catalog.previewStatus(record, state.previewIndex);
    els.inspector.hidden = false;
    els.inspector.innerHTML = inspectorTemplate(record, preview);
  }

  function inspectorTemplate(record, preview) {
    const href = `#/dataset/${encodeURIComponent(record.dataset_id)}`;
    return `
      <div class="inspector-inner">
        <div class="inspector-head">
          <div>
            <p class="inspector-eyebrow">${Catalog.escapeHtml(Catalog.familyLabel(record.source_family))}</p>
            <h2 class="inspector-title">${Catalog.escapeHtml(Catalog.titleLabel(record))}</h2>
            <p class="inspector-id"><span class="mono">${Catalog.escapeHtml(record.dataset_id)}</span></p>
          </div>
          <button class="icon-button inspector-close" type="button" data-close-inspector aria-label="Close inspector">×</button>
        </div>
        <div class="inspector-actions">
          <a class="primary-button" href="${href}">Open dataset</a>
          <a class="secondary-button" href="${href}/map" ${preview.status === "available" ? "" : 'title="Preview is not available for this layer"'}>Map</a>
          <button class="secondary-button" type="button" data-copy="${Catalog.escapeHtml(record.dataset_id)}">Copy ID</button>
        </div>
        <div class="inspector-section">
          <h3>At a glance</h3>
          ${definitionList([
            ["Family", Catalog.familyLabel(record.source_family)],
            ["Format", Catalog.formatLabel(record)],
            ["Size", Catalog.formatBytes(record.manifest_size_bytes)],
            ["Verification", Catalog.verificationLabel(record.verification_status)],
            ["Preview", preview.label],
          ])}
        </div>
        <div class="inspector-section">
          <h3>Preview</h3>
          <p class="muted">${Catalog.escapeHtml(previewExplanation(record, preview))}</p>
          ${previewBlockersTemplate(record, preview)}
        </div>
        <div class="inspector-section">
          <h3>Source</h3>
          ${definitionList([
            ["Source ZIP", record.source_zip_path],
            ["Source file", record.source_filename],
          ])}
        </div>
        <div class="inspector-section">
          <h3>Actions</h3>
          <div class="inspector-actions">
            <button class="secondary-button" type="button" data-download-json="${Catalog.escapeHtml(record.dataset_id)}">Download metadata</button>
          </div>
        </div>
      </div>
    `;
  }

  /* --------------------------------------------------------------- dataset */

  async function renderDataset() {
    const token = ++state.renderToken;
    stopHistoryPolling();
    clearCompareResize();
    closeDiscover();
    resetIdentifyState();
    window.HectaresBCMap?.destroy();
    closeClipPanel();
    document.body.dataset.view = "dataset";
    document.body.classList.remove("filters-open", "inspector-open");
    els.content.innerHTML = loadingTemplate("Loading dataset…");
    const datasetId = state.route.datasetId;
    await loadDetails();
    if (token !== state.renderToken) {
      return;
    }
    const record = getRecordSync(datasetId);
    if (!record) {
      els.content.innerHTML = notFoundTemplate(datasetId);
      document.title = "Dataset not found · HectaresBC";
      if (els.liveStatus) {
        els.liveStatus.textContent = "Dataset not found.";
      }
      updateTabs();
      return;
    }
    const artifact = await loadArtifactDetails(
      Catalog.previewArtifact(record, state.previewIndex)
    );
    if (token !== state.renderToken) {
      return;
    }
    const preview = Catalog.previewStatus(record, state.previewIndex);
    els.content.innerHTML = datasetTemplate(record, preview, artifact);
    updateHeader();
    updateTabs();
    if (els.liveStatus) {
      els.liveStatus.textContent = `Dataset details for ${Catalog.titleLabel(record)}.`;
    }
    document.title = `${Catalog.titleLabel(record)} · HectaresBC`;
    const heading = els.content.querySelector("h1");
    heading?.focus();
  }

  function datasetTemplate(record, preview, artifact) {
    const back = state.lastBrowseHash || "#/catalog";
    const mapHref = `#/dataset/${encodeURIComponent(record.dataset_id)}/map`;
    const metadata = metadataRows(record.metadata);
    const provenance = provenanceRows(record.provenance);
    const notes = notesRows(record);
    return `
      <article class="dataset-view">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a href="${back}">Browse</a><span aria-hidden="true">/</span>
          <span>${Catalog.escapeHtml(Catalog.titleLabel(record))}</span>
        </nav>
        <header class="dataset-hero">
          <div class="dataset-hero-main">
            <div class="dataset-eyebrow">
              <span class="badge badge-accent">${Catalog.escapeHtml(Catalog.familyLabel(record.source_family))}</span>
              ${verificationBadge(record)}
              ${previewBadge(preview)}
            </div>
            <h1 class="dataset-title" tabindex="-1">${Catalog.escapeHtml(Catalog.titleLabel(record))}</h1>
            <p class="dataset-id"><span class="mono">${Catalog.escapeHtml(record.dataset_id)}</span>
              <button class="copy-button" type="button" data-copy="${Catalog.escapeHtml(record.dataset_id)}">Copy</button>
            </p>
            <p class="dataset-status">${Catalog.escapeHtml(previewExplanation(record, preview))}</p>
          </div>
          <div class="dataset-actions">
            <a class="primary-button" href="${mapHref}">Open map</a>
            <button class="secondary-button" type="button" data-tray-add="${Catalog.escapeHtml(record.dataset_id)}">Add to tray</button>
            <button class="secondary-button" type="button" data-favorite-toggle="${Catalog.escapeHtml(record.dataset_id)}" aria-pressed="${isFavorite(record.dataset_id) ? "true" : "false"}">${isFavorite(record.dataset_id) ? "★ Favorited" : "☆ Favorite"}</button>
            <button class="secondary-button" type="button" data-copy="fresh-hectaresbc catalog show ${Catalog.escapeHtml(record.dataset_id)}">Copy CLI</button>
            <button class="secondary-button" type="button" data-download-json="${Catalog.escapeHtml(record.dataset_id)}">Download JSON</button>
          </div>
        </header>

        <section class="dataset-grid" aria-label="Dataset summary">
          ${statCard("Family", Catalog.familyLabel(record.source_family))}
          ${statCard("Size", Catalog.formatBytes(record.manifest_size_bytes))}
          ${statCard("Source format", Catalog.formatLabel(record))}
          ${statCard("Verification", Catalog.verificationLabel(record.verification_status))}
        </section>

        <div class="dataset-columns">
          <div>
            <section class="panel" aria-labelledby="about-heading">
              <h2 id="about-heading">About</h2>
              ${record.metadata?.description
                ? `<p>${Catalog.escapeHtml(record.metadata.description)}</p>`
                : '<p class="muted">No description was recovered for this layer.</p>'}
              ${metadata.length ? definitionList(metadata) : '<p class="muted">No recovered metadata fields.</p>'}
            </section>

            <section class="panel ${notes.length ? "panel-callout" : ""}" aria-labelledby="gaps-heading">
              <h2 id="gaps-heading">Known gaps and uncertainty</h2>
              ${notes.length ? `<ul class="note-list">${notes.map((note) => `<li>${Catalog.escapeHtml(note)}</li>`).join("")}</ul>` : '<p class="muted">No known gaps or uncertainty notes are recorded.</p>'}
            </section>

            <section class="panel" aria-labelledby="use-heading">
              <h2 id="use-heading">Use this layer</h2>
              ${codeBlock("Python", `from fresh_hectaresbc import HectaresBC\n\nrecord = HectaresBC().get("${record.dataset_id}")\nprint(record.title_candidate)`)}
              ${codeBlock("CLI metadata", `fresh-hectaresbc catalog show ${record.dataset_id}`)}
              ${codeBlock("Dry-run fetch", `fresh-hectaresbc fetch ${record.dataset_id} --dry-run`)}
            </section>
          </div>

          <div>
            <section class="panel" aria-labelledby="preview-heading">
              <h2 id="preview-heading">Preview</h2>
              ${previewPanel(record, preview, artifact, mapHref)}
            </section>

            <section class="panel" aria-labelledby="provenance-heading">
              <h2 id="provenance-heading">Provenance</h2>
              ${provenance.length ? definitionList(provenance) : '<p class="muted">No provenance fields were recovered.</p>'}
            </section>
          </div>
        </div>

        <details class="technical">
          <summary>Technical details (raw record JSON)</summary>
          <pre>${Catalog.escapeHtml(JSON.stringify(record, null, 2))}</pre>
        </details>
      </article>
    `;
  }

  function statCard(label, value) {
    return `<div class="stat-card"><span class="stat-label">${Catalog.escapeHtml(label)}</span><span class="stat-value">${Catalog.escapeHtml(value)}</span></div>`;
  }

  function verificationBadge(record) {
    if (Catalog.hasConflict(record)) {
      return '<span class="badge badge-danger badge-conflict">Conflict detected</span>';
    }
    return `<span class="badge badge-ok">${Catalog.escapeHtml(Catalog.verificationLabel(record.verification_status))}</span>`;
  }

  function previewBadge(preview) {
    const tone = preview.tone === "ok" ? "ok" : preview.tone === "warn" ? "warn" : "muted";
    return `<span class="badge badge-${tone}">${Catalog.escapeHtml(preview.label)}</span>`;
  }

  function previewExplanation(record, preview) {
    if (preview.status === "available") {
      if (preview.artifact?._source === "highres") {
        return "A high-resolution local preview artifact is available for this layer.";
      }
      return state.previewKind === "published"
        ? "A published preview artifact is available for this layer."
        : "A local preview artifact is available for this layer.";
    }
    if (preview.status === "not_previewable") {
      return "The published preview batch marked this layer as not previewable.";
    }
    if (preview.status === "missing") {
      return "No published preview artifact was found for this layer.";
    }
    if (preview.status === "unknown") {
      return state.previewKind === "unavailable"
        ? "The preview index is not reachable from this checkout, so preview availability is unknown."
        : "Preview availability is still loading.";
    }
    return "The preview artifact exists but is not currently usable.";
  }

  function previewBlockersTemplate(record, preview) {
    const blockers =
      preview.artifact?.preview_eligibility_blockers ||
      record.preview_eligibility_blockers ||
      record.preview?.eligibility_blockers ||
      [];
    const eligibility =
      preview.artifact?.preview_eligibility_status ||
      record.preview_eligibility_status ||
      record.preview?.eligibility_status ||
      "unknown";
    const reason =
      preview.artifact?.preview_eligibility_reason ||
      record.preview?.eligibility_reason ||
      "";
    return `
      <dl class="kv-list">
        <dt>Metadata eligibility</dt><dd>${Catalog.escapeHtml(Catalog.previewEligibilityLabel(eligibility))}</dd>
        ${reason ? `<dt>Reason</dt><dd>${Catalog.escapeHtml(reason)}</dd>` : ""}
        ${blockers.length ? `<dt>Blockers</dt><dd>${Catalog.escapeHtml(blockers.join(", "))}</dd>` : ""}
      </dl>
    `;
  }

  function legendItemLabel(item) {
    if (!item) {
      return "";
    }
    if (item.value_min !== undefined && item.value_max !== undefined) {
      return item.label || `${item.value_min}–${item.value_max}`;
    }
    if (item.value === undefined || item.value === null || item.value === "") {
      return item.label || "";
    }
    return `${item.value}: ${item.label}`;
  }

  function previewPanel(record, preview, artifact, mapHref) {
    const blocks = [];
    if (preview.status === "available" && artifact?.artifact_path) {
      const url = artifactUrl(artifact, artifact.artifact_path);
      if (url) {
        blocks.push(
          `<p><img data-thumb loading="lazy" decoding="async" src="${Catalog.escapeHtml(url)}" alt="Preview of ${Catalog.escapeHtml(Catalog.titleLabel(record))}" style="max-width:100%;border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--panel-soft)"></p>`
        );
      }
    }
    blocks.push(previewExplanation(record, preview));
    if (preview.status === "available") {
      blocks.push(
        `<details class="technical" style="margin-top:0.6rem"><summary>Metadata eligibility (historical)</summary><div style="padding:0 0.8rem 0.6rem">${previewBlockersTemplate(record, preview)}</div></details>`
      );
    } else {
      blocks.push(previewBlockersTemplate(record, preview));
    }
    if (artifact?.wgs84_bounds) {
      blocks.push(
        `<dl class="kv-list"><dt>Preview bounds</dt><dd class="mono">${Catalog.escapeHtml(formatBounds(artifact.wgs84_bounds))}</dd><dt>Preview CRS</dt><dd>${Catalog.escapeHtml(artifact.crs || "unknown")}</dd></dl>`
      );
    }
    if (Array.isArray(artifact?.value_classes) && artifact.value_classes.length) {
      blocks.push(
        `<ul class="layer-legend">${artifact.value_classes
          .map(
            (item) =>
              `<li><span class="layer-swatch" style="background: rgb(${(item.rgb || []).join(", ")})"></span>${Catalog.escapeHtml(legendItemLabel(item))}</li>`
          )
          .join("")}</ul>`
      );
    }
    blocks.push(`<p><a class="primary-button" href="${mapHref}">Open map workspace</a></p>`);
    if (state.previewKind === "local") {
      blocks.push('<p class="muted">Using local preview artifacts; the published preview index is not reachable from this checkout.</p>');
    }
    return blocks.join("");
  }

  function definitionList(rows) {
    if (!rows.length) {
      return '<p class="muted">No values recorded.</p>';
    }
    return `<dl class="kv-list">${rows
      .map(
        ([label, value]) =>
          `<dt>${Catalog.escapeHtml(label)}</dt><dd>${formatValue(value)}</dd>`
      )
      .join("")}</dl>`;
  }

  function metadataRows(metadata) {
    if (!metadata || typeof metadata !== "object") {
      return [];
    }
    return Object.entries(metadata)
      .filter(([key, value]) => key !== "description" && hasValue(value))
      .map(([key, value]) => [METADATA_LABELS[key] || humanizeKey(key), value]);
  }

  function provenanceRows(provenance) {
    if (!provenance || typeof provenance !== "object") {
      return [];
    }
    return Object.entries(provenance)
      .filter(([, value]) => hasValue(value))
      .map(([key, value]) => [PROVENANCE_LABELS[key] || humanizeKey(key), value]);
  }

  function notesRows(record) {
    return [
      ...(record.known_gaps || []).map((text) => `Known gap: ${text}`),
      ...(record.uncertainty_notes || []).map((text) => text),
    ];
  }

  function hasValue(value) {
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (value && typeof value === "object") {
      return Object.keys(value).length > 0;
    }
    return value !== null && value !== undefined && String(value).trim() !== "";
  }

  function formatValue(value) {
    if (Array.isArray(value)) {
      return `<ul class="note-list">${value.map((item) => `<li>${formatValue(item)}</li>`).join("")}</ul>`;
    }
    if (value && typeof value === "object") {
      return `<dl class="kv-list">${Object.entries(value)
        .map(([key, item]) => `<dt>${Catalog.escapeHtml(humanizeKey(key))}</dt><dd>${formatValue(item)}</dd>`)
        .join("")}</dl>`;
    }
    const text = String(value ?? "");
    if (text.length > 260) {
      return `<details><summary>Show full value</summary><pre class="mono" style="white-space:pre-wrap;overflow-wrap:anywhere">${Catalog.escapeHtml(text)}</pre></details>`;
    }
    return Catalog.escapeHtml(text || "unknown");
  }

  function humanizeKey(key) {
    const labels = {
      bclist: "BC list",
      ecolcomm: "Ecological community",
      ischanged: "Is changed",
      sara: "SARA",
    };
    if (labels[key]) {
      return labels[key];
    }
    return String(key)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  function codeBlock(label, code) {
    return `
      <div class="code-block">
        <div class="command-heading"><strong>${Catalog.escapeHtml(label)}</strong></div>
        <pre>${Catalog.escapeHtml(code)}</pre>
        <button class="copy-button" type="button" data-copy="${Catalog.escapeHtml(code)}">Copy</button>
      </div>
    `;
  }

  /* ------------------------------------------------------------------- map */

  function previewArtifactAvailable(datasetId) {
    const artifact = state.previewIndex?.get(datasetId);
    return Boolean(
      artifact &&
        ["source_derived_preview", "already_present"].includes(
          artifact.artifact_status || artifact.status
        )
    );
  }

  function defaultPreviewDatasetId() {
    if (!state.previewIndex) {
      return null;
    }
    if (previewArtifactAvailable("dl_adminunits_bcts")) {
      return "dl_adminunits_bcts";
    }
    for (const datasetId of state.previewIndex.keys()) {
      if (previewArtifactAvailable(datasetId)) {
        return datasetId;
      }
    }
    return null;
  }

  async function loadContextLayer(datasetId) {
    const record = getRecordSync(datasetId);
    if (!record) {
      return null;
    }
    const artifact = await loadArtifactDetails(
      Catalog.previewArtifact(record, state.previewIndex)
    );
    const preview = Catalog.previewStatus(record, state.previewIndex);
    if (!artifact || preview.status !== "available") {
      return null;
    }
    const tileMeta = await fetchJson(
      `../api/tiles/${encodeURIComponent(datasetId)}/metadata`
    );
    const tileBounds = window.HectaresBCMap?.validBounds(tileMeta?.bounds_wgs84);
    const staticBounds =
      window.HectaresBCMap?.validBounds(artifact._map_bounds_wgs84) ||
      window.HectaresBCMap?.validBounds(artifact.wgs84_bounds);
    const bounds = tileBounds || staticBounds;
    if (!bounds) {
      return null;
    }
    let previewUrl = artifact._map_path
      ? artifactUrl({ _base: artifact._map_base }, artifact._map_path)
      : artifact.artifact_path
        ? artifactUrl(artifact, artifact.artifact_path)
        : null;
    if (previewUrl && artifact._map_path && state.mapPreviewVersion) {
      previewUrl += `${previewUrl.includes("?") ? "&" : "?"}v=${encodeURIComponent(state.mapPreviewVersion)}`;
    }
    const tileUrl =
      tileMeta?.status === "ok" && tileBounds
        ? `../api/tiles/${encodeURIComponent(datasetId)}/{z}/{x}/{y}.png`
        : null;
    if (!tileUrl && !previewUrl) {
      return null;
    }
    return {
      dataset_id: datasetId,
      title: Catalog.titleLabel(record),
      previewUrl: tileUrl ? null : previewUrl,
      tileUrl,
      bounds,
      minzoom: tileMeta?.minzoom || 0,
      maxzoom: tileMeta?.maxzoom || 14,
      categorical: Boolean(
        artifact.value_class_count || artifact.value_classes?.length
      ),
      opacity: 0.55,
    };
  }

  function contextLayerIds(primaryId) {
    const routeLayers = Array.isArray(state.route.layers) ? state.route.layers : [];
    const trayLayers = state.tray.ids;
    return [...new Set([...routeLayers, ...trayLayers])]
      .filter((datasetId) => datasetId && datasetId !== primaryId)
      .slice(0, 3);
  }

  /* --------------------------------------------------------------- bundles */

  function stopHistoryPolling() {
    if (state.history.timer) {
      clearTimeout(state.history.timer);
      state.history.timer = null;
    }
  }

  function historyStatusTone(status) {
    if (status === "complete") return "ok";
    if (status === "partial") return "warn";
    if (status === "failed" || status === "interrupted") return "error";
    if (status === "canceled") return "muted";
    return "active";
  }

  function historyProgress(job) {
    const progress = Math.max(0, Math.min(100, Number(job.progress || 0)));
    return `<div class="clip-progress" role="progressbar" aria-label="Bundle job progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress)}"><div class="clip-progress-bar" style="width:${progress}%"></div></div>`;
  }

  function historyJobTemplate(job) {
    const status = String(job.status || "unknown");
    const result = job.result || {};
    const failures = Array.isArray(result.failures) ? result.failures : [];
    const active = ["queued", "running", "canceling"].includes(status);
    const tone = historyStatusTone(status);
    return `<article class="history-card">
      <header class="history-card-head">
        <span class="history-status ${tone}">${Catalog.escapeHtml(status)}</span>
        <strong>${Catalog.escapeHtml(job.aoi_name || "Bundle job")}</strong>
        <span class="history-date">${Catalog.formatDate(job.created_utc)}</span>
      </header>
      <p class="history-message">${Catalog.escapeHtml(job.message || "")}</p>
      ${active ? historyProgress(job) : ""}
      <div class="history-meta">
        <span>${Catalog.formatNumber((job.layer_ids || []).length)} layers</span>
        <span>${Catalog.escapeHtml(job.job_id || "")}</span>
        ${job.failed_layers ? `<span>${Catalog.formatNumber(job.failed_layers)} failed</span>` : ""}
      </div>
      <div class="history-actions">
        ${result.download_url ? `<a class="secondary-button" href="${Catalog.escapeHtml(result.download_url)}" target="_blank" rel="noreferrer">Download ZIP</a>` : ""}
        ${active ? `<button class="secondary-button" type="button" data-history-cancel="${Catalog.escapeHtml(job.job_id)}">Cancel</button>` : ""}
        ${failures.length ? `<button class="secondary-button" type="button" data-history-retry="${Catalog.escapeHtml(job.job_id)}">Retry failed layers</button>` : ""}
      </div>
    </article>`;
  }

  function historyBundleTemplate(bundle) {
    const status = String(bundle.status || "unknown");
    const tone = historyStatusTone(status);
    const aoi = bundle.aoi || {};
    return `<article class="history-card">
      <header class="history-card-head">
        <span class="history-status ${tone}">${Catalog.escapeHtml(status)}</span>
        <strong>${Catalog.escapeHtml(aoi.name || bundle.bundle_id || "Bundle")}</strong>
        <span class="history-date">${Catalog.formatDate(bundle.generated_utc)}</span>
      </header>
      <div class="history-meta">
        <span>${Catalog.formatNumber(bundle.layer_count || 0)} layers</span>
        ${aoi.area_ha ? `<span>${Catalog.formatNumber(aoi.area_ha)} ha</span>` : ""}
        ${bundle.failures ? `<span>${Catalog.formatNumber(bundle.failures)} failures</span>` : ""}
      </div>
      <div class="history-actions">
        ${bundle.download_url ? `<a class="secondary-button" href="${Catalog.escapeHtml(bundle.download_url)}" target="_blank" rel="noreferrer">Download ZIP</a>` : ""}
        ${bundle.manifest_url ? `<a class="secondary-button" href="${Catalog.escapeHtml(bundle.manifest_url)}" target="_blank" rel="noreferrer">Manifest</a>` : ""}
      </div>
    </article>`;
  }

  function renderBundleHistory() {
    const jobs = state.history.jobs || [];
    const bundles = state.history.bundles || [];
    const active = jobs.filter((job) =>
      ["queued", "running", "canceling"].includes(String(job.status))
    );
    const recentJobs = jobs.filter(
      (job) => !["queued", "running", "canceling"].includes(String(job.status))
    );
    const body = jobs.length || bundles.length
      ? `<section class="history-section">
          <h2>Jobs</h2>
          ${active.length ? active.map(historyJobTemplate).join("") : '<p class="history-empty">No active jobs.</p>'}
          ${recentJobs.slice(0, 8).map(historyJobTemplate).join("")}
        </section>
        <section class="history-section">
          <h2>Completed bundles</h2>
          ${bundles.length ? bundles.map(historyBundleTemplate).join("") : '<p class="history-empty">No completed bundles yet.</p>'}
        </section>`
      : `<div class="history-empty">
          <p>No bundle jobs or downloads yet.</p>
          <p>Open a map, choose an AOI, and prepare a bundle.</p>
          <a class="primary-button" href="#/map">Open map</a>
        </div>`;
    els.content.innerHTML = `
      <div class="history-shell">
        <header class="history-head">
          <div>
            <span class="dataset-eyebrow"><span class="badge badge-accent">Workspace</span></span>
            <h1 tabindex="-1">Bundle history</h1>
            <p>Active jobs, recent runs, failed-layer retries, and downloadable bundles.</p>
          </div>
          <button class="secondary-button" type="button" data-history-refresh>Refresh</button>
        </header>
        ${state.serviceAvailable ? "" : '<div class="history-warning">The bundle service is offline. Start the optional FastAPI service to create or refresh jobs.</div>'}
        ${body}
      </div>`;
    els.content.querySelector("h1")?.focus();
    if (active.length && !state.history.timer && state.route.view === "bundles") {
      state.history.timer = setTimeout(() => {
        state.history.timer = null;
        if (state.route.view === "bundles") {
          void loadBundleHistory(++state.renderToken);
        }
      }, 5000);
    }
  }

  async function loadBundleHistory(token) {
    state.history.loading = true;
    const [bundlePayload, jobPayload] = await Promise.all([
      fetchJson("../api/bundles"),
      fetchJson("../api/bundle-jobs?limit=50"),
    ]);
    if (token !== state.renderToken) {
      return;
    }
    state.history.loading = false;
    state.history.bundles = bundlePayload?.bundles || [];
    state.history.jobs = jobPayload?.jobs || [];
    state.serviceAvailable = Boolean(bundlePayload || jobPayload);
    renderBundleHistory();
  }

  async function renderBundles() {
    const token = ++state.renderToken;
    stopHistoryPolling();
    clearCompareResize();
    closeDiscover();
    window.HectaresBCMap?.destroy();
    closeClipPanel();
    closeTray();
    document.body.dataset.view = "bundles";
    document.body.classList.remove("filters-open", "inspector-open");
    els.content.innerHTML = loadingTemplate("Loading bundle history…");
    updateHeader();
    updateTabs();
    if (els.liveStatus) {
      els.liveStatus.textContent = "Bundle history.";
    }
    document.title = "Bundle history · HectaresBC";
    await loadBundleHistory(token);
  }

  async function refreshBundleHistory() {
    stopHistoryPolling();
    await loadBundleHistory(++state.renderToken);
  }

  async function cancelHistoryJob(jobId) {
    try {
      const response = await fetch(
        `../api/bundle-jobs/${encodeURIComponent(jobId)}/cancel`,
        { method: "POST" }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || `cancel failed (${response.status})`);
      }
      showToast("Bundle job canceled.");
      await refreshBundleHistory();
    } catch (error) {
      showToast(`Could not cancel job: ${error.message}`);
    }
  }

  async function retryHistoryJob(jobId) {
    try {
      const response = await fetch(
        `../api/bundle-jobs/${encodeURIComponent(jobId)}/retry`,
        { method: "POST" }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || `retry failed (${response.status})`);
      }
      showToast("Failed layers queued for retry.");
      await refreshBundleHistory();
    } catch (error) {
      showToast(`Could not retry job: ${error.message}`);
    }
  }

  /* ----------------------------------------------------------------- admin */

  function adminMetric(label, value, detail = "") {
    return `<article class="admin-metric">
      <span>${Catalog.escapeHtml(label)}</span>
      <strong>${Catalog.escapeHtml(String(value))}</strong>
      ${detail ? `<small>${Catalog.escapeHtml(detail)}</small>` : ""}
    </article>`;
  }

  function adminSourceTemplate(totals) {
    const sources = totals?.sources || {};
    const total = Object.values(sources).reduce(
      (sum, value) => sum + Number(value || 0),
      0
    );
    const labels = ["cache", "overlay", "cog", "zip", "error"];
    return `<div class="admin-source-list">${labels
      .map((label) => {
        const count = Number(sources[label] || 0);
        const percent = total ? (count / total) * 100 : 0;
        return `<div class="admin-source-row">
          <span>${label}</span>
          <div class="admin-source-bar"><span style="width:${percent}%"></div>
          <small>${Catalog.formatNumber(count)}</small>
        </div>`;
      })
      .join("")}</div>`;
  }

  function adminCommand(datasetId) {
    return `python scripts/build_tile_cog.py --dataset-id ${datasetId} --archive-root /path/to/hectaresbc --output-root var/tile-cogs`;
  }

  function renderAdminDashboard(stats, jobs) {
    const tiles = stats?.tiles || {};
    const totals = tiles.totals || {};
    const top = tiles.top_datasets || [];
    const cogs = new Set(stats?.cog_datasets || []);
    const jobCounts = stats?.bundle_jobs || {};
    const jobItems = jobs || [];
    const hitRate = ((Number(totals.cache_hit_rate) || 0) * 100).toFixed(1);
    const sourceRows = top
      .map((item) => {
        const sourceText = Object.entries(item.sources || {})
          .map(([key, value]) => `${key}:${value}`)
          .join(" ");
        const cog = cogs.has(item.dataset_id);
        return `<tr>
          <td><span class="mono">${Catalog.escapeHtml(item.dataset_id)}</span></td>
          <td>${Catalog.formatNumber(item.requests || 0)}</td>
          <td>${((Number(item.cache_hit_rate) || 0) * 100).toFixed(1)}%</td>
          <td>${Catalog.escapeHtml(item.avg_latency_ms ?? "—")} / ${Catalog.escapeHtml(item.latency_ms_max ?? "—")}</td>
          <td class="admin-source-summary">${Catalog.escapeHtml(sourceText || "—")}</td>
          <td>${cog ? '<span class="history-status ok">COG</span>' : `<button class="secondary-button admin-cog-button" type="button" data-copy="${Catalog.escapeHtml(adminCommand(item.dataset_id))}">Copy COG command</button>`}</td>
        </tr>`;
      })
      .join("");
    const jobsRows = jobItems
      .slice(0, 8)
      .map(
        (job) => `<tr>
          <td><span class="mono">${Catalog.escapeHtml(job.job_id || "")}</span></td>
          <td><span class="history-status ${historyStatusTone(job.status)}">${Catalog.escapeHtml(job.status || "unknown")}</span></td>
          <td>${Catalog.escapeHtml(job.aoi_name || "—")}</td>
          <td>${Catalog.formatNumber((job.layer_ids || []).length)}</td>
          <td>${Catalog.escapeHtml(job.message || "")}</td>
        </tr>`
      )
      .join("");
    els.content.innerHTML = `
      <div class="admin-shell">
        <header class="history-head">
          <div>
            <span class="dataset-eyebrow"><span class="badge badge-accent">Admin</span></span>
            <h1 tabindex="-1">Service statistics</h1>
            <p>Process-lifetime tile, cache, COG, and bundle-job health.</p>
          </div>
          <button class="secondary-button" type="button" data-admin-refresh>Refresh</button>
        </header>
        <div class="admin-metrics">
          ${adminMetric("Requests", Catalog.formatNumber(totals.requests || 0), "since process start")}
          ${adminMetric("Cache hit rate", `${hitRate}%`, `${Catalog.formatNumber(totals.cache_hits || 0)} hits`)}
          ${adminMetric("Average latency", `${Catalog.escapeHtml(totals.avg_latency_ms ?? 0)} ms`, `max ${Catalog.escapeHtml(totals.latency_ms_max ?? 0)} ms`)}
          ${adminMetric("Errors", Catalog.formatNumber(totals.errors || 0))}
          ${adminMetric("COGs", Catalog.formatNumber(stats?.tile_cogs || 0), stats?.tile_cog_root || "")}
        </div>
        <div class="admin-grid">
          <section class="admin-panel">
            <h2>Source mix</h2>
            ${adminSourceTemplate(totals)}
          </section>
          <section class="admin-panel">
            <h2>Bundle jobs</h2>
            <div class="admin-job-counts">
              ${["queued", "running", "complete", "partial", "failed", "canceled"]
                .map(
                  (status) =>
                    `<div><span>${status}</span><strong>${Catalog.formatNumber(jobCounts[status] || 0)}</strong></div>`
                )
                .join("")}
            </div>
          </section>
        </div>
        <section class="admin-panel admin-table-panel">
          <h2>Top datasets</h2>
          ${top.length
            ? `<div class="admin-table-wrap"><table class="admin-table">
                <thead><tr><th>Dataset</th><th>Requests</th><th>Hit rate</th><th>Avg / max ms</th><th>Sources</th><th>COG</th></tr></thead>
                <tbody>${sourceRows}</tbody>
              </table></div>`
            : '<p class="history-empty">No tile requests recorded yet. Open a map layer to populate this table.</p>'}
        </section>
        <section class="admin-panel admin-table-panel">
          <h2>Recent jobs</h2>
          ${jobsRows
            ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Job</th><th>Status</th><th>AOI</th><th>Layers</th><th>Message</th></tr></thead><tbody>${jobsRows}</tbody></table></div>`
            : '<p class="history-empty">No bundle jobs recorded.</p>'}
        </section>
        <p class="admin-links"><a href="../api/stats?top=25" target="_blank" rel="noreferrer">Raw stats JSON</a> · <a href="../api/health" target="_blank" rel="noreferrer">Health JSON</a></p>
      </div>`;
    els.content.querySelector("h1")?.focus();
  }

  async function loadAdminDashboard(token) {
    const [stats, jobsPayload] = await Promise.all([
      fetchJson("../api/stats?top=25"),
      fetchJson("../api/bundle-jobs?limit=20"),
    ]);
    if (token !== state.renderToken) {
      return;
    }
    if (!stats) {
      els.content.innerHTML = `<div class="admin-shell"><div class="history-warning">Statistics are unavailable. Start the optional service with <code>--allow-remote</code> and open this route through the protected origin.</div><a class="primary-button" href="#/catalog">Back to catalog</a></div>`;
      return;
    }
    renderAdminDashboard(stats, jobsPayload?.jobs || []);
  }

  async function renderAdmin() {
    const token = ++state.renderToken;
    stopHistoryPolling();
    clearCompareResize();
    closeDiscover();
    window.HectaresBCMap?.destroy();
    closeClipPanel();
    closeTray();
    resetIdentifyState();
    document.body.dataset.view = "admin";
    document.body.classList.remove("filters-open", "inspector-open");
    els.content.innerHTML = loadingTemplate("Loading service statistics…");
    updateHeader();
    updateTabs();
    document.title = "Service statistics · HectaresBC";
    if (els.liveStatus) {
      els.liveStatus.textContent = "Service statistics.";
    }
    await loadAdminDashboard(token);
  }

  /* -------------------------------------------------------------- identify */

  function updateIdentifyButton() {
    document.querySelectorAll("[data-identify-toggle]").forEach((button) => {
      button.textContent = state.identify.enabled ? "Stop identify" : "Identify";
      button.classList.toggle("is-active", state.identify.enabled);
      button.setAttribute(
        "aria-pressed",
        state.identify.enabled ? "true" : "false"
      );
    });
  }

  function resetIdentifyState() {
    state.identify.enabled = false;
    state.identify.busy = false;
    state.identify.result = null;
    state.mapHandle?.__hbc?.setIdentifyMode?.(false, null);
    const card = document.querySelector("#map-identify-card");
    if (card) {
      card.hidden = true;
      card.innerHTML = "";
    }
    updateIdentifyButton();
  }

  function identifyColor(result) {
    const color = result?.color;
    if (!Array.isArray(color) || color.length < 3) {
      return "";
    }
    const channels = color.slice(0, 4).map((value) => {
      const number = Math.max(0, Math.min(255, Number(value)));
      return Number.isFinite(number) ? Math.round(number) : 0;
    });
    const alpha = channels.length === 4 ? channels[3] / 255 : 1;
    return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
  }

  function renderIdentifyCard() {
    const card = document.querySelector("#map-identify-card");
    if (!card) {
      return;
    }
    if (!state.identify.enabled && !state.identify.busy && !state.identify.result) {
      card.hidden = true;
      card.innerHTML = "";
      return;
    }
    card.hidden = false;
    if (state.identify.busy) {
      card.innerHTML = '<p class="map-identify-status">Reading raster value…</p>';
      return;
    }
    const result = state.identify.result;
    if (!result) {
      card.innerHTML =
        '<p class="map-identify-status">Click the map to read a raster value.</p>';
      return;
    }
    const close = '<button class="icon-button" type="button" data-identify-close aria-label="Close identify result">×</button>';
    if (result.status === "outside") {
      card.innerHTML = `<div class="map-identify-head"><strong>Outside layer</strong>${close}</div><p class="map-identify-status">This point is outside the raster extent.</p><p class="map-identify-coords">${Number(result.lon).toFixed(5)}, ${Number(result.lat).toFixed(5)}</p>`;
      return;
    }
    if (result.status === "nodata") {
      card.innerHTML = `<div class="map-identify-head"><strong>${Catalog.escapeHtml(result.title || result.dataset_id)}</strong>${close}</div><p class="map-identify-status">No data at this cell.</p><p class="map-identify-coords">${Number(result.lon).toFixed(5)}, ${Number(result.lat).toFixed(5)}</p>`;
      return;
    }
    if (result.status === "error") {
      card.innerHTML = `<div class="map-identify-head"><strong>${Catalog.escapeHtml(result.title || "Identify failed")}</strong>${close}</div><p class="map-identify-status">${Catalog.escapeHtml(result.message || "Could not read this cell.")}</p>`;
      return;
    }
    const color = identifyColor(result);
    const label = result.label
      ? `<span class="map-identify-label">${Catalog.escapeHtml(result.label)}</span>`
      : "";
    card.innerHTML = `<div class="map-identify-head"><strong>${Catalog.escapeHtml(result.title || result.dataset_id)}</strong>${close}</div>
      <div class="map-identify-value">
        ${color ? `<span class="map-identify-swatch" style="background:${color}"></span>` : ""}
        <strong>${Catalog.escapeHtml(String(result.value))}</strong>${label}
      </div>
      <p class="map-identify-coords">${Number(result.lon).toFixed(5)}, ${Number(result.lat).toFixed(5)} · ${Catalog.escapeHtml(result.source_raster || "source")}</p>`;
  }

  async function identifyAt(lngLat) {
    const datasetId = state.identify.datasetId;
    if (!datasetId) {
      return;
    }
    const token = (state.identify.token || 0) + 1;
    state.identify.token = token;
    state.identify.busy = true;
    renderIdentifyCard();
    try {
      const response = await fetch(
        `../api/tiles/${encodeURIComponent(datasetId)}/identify?lon=${encodeURIComponent(lngLat.lng)}&lat=${encodeURIComponent(lngLat.lat)}`
      );
      if (token !== state.identify.token) {
        return;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || `identify failed (${response.status})`);
      }
      state.identify.result = payload;
      state.identify.busy = false;
      renderIdentifyCard();
    } catch (error) {
      if (token !== state.identify.token) {
        return;
      }
      state.identify.busy = false;
      state.identify.result = {
        status: "error",
        title: "Identify failed",
        message: error.message,
      };
      showToast(`Could not identify: ${error.message}`);
      renderIdentifyCard();
    }
  }

  function toggleIdentify() {
    if (!state.serviceAvailable) {
      showToast("Identify requires the map service.");
      return;
    }
    if (!state.mapHandle?.__hbc) {
      showToast("Open a map first.");
      return;
    }
    state.identify.enabled = !state.identify.enabled;
    state.identify.result = null;
    state.mapHandle.__hbc.setIdentifyMode(
      state.identify.enabled,
      ({ lng, lat }) => void identifyAt({ lng, lat })
    );
    updateIdentifyButton();
    renderIdentifyCard();
    if (state.identify.enabled) {
      showToast("Click the map to identify a raster value.");
    }
  }

  function contextLayerIds(primaryId) {
    const routeLayers = Array.isArray(state.route.layers) ? state.route.layers : [];
    const trayLayers = state.tray.ids;
    return [...new Set([...routeLayers, ...trayLayers])]
      .filter((datasetId) => datasetId && datasetId !== primaryId)
      .slice(0, 3);
  }

  function compareLayerOptions() {
    if (!state.previewIndex) {
      return [];
    }
    if (compareOptionsCache?.source === state.previewIndex) {
      return compareOptionsCache.options;
    }
    const options = [...state.previewIndex.values()]
      .filter((artifact) =>
        ["source_derived_preview", "already_present"].includes(
          artifact.artifact_status || artifact.status
        )
      )
      .map((artifact) => ({
        dataset_id: artifact.dataset_id,
        title: artifact.title || artifact.dataset_id,
      }))
      .sort((left, right) =>
        left.title.localeCompare(right.title, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      );
    compareOptionsCache = { source: state.previewIndex, options };
    return options;
  }

  function unionBounds(left, right) {
    if (!left) return right;
    if (!right) return left;
    return [
      Math.min(left[0], right[0]),
      Math.min(left[1], right[1]),
      Math.max(left[2], right[2]),
      Math.max(left[3], right[3]),
    ];
  }

  function alternatePreviewId(exclude) {
    if (!state.previewIndex) {
      return null;
    }
    for (const artifact of state.previewIndex.values()) {
      if (
        artifact.dataset_id !== exclude &&
        ["source_derived_preview", "already_present"].includes(
          artifact.artifact_status || artifact.status
        )
      ) {
        return artifact.dataset_id;
      }
    }
    return null;
  }

  function compareSelectTemplate(side, selected, options) {
    return `<label class="compare-select-label">${side === "left" ? "Left" : "Right"} layer
      <select data-compare-select="${side}">
        ${options
          .map(
            (item) =>
              `<option value="${Catalog.escapeHtml(item.dataset_id)}" ${item.dataset_id === selected ? "selected" : ""}>${Catalog.escapeHtml(item.title)}</option>`
          )
          .join("")}
      </select>
    </label>`;
  }

  function compareMissingTemplate() {
    return `<div class="compare-shell">
      <header class="history-head">
        <div><span class="badge badge-accent">Compare</span><h1>Layer comparison</h1></div>
        <a class="secondary-button" href="#/map">Back to map</a>
      </header>
      <div class="history-empty"><p>Two previewable layers are needed for comparison.</p><a class="primary-button" href="#/catalog?preview=available">Browse previewable layers</a></div>
    </div>`;
  }

  function clearCompareFlicker() {
    if (state.compareFlicker.timer) {
      clearInterval(state.compareFlicker.timer);
      state.compareFlicker.timer = null;
    }
    state.compareFlicker.paused = false;
    state.compareFlicker.activeLeft = true;
  }

  function clearCompareResize() {
    if (state.compareResizeHandler) {
      window.removeEventListener("resize", state.compareResizeHandler);
      state.compareResizeHandler = null;
    }
    clearCompareFlicker();
    clearSeriesFlicker();
  }

  async function renderCompare() {
    const token = ++state.renderToken;
    stopHistoryPolling();
    clearCompareResize();
    closeDiscover();
    window.HectaresBCMap?.destroy();
    closeClipPanel();
    closeTray();
    resetIdentifyState();
    document.body.dataset.view = "compare";
    document.body.classList.remove("filters-open", "inspector-open");
    els.content.innerHTML = loadingTemplate("Loading comparison…");
    updateHeader();
    updateTabs();
    document.title = "Layer comparison · HectaresBC";
    if (els.liveStatus) {
      els.liveStatus.textContent = "Layer comparison.";
    }
    let leftId =
      state.route.compareLeft ||
      currentMapDatasetId() ||
      state.tray.ids[0] ||
      defaultPreviewDatasetId();
    let rightId =
      state.route.compareRight ||
      state.tray.ids.find((id) => id !== leftId) ||
      alternatePreviewId(leftId);
    if (!leftId || !rightId) {
      els.content.innerHTML = compareMissingTemplate();
      els.content.querySelector("h1")?.focus();
      return;
    }
    if (leftId === rightId) {
      rightId = alternatePreviewId(leftId);
    }
    if (!rightId) {
      els.content.innerHTML = compareMissingTemplate();
      els.content.querySelector("h1")?.focus();
      return;
    }
    const [leftLayer, rightLayer] = await Promise.all([
      loadContextLayer(leftId),
      loadContextLayer(rightId),
    ]);
    if (token !== state.renderToken) {
      return;
    }
    if (!leftLayer || !rightLayer) {
      els.content.innerHTML = compareMissingTemplate();
      els.content.querySelector("h1")?.focus();
      return;
    }
    const options = compareLayerOptions();
    const compareMode = ["wipe", "flicker"].includes(state.route.compareMode)
      ? state.route.compareMode
      : "split";
    const fitBounds = unionBounds(leftLayer.bounds, rightLayer.bounds);
    els.content.innerHTML = `
      <div class="compare-shell">
        <header class="compare-head">
          <div>
            <span class="dataset-eyebrow"><span class="badge badge-accent">Compare</span></span>
            <h1 tabindex="-1">Layer comparison</h1>
            <p>Pan or zoom either pane to synchronize both maps.</p>
          </div>
          <div class="compare-actions">
            <button class="secondary-button" type="button" data-compare-swap>Swap sides</button>
            <button class="secondary-button" type="button" data-compare-download>Download PNG</button>
            ${state.tray.ids.length >= 3 ? `<a class="secondary-button" href="${traySeriesHref()}">Open series</a>` : ""}
            <a class="secondary-button" href="#/dataset/${encodeURIComponent(leftLayer.dataset_id)}/map">Open left map</a>
            <a class="secondary-button" href="#/map">Back to map</a>
          </div>
        </header>
        <div class="compare-mode-bar" role="group" aria-label="Comparison layout">
          <button type="button" data-compare-mode="split" class="${compareMode === "split" ? "is-active" : ""}">Side-by-side</button>
          <button type="button" data-compare-mode="wipe" class="${compareMode === "wipe" ? "is-active" : ""}">Wipe</button>
          <button type="button" data-compare-mode="flicker" class="${compareMode === "flicker" ? "is-active" : ""}">Flicker</button>
        </div>
        ${compareMode === "flicker" ? `<div class="compare-flicker-controls">
          <button class="secondary-button" type="button" data-flicker-toggle>Pause</button>
          <label>Speed
            <select data-flicker-speed>
              <option value="500" ${state.compareFlicker.speed === 500 ? "selected" : ""}>Fast</option>
              <option value="1000" ${state.compareFlicker.speed === 1000 ? "selected" : ""}>Normal</option>
              <option value="2000" ${state.compareFlicker.speed === 2000 ? "selected" : ""}>Slow</option>
            </select>
          </label>
        </div>` : ""}
        <div class="compare-selects">
          ${compareSelectTemplate("left", leftLayer.dataset_id, options)}
          ${compareSelectTemplate("right", rightLayer.dataset_id, options)}
        </div>
        <div class="compare-stage${compareMode !== "split" ? ` is-${compareMode}` : ""}">
          <section class="compare-pane is-left">
            <div id="compare-left" class="compare-map" aria-label="Left comparison map"></div>
            <div class="compare-label"><strong>${Catalog.escapeHtml(leftLayer.title)}</strong><span>${Catalog.escapeHtml(leftLayer.dataset_id)}</span></div>
          </section>
          <div class="compare-divider" aria-hidden="true"><span class="compare-divider-knob">↔</span></div>
          <section class="compare-pane is-right">
            <div id="compare-right" class="compare-map" aria-label="Right comparison map"></div>
            <div class="compare-label"><strong>${Catalog.escapeHtml(rightLayer.title)}</strong><span>${Catalog.escapeHtml(rightLayer.dataset_id)}</span></div>
          </section>
        </div>
        <p class="clip-status">Both maps use the same WGS84 extent. Pan/zoom is synchronized; layer styling controls are intentionally omitted in compare mode.</p>
      </div>`;
    bindCompareControls();
    if (compareMode === "wipe") {
      bindCompareWipe();
    } else if (compareMode === "flicker") {
      bindCompareFlicker();
    }
    els.content.querySelector("h1")?.focus();
    try {
      state.mapHandle = await window.HectaresBCMap.createCompare({
        left: {
          container: document.querySelector("#compare-left"),
          previewUrl: leftLayer.tileUrl ? null : leftLayer.previewUrl,
          tileUrl: leftLayer.tileUrl,
          minzoom: leftLayer.minzoom,
          maxzoom: leftLayer.maxzoom,
          bounds: leftLayer.bounds,
          fitBounds,
          categorical: leftLayer.categorical,
        },
        right: {
          container: document.querySelector("#compare-right"),
          previewUrl: rightLayer.tileUrl ? null : rightLayer.previewUrl,
          tileUrl: rightLayer.tileUrl,
          minzoom: rightLayer.minzoom,
          maxzoom: rightLayer.maxzoom,
          bounds: rightLayer.bounds,
          fitBounds,
          categorical: rightLayer.categorical,
        },
      });
      const handle = state.mapHandle;
      const resize = () => handle?.resize?.();
      if (state.compareResizeHandler) {
        window.removeEventListener("resize", state.compareResizeHandler);
      }
      state.compareResizeHandler = resize;
      window.addEventListener("resize", resize);
      requestAnimationFrame(() => resize());
    } catch (error) {
      els.content.innerHTML = mapFallbackTemplate(
        getRecordSync(leftLayer.dataset_id),
        Catalog.previewStatus(getRecordSync(leftLayer.dataset_id), state.previewIndex),
        null,
        leftLayer.previewUrl,
        error.message
      );
    }
  }

  function seriesMissingTemplate() {
    return `<div class="compare-shell series-shell">
      <header class="history-head">
        <div><span class="badge badge-accent">Series</span><h1>Layer flicker series</h1></div>
        <a class="secondary-button" href="#/map">Back to map</a>
      </header>
      <div class="history-empty"><p>Two previewable layers are needed for a series.</p><a class="primary-button" href="#/catalog?preview=available">Browse previewable layers</a></div>
    </div>`;
  }

  function clearSeriesFlicker() {
    if (state.series.timer) {
      clearInterval(state.series.timer);
      state.series.timer = null;
    }
    state.series.paused = false;
    state.series.index = 0;
    state.series.count = 0;
    state.series.mapReady = false;
    state.series.exporting = false;
    state.series.setFrame = null;
    state.series.setPaused = null;
  }

  function seriesCompareHref(layers) {
    return Catalog.buildRoute({
      ...Catalog.defaultState(),
      view: "compare",
      compareLeft: layers[0]?.dataset_id || null,
      compareRight: layers[1]?.dataset_id || null,
    });
  }

  function tourCards() {
    const sequence = seriesSequences().find(
      (item) => item.prefix === "dl_pinebeetle_allkill"
    );
    const seriesHref = sequence
      ? Catalog.buildRoute(seriesRouteFor(sequence.layers, 1000))
      : "#/series";
    const compareBase = {
      ...Catalog.defaultState(),
      view: "compare",
      compareLeft: "dl_adminunits_bcts",
      compareRight: "dl_adminunits_coaltenure",
    };
    const clipHref = Catalog.buildRoute({
      ...Catalog.defaultState(),
      view: "dataset",
      datasetId: "dl_adminunits_bcts",
      map: true,
      clipQuery: "timber supply area",
      clipName: "TSA 27",
    });
    const discoverHref = Catalog.buildRoute({
      ...Catalog.defaultState(),
      view: "map",
      map: true,
      discover: "view",
    });
    return [
      {
        id: "browse",
        badge: "Search",
        title: "Find recovered layers",
        description:
          "Start with search and facets, then inspect the metadata and provenance behind a result.",
        steps: [
          "Search for a topic such as “old growth”.",
          "Filter to previewable layers.",
          "Open a result to inspect metadata and provenance.",
          "Add layers to the tray for map or series work.",
        ],
        actions: [
          {
            label: "Browse old-growth layers",
            href: "#/catalog?q=old+growth&preview=available",
            primary: true,
          },
          { label: "Browse all previews", href: "#/catalog?preview=available" },
        ],
      },
      {
        id: "compare",
        badge: "Compare",
        title: "Compare two thematic layers",
        description:
          "Put BCTS operating areas beside coal tenures and try split, wipe, and flicker views.",
        steps: [
          "Open the two previewable layers.",
          "Pan or zoom one pane; the other follows.",
          "Try Wipe and drag the divider.",
          "Try Flicker and change the speed.",
        ],
        actions: [
          {
            label: "Compare side-by-side",
            href: Catalog.buildRoute(compareBase),
            primary: true,
          },
          {
            label: "Open wipe",
            href: Catalog.buildRoute({ ...compareBase, compareMode: "wipe" }),
          },
          {
            label: "Open flicker",
            href: Catalog.buildRoute({ ...compareBase, compareMode: "flicker" }),
          },
        ],
      },
      {
        id: "series",
        badge: "Series",
        title: "Play 17 years of pine-beetle data",
        description: sequence
          ? "Cycle the real 1999–2015 cumulative forest-killed sequence on one synchronized map."
          : "Open the Series workspace and choose a year family from the preview index.",
        steps: [
          "Open the pine-beetle family.",
          "Pause and step through frames.",
          "Use Year sequences to switch families.",
          "Download the active frame.",
        ],
        actions: [
          {
            label: sequence ? "Play 17-year series" : "Open Series",
            href: seriesHref,
            primary: true,
          },
        ],
        note: sequence ? "" : "The pine-beetle family is not in this checkout's preview index.",
      },
      {
        id: "clip",
        badge: "Bundle",
        title: "Clip BCTS to TSA 27",
        description:
          "Open the Clip drawer with the TSA boundary query prefilled, then estimate and prepare a bundle.",
        steps: [
          "Open BCTS on the map.",
          "Click Find boundary to resolve TSA 27.",
          "Select layers and run Estimate.",
          "Prepare the bundle and download it from Bundles.",
        ],
        actions: [
          {
            label: state.serviceAvailable ? "Open prefilled Clip" : "Open BCTS map",
            href: clipHref,
            primary: true,
          },
          { label: "Open bundle history", href: "#/bundles" },
        ],
        note: state.serviceAvailable
          ? "The query is prefilled; review it before resolving the boundary."
          : "Clip requires the optional map service.",
      },
      {
        id: "discover",
        badge: "Discover",
        title: "Find layers in the current view",
        description:
          "Open a map and let spatial discovery find previewable layers whose bounds intersect the view.",
        steps: [
          "Open the map.",
          "Discover opens against the current view.",
          "Filter results by family or text.",
          "Add results to the tray and open Compare or Series.",
        ],
        actions: [
          { label: "Open Discovery tour", href: discoverHref, primary: true },
          { label: "Open map", href: "#/map" },
        ],
      },
    ];
  }

  function tourCardTemplate(tour) {
    return `<article class="tour-card" id="tour-${Catalog.escapeHtml(tour.id)}">
      <div class="tour-card-head">
        <span class="badge badge-accent">${Catalog.escapeHtml(tour.badge)}</span>
        <h2>${Catalog.escapeHtml(tour.title)}</h2>
      </div>
      <p>${Catalog.escapeHtml(tour.description)}</p>
      <ol class="tour-steps">
        ${tour.steps.map((step) => `<li>${Catalog.escapeHtml(step)}</li>`).join("")}
      </ol>
      ${tour.note ? `<p class="tour-note">${Catalog.escapeHtml(tour.note)}</p>` : ""}
      <div class="tour-actions">
        ${tour.actions
          .map(
            (action) =>
              `<a class="${action.primary ? "primary-button" : "secondary-button"}" href="${Catalog.escapeHtml(action.href)}">${Catalog.escapeHtml(action.label)}</a>`
          )
          .join("")}
      </div>
    </article>`;
  }

  function renderTours() {
    const token = ++state.renderToken;
    stopHistoryPolling();
    clearCompareResize();
    closeDiscover();
    closeAssistant();
    closeClipPanel();
    closeTray();
    window.HectaresBCMap?.destroy();
    resetIdentifyState();
    document.body.dataset.view = "tours";
    document.body.classList.remove("filters-open", "inspector-open");
    els.content.innerHTML = loadingTemplate("Loading tours…");
    updateHeader();
    updateTabs();
    document.title = "Guided tours · HectaresBC";
    if (!state.ready) {
      renderLoading();
      return;
    }
    if (token !== state.renderToken) {
      return;
    }
    const cards = tourCards();
    els.content.innerHTML = `
      <div class="tours-shell">
        <header class="tours-head">
          <div>
            <span class="dataset-eyebrow"><span class="badge badge-accent">Tours</span></span>
            <h1 tabindex="-1">Guided tours</h1>
            <p>Five short paths through the recovered catalog. Each tour links straight into the workspace it describes.</p>
          </div>
          <a class="secondary-button" href="#/catalog">Back to Browse</a>
        </header>
        <div class="tours-grid">
          ${cards.map(tourCardTemplate).join("")}
        </div>
        <p class="clip-status">Tours are ordinary shareable routes; they do not create accounts, server-side progress, or saved user state.</p>
      </div>`;
    els.content.querySelector("h1")?.focus();
    if (els.liveStatus) {
      els.liveStatus.textContent = "Guided tours.";
    }
  }

  function updateSeriesFrameStatus() {
    const frameStatus = document.querySelector("[data-series-frame]");
    const layer = state.series.layers[state.series.index];
    if (!frameStatus || !layer) {
      return;
    }
    const ready =
      state.series.mapReady &&
      state.mapHandle?.isFrameReady?.(state.series.index) !== false;
    frameStatus.textContent = `Frame ${state.series.index + 1} of ${state.series.count} · ${layer.title} · ${layer.dataset_id}${ready ? "" : " · loading…"}`;
    frameStatus.classList.toggle("is-loading", !ready);
  }

  function seriesRouteFor(layerIds, speed = state.series.speed) {
    return {
      ...Catalog.defaultState(),
      view: "series",
      seriesLayers: layerIds.slice(0, SeriesMax),
      seriesSpeed: [500, 1000, 2000].includes(Number(speed)) ? Number(speed) : 1000,
    };
  }

  function navigateSeries(layerIds) {
    navigate(seriesRouteFor(layerIds, state.series.speed));
  }

  function seriesSequences() {
    if (seriesSequencesCache?.source === state.previewIndex) {
      return seriesSequencesCache.sequences;
    }
    const groups = new Map();
    for (const layer of compareLayerOptions()) {
      const match = layer.dataset_id.match(
        /^(.+?)[_-]?((?:19|20)\d{2})$/
      );
      if (!match) {
        continue;
      }
      const prefix = match[1].replace(/[_-]+$/, "");
      const year = Number(match[2]);
      if (!prefix || year < 1900 || year > 2100) {
        continue;
      }
      let group = groups.get(prefix);
      if (!group) {
        group = { prefix, items: [] };
        groups.set(prefix, group);
      }
      group.items.push({ ...layer, year });
    }
    const sequences = [...groups.values()]
      .map((group) => {
        const byYear = new Map();
        for (const item of group.items.sort((left, right) => left.year - right.year)) {
          if (!byYear.has(item.year)) {
            byYear.set(item.year, item);
          }
        }
        const items = [...byYear.values()].sort(
          (left, right) => left.year - right.year
        );
        if (items.length < 3 || items.length > SeriesMax) {
          return null;
        }
        const first = items[0];
        const baseTitle = String(first.title || "")
          .replace(/\s*(?:[,;:(\-–—]\s*)?(?:19|20)\d{2}\b.*$/, "")
          .trim();
        const fallback = group.prefix
          .split(/[_-]+/)
          .filter(Boolean)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ");
        return {
          prefix: group.prefix,
          label: baseTitle || fallback || group.prefix,
          years: items.map((item) => item.year),
          layers: items.map((item) => item.dataset_id),
        };
      })
      .filter(Boolean)
      .sort((left, right) =>
        left.label.localeCompare(right.label, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      );
    seriesSequencesCache = { source: state.previewIndex, sequences };
    return sequences;
  }

  function seriesSequencesTemplate(sequences, currentIds) {
    if (!sequences.length) {
      return "";
    }
    const current = currentIds.join(",");
    return `<section class="series-sequences" aria-label="Year sequences">
      <div class="series-sequences-head">
        <strong>Year sequences</strong>
        <span>Detected from dataset IDs ending in a year.</span>
      </div>
      <div class="series-sequence-list">
        ${sequences
          .map(
            (sequence, index) => `<button type="button" class="${sequence.layers.join(",") === current ? "is-active" : ""}" data-series-sequence="${index}">
              <strong>${Catalog.escapeHtml(sequence.label)}</strong>
              <span>${sequence.years[0]}–${sequence.years[sequence.years.length - 1]} · ${sequence.layers.length} frames</span>
            </button>`
          )
          .join("")}
      </div>
    </section>`;
  }

  function seriesEditorTemplate(loaded, options) {
    const current = new Set(loaded.map((layer) => layer.dataset_id));
    const available = options.filter((item) => !current.has(item.dataset_id));
    return `<details class="series-editor">
      <summary>Edit frames <span>${loaded.length} of ${SeriesMax}</span></summary>
      <div class="series-editor-body">
        <ol class="series-frame-list">
          ${loaded
            .map(
              (layer, index) => `<li class="series-frame-chip${index === state.series.index ? " is-active" : ""}" data-series-chip="${index}">
                <button type="button" class="series-frame-jump" data-series-jump="${index}" aria-label="Jump to frame ${index + 1}: ${Catalog.escapeHtml(layer.title)}">
                  <span class="series-frame-number">${index + 1}</span>
                  <span class="series-frame-text"><b>${Catalog.escapeHtml(layer.title)}</b><small>${Catalog.escapeHtml(layer.dataset_id)}</small></span>
                </button>
                <span class="series-frame-actions">
                  <button type="button" data-series-move="${index}" data-direction="-1" aria-label="Move ${Catalog.escapeHtml(layer.title)} up" ${index === 0 ? "disabled" : ""}>↑</button>
                  <button type="button" data-series-move="${index}" data-direction="1" aria-label="Move ${Catalog.escapeHtml(layer.title)} down" ${index === loaded.length - 1 ? "disabled" : ""}>↓</button>
                  <button type="button" data-series-remove="${index}" aria-label="Remove ${Catalog.escapeHtml(layer.title)}" ${loaded.length <= 2 ? "disabled" : ""}>×</button>
                </span>
              </li>`
            )
            .join("")}
        </ol>
        ${loaded.length >= SeriesMax
          ? `<p class="series-editor-note">Series is at the ${SeriesMax}-frame limit.</p>`
          : `<div class="series-add">
              <label>Add layer
                <select data-series-add-select>
                  ${available
                    .map(
                      (item) =>
                        `<option value="${Catalog.escapeHtml(item.dataset_id)}">${Catalog.escapeHtml(item.title)}</option>`
                    )
                    .join("")}
                </select>
              </label>
              <button class="secondary-button" type="button" data-series-add>Add</button>
            </div>`}
      </div>
    </details>`;
  }

  async function renderSeries() {
    const token = ++state.renderToken;
    stopHistoryPolling();
    clearCompareResize();
    closeDiscover();
    window.HectaresBCMap?.destroy();
    state.mapHandle = null;
    closeClipPanel();
    closeTray();
    resetIdentifyState();
    document.body.dataset.view = "series";
    document.body.classList.remove("filters-open", "inspector-open");
    els.content.innerHTML = loadingTemplate("Loading layer series…");
    updateHeader();
    updateTabs();
    document.title = "Layer series · HectaresBC";
    if (els.liveStatus) {
      els.liveStatus.textContent = "Layer series.";
    }
    const requested = Array.isArray(state.route.seriesLayers)
      ? state.route.seriesLayers
      : [];
    const fallback = state.tray.ids.slice(0, 6);
    const ids = [...new Set((requested.length ? requested : fallback).filter(Boolean))]
      .slice(0, SeriesMax);
    if (ids.length < 2) {
      els.content.innerHTML = seriesMissingTemplate();
      els.content.querySelector("h1")?.focus();
      return;
    }
    const loaded = (
      await Promise.all(
        ids.map((datasetId) =>
          loadContextLayer(datasetId).catch(() => null)
        )
      )
    ).filter(Boolean);
    if (token !== state.renderToken) {
      return;
    }
    if (loaded.length < 2) {
      els.content.innerHTML = seriesMissingTemplate();
      els.content.querySelector("h1")?.focus();
      return;
    }
    const speed = [500, 1000, 2000].includes(Number(state.route.seriesSpeed))
      ? Number(state.route.seriesSpeed)
      : 1000;
    state.series.speed = speed;
    state.series.index = 0;
    state.series.count = loaded.length;
    state.series.layers = loaded;
    state.series.sequences = seriesSequences();
    const options = compareLayerOptions();
    const currentIds = loaded.map((layer) => layer.dataset_id);
    const fitBounds = loaded.reduce(
      (bounds, layer) => unionBounds(bounds, layer.bounds),
      null
    );
    const mapHref = Catalog.buildRoute({
      ...Catalog.defaultState(),
      view: "dataset",
      datasetId: loaded[0].dataset_id,
      map: true,
      layers: loaded.slice(0, 6).map((layer) => layer.dataset_id),
    });
    els.content.innerHTML = `
      <div class="compare-shell series-shell">
        <header class="compare-head">
          <div>
            <span class="dataset-eyebrow"><span class="badge badge-accent">Series</span></span>
            <h1 tabindex="-1">Layer flicker series</h1>
            <p>Cycles through ${loaded.length} layers. One synchronized map switches the active frame; edits update the URL.</p>
          </div>
          <div class="compare-actions">
            <button class="secondary-button" type="button" data-series-download>Download PNG</button>
            <button class="secondary-button" type="button" data-series-video ${state.series.exporting ? "disabled" : ""}>${state.series.exporting ? "Recording…" : "Export video"}</button>
            <button class="secondary-button" type="button" data-series-contact ${state.series.exporting ? "disabled" : ""}>Contact sheet</button>
            <a class="secondary-button" href="${mapHref}">Open map with first six</a>
            <a class="secondary-button" href="${seriesCompareHref(loaded)}">Compare first two</a>
            <a class="secondary-button" href="#/map">Back to map</a>
          </div>
        </header>
        ${seriesSequencesTemplate(state.series.sequences, currentIds)}
        <div class="series-controls" role="group" aria-label="Series playback">
          <button class="secondary-button" type="button" data-series-prev aria-label="Previous frame">← Previous</button>
          <button class="secondary-button" type="button" data-series-toggle>Pause</button>
          <button class="secondary-button" type="button" data-series-next aria-label="Next frame">Next →</button>
          <label>Speed
            <select data-series-speed>
              <option value="500" ${speed === 500 ? "selected" : ""}>Fast</option>
              <option value="1000" ${speed === 1000 ? "selected" : ""}>Normal</option>
              <option value="2000" ${speed === 2000 ? "selected" : ""}>Slow</option>
            </select>
          </label>
          <span class="series-frame-status" data-series-frame aria-live="polite"></span>
        </div>
        <div class="series-stage" role="group" aria-label="Layer flicker frame">
          <div id="series-map" class="series-map" aria-label="Layer series map"></div>
          <div class="series-label" data-series-label><strong>${Catalog.escapeHtml(loaded[0].title)}</strong><span>Frame 1 of ${loaded.length} · ${Catalog.escapeHtml(loaded[0].dataset_id)}</span></div>
        </div>
        ${seriesEditorTemplate(loaded, options)}
        <p class="clip-status">The active frame uses the same WGS84 extent as the other frames. Layer styling controls are intentionally omitted in series mode.</p>
      </div>`;
    bindSeriesControls(loaded);
    els.content.querySelector("h1")?.focus();
    try {
      state.mapHandle = await window.HectaresBCMap.createSeries({
        container: document.querySelector("#series-map"),
        layers: loaded.map((layer) => ({
          previewUrl: layer.tileUrl ? null : layer.previewUrl,
          tileUrl: layer.tileUrl,
          minzoom: layer.minzoom,
          maxzoom: layer.maxzoom,
          bounds: layer.bounds,
          categorical: layer.categorical,
        })),
        fitBounds,
      });
      state.series.mapReady = true;
      state.mapHandle.activate(state.series.index);
      state.mapHandle.onFrameReady?.((index) => {
        if (index === state.series.index) {
          updateSeriesFrameStatus();
        }
      });
      updateSeriesFrameStatus();
      const handle = state.mapHandle;
      const resize = () => handle?.resize?.();
      if (state.compareResizeHandler) {
        window.removeEventListener("resize", state.compareResizeHandler);
      }
      state.compareResizeHandler = resize;
      window.addEventListener("resize", resize);
      requestAnimationFrame(() => resize());
    } catch (error) {
      clearSeriesFlicker();
      els.content.innerHTML = mapFallbackTemplate(
        getRecordSync(loaded[0].dataset_id),
        Catalog.previewStatus(
          getRecordSync(loaded[0].dataset_id),
          state.previewIndex
        ),
        null,
        loaded[0].previewUrl,
        error.message
      );
    }
  }

  function bindSeriesControls(loaded) {
    const toggle = document.querySelector("[data-series-toggle]");
    const speedSelect = document.querySelector("[data-series-speed]");
    const previous = document.querySelector("[data-series-prev]");
    const next = document.querySelector("[data-series-next]");
    if (!loaded.length) {
      return;
    }
    state.series.count = loaded.length;
    const apply = (index) => {
      const active = ((index % loaded.length) + loaded.length) % loaded.length;
      state.series.index = active;
      state.mapHandle?.activate?.(active);
      const layer = loaded[active];
      const label = document.querySelector("[data-series-label] strong");
      const meta = document.querySelector("[data-series-label] span");
      if (label) {
        label.textContent = layer.title;
      }
      if (meta) {
        meta.textContent = `Frame ${active + 1} of ${loaded.length} · ${layer.dataset_id}`;
      }
      document.querySelectorAll("[data-series-chip]").forEach((chip, chipIndex) => {
        chip.classList.toggle("is-active", chipIndex === active);
      });
      updateSeriesFrameStatus();
    };
    const stop = () => {
      if (state.series.timer) {
        clearInterval(state.series.timer);
        state.series.timer = null;
      }
    };
    const start = () => {
      stop();
      if (state.series.paused) {
        return;
      }
      state.series.timer = setInterval(() => {
        apply(state.series.index + 1);
      }, state.series.speed);
    };
    const setPaused = (paused) => {
      state.series.paused = paused;
      if (toggle) {
        toggle.textContent = paused ? "Play" : "Pause";
      }
      if (paused) {
        stop();
      } else {
        start();
      }
    };
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    apply(0);
    state.series.paused = reducedMotion;
    if (toggle) {
      toggle.textContent = reducedMotion ? "Play" : "Pause";
      toggle.addEventListener("click", () => setPaused(!state.series.paused));
    }
    previous?.addEventListener("click", () => {
      setPaused(true);
      apply(state.series.index - 1);
    });
    next?.addEventListener("click", () => {
      setPaused(true);
      apply(state.series.index + 1);
    });
    speedSelect?.addEventListener("change", () => {
      state.series.speed = Number(speedSelect.value) || 1000;
      state.route.seriesSpeed = state.series.speed;
      const nextHash = Catalog.buildRoute(state.route);
      if (nextHash !== window.location.hash) {
        window.history.replaceState({}, "", nextHash);
      }
      if (!state.series.paused) {
        start();
      }
    });

    const currentIds = () => loaded.map((layer) => layer.dataset_id);
    document.querySelector("[data-series-add]")?.addEventListener("click", () => {
      const select = document.querySelector("[data-series-add-select]");
      const datasetId = select?.value;
      if (!datasetId) {
        return;
      }
      if (currentIds().includes(datasetId)) {
        showToast("Layer is already in the series.");
        return;
      }
      if (loaded.length >= SeriesMax) {
        showToast(`Series holds at most ${SeriesMax} frames.`);
        return;
      }
      navigateSeries([...currentIds(), datasetId]);
    });
    document.querySelectorAll("[data-series-remove]").forEach((button) => {
      button.addEventListener("click", () => {
        if (loaded.length <= 2) {
          showToast("A series needs at least two frames.");
          return;
        }
        const index = Number(button.dataset.seriesRemove);
        navigateSeries(currentIds().filter((_, itemIndex) => itemIndex !== index));
      });
    });
    document.querySelectorAll("[data-series-move]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.seriesMove);
        const direction = Number(button.dataset.direction);
        const target = index + direction;
        if (target < 0 || target >= loaded.length) {
          return;
        }
        const ids = currentIds();
        [ids[index], ids[target]] = [ids[target], ids[index]];
        navigateSeries(ids);
      });
    });
    document.querySelectorAll("[data-series-jump]").forEach((button) => {
      button.addEventListener("click", () => {
        setPaused(true);
        apply(Number(button.dataset.seriesJump));
      });
    });
    document.querySelectorAll("[data-series-sequence]").forEach((button) => {
      button.addEventListener("click", () => {
        const sequence = state.series.sequences[Number(button.dataset.seriesSequence)];
        if (sequence) {
          navigateSeries(sequence.layers);
        }
      });
    });
    state.series.setFrame = apply;
    state.series.setPaused = setPaused;
    start();
  }

  function seriesVideoMimeType() {
    if (typeof window.MediaRecorder !== "function") {
      return null;
    }
    const candidates = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    return (
      candidates.find((type) => {
        try {
          return window.MediaRecorder.isTypeSupported(type);
        } catch (error) {
          return false;
        }
      }) || "video/webm"
    );
  }

  async function waitForSeriesFrameReady(index, timeout = 1800) {
    const started = performance.now();
    while (performance.now() - started < timeout) {
      if (state.mapHandle?.isFrameReady?.(index)) {
        return true;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }
    return false;
  }

  async function downloadSeriesContactSheet() {
    if (state.series.exporting) {
      return;
    }
    const layers = state.series.layers;
    const canvas = document.querySelector("#series-map .maplibregl-canvas");
    if (layers.length < 2 || !canvas || !state.series.mapReady) {
      showToast("The Series map is still loading.");
      return;
    }
    const previousIndex = state.series.index;
    const wasPaused = state.series.paused;
    const buttons = [
      ...document.querySelectorAll(
        "[data-series-download], [data-series-video], [data-series-contact]"
      ),
    ];
    const button = document.querySelector("[data-series-contact]");
    state.series.exporting = true;
    state.series.setPaused?.(true);
    buttons.forEach((exportButton) => {
      exportButton.disabled = true;
    });
    if (button) {
      button.textContent = "Exporting…";
    }
    let blob = null;
    try {
      const columns = Math.min(layers.length, 4);
      const gap = 12;
      const padding = 14;
      const headerHeight = 52;
      const footerHeight = 26;
      const labelHeight = 34;
      const sheetWidth = Math.min(
        1600,
        Math.max(900, canvas.clientWidth || canvas.width)
      );
      const cellWidth = Math.floor(
        (sheetWidth - padding * 2 - gap * (columns - 1)) / columns
      );
      const mapHeight = Math.round(
        (cellWidth * canvas.height) / Math.max(1, canvas.width)
      );
      const cellHeight = mapHeight + labelHeight;
      const rows = Math.ceil(layers.length / columns);
      const targetWidth =
        padding * 2 + columns * cellWidth + gap * (columns - 1);
      const targetHeight =
        headerHeight +
        padding +
        rows * cellHeight +
        gap * (rows - 1) +
        footerHeight;
      const target = document.createElement("canvas");
      target.width = targetWidth;
      target.height = targetHeight;
      const ctx = target.getContext("2d");
      if (!ctx) {
        throw new Error("PNG composition is not supported.");
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.fillStyle = "#1f2933";
      ctx.font = "600 18px sans-serif";
      ctx.fillText("HectaresBC · Series contact sheet", padding, 28);
      ctx.fillStyle = "#66727d";
      ctx.font = "10px monospace";
      ctx.fillText(
        `${layers.length} frames · ${new Date().toLocaleDateString()}`,
        padding,
        43
      );
      for (let index = 0; index < layers.length; index += 1) {
        state.series.setFrame?.(index);
        await waitForSeriesFrameReady(index);
        await new Promise((resolve) =>
          window.requestAnimationFrame(() =>
            window.requestAnimationFrame(resolve)
          )
        );
        const column = index % columns;
        const row = Math.floor(index / columns);
        const x = padding + column * (cellWidth + gap);
        const y = headerHeight + padding + row * (cellHeight + gap);
        ctx.drawImage(canvas, x, y, cellWidth, mapHeight);
        ctx.strokeStyle = "#c4d0dc";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, cellWidth - 1, cellHeight - 1);
        ctx.fillStyle = "#fbfcfd";
        ctx.fillRect(x, y + mapHeight, cellWidth, labelHeight);
        const layer = layers[index];
        ctx.fillStyle = "#1f2933";
        ctx.font = "600 9px sans-serif";
        ctx.fillText(
          ellipsizeCanvasText(ctx, layer.title, cellWidth - 12),
          x + 6,
          y + mapHeight + 14
        );
        ctx.fillStyle = "#66727d";
        ctx.font = "7px monospace";
        ctx.fillText(
          ellipsizeCanvasText(
            ctx,
            `Frame ${index + 1} · ${layer.dataset_id}`,
            cellWidth - 12
          ),
          x + 6,
          y + mapHeight + 27
        );
      }
      ctx.fillStyle = "#66727d";
      ctx.font = "10px sans-serif";
      ctx.fillText(
        `HectaresBC · series contact sheet · ${new Date().toLocaleDateString()} · Map data © OpenStreetMap contributors`,
        padding,
        targetHeight - 9
      );
      blob = await new Promise((resolve, reject) => {
        target.toBlob(
          (value) =>
            value ? resolve(value) : reject(new Error("PNG encoding failed.")),
          "image/png"
        );
      });
    } catch (error) {
      showToast(`Could not export contact sheet: ${error.message}`);
    } finally {
      state.series.exporting = false;
      buttons.forEach((exportButton) => {
        exportButton.disabled = false;
      });
      if (button) {
        button.textContent = "Contact sheet";
      }
      state.series.setFrame?.(previousIndex);
      state.series.setPaused?.(wasPaused);
    }
    if (!blob) {
      return;
    }
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `hectaresbc-series-contact-sheet-${layers[0].dataset_id.replace(/[^a-z0-9_-]+/gi, "-")}-${new Date()
        .toISOString()
        .slice(0, 10)}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast("Series contact sheet downloaded.");
    } catch (error) {
      showToast(`Could not download contact sheet: ${error.message}`);
    }
  }

  async function downloadSeriesVideo() {
    if (state.series.exporting) {
      return;
    }
    const layers = state.series.layers;
    const canvas = document.querySelector("#series-map .maplibregl-canvas");
    if (
      layers.length < 2 ||
      !canvas ||
      !state.series.mapReady
    ) {
      showToast("The Series map is still loading.");
      return;
    }
    const mimeType = seriesVideoMimeType();
    if (!mimeType || typeof canvas.captureStream !== "function") {
      showToast("Video export is not supported in this browser.");
      return;
    }

    const maxWidth = 1280;
    const scale = Math.min(1, maxWidth / canvas.width);
    const mapWidth = Math.max(2, Math.round(canvas.width * scale));
    const mapHeight = Math.max(2, Math.round(canvas.height * scale));
    const padding = 12;
    const headerHeight = 64;
    const footerHeight = 26;
    const target = document.createElement("canvas");
    target.width = mapWidth;
    target.height = headerHeight + mapHeight + footerHeight;
    const ctx = target.getContext("2d");
    if (!ctx) {
      showToast("Video export is not supported in this browser.");
      return;
    }
    const drawFrame = (index) => {
      const layer = layers[index];
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, target.width, target.height);
      ctx.fillStyle = "#66727d";
      ctx.font = "600 10px sans-serif";
      ctx.fillText("HectaresBC · Series", padding, 16);
      ctx.fillStyle = "#1f2933";
      ctx.font = "600 18px sans-serif";
      ctx.fillText(
        ellipsizeCanvasText(ctx, layer.title, target.width - padding * 2),
        padding,
        37
      );
      ctx.fillStyle = "#66727d";
      ctx.font = "10px monospace";
      ctx.fillText(
        ellipsizeCanvasText(
          ctx,
          `Frame ${index + 1} of ${layers.length} · ${layer.dataset_id}`,
          target.width - padding * 2
        ),
        padding,
        53
      );
      ctx.drawImage(canvas, 0, headerHeight, mapWidth, mapHeight);
      ctx.fillStyle = "#66727d";
      ctx.font = "10px sans-serif";
      ctx.fillText(
        `HectaresBC · series · ${new Date().toLocaleDateString()} · Map data © OpenStreetMap contributors`,
        padding,
        target.height - 9
      );
    };

    const button = document.querySelector("[data-series-video]");
    const previousIndex = state.series.index;
    const wasPaused = state.series.paused;
    const frameHold = Math.max(500, state.series.speed || 1000);
    let recorder = null;
    let stream = null;
    let blob = null;
    state.series.exporting = true;
    state.series.setPaused?.(true);
    if (button) {
      button.disabled = true;
      button.textContent = "Recording…";
    }
    try {
      stream = target.captureStream(30);
      const stopped = new Promise((resolve, reject) => {
        recorder = new window.MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 4_000_000,
        });
        recorder.ondataavailable = (event) => {
          if (event.data?.size) {
            chunks.push(event.data);
          }
        };
        recorder.onstop = () => resolve();
        recorder.onerror = (event) =>
          reject(event.error || new Error("Video recording failed."));
      });
      const chunks = [];
      recorder.start(250);
      for (let index = 0; index < layers.length; index += 1) {
        state.series.setFrame?.(index);
        await waitForSeriesFrameReady(index);
        const started = performance.now();
        while (performance.now() - started < frameHold) {
          drawFrame(index);
          await new Promise((resolve) =>
            window.requestAnimationFrame(resolve)
          );
        }
      }
      recorder.stop();
      await stopped;
      blob = new Blob(chunks, { type: mimeType.split(";")[0] });
      if (!blob.size) {
        throw new Error("The recording was empty.");
      }
    } catch (error) {
      showToast(`Could not export Series video: ${error.message}`);
    } finally {
      stream?.getTracks?.().forEach((track) => track.stop());
      state.series.exporting = false;
      document
        .querySelectorAll("[data-series-download], [data-series-video], [data-series-contact]")
        .forEach((exportButton) => {
          exportButton.disabled = false;
        });
      if (button) {
        button.textContent = "Export video";
      }
      state.series.setFrame?.(previousIndex);
      state.series.setPaused?.(wasPaused);
    }
    if (!blob) {
      return;
    }
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `hectaresbc-series-${layers[0].dataset_id.replace(/[^a-z0-9_-]+/gi, "-")}-${new Date()
        .toISOString()
        .slice(0, 10)}.webm`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast("Series WebM downloaded.");
    } catch (error) {
      showToast(`Could not download Series video: ${error.message}`);
    }
  }

  async function downloadSeriesImage() {
    const index = state.series.index;
    const canvas = document.querySelector("#series-map .maplibregl-canvas");
    const layer = state.series.layers[index];
    if (!canvas || !layer) {
      showToast("The active series frame is still loading.");
      return;
    }
    const title = layer.title || "Layer";
    const datasetId = layer.dataset_id || "";
    const footer = 26;
    const target = document.createElement("canvas");
    target.width = canvas.width;
    target.height = canvas.height + footer;
    const ctx = target.getContext("2d");
    if (!ctx) {
      showToast("PNG export is not supported in this browser.");
      return;
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, target.width, target.height);
    ctx.drawImage(canvas, 0, 0);
    ctx.save();
    ctx.font = "600 13px sans-serif";
    let displayTitle = title;
    while (
      displayTitle.length > 4 &&
      ctx.measureText(displayTitle).width > canvas.width - 32
    ) {
      displayTitle = displayTitle.slice(0, -2);
    }
    let displayId = datasetId;
    ctx.font = "10px monospace";
    while (
      displayId.length > 8 &&
      ctx.measureText(displayId).width > canvas.width - 32
    ) {
      displayId = displayId.slice(0, -2);
    }
    ctx.font = "600 13px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.fillRect(8, 8, Math.min(canvas.width - 16, Math.max(180, ctx.measureText(displayTitle).width + 16)), 38);
    ctx.fillStyle = "#1f2933";
    ctx.fillText(displayTitle, 16, 24);
    ctx.font = "10px monospace";
    ctx.fillStyle = "#66727d";
    ctx.fillText(displayId, 16, 38);
    ctx.font = "10px sans-serif";
    ctx.fillStyle = "#66727d";
    ctx.fillText(
      `HectaresBC · series · frame ${index + 1} of ${state.series.count} · ${new Date().toLocaleDateString()} · Map data © OpenStreetMap contributors`,
      8,
      target.height - 9
    );
    ctx.restore();
    try {
      const blob = await new Promise((resolve, reject) => {
        target.toBlob(
          (value) =>
            value ? resolve(value) : reject(new Error("PNG encoding failed")),
          "image/png"
        );
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `hectaresbc-series-frame-${index + 1}-${new Date()
        .toISOString()
        .slice(0, 10)}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast("Series frame PNG downloaded.");
    } catch (error) {
      showToast(`Could not export series frame: ${error.message}`);
    }
  }

  function bindCompareControls() {
    document.querySelectorAll("[data-compare-select]").forEach((select) => {
      select.addEventListener("change", () => {
        const left = document.querySelector('[data-compare-select="left"]');
        const right = document.querySelector('[data-compare-select="right"]');
        navigate({
          ...Catalog.defaultState(),
          view: "compare",
          compareLeft: left?.value || null,
          compareRight: right?.value || null,
          compareMode: state.route.compareMode || "split",
        });
      });
    });
  }

  function bindCompareFlicker() {
    const stage = document.querySelector(".compare-stage.is-flicker");
    const leftPane = stage?.querySelector(".compare-pane.is-left");
    const rightPane = stage?.querySelector(".compare-pane.is-right");
    const toggle = document.querySelector("[data-flicker-toggle]");
    const speedSelect = document.querySelector("[data-flicker-speed]");
    if (!stage || !leftPane || !rightPane) {
      return;
    }
    let activeLeft = true;
    const apply = () => {
      leftPane.style.opacity = activeLeft ? "1" : "0";
      rightPane.style.opacity = activeLeft ? "0" : "1";
      leftPane.style.pointerEvents = activeLeft ? "auto" : "none";
      rightPane.style.pointerEvents = activeLeft ? "none" : "auto";
      state.compareFlicker.activeLeft = activeLeft;
    };
    const stop = () => {
      if (state.compareFlicker.timer) {
        clearInterval(state.compareFlicker.timer);
        state.compareFlicker.timer = null;
      }
    };
    const start = () => {
      stop();
      if (state.compareFlicker.paused) {
        return;
      }
      state.compareFlicker.timer = setInterval(() => {
        activeLeft = !activeLeft;
        apply();
      }, state.compareFlicker.speed);
    };
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    state.compareFlicker.paused = reducedMotion;
    if (toggle) {
      toggle.textContent = reducedMotion ? "Play" : "Pause";
      toggle.addEventListener("click", () => {
        state.compareFlicker.paused = !state.compareFlicker.paused;
        toggle.textContent = state.compareFlicker.paused ? "Play" : "Pause";
        if (state.compareFlicker.paused) {
          stop();
        } else {
          start();
        }
      });
    }
    speedSelect?.addEventListener("change", () => {
      state.compareFlicker.speed = Number(speedSelect.value) || 1000;
      start();
    });
    apply();
    start();
  }

  function ellipsizeCanvasText(ctx, text, maxWidth) {
    let value = String(text || "");
    if (ctx.measureText(value).width <= maxWidth) {
      return value;
    }
    while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) {
      value = value.slice(0, -1);
    }
    return `${value}…`;
  }

  function mapLegendExportItems() {
    return [...document.querySelectorAll("#map-layer-panel .layer-legend li")]
      .map((item) => {
        const swatch = item.querySelector(".layer-swatch");
        return {
          color: swatch ? getComputedStyle(swatch).backgroundColor : "",
          label: item.textContent?.trim() || "",
        };
      })
      .filter((item) => item.label);
  }

  async function downloadMapImage() {
    const handle = state.mapHandle;
    const canvas = document.querySelector("#map-canvas .maplibregl-canvas");
    if (!handle?.__hbcReady || !canvas || !canvas.width || !canvas.height) {
      showToast("The map is still loading.");
      return;
    }
    const title =
      document.querySelector(".map-title-card h1")?.textContent?.trim() ||
      "HectaresBC map";
    const datasetId =
      document.querySelector(".map-title-card p")?.textContent?.trim() || "";
    const primaryVisible =
      document.querySelector("#layer-visible")?.checked !== false;
    const contextLayers = [...document.querySelectorAll("[data-context-visible]")]
      .filter((input) => input.checked)
      .map((input) => input.parentElement?.textContent?.trim())
      .filter(Boolean);
    const legendItems = mapLegendExportItems();
    const scale = Math.max(
      1,
      canvas.width / Math.max(1, canvas.clientWidth || canvas.width)
    );
    const padding = 14 * scale;
    const headerHeight = 78 * scale;
    const footerHeight = 28 * scale;
    const target = document.createElement("canvas");
    target.width = canvas.width;
    target.height = headerHeight + canvas.height + footerHeight;
    const ctx = target.getContext("2d");
    if (!ctx) {
      showToast("PNG export is not supported in this browser.");
      return;
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, target.width, target.height);

    ctx.textBaseline = "alphabetic";
    ctx.font = `600 ${18 * scale}px sans-serif`;
    ctx.fillStyle = "#1f2933";
    ctx.fillText(
      ellipsizeCanvasText(ctx, title, target.width - padding * 2),
      padding,
      padding + 18 * scale
    );
    ctx.font = `${11 * scale}px monospace`;
    ctx.fillStyle = "#66727d";
    ctx.fillText(
      ellipsizeCanvasText(ctx, datasetId, target.width - padding * 2),
      padding,
      padding + 35 * scale
    );
    const contextText = [
      primaryVisible ? "" : "Primary layer hidden",
      contextLayers.length
        ? `Context: ${contextLayers.join(" · ")}`
        : "Context: none",
    ]
      .filter(Boolean)
      .join(" · ");
    ctx.font = `${10 * scale}px sans-serif`;
    ctx.fillStyle = "#66727d";
    ctx.fillText(
      ellipsizeCanvasText(ctx, contextText, target.width - padding * 2),
      padding,
      padding + 52 * scale
    );

    ctx.drawImage(canvas, 0, headerHeight);

    const legendWidth = Math.min(300 * scale, target.width * 0.42);
    const legendPadding = 10 * scale;
    const rowHeight = 18 * scale;
    let maxRows = Math.max(
      2,
      Math.min(
        24,
        Math.floor((canvas.height - 56 * scale) / rowHeight)
      )
    );
    if (legendItems.length > maxRows) {
      maxRows = Math.max(1, maxRows - 1);
    }
    const shownItems = legendItems.slice(0, maxRows);
    const hiddenCount = Math.max(0, legendItems.length - shownItems.length);
    const legendHeight =
      32 * scale +
      (shownItems.length || 1) * rowHeight +
      (hiddenCount ? rowHeight : 0) +
      legendPadding;
    const legendX = target.width - legendWidth - 12 * scale;
    const legendY = headerHeight + 12 * scale;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.strokeStyle = "#c4d0dc";
    ctx.lineWidth = Math.max(1, scale);
    ctx.beginPath();
    ctx.roundRect(legendX, legendY, legendWidth, legendHeight, 6 * scale);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1f2933";
    ctx.font = `650 ${11 * scale}px sans-serif`;
    ctx.fillText("Legend", legendX + legendPadding, legendY + 17 * scale);
    let rowY = legendY + 30 * scale;
    if (!shownItems.length) {
      ctx.font = `${9 * scale}px sans-serif`;
      ctx.fillStyle = "#66727d";
      ctx.fillText(
        "No recovered legend classes",
        legendX + legendPadding,
        rowY + 12 * scale
      );
    } else {
      shownItems.forEach((item) => {
        ctx.fillStyle = item.color || "#d9e2ec";
        ctx.fillRect(
          legendX + legendPadding,
          rowY + 3 * scale,
          11 * scale,
          11 * scale
        );
        ctx.strokeStyle = "rgba(31,41,51,0.18)";
        ctx.strokeRect(
          legendX + legendPadding,
          rowY + 3 * scale,
          11 * scale,
          11 * scale
        );
        ctx.fillStyle = "#1f2933";
        ctx.font = `${9 * scale}px sans-serif`;
        ctx.fillText(
          ellipsizeCanvasText(
            ctx,
            item.label,
            legendWidth - legendPadding * 2 - 15 * scale
          ),
          legendX + legendPadding + 15 * scale,
          rowY + 12 * scale
        );
        rowY += rowHeight;
      });
      if (hiddenCount) {
        ctx.fillStyle = "#66727d";
        ctx.font = `${9 * scale}px sans-serif`;
        ctx.fillText(
          `…and ${hiddenCount} more`,
          legendX + legendPadding,
          rowY + 12 * scale
        );
      }
    }
    ctx.restore();

    ctx.font = `${10 * scale}px sans-serif`;
    ctx.fillStyle = "#66727d";
    ctx.fillText(
      `HectaresBC · map · ${new Date().toLocaleDateString()} · Map data © OpenStreetMap contributors`,
      padding,
      target.height - 9 * scale
    );

    try {
      const blob = await new Promise((resolve, reject) => {
        target.toBlob(
          (value) =>
            value ? resolve(value) : reject(new Error("PNG encoding failed")),
          "image/png"
        );
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `hectaresbc-map-${datasetId.replace(/[^a-z0-9_-]+/gi, "-")}-${new Date()
        .toISOString()
        .slice(0, 10)}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast("Map PNG downloaded.");
    } catch (error) {
      showToast(`Could not export map: ${error.message}`);
    }
  }

  async function downloadCompareImage() {
    const handle = state.mapHandle;
    if (!handle?.left?.__hbcReady || !handle?.right?.__hbcReady) {
      showToast("The comparison maps are still loading.");
      return;
    }
    const leftCanvas = document.querySelector("#compare-left .maplibregl-canvas");
    const rightCanvas = document.querySelector("#compare-right .maplibregl-canvas");
    if (!leftCanvas || !rightCanvas) {
      showToast("Comparison map canvases are unavailable.");
      return;
    }
    const mode = state.route.compareMode || "split";
    const leftLabel = document.querySelector(
      ".compare-pane.is-left .compare-label"
    );
    const rightLabel = document.querySelector(
      ".compare-pane.is-right .compare-label"
    );
    const labelText = (node) => ({
      title: node?.querySelector("strong")?.textContent?.trim() || "Layer",
      id: node?.querySelector("span")?.textContent?.trim() || "",
    });
    const labels = {
      left: labelText(leftLabel),
      right: labelText(rightLabel),
    };
    const gap = 16;
    const footer = 26;
    let width;
    let height;
    if (mode === "split") {
      width = leftCanvas.width + gap + rightCanvas.width;
      height = Math.max(leftCanvas.height, rightCanvas.height) + footer;
    } else {
      width = Math.max(leftCanvas.width, rightCanvas.width);
      height = Math.max(leftCanvas.height, rightCanvas.height) + footer;
    }
    const target = document.createElement("canvas");
    target.width = width;
    target.height = height;
    const ctx = target.getContext("2d");
    if (!ctx) {
      showToast("PNG export is not supported in this browser.");
      return;
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const drawLabel = (label, x, y, maxWidth) => {
      ctx.save();
      ctx.font = "600 13px sans-serif";
      let title = label.title;
      while (title.length > 4 && ctx.measureText(title).width > maxWidth - 16) {
        title = title.slice(0, -2);
      }
      ctx.fillStyle = "rgba(255,255,255,0.94)";
      ctx.fillRect(x, y, Math.min(maxWidth, Math.max(140, ctx.measureText(title).width + 16)), 38);
      ctx.fillStyle = "#1f2933";
      ctx.fillText(title, x + 8, y + 16);
      ctx.font = "10px monospace";
      ctx.fillStyle = "#66727d";
      ctx.fillText(label.id, x + 8, y + 30);
      ctx.restore();
    };

    const drawFooter = (text) => {
      ctx.save();
      ctx.font = "10px sans-serif";
      ctx.fillStyle = "#66727d";
      ctx.fillText(text, 8, height - 9);
      ctx.restore();
    };

    try {
      const divider = document.querySelector(".compare-divider");
      if (mode === "split") {
        ctx.drawImage(leftCanvas, 0, 0);
        ctx.drawImage(rightCanvas, leftCanvas.width + gap, 0);
        drawLabel(labels.left, 8, 8, leftCanvas.width - 16);
        drawLabel(
          labels.right,
          leftCanvas.width + gap + 8,
          8,
          rightCanvas.width - 16
        );
      } else if (mode === "wipe") {
        ctx.drawImage(rightCanvas, 0, 0);
        const percent = Math.min(
          98,
          Math.max(2, Number.parseFloat(divider?.style.left || "50"))
        );
        const clipWidth = (width * percent) / 100;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, clipWidth, height);
        ctx.clip();
        ctx.drawImage(leftCanvas, 0, 0);
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.shadowColor = "rgba(0,0,0,0.4)";
        ctx.shadowBlur = 2;
        ctx.beginPath();
        ctx.moveTo(clipWidth, 0);
        ctx.lineTo(clipWidth, height - footer);
        ctx.stroke();
        ctx.restore();
        drawLabel(labels.left, 8, 8, width * 0.48);
        drawLabel(labels.right, width * 0.52, 8, width * 0.48);
      } else {
        const activeCanvas = state.compareFlicker.activeLeft
          ? leftCanvas
          : rightCanvas;
        const activeLabel = state.compareFlicker.activeLeft
          ? labels.left
          : labels.right;
        ctx.drawImage(activeCanvas, 0, 0);
        drawLabel(activeLabel, 8, 8, width - 16);
      }
      drawFooter(
        `HectaresBC · ${mode} · ${new Date().toLocaleDateString()} · Map data © OpenStreetMap contributors`
      );
      const blob = await new Promise((resolve, reject) => {
        target.toBlob(
          (value) =>
            value ? resolve(value) : reject(new Error("PNG encoding failed")),
          "image/png"
        );
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `hectaresbc-compare-${mode}-${new Date()
        .toISOString()
        .slice(0, 10)}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast("Comparison PNG downloaded.");
    } catch (error) {
      showToast(`Could not export comparison: ${error.message}`);
    }
  }

  function bindCompareWipe() {
    const stage = document.querySelector(".compare-stage.is-wipe");
    const leftPane = stage?.querySelector(".compare-pane.is-left");
    const divider = stage?.querySelector(".compare-divider");
    if (!stage || !leftPane || !divider) {
      return;
    }
    let percent = 50;
    const apply = (value) => {
      percent = Math.min(98, Math.max(2, value));
      leftPane.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
      divider.style.left = `${percent}%`;
    };
    const move = (event) => {
      const rect = stage.getBoundingClientRect();
      if (rect.width > 0) {
        apply(((event.clientX - rect.left) / rect.width) * 100);
      }
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      divider.classList.remove("is-dragging");
    };
    divider.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      divider.classList.add("is-dragging");
      move(event);
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
    });
    apply(50);
  }

  function openCompare() {
    const left =
      currentMapDatasetId() ||
      state.tray.ids[0] ||
      defaultPreviewDatasetId();
    const right =
      state.tray.ids.find((id) => id !== left) || alternatePreviewId(left);
    if (!left || !right) {
      showToast("Add two previewable layers to compare.");
      return;
    }
    navigate({
      ...Catalog.defaultState(),
      view: "compare",
      compareLeft: left,
      compareRight: right,
    });
  }

  async function renderMap() {

    const token = ++state.renderToken;
    stopHistoryPolling();
    clearCompareResize();
    closeDiscover();
    document.body.dataset.view = "map";
    document.body.classList.remove("filters-open", "inspector-open");
    els.content.innerHTML = loadingTemplate("Loading map preview…");
    const workspaceRaw = state.route.workspace || null;
    if (!workspaceRaw) {
      state.workspace.applied = null;
      state.workspace.view = null;
      state.workspace.aoi = null;
      state.workspace.aoiApplied = false;
    } else if (state.workspace.applied !== workspaceRaw) {
      const workspacePayload = decodeWorkspace(workspaceRaw);
      if (workspacePayload) {
        applyWorkspacePayload(workspacePayload, workspaceRaw);
      }
    }
    let datasetId = state.route.datasetId;
    if (!datasetId && workspaceRaw) {
      const workspacePayload = decodeWorkspace(workspaceRaw);
      datasetId = workspacePayload?.primary || null;
    }
    if (!datasetId) {
      datasetId = defaultPreviewDatasetId();
      if (!datasetId) {
        els.content.innerHTML = mapEmptyTemplate();
        document.title = "Map · HectaresBC";
        if (els.liveStatus) {
          els.liveStatus.textContent = "No map layer is available.";
        }
        els.content.querySelector("h1")?.focus();
        updateTabs();
        return;
      }
      state.selectedId = datasetId;
    }
    state.identify.datasetId = datasetId;
    resetIdentifyState();
    if (state.clip.open && state.clip.datasetId && state.clip.datasetId !== datasetId) {
      resetClipState();
      state.clip.datasetId = datasetId;
    }
    await loadDetails();
    if (token !== state.renderToken) {
      return;
    }
    const record = getRecordSync(datasetId);
    if (!record) {
      els.content.innerHTML = notFoundTemplate(datasetId);
      document.title = "Dataset not found · HectaresBC";
      if (els.liveStatus) {
        els.liveStatus.textContent = "Dataset not found.";
      }
      updateTabs();
      return;
    }
    const artifact = await loadArtifactDetails(
      Catalog.previewArtifact(record, state.previewIndex)
    );
    if (token !== state.renderToken) {
      return;
    }
    const preview = Catalog.previewStatus(record, state.previewIndex);
    const tileMeta = await fetchJson(
      `../api/tiles/${encodeURIComponent(datasetId)}/metadata`
    );
    const tileBounds = window.HectaresBCMap?.validBounds(tileMeta?.bounds_wgs84);
    const staticBounds =
      window.HectaresBCMap?.validBounds(artifact?._map_bounds_wgs84) ||
      window.HectaresBCMap?.validBounds(artifact?.wgs84_bounds);
    const bounds = tileBounds || staticBounds;
    let previewUrl = artifact?._map_path
      ? artifactUrl({ _base: artifact._map_base }, artifact._map_path)
      : artifact?.artifact_path
        ? artifactUrl(artifact, artifact.artifact_path)
        : null;
    if (previewUrl && artifact?._map_path && state.mapPreviewVersion) {
      previewUrl += `${previewUrl.includes("?") ? "&" : "?"}v=${encodeURIComponent(state.mapPreviewVersion)}`;
    }
    const tileUrl =
      tileMeta?.status === "ok" && tileBounds
        ? `../api/tiles/${encodeURIComponent(datasetId)}/{z}/{x}/{y}.png`
        : null;
    const canMap =
      preview.status === "available" && bounds && (tileUrl || previewUrl);

    if (!canMap) {
      els.content.innerHTML = mapFallbackTemplate(record, preview, artifact, previewUrl);
      updateHeader();
      updateTabs();
      if (els.liveStatus) {
        els.liveStatus.textContent = `Map preview unavailable for ${Catalog.titleLabel(record)}. ${previewExplanation(record, preview)}`;
      }
      document.title = `${Catalog.titleLabel(record)} map · HectaresBC`;
      els.content.querySelector("h1")?.focus();
      return;
    }

    const reference = referenceLayer();
    const referenceUrl = reference?.artifact_path
      ? artifactUrl(reference, reference.artifact_path)
      : null;
    const contextIds = contextLayerIds(datasetId);
    const extraLayers = (
      await Promise.all(contextIds.map((id) => loadContextLayer(id)))
    ).filter(Boolean);
    if (token !== state.renderToken) {
      return;
    }
    els.content.innerHTML = mapTemplate(
      record,
      preview,
      artifact,
      bounds,
      tileMeta,
      extraLayers
    );
    bindMapLayerSearch();
    updateHeader();
    updateTabs();
    if (els.liveStatus) {
      els.liveStatus.textContent = `Map preview for ${Catalog.titleLabel(record)}.`;
    }
    document.title = `${Catalog.titleLabel(record)} map · HectaresBC`;
    els.content.querySelector("h1")?.focus();

    try {
      state.mapHandle = await window.HectaresBCMap.create({
        container: document.querySelector("#map-canvas"),
        previewUrl: tileUrl ? null : previewUrl,
        tileUrl,
        minzoom: tileMeta?.minzoom || 0,
        maxzoom: tileMeta?.maxzoom || 14,
        referenceUrl,
        referenceBounds: reference?.wgs84_bounds || null,
        bounds,
        categorical: Boolean(
          artifact?.value_class_count || artifact?.value_classes?.length
        ),
        panel: document.querySelector("#map-layer-panel"),
        loading: document.querySelector("#map-loading"),
        extraLayers,
        view: state.workspace.view,
        onError: () => {
          const card = document.querySelector(".map-status-card p");
          if (card) {
            card.textContent =
              "The preview image could not be loaded. It is still annexed in the data repository.";
          }
          if (!document.querySelector(".map-image-error")) {
            const banner = document.createElement("div");
            banner.className = "map-image-error";
            banner.innerHTML =
              "<strong>Preview image missing locally.</strong> Fetch preview payloads with <code>python scripts/fetch_web_previews.py</code>.";
            document.querySelector(".map-view")?.append(banner);
          }
        },
      });
      if (state.clip.geometry) {
        state.mapHandle.__hbc?.setAoi(state.clip.geometry, { fit: false });
      }
      state.identify.datasetId = datasetId;
      updateIdentifyButton();
      if (state.route.discover === "view") {
        void waitForMapReady(state.mapHandle).then((ready) => {
          if (ready && token === state.renderToken) {
            openDiscover();
          }
        });
      }
      if (state.route.clipQuery) {
        state.clip.query = state.route.clipQuery;
        state.clip.name = state.route.clipName || "";
        if (state.serviceAvailable) {
          void openClipPanel();
        } else {
          showToast("Clip requires the optional map service.");
        }
      }
      void restoreWorkspaceAoi();
    } catch (error) {
      state.mapHandle = null;
      if (token !== state.renderToken) {
        return;
      }
      window.HectaresBCMap?.destroy();
      els.content.innerHTML = mapFallbackTemplate(
        record,
        preview,
        artifact,
        previewUrl,
        error.message
      );
      els.content.querySelector("h1")?.focus();
    }
  }

  function mapTemplate(record, preview, artifact, bounds, tileMeta = null, extraLayers = []) {
    const datasetHref = `#/dataset/${encodeURIComponent(record.dataset_id)}`;
    const legend = mapLegendTemplate(artifact);
    const contextLayers = extraLayers.length
      ? extraLayers
          .map(
            (layer, index) => `<div class="map-context-layer">
              <label class="layer-control"><input type="checkbox" data-context-visible="${index}" checked> ${Catalog.escapeHtml(layer.title)}</label>
              <label class="layer-control">Opacity <input type="range" min="0" max="1" step="0.05" value="${layer.opacity}" data-context-opacity="${index}"></label>
            </div>`
          )
          .join("")
      : '<p class="muted" style="font-size:0.68rem">Add layers to the tray to show them as map context.</p>';
    return `
      <div class="map-view">
        <div id="map-canvas" class="map-canvas" aria-label="Map preview for ${Catalog.escapeHtml(Catalog.titleLabel(record))}"></div>
        <div class="map-topbar">
          <div class="map-title-card">
            <div class="dataset-eyebrow">
              <span class="badge badge-accent">${Catalog.escapeHtml(Catalog.familyLabel(record.source_family))}</span>
              ${previewBadge(preview)}
            </div>
            <h1 tabindex="-1">${Catalog.escapeHtml(Catalog.titleLabel(record))}</h1>
            <p>${Catalog.escapeHtml(record.dataset_id)}</p>
          </div>
          <div class="map-actions">
            <a class="secondary-button" href="${datasetHref}">Dataset</a>
            <a class="secondary-button" href="${state.lastBrowseHash || "#/catalog"}">Browse</a>
            <a class="secondary-button" href="#/catalog?preview=available">Preview layers</a>
            <button class="secondary-button" type="button" data-map-export>Download PNG</button>
            <button class="secondary-button" type="button" data-tray-add="${Catalog.escapeHtml(record.dataset_id)}">Add to tray</button>
            <button class="secondary-button" type="button" data-discover-open aria-controls="discover-panel" aria-haspopup="dialog" aria-expanded="false">Discover</button>
            <button class="secondary-button" type="button" data-compare-open>Compare</button>
            <button class="secondary-button" type="button" data-identify-toggle ${state.serviceAvailable ? "" : "hidden"}>Identify</button>
            <button class="secondary-button" type="button" data-open-clip aria-controls="clip-panel" aria-haspopup="dialog" aria-expanded="false" ${state.serviceAvailable ? "" : "hidden"}>Clip AOI</button>
            <button class="secondary-button" type="button" data-copy="${Catalog.escapeHtml(record.dataset_id)}">Copy ID</button>
          </div>
        </div>
        <aside class="map-layer-panel" id="map-layer-panel" aria-label="Map layer controls">
          <h2>Layer</h2>
          <label class="layer-control"><input id="layer-visible" type="checkbox" checked> Visible</label>
          <label class="layer-control">Opacity <input id="layer-opacity" type="range" min="0" max="1" step="0.05" value="0.88"></label>
          <div class="layer-control"><span>Opacity value</span><output id="layer-opacity-value">88%</output></div>
          <label class="layer-control">Basemap
            <select id="basemap-select">
              <option value="osm">OpenStreetMap</option>
              <option value="offline">Offline</option>
            </select>
          </label>
          <button id="map-fit-layer" class="secondary-button" type="button">Fit layer</button>
          <h2>Context layers</h2>
          <div class="map-context-layers" id="map-context-layers">${contextLayers}</div>
          <h2>Change layer</h2>
          <label class="layer-control map-layer-search-label">
            <input id="map-layer-search" type="search" aria-label="Find a previewable layer" placeholder="Find a previewable layer…" autocomplete="off">
          </label>
          <p id="map-layer-hint" class="map-layer-hint">${Catalog.formatNumber(state.previewMeta?.available || 0)} previewable layers</p>
          <div id="map-layer-results" class="map-layer-results" hidden></div>
          <h2>Legend</h2>
          ${legend}
          <p class="muted" style="font-size:0.68rem">Preview overlays are static source-derived images placed on a map using their recovered WGS84 bounds.</p>
        </aside>
        <div class="map-status-card">
          <h2>${Catalog.escapeHtml(preview.label)}</h2>
          <p>${tileMeta ? "Live 1-ha raster tiles from the recovered source data." : Catalog.escapeHtml(previewExplanation(record, preview))}</p>
          <dl class="kv-list" style="margin-top:0.5rem">
            <dt>Bounds</dt><dd class="mono">${Catalog.escapeHtml(formatBounds(bounds))}</dd>
            <dt>Map CRS</dt><dd>${Catalog.escapeHtml(artifact?._map_crs || artifact?.crs || "unknown")}</dd>
            <dt>Data</dt><dd>${tileMeta ? `Tiled raster · ${Catalog.escapeHtml(tileMeta.max_detail || "source resolution")}` : "Static preview"}</dd>
            <dt>Max zoom</dt><dd>${Catalog.escapeHtml(String(tileMeta?.maxzoom ?? "—"))}</dd>
            <dt>Artifact</dt><dd>${Catalog.escapeHtml(artifact?.artifact_status || "unknown")}</dd>
          </dl>
        </div>
        <div id="map-identify-card" class="map-identify-card" hidden></div>
        <div id="map-loading" class="map-loading"><span><span class="spinner"></span>Loading map…</span></div>
      </div>
    `;
  }

  function bindMapLayerSearch() {
    const input = document.querySelector("#map-layer-search");
    const results = document.querySelector("#map-layer-results");
    const hint = document.querySelector("#map-layer-hint");
    if (!input || !results || !state.previewIndex) {
      return;
    }
    const layers = [...state.previewIndex.values()]
      .filter((artifact) =>
        ["source_derived_preview", "already_present"].includes(
          artifact.artifact_status || artifact.status
        )
      )
      .map((artifact) => ({
        dataset_id: artifact.dataset_id,
        title: artifact.title || artifact.dataset_id,
        family: artifact.source_family || "",
        text: Catalog.normalizeText(
          `${artifact.title || ""} ${artifact.dataset_id || ""}`
        ),
      }))
      .sort((left, right) =>
        left.title.localeCompare(right.title, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      );

    const renderMatches = (query) => {
      const tokens = Catalog.normalizeText(query).split(" ").filter(Boolean);
      if (tokens.length === 0) {
        results.hidden = true;
        results.innerHTML = "";
        if (hint) {
          hint.textContent = `${Catalog.formatNumber(layers.length)} previewable layers`;
        }
        return;
      }
      const matches = layers
        .filter((layer) => tokens.every((token) => layer.text.includes(token)))
        .slice(0, 8);
      if (hint) {
        hint.textContent = `${Catalog.formatNumber(matches.length)} match${matches.length === 1 ? "" : "es"}`;
      }
      results.hidden = matches.length === 0;
      results.innerHTML = matches
        .map(
          (layer) =>
            `<a class="map-layer-result" href="#/dataset/${encodeURIComponent(layer.dataset_id)}/map">` +
            `<span>${Catalog.escapeHtml(layer.title)}</span>` +
            `<small>${Catalog.escapeHtml(layer.family.replace("_", " "))}</small>` +
            `</a>`
        )
        .join("");
    };

    input.addEventListener("input", () => renderMatches(input.value));
    renderMatches("");
  }

  function mapLegendTemplate(artifact) {
    const classes = Array.isArray(artifact?.value_classes)
      ? artifact.value_classes
      : [];
    if (!classes.length) {
      return '<p class="muted">No legend classes were recovered for this preview.</p>';
    }
    return `<ul class="layer-legend">${classes
      .map(
        (item) =>
          `<li><span class="layer-swatch" style="background: rgb(${(item.rgb || []).join(", ")})"></span>${Catalog.escapeHtml(legendItemLabel(item))}</li>`
      )
      .join("")}</ul>`;
  }

  function mapEmptyTemplate() {
    const hasIndex = Boolean(state.previewIndex);
    const message = hasIndex
      ? "The preview index is present, but it does not expose a usable preview artifact."
      : "The published preview index is not reachable from this checkout, so no map layers can be listed.";
    return `
      <div class="map-view">
        <div class="map-topbar">
          <div class="map-title-card">
            <h1 tabindex="-1">Map layers</h1>
            <p>Choose a previewable recovered layer to explore spatially.</p>
          </div>
          <div class="map-actions">
            <a class="secondary-button" href="${state.lastBrowseHash || "#/catalog"}">Browse</a>
          </div>
        </div>
        <div class="map-fallback">
          <div class="map-fallback-card">
            <h1>No map layer available</h1>
            <p>${Catalog.escapeHtml(message)}</p>
            <p><a class="primary-button" href="#/catalog?preview=available">Browse previewable layers</a></p>
            <details style="margin-top:0.8rem;text-align:left">
              <summary>Maintainer details</summary>
              <p class="muted" style="margin-top:0.5rem">Initialize the DataLad submodule and fetch the preview payloads:</p>
              <pre style="white-space:pre-wrap">git submodule update --init external/fresh-hectaresbc-data
python scripts/fetch_web_previews.py</pre>
            </details>
          </div>
        </div>
      </div>
    `;
  }

  function mapFallbackTemplate(record, preview, artifact, previewUrl, errorMessage = "") {
    const datasetHref = `#/dataset/${encodeURIComponent(record.dataset_id)}`;
    const canShowImage = Boolean(previewUrl);
    const message = previewExplanation(record, preview);
    return `
      <div class="map-view">
        <div class="map-topbar">
          <div class="map-title-card">
            <div class="dataset-eyebrow">
              <span class="badge badge-accent">${Catalog.escapeHtml(Catalog.familyLabel(record.source_family))}</span>
              ${previewBadge(preview)}
            </div>
            <h1 tabindex="-1">${Catalog.escapeHtml(Catalog.titleLabel(record))}</h1>
            <p>${Catalog.escapeHtml(record.dataset_id)}</p>
          </div>
          <div class="map-actions">
            <a class="secondary-button" href="${datasetHref}">Dataset</a>
            <a class="secondary-button" href="${state.lastBrowseHash || "#/catalog"}">Browse</a>
            <a class="secondary-button" href="#/catalog?preview=available">Preview layers</a>
          </div>
        </div>
        <div class="map-fallback">
          ${canShowImage
            ? `<img src="${Catalog.escapeHtml(previewUrl)}" alt="Preview of ${Catalog.escapeHtml(Catalog.titleLabel(record))}">`
            : `<div class="map-fallback-card">
                <h1>Map preview unavailable</h1>
                <p>${Catalog.escapeHtml(message)}</p>
                ${errorMessage ? `<p class="muted">${Catalog.escapeHtml(errorMessage)}</p>` : ""}
                <p><a class="primary-button" href="${datasetHref}">Open dataset details</a></p>
              </div>`}
        </div>
        <div class="map-status-card">
          <h2>${Catalog.escapeHtml(preview.label)}</h2>
          <p>${Catalog.escapeHtml(message)}</p>
          ${previewBlockersTemplate(record, preview)}
          ${state.previewKind === "unavailable" ? '<p class="muted">The preview index is not reachable from this checkout, so the map cannot load a basemap overlay.</p>' : ""}
        </div>
      </div>
    `;
  }

  function referenceLayer() {
    return (
      state.referenceLayers.find(
        (layer) => layer.role === "source_derived_basemap_reference"
      ) || state.referenceLayers[0] || null
    );
  }

  function formatBounds(bounds) {
    if (!Array.isArray(bounds) || bounds.length !== 4) {
      return "unknown";
    }
    return bounds.map((value) => Number(value).toFixed(4)).join(", ");
  }

  /* --------------------------------------------------------------- actions */

  function getRecordSync(datasetId) {
    if (!datasetId) {
      return null;
    }
    if (state.details?.has(datasetId)) {
      return state.details.get(datasetId);
    }
    return state.records.find((record) => record.dataset_id === datasetId) || null;
  }

  function selectRecord(datasetId) {
    state.selectedId = datasetId;
    renderInspector();
    document.body.classList.add("inspector-open");
    updateTabs();
  }

  function closeInspector() {
    state.selectedId = null;
    document.body.classList.remove("inspector-open");
    els.inspector.hidden = true;
    els.inspector.innerHTML = "";
    document.querySelectorAll(".result-row.is-selected").forEach((row) => {
      row.classList.remove("is-selected");
    });
    updateTabs();
  }

  function openMapFor(datasetId) {
    if (!datasetId) {
      showToast("Select a layer first.");
      return;
    }
    navigate({ ...Catalog.defaultState(), view: "dataset", datasetId, map: true });
  }

  function handleContentClick(event) {
    const target = event.target;
    if (target.closest("[data-compare-open]")) {
      openCompare();
      return;
    }
    if (target.closest("[data-compare-download]")) {
      void downloadCompareImage();
      return;
    }
    if (target.closest("[data-series-download]")) {
      void downloadSeriesImage();
      return;
    }
    if (target.closest("[data-series-video]")) {
      void downloadSeriesVideo();
      return;
    }
    if (target.closest("[data-series-contact]")) {
      void downloadSeriesContactSheet();
      return;
    }
    if (target.closest("[data-map-export]")) {
      void downloadMapImage();
      return;
    }
    if (target.closest("[data-compare-swap]")) {
      const left = state.route.compareLeft;
      const right = state.route.compareRight;
      navigate({
        ...Catalog.defaultState(),
        view: "compare",
        compareLeft: right,
        compareRight: left,
        compareMode: state.route.compareMode || "split",
      });
      return;
    }
    const compareMode = target.closest("[data-compare-mode]");
    if (compareMode) {
      navigate({
        ...Catalog.defaultState(),
        view: "compare",
        compareLeft: state.route.compareLeft,
        compareRight: state.route.compareRight,
        compareMode: compareMode.dataset.compareMode,
      });
      return;
    }
    const favoriteToggle = target.closest("[data-favorite-toggle]");
    if (favoriteToggle) {
      toggleFavorite(favoriteToggle.dataset.favoriteToggle);
      return;
    }
    const discoverOpen = target.closest("[data-discover-open]");
    if (discoverOpen) {
      openDiscover(discoverOpen);
      return;
    }
    if (target.closest("[data-admin-refresh]")) {
      void renderAdmin();
      return;
    }
    if (target.closest("[data-identify-toggle]")) {
      toggleIdentify();
      return;
    }
    if (target.closest("[data-identify-close]")) {
      state.identify.result = null;
      renderIdentifyCard();
      return;
    }
    if (target.closest("[data-history-refresh]")) {
      void refreshBundleHistory();
      return;
    }
    const cancelJob = target.closest("[data-history-cancel]");
    if (cancelJob) {
      void cancelHistoryJob(cancelJob.dataset.historyCancel);
      return;
    }
    const retryJob = target.closest("[data-history-retry]");
    if (retryJob) {
      void retryHistoryJob(retryJob.dataset.historyRetry);
      return;
    }
    const trayAdd = target.closest("[data-tray-add]");
    if (trayAdd) {
      event.preventDefault();
      addToTray(trayAdd.dataset.trayAdd);
      return;
    }
    const openClip = target.closest("[data-open-clip]");
    if (openClip) {
      void openClipPanel(openClip);
      return;
    }
    const copy = target.closest("[data-copy]");
    if (copy) {
      copyText(copy.dataset.copy);
      return;
    }
    const download = target.closest("[data-download-json]");
    if (download) {
      downloadRecord(download.dataset.downloadJson);
      return;
    }
    const retry = target.closest("[data-retry]");
    if (retry) {
      renderLoading();
      loadCatalog();
      return;
    }
    const page = target.closest("[data-page]");
    if (page && !page.disabled) {
      const next = Number.parseInt(page.dataset.page, 10);
      if (Number.isFinite(next)) {
        state.browseScroll = 0;
        navigate({ ...state.route, page: next });
      }
      return;
    }
    const sort = target.closest("[data-sort]");
    if (sort) {
      const column = sort.dataset.sort;
      let nextSort = column;
      if (column === "size") {
        nextSort = state.route.sort === "size_desc" ? "size_asc" : "size_desc";
      }
      navigate({ ...state.route, sort: nextSort, page: 1 }, { replace: true });
      return;
    }
    const clearFacet = target.closest("[data-clear-facet]");
    if (clearFacet) {
      clearFacetValue(clearFacet.dataset.clearFacet);
      return;
    }
    const clearAll = target.closest("[data-clear-all]");
    if (clearAll) {
      clearAllFilters();
      return;
    }
    const filterButton = target.closest("[data-open-filters]");
    if (filterButton) {
      openFilters(filterButton);
      return;
    }
    const close = target.closest("[data-close-inspector]");
    if (close) {
      closeInspector();
      return;
    }
    const row = target.closest("[data-dataset-id]");
    if (row && !target.closest("a,button,input,select,label")) {
      const datasetId = row.dataset.datasetId;
      if (window.matchMedia(NarrowInspectorQuery).matches) {
        navigate({
          ...Catalog.defaultState(),
          view: "dataset",
          datasetId,
        });
      } else {
        selectRecord(datasetId);
      }
    }
  }

  function handleContentChange(event) {
    const sort = event.target.closest("[data-sort-select]");
    if (sort) {
      const key = sort.dataset.focusKey;
      navigate({ ...state.route, sort: sort.value, page: 1 }, { replace: true });
      requestAnimationFrame(() => {
        document.querySelector(`[data-focus-key="${key}"]`)?.focus();
      });
      return;
    }
    const pageSize = event.target.closest("[data-page-size]");
    if (pageSize) {
      const key = pageSize.dataset.focusKey;
      state.browseScroll = 0;
      navigate(
        { ...state.route, pageSize: pageSize.value, page: 1 },
        { replace: true }
      );
      requestAnimationFrame(() => {
        document.querySelector(`[data-focus-key="${key}"]`)?.focus();
      });
    }
  }

  function handleFacetChange(event) {
    const input = event.target.closest("input[data-facet]");
    if (!input) {
      return;
    }
    const facet = input.dataset.facet;
    const route = { ...state.route, [facet]: input.value, page: 1 };
    state.browseScroll = 0;
    document.body.classList.remove("filters-open");
    navigate(route, { replace: true });
  }

  function clearFacetValue(facet) {
    if (facet === "query") {
      els.searchInput.value = "";
      navigate({ ...state.route, query: "", page: 1 }, { replace: true });
      return;
    }
    navigate({ ...state.route, [facet]: "all", page: 1 }, { replace: true });
  }

  function clearAllFilters() {
    els.searchInput.value = "";
    navigate(
      {
        ...Catalog.defaultState(),
        pageSize: state.route.pageSize,
      },
      { replace: true }
    );
  }

  function handleSearchInput() {
    const query = els.searchInput.value;
    let route = state.route;
    if (route.view !== "catalog") {
      route = { ...Catalog.defaultState(), pageSize: route.pageSize };
    }
    route = { ...route, query, page: 1 };
    state.route = route;
    state.browseScroll = 0;
    if (state.searchRaf) {
      cancelAnimationFrame(state.searchRaf);
    }
    state.searchRaf = requestAnimationFrame(() => renderBrowse());
    clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(() => {
      navigate(state.route, { replace: true });
    }, 180);
  }

  function handleGlobalKeydown(event) {
    const target = event.target;
    const typing =
      target instanceof HTMLElement &&
      (target.matches("input, textarea, select") || target.isContentEditable);

    if (event.key === "Escape") {
      document.body.classList.remove("inspector-open");
      if (els.helpDialog.open) {
        els.helpDialog.close();
      }
      closeFilters();
      if (els.trayPanel && !els.trayPanel.hidden) {
        closeTray();
      }
      if (els.discoverPanel && !els.discoverPanel.hidden) {
        closeDiscover();
      }
      if (els.clipPanel && !els.clipPanel.hidden) {
        closeClipPanel();
      }
      if (els.assistantPanel && !els.assistantPanel.hidden) {
        closeAssistant();
      }
      return;
    }
    if (typing) {
      return;
    }
    const overlayOpen =
      (els.helpDialog && els.helpDialog.open) ||
      (els.trayPanel && !els.trayPanel.hidden) ||
      (els.discoverPanel && !els.discoverPanel.hidden) ||
      (els.clipPanel && !els.clipPanel.hidden) ||
      (els.assistantPanel && !els.assistantPanel.hidden);
    if (overlayOpen) {
      return;
    }
    if (event.key === "/") {
      event.preventDefault();
      els.searchInput.focus();
      els.searchInput.select();
      return;
    }
    if (event.key === "?") {
      event.preventDefault();
      openHelp();
      return;
    }
    if (event.key === "f") {
      event.preventDefault();
      if (document.body.classList.contains("filters-open")) {
        closeFilters();
      } else {
        openFilters();
      }
      return;
    }
    if (event.key === "m") {
      const id = state.route.datasetId || state.selectedId;
      if (id) {
        event.preventDefault();
        openMapFor(id);
      }
      return;
    }
    if (event.key === "j" || event.key === "k") {
      const links = [...document.querySelectorAll("[data-result-link]")];
      if (!links.length) {
        return;
      }
      event.preventDefault();
      const index = links.indexOf(document.activeElement);
      const next = event.key === "j" ? index + 1 : index - 1;
      const clamped = Math.min(Math.max(next, 0), links.length - 1);
      links[clamped].focus();
    }
  }

  /* ------------------------------------------------------------------ copy */

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied to clipboard.");
    } catch (error) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        showToast("Copied to clipboard.");
      } catch (fallbackError) {
        showToast("Copy failed. Select the text and copy it manually.");
      } finally {
        textarea.remove();
      }
    }
  }

  async function downloadRecord(datasetId) {
    await loadDetails();
    const record = getRecordSync(datasetId);
    if (!record) {
      showToast("Dataset metadata is not loaded.");
      return;
    }
    const blob = new Blob([JSON.stringify(record, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${datasetId}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  let toastTimer = null;
  function rememberPanelTrigger(panel, trigger = document.activeElement) {
    if (!panel) {
      return;
    }
    panel.__returnFocus =
      trigger instanceof HTMLElement && !panel.contains(trigger) ? trigger : null;
  }

  function restorePanelFocus(panel) {
    if (!panel) {
      return;
    }
    const trigger = panel.__returnFocus;
    panel.__returnFocus = null;
    if (
      trigger?.isConnected &&
      !trigger.hidden &&
      !trigger.disabled &&
      typeof trigger.focus === "function"
    ) {
      trigger.focus();
    }
  }

  function focusPanel(panel, selector) {
    if (!panel) {
      return;
    }
    const target =
      panel.querySelector(selector) ||
      panel.querySelector(
        "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
      );
    target?.focus();
  }

  function setDisclosure(selector, expanded) {
    document.querySelectorAll(selector).forEach((element) => {
      element.setAttribute("aria-expanded", expanded ? "true" : "false");
    });
  }

  function openFilters(trigger = document.activeElement) {
    document.body.classList.add("filters-open");
    requestAnimationFrame(() => {
      const target =
        els.filterRail?.querySelector(
          "input:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex='-1'])"
        ) ||
        els.filterRail ||
        null;
      target?.focus();
    });
    state.filtersReturnFocus = trigger instanceof HTMLElement ? trigger : null;
  }

  function closeFilters({ restore = true } = {}) {
    const wasOpen = document.body.classList.contains("filters-open");
    document.body.classList.remove("filters-open");
    const trigger = state.filtersReturnFocus;
    state.filtersReturnFocus = null;
    if (wasOpen && restore && trigger?.isConnected && !trigger.hidden) {
      trigger.focus();
    }
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      els.toast.hidden = true;
    }, 2200);
  }

  /* ------------------------------------------------------------------ header */

  function updateHeader(matching = state.records.length) {
    if (!state.ready) {
      els.status.textContent = "Loading catalog…";
      return;
    }
    const updated = state.meta?.generated_at
      ? `updated ${Catalog.formatDate(state.meta.generated_at)}`
      : "recovered catalog";
    const noun = state.route.view === "catalog" ? "matching" : "records";
    els.status.textContent = `${Catalog.formatNumber(matching)} ${noun} · ${updated}`;

    if (state.previewMeta) {
      els.previewStatus.hidden = false;
      els.previewStatus.classList.remove("warn");
      const count = state.previewMeta.available;
      els.previewStatus.textContent = `${Catalog.formatNumber(count)} ${count === 1 ? "preview" : "previews"}`;
      const highres = state.previewMeta.highresCount || 0;
      els.previewStatus.title = highres
        ? `Published DataLad preview index with ${Catalog.formatNumber(highres)} high-resolution local overrides`
        : state.previewMeta.kind === "published"
          ? "Published DataLad preview index"
          : "Local preview artifacts";
    } else if (state.previewKind === "loading") {
      els.previewStatus.hidden = false;
      els.previewStatus.classList.remove("warn");
      els.previewStatus.textContent = "Loading previews…";
    } else {
      els.previewStatus.hidden = false;
      els.previewStatus.classList.add("warn");
      els.previewStatus.textContent = "Preview index unavailable";
      els.previewStatus.title =
        "Browse and metadata still work; preview images require the published DataLad preview index.";
    }
  }

  function updateTabs() {
    const datasetId = state.route.datasetId || state.selectedId;
    const setCurrent = (element, current) => {
      if (!element) {
        return;
      }
      if (current) {
        element.setAttribute("aria-current", "page");
      } else {
        element.removeAttribute("aria-current");
      }
    };
    els.tabBrowse.href = state.lastBrowseHash || "#/catalog";
    setCurrent(els.tabBrowse, state.route.view === "catalog");
    if (datasetId) {
      els.tabMap.href = `#/dataset/${encodeURIComponent(datasetId)}/map`;
      els.tabMap.title = "Open the map workspace for the selected layer";
    } else {
      els.tabMap.href = "#/map";
      els.tabMap.title = "Open the map workspace";
    }
    els.tabMap.removeAttribute("aria-disabled");
    setCurrent(
      els.tabMap,
      state.route.view === "map" ||
        state.route.view === "compare" ||
        state.route.view === "series" ||
        (state.route.view === "dataset" && state.route.map)
    );
    setCurrent(els.tabTours, state.route.view === "tours");
    setCurrent(els.tabBundles, state.route.view === "bundles");
    setCurrent(els.tabAdmin, state.route.view === "admin");
  }

  /* --------------------------------------------------------------- assistant */

  async function loadServiceInfo() {
    const health = await fetchJson("../api/health");
    state.serviceAvailable = health?.status === "ok";
    if (Number.isFinite(Number(health?.max_area_ha))) {
      state.clip.maxAreaHa = Number(health.max_area_ha);
    }
    if (Number.isFinite(Number(health?.max_layers))) {
      state.clip.maxLayers = Number(health.max_layers);
    }
    document.querySelectorAll("[data-open-clip]").forEach((button) => {
      button.hidden = !state.serviceAvailable;
    });
    if (els.tabAdmin) {
      els.tabAdmin.hidden = !state.serviceAvailable;
    }
  }

  /* ---------------------------------------------------------- saved browse */

  const SavedSearchKey = "fresh-hectaresbc.saved-searches.v1";
  const FavoritesKey = "fresh-hectaresbc.favorites.v1";

  function loadSavedBrowse() {
    try {
      const searches = JSON.parse(localStorage.getItem(SavedSearchKey) || "[]");
      state.saved.searches = Array.isArray(searches)
        ? searches.filter(
            (item) =>
              item &&
              typeof item.id === "string" &&
              typeof item.name === "string" &&
              typeof item.hash === "string"
          )
        : [];
    } catch (error) {
      state.saved.searches = [];
    }
    try {
      const favorites = JSON.parse(localStorage.getItem(FavoritesKey) || "[]");
      state.saved.favorites = Array.isArray(favorites)
        ? favorites.filter(
            (item) => item && typeof item.dataset_id === "string"
          )
        : [];
    } catch (error) {
      state.saved.favorites = [];
    }
  }

  function saveSavedBrowse() {
    try {
      localStorage.setItem(
        SavedSearchKey,
        JSON.stringify(state.saved.searches.slice(0, 30))
      );
      localStorage.setItem(
        FavoritesKey,
        JSON.stringify(state.saved.favorites.slice(0, 100))
      );
    } catch (error) {
      // Non-fatal.
    }
  }

  function isFavorite(datasetId) {
    return state.saved.favorites.some(
      (item) => item.dataset_id === datasetId
    );
  }

  function updateFavoriteButtons() {
    document.querySelectorAll("[data-favorite-toggle]").forEach((button) => {
      const active = isFavorite(button.dataset.favoriteToggle);
      button.textContent = active ? "★" : "☆";
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.setAttribute(
        "aria-label",
        `${active ? "Remove" : "Add"} ${button.dataset.favoriteToggle} ${active ? "from" : "to"} favorites`
      );
    });
  }

  function toggleFavorite(datasetId) {
    if (!datasetId) {
      return;
    }
    if (isFavorite(datasetId)) {
      state.saved.favorites = state.saved.favorites.filter(
        (item) => item.dataset_id !== datasetId
      );
      showToast("Removed from favorites.");
    } else {
      state.saved.favorites.unshift({
        dataset_id: datasetId,
        created_utc: new Date().toISOString(),
      });
      showToast("Added to favorites.");
    }
    saveSavedBrowse();
    updateFavoriteButtons();
    renderSavedBrowse();
  }

  function saveCurrentSearch() {
    if (state.route.view !== "catalog") {
      showToast("Open Browse before saving a search.");
      return;
    }
    const name = window.prompt("Name this search:", "Saved search");
    if (!name || !name.trim()) {
      return;
    }
    state.saved.searches.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      name: name.trim().slice(0, 80),
      hash: Catalog.buildRoute(state.route),
      created_utc: new Date().toISOString(),
    });
    saveSavedBrowse();
    renderSavedBrowse();
    showToast("Search saved.");
  }

  function openSavedSearch(hash) {
    if (!hash) {
      return;
    }
    navigate(Catalog.parseRoute(hash));
  }

  function deleteSavedSearch(id) {
    state.saved.searches = state.saved.searches.filter(
      (item) => item.id !== id
    );
    saveSavedBrowse();
    renderSavedBrowse();
  }

  function renderSavedBrowse() {
    if (!els?.savedBrowse) {
      return;
    }
    const searches = state.saved.searches.slice(0, 8);
    const favorites = state.saved.favorites.slice(0, 8);
    const favoriteTitle = (datasetId) =>
      state.previewIndex?.get(datasetId)?.title ||
      getRecordSync(datasetId)?.title_candidate ||
      datasetId;
    els.savedBrowse.innerHTML = `
      <div class="saved-head">
        <h3>Saved</h3>
        <button class="secondary-button saved-search-button" type="button" data-save-search>Save search</button>
      </div>
      ${searches.length
        ? `<div class="saved-list">${searches
            .map(
              (item) => `<div class="saved-row">
                <button type="button" data-saved-search-open="${Catalog.escapeHtml(item.hash)}">${Catalog.escapeHtml(item.name)}</button>
                <button type="button" data-saved-search-delete="${Catalog.escapeHtml(item.id)}" aria-label="Delete ${Catalog.escapeHtml(item.name)}">×</button>
              </div>`
            )
            .join("")}</div>`
        : '<p class="saved-empty">No saved searches.</p>'}
      <h3 class="saved-subhead">Favorites</h3>
      ${favorites.length
        ? `<div class="saved-list">${favorites
            .map(
              (item) => `<div class="saved-row">
                <a href="#/dataset/${encodeURIComponent(item.dataset_id)}">${Catalog.escapeHtml(favoriteTitle(item.dataset_id))}</a>
                <button type="button" data-favorite-remove="${Catalog.escapeHtml(item.dataset_id)}" aria-label="Remove ${Catalog.escapeHtml(item.dataset_id)} from favorites">×</button>
              </div>`
            )
            .join("")}</div>`
        : '<p class="saved-empty">No favorite datasets.</p>'}`;
    updateFavoriteButtons();
  }

  function handleSavedBrowseClick(event) {
    const target = event.target;
    if (target.closest("[data-save-search]")) {
      saveCurrentSearch();
      return;
    }
    const openSearch = target.closest("[data-saved-search-open]");
    if (openSearch) {
      openSavedSearch(openSearch.dataset.savedSearchOpen);
      return;
    }
    const deleteSearch = target.closest("[data-saved-search-delete]");
    if (deleteSearch) {
      deleteSavedSearch(deleteSearch.dataset.savedSearchDelete);
      return;
    }
    const removeFavorite = target.closest("[data-favorite-remove]");
    if (removeFavorite) {
      state.saved.favorites = state.saved.favorites.filter(
        (item) => item.dataset_id !== removeFavorite.dataset.favoriteRemove
      );
      saveSavedBrowse();
      updateFavoriteButtons();
      renderSavedBrowse();
    }
  }

  /* ---------------------------------------------------------------- tray */

  const TrayStorageKey = "fresh-hectaresbc.layer-tray.v1";

  function loadTray() {
    try {
      const stored = JSON.parse(localStorage.getItem(TrayStorageKey) || "[]");
      if (Array.isArray(stored)) {
        state.tray.ids = [
          ...new Set(stored.filter((value) => typeof value === "string")),
        ].slice(0, 6);
      }
    } catch (error) {
      state.tray.ids = [];
    }
    syncTrayButton();
  }

  function saveTray() {
    try {
      localStorage.setItem(TrayStorageKey, JSON.stringify(state.tray.ids));
    } catch (error) {
      // Private browsing or a full storage quota is non-fatal.
    }
    syncTrayButton();
  }

  function syncTrayButton() {
    if (els?.trayCount) {
      els.trayCount.textContent = String(state.tray.ids.length);
    }
    els?.trayButton?.setAttribute(
      "aria-expanded",
      state.tray.open ? "true" : "false"
    );
  }

  function trayLayer(artifactId) {
    return state.previewIndex?.get(artifactId) || null;
  }

  function addToTray(datasetId) {
    if (!datasetId) {
      return;
    }
    if (state.tray.ids.includes(datasetId)) {
      showToast("Layer is already in the tray.");
      return;
    }
    if (state.tray.ids.length >= 6) {
      showToast("The tray holds at most 6 layers.");
      return;
    }
    const artifact = trayLayer(datasetId);
    if (state.previewIndex && !artifact) {
      showToast("Layer is not previewable.");
      return;
    }
    state.tray.ids.push(datasetId);
    saveTray();
    renderTray();
    showToast("Layer added to tray.");
  }

  function removeFromTray(datasetId) {
    state.tray.ids = state.tray.ids.filter((value) => value !== datasetId);
    saveTray();
    renderTray();
  }

  function moveTray(datasetId, delta) {
    const index = state.tray.ids.indexOf(datasetId);
    if (index < 0) {
      return;
    }
    const next = index + delta;
    if (next < 0 || next >= state.tray.ids.length) {
      return;
    }
    const ids = [...state.tray.ids];
    [ids[index], ids[next]] = [ids[next], ids[index]];
    state.tray.ids = ids;
    saveTray();
    renderTray();
  }

  function clearTray() {
    state.tray.ids = [];
    saveTray();
    renderTray();
  }

  function trayMapHref() {
    if (!state.tray.ids.length) {
      return "#/map";
    }
    return Catalog.buildRoute({
      ...Catalog.defaultState(),
      view: "dataset",
      datasetId: state.tray.ids[0],
      map: true,
      layers: [...state.tray.ids],
    });
  }

  function trayCompareHref() {
    if (state.tray.ids.length < 2) {
      return "#/compare";
    }
    return Catalog.buildRoute({
      ...Catalog.defaultState(),
      view: "compare",
      compareLeft: state.tray.ids[0],
      compareRight: state.tray.ids[1],
    });
  }

  function traySeriesHref() {
    if (state.tray.ids.length < 2) {
      return "#/series";
    }
    return Catalog.buildRoute({
      ...Catalog.defaultState(),
      view: "series",
      seriesLayers: state.tray.ids.slice(0, 6),
      seriesSpeed: state.series.speed || 1000,
    });
  }

  function renderTray() {
    if (!els?.trayBody) {
      return;
    }
    syncTrayButton();
    if (!state.tray.ids.length) {
      els.trayBody.innerHTML = `
        <div class="tray-empty">
          <p>No layers in the tray.</p>
          <p>Use the + buttons in Browse, Dataset, or Map to collect layers.</p>
          <a class="secondary-button" href="#/catalog?preview=available">Browse previewable layers</a>
        </div>
        <div class="tray-actions">
          <button class="secondary-button" type="button" data-workspace-save>Save workspace</button>
          <button class="secondary-button" type="button" data-workspace-share>Copy share link</button>
        </div>
        <h3 class="tray-saved-heading">Saved workspaces</h3>
        ${renderWorkspaceList()}`;
      return;
    }
    els.trayBody.innerHTML = `
      <div class="tray-list">
        ${state.tray.ids
          .map((datasetId, index) => {
            const artifact = trayLayer(datasetId);
            const title = artifact?.title || datasetId;
            return `<div class="tray-layer" data-tray-id="${Catalog.escapeHtml(datasetId)}">
              <div>
                <b>${Catalog.escapeHtml(title)}</b>
                <small>${Catalog.escapeHtml(datasetId)}</small>
              </div>
              <div class="tray-layer-actions">
                <button type="button" data-tray-move="${Catalog.escapeHtml(datasetId)}" data-direction="-1" aria-label="Move ${Catalog.escapeHtml(title)} up" ${index === 0 ? "disabled" : ""}>↑</button>
                <button type="button" data-tray-move="${Catalog.escapeHtml(datasetId)}" data-direction="1" aria-label="Move ${Catalog.escapeHtml(title)} down" ${index === state.tray.ids.length - 1 ? "disabled" : ""}>↓</button>
                <button type="button" data-tray-remove="${Catalog.escapeHtml(datasetId)}" aria-label="Remove ${Catalog.escapeHtml(title)}">×</button>
              </div>
            </div>`;
          })
          .join("")}
      </div>
      <div class="tray-actions">
        <a class="primary-button" href="${trayMapHref()}" data-tray-open-map>Open map with tray</a>
        <a class="secondary-button" href="${trayCompareHref()}">Compare first two</a>
        ${state.tray.ids.length >= 2 ? `<a class="secondary-button" href="${traySeriesHref()}">Flicker series</a>` : ""}
        <button class="secondary-button" type="button" data-tray-clear>Clear tray</button>
        <button class="secondary-button" type="button" data-workspace-save>Save workspace</button>
        <button class="secondary-button" type="button" data-workspace-share>Copy share link</button>
      </div>
      <p class="clip-status">The first tray layer becomes the primary map layer. Up to three additional tray layers render as context overlays.</p>
      <h3 class="tray-saved-heading">Saved workspaces</h3>
      ${renderWorkspaceList()}`;
  }

  function openTray(trigger = document.activeElement) {
    closeAssistant();
    closeDiscover();
    if (els.clipPanel && !els.clipPanel.hidden) {
      closeClipPanel();
    }
    rememberPanelTrigger(els.trayPanel, trigger);
    state.tray.open = true;
    els.trayPanel.hidden = false;
    renderTray();
    syncTrayButton();
    focusPanel(els.trayPanel, "#tray-close");
  }

  function closeTray() {
    if (!els.trayPanel || els.trayPanel.hidden) {
      return;
    }
    const panel = els.trayPanel;
    state.tray.open = false;
    panel.hidden = true;
    syncTrayButton();
    restorePanelFocus(panel);
  }

  function toggleTray() {
    if (state.tray.open) {
      closeTray();
    } else {
      openTray();
    }
  }

  const WorkspaceStorageKey = "fresh-hectaresbc.workspaces.v1";

  function loadWorkspaces() {
    try {
      const stored = JSON.parse(localStorage.getItem(WorkspaceStorageKey) || "[]");
      state.workspaces.items = Array.isArray(stored)
        ? stored.filter(
            (item) =>
              item &&
              typeof item.id === "string" &&
              typeof item.name === "string" &&
              item.state &&
              typeof item.state === "object"
          )
        : [];
    } catch (error) {
      state.workspaces.items = [];
    }
  }

  function saveWorkspaces() {
    try {
      localStorage.setItem(
        WorkspaceStorageKey,
        JSON.stringify(state.workspaces.items.slice(0, 50))
      );
    } catch (error) {
      // Non-fatal; the in-memory list remains usable.
    }
  }

  function geometryNumberCount(value) {
    if (Array.isArray(value)) {
      return value.reduce((total, item) => total + geometryNumberCount(item), 0);
    }
    return typeof value === "number" && Number.isFinite(value) ? 1 : 0;
  }

  function currentWorkspaceState() {
    const primary = currentMapDatasetId() || state.tray.ids[0] || null;
    const view = state.mapHandle?.__hbc?.getView?.() || state.workspace.view;
    let aoi = null;
    if (state.clip.aoi?.query) {
      aoi = {
        name: state.clip.aoi.name || state.clip.name || "Boundary AOI",
        query: state.clip.aoi.query,
        area_ha: Number(state.clip.areaHa || state.clip.aoi.area_ha || 0),
      };
    } else if (state.clip.geometry) {
      const count = geometryNumberCount(state.clip.geometry.coordinates);
      aoi = {
        name: state.clip.name || "Drawn AOI",
        geometry: count <= 2000 ? state.clip.geometry : null,
        geometry_omitted: count > 2000,
        area_ha: Number(state.clip.areaHa || 0),
      };
    }
    return {
      v: 1,
      primary,
      layers: [...new Set(state.tray.ids)].slice(0, 6),
      view: view && Array.isArray(view.center) ? view : null,
      aoi,
      clip_selected: [...state.clip.selected].slice(0, state.clip.maxLayers),
    };
  }

  function workspaceHref(payload) {
    if (!payload?.primary) {
      return "#/map";
    }
    return Catalog.buildRoute({
      ...Catalog.defaultState(),
      view: "dataset",
      datasetId: payload.primary,
      map: true,
      workspace: JSON.stringify(payload),
    });
  }

  function decodeWorkspace(raw) {
    if (!raw) {
      return null;
    }
    try {
      const payload = JSON.parse(raw);
      if (!payload || payload.v !== 1 || typeof payload.primary !== "string") {
        return null;
      }
      if (payload.layers !== undefined && !Array.isArray(payload.layers)) {
        return null;
      }
      return payload;
    } catch (error) {
      return null;
    }
  }

  function applyWorkspacePayload(payload, raw) {
    state.workspace.applied = raw;
    state.workspace.view = payload.view || null;
    state.workspace.aoi =
      payload.aoi && typeof payload.aoi === "object" ? payload.aoi : null;
    state.workspace.aoiApplied = false;
    state.tray.ids = [
      ...new Set(
        (payload.layers || []).filter((value) => typeof value === "string")
      ),
    ].slice(0, 6);
    saveTray();
    state.clip.selected = new Set(
      (payload.clip_selected || [])
        .filter((value) => typeof value === "string")
        .slice(0, state.clip.maxLayers)
    );
    if (payload.primary) {
      state.selectedId = payload.primary;
      state.clip.datasetId = payload.primary;
    }
    if (!state.workspace.aoi) {
      state.clip.aoi = null;
      state.clip.geometry = null;
      state.clip.areaHa = null;
      state.clip.areaWithinLimit = null;
      state.clip.areaPending = false;
    }
    renderTray();
  }

  async function restoreWorkspaceAoi() {
    const aoi = state.workspace.aoi;
    if (!aoi || state.workspace.aoiApplied || !state.mapHandle?.__hbc) {
      return;
    }
    state.workspace.aoiApplied = true;
    if (aoi.geometry) {
      state.clip.aoi = null;
      state.clip.geometry = aoi.geometry;
      state.clip.name = aoi.name || "Drawn AOI";
      state.clip.areaHa = Number.isFinite(Number(aoi.area_ha))
        ? Number(aoi.area_ha)
        : null;
      state.clip.areaWithinLimit =
        state.clip.areaHa == null
          ? null
          : state.clip.areaHa <= state.clip.maxAreaHa;
      state.clip.areaPending = false;
      state.clip.error = state.clip.areaWithinLimit === false;
      state.clip.message = aoi.geometry_omitted
        ? "Workspace AOI geometry was too large to share."
        : clipAoiSummary();
      state.mapHandle.__hbc.setAoi(aoi.geometry, { fit: false });
      renderClipPanel();
      return;
    }
    if (aoi.query && state.serviceAvailable) {
      state.clip.areaPending = true;
      state.clip.message = "Restoring workspace AOI…";
      renderClipPanel();
      try {
        const response = await fetch("../api/aoi/resolve", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: aoi.query, name: aoi.name || null }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.status !== "ok" || !payload.geometry) {
          throw new Error(payload.detail || "boundary could not be restored");
        }
        state.clip.aoi = payload;
        state.clip.geometry = payload.geometry;
        state.clip.name = payload.name || aoi.name || "AOI";
        state.clip.areaHa = Number(payload.area_ha || 0);
        state.clip.areaWithinLimit = state.clip.areaHa <= state.clip.maxAreaHa;
        state.clip.areaPending = false;
        state.clip.error = state.clip.areaWithinLimit === false;
        state.clip.message = clipAoiSummary();
        state.mapHandle?.__hbc?.setAoi(payload.geometry, { fit: false });
      } catch (error) {
        state.clip.areaPending = false;
        state.clip.error = true;
        state.clip.message = `Workspace AOI could not be restored: ${error.message}`;
      }
      renderClipPanel();
      return;
    }
    state.clip.message =
      "Workspace AOI needs the map service or a compact geometry to restore.";
    renderClipPanel();
  }

  function saveCurrentWorkspace() {
    const payload = currentWorkspaceState();
    const name = window.prompt("Name this workspace:", "Workspace");
    if (!name || !name.trim()) {
      return;
    }
    state.workspaces.items.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      name: name.trim().slice(0, 80),
      created_utc: new Date().toISOString(),
      state: payload,
    });
    saveWorkspaces();
    renderTray();
    showToast("Workspace saved.");
  }

  async function copyWorkspaceLink() {
    const payload = currentWorkspaceState();
    const href = new URL(workspaceHref(payload), window.location.href).href;
    try {
      await copyText(href);
      showToast("Workspace link copied.");
    } catch (error) {
      showToast("Could not copy the workspace link.");
    }
  }

  function openSavedWorkspace(id) {
    const item = state.workspaces.items.find((candidate) => candidate.id === id);
    if (!item) {
      return;
    }
    closeTray();
    navigate(Catalog.parseRoute(workspaceHref(item.state)));
  }

  function deleteSavedWorkspace(id) {
    state.workspaces.items = state.workspaces.items.filter(
      (item) => item.id !== id
    );
    saveWorkspaces();
    renderTray();
  }

  function renderWorkspaceList() {
    if (!state.workspaces.items.length) {
      return '<p class="tray-empty">No saved workspaces yet.</p>';
    }
    return `<div class="workspace-list">${state.workspaces.items
      .slice(0, 12)
      .map(
        (item) => `<div class="workspace-row">
          <button type="button" class="link-button" data-workspace-open="${Catalog.escapeHtml(item.id)}">${Catalog.escapeHtml(item.name)}</button>
          <button type="button" class="link-button" data-workspace-delete="${Catalog.escapeHtml(item.id)}" aria-label="Delete ${Catalog.escapeHtml(item.name)}">×</button>
        </div>`
      )
      .join("")}</div>`;
  }

  function clearPreflight() {
    state.preflight.busy = false;
    state.preflight.result = null;
    state.preflight.error = false;
  }

  function clipPreflightTemplate() {
    const result = state.preflight.result;
    if (!result) {
      return "";
    }
    const layers = Array.isArray(result.layers) ? result.layers : [];
    const warnings = layers.filter((layer) => layer.status !== "ok");
    return `<div class="clip-preflight">
      <strong>Estimate: ${Catalog.formatBytes(result.total_estimated_bytes || 0)} · ${Catalog.formatNumber(result.total_pixels || 0)} px · ~${Catalog.escapeHtml(String(result.estimated_seconds ?? 0))} s</strong>
      <p>${Catalog.escapeHtml(result.caveat || "")}</p>
      ${warnings.length ? `<p class="clip-status error">${warnings.length} layer warning${warnings.length === 1 ? "" : "s"}</p>` : ""}
      <details><summary>Layer estimates</summary><ul>${layers
        .map(
          (layer) =>
            `<li><b>${Catalog.escapeHtml(layer.dataset_id)}</b> · ${Catalog.escapeHtml(layer.status)}${layer.pixels ? ` · ${Catalog.formatNumber(layer.width)}×${Catalog.formatNumber(layer.height)} · ${Catalog.formatBytes(layer.estimated_bytes)}` : ""}${layer.message ? ` · ${Catalog.escapeHtml(layer.message)}` : ""}</li>`
        )
        .join("")}</ul></details>
    </div>`;
  }

  function loadAoiLibrary() {
    try {
      const stored = JSON.parse(localStorage.getItem(AoiStorageKey) || "[]");
      state.aois.items = Array.isArray(stored)
        ? stored.filter(
            (item) =>
              item &&
              typeof item.id === "string" &&
              typeof item.name === "string" &&
              (typeof item.query === "string" || item.geometry)
          )
        : [];
    } catch (error) {
      state.aois.items = [];
    }
  }

  function saveAoiLibrary() {
    try {
      localStorage.setItem(
        AoiStorageKey,
        JSON.stringify(state.aois.items.slice(0, 20))
      );
    } catch (error) {
      // Non-fatal; keep the in-memory list.
    }
  }

  function aoiDedupeKey(record) {
    if (record.query) {
      return `q:${record.query}|${record.name || ""}`;
    }
    if (record.geometry) {
      return `g:${Math.round(Number(record.area_ha || 0))}|${geometryNumberCount(record.geometry.coordinates)}`;
    }
    return "";
  }

  function rememberAoi(record) {
    if (!record || (!record.query && !record.geometry)) {
      return;
    }
    const key = aoiDedupeKey(record);
    if (!key) {
      return;
    }
    const now = new Date().toISOString();
    const existingIndex = state.aois.items.findIndex(
      (item) => aoiDedupeKey(item) === key
    );
    const existing =
      existingIndex >= 0 ? state.aois.items[existingIndex] : null;
    const item = {
      id: existing?.id || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      name: record.name || existing?.name || "AOI",
      named: Boolean(record.named || existing?.named),
      query: record.query || null,
      geometry: record.geometry || null,
      geometry_omitted: Boolean(record.geometry_omitted),
      area_ha: Number.isFinite(Number(record.area_ha))
        ? Number(record.area_ha)
        : existing?.area_ha || null,
      created_utc: existing?.created_utc || now,
      updated_utc: now,
    };
    if (existingIndex >= 0) {
      state.aois.items.splice(existingIndex, 1);
    }
    state.aois.items.unshift(item);
    state.aois.items.sort((left, right) =>
      String(right.updated_utc).localeCompare(String(left.updated_utc))
    );
    state.aois.items = state.aois.items.slice(0, 20);
    saveAoiLibrary();
    if (state.clip.open) {
      renderClipPanel();
    }
  }

  function currentAoiRecord() {
    if (!state.clip.geometry) {
      return null;
    }
    if (state.clip.aoi?.query) {
      return {
        name: state.clip.aoi.name || state.clip.name || "Boundary AOI",
        query: state.clip.aoi.query,
        geometry: null,
        area_ha: Number(state.clip.areaHa || state.clip.aoi.area_ha || 0),
        named: false,
      };
    }
    const count = geometryNumberCount(state.clip.geometry.coordinates);
    return {
      name: state.clip.name || "Drawn AOI",
      query: null,
      geometry: count <= 2000 ? state.clip.geometry : null,
      geometry_omitted: count > 2000,
      area_ha: Number(state.clip.areaHa || 0),
      named: false,
    };
  }

  function saveCurrentAoi() {
    const record = currentAoiRecord();
    if (!record) {
      showToast("Draw or resolve an AOI first.");
      return;
    }
    if (record.geometry_omitted) {
      showToast("This AOI geometry is too large to save locally.");
      return;
    }
    const name = window.prompt("Name this AOI:", record.name || "AOI");
    if (!name || !name.trim()) {
      return;
    }
    rememberAoi({ ...record, name: name.trim().slice(0, 80), named: true });
    showToast("AOI saved to library.");
  }

  async function applyAoiRecord(id) {
    const item = state.aois.items.find((candidate) => candidate.id === id);
    if (!item) {
      return;
    }
    state.clip.areaToken += 1;
    if (item.geometry) {
      state.clip.aoi = null;
      state.clip.geometry = item.geometry;
      state.clip.name = item.name;
      state.clip.areaHa = item.area_ha ?? null;
      state.clip.areaWithinLimit =
        state.clip.areaHa == null
          ? null
          : state.clip.areaHa <= state.clip.maxAreaHa;
      state.clip.areaPending = state.clip.areaHa == null;
      state.clip.error = state.clip.areaWithinLimit === false;
      clearPreflight();
      state.clip.message = state.clip.areaPending
        ? "Saved AOI restored · checking area…"
        : clipAoiSummary();
      state.mapHandle?.__hbc?.setAoi(item.geometry, { fit: true });
      renderClipPanel();
      if (state.clip.areaHa == null) {
        await inspectClipAoi(item.geometry);
      }
      return;
    }
    if (item.query && state.serviceAvailable) {
      state.clip.busy = true;
      state.clip.message = "Restoring saved AOI…";
      state.clip.areaPending = true;
      renderClipPanel();
      try {
        const response = await fetch("../api/aoi/resolve", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: item.query, name: item.name }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.status !== "ok" || !payload.geometry) {
          throw new Error(payload.detail || "AOI could not be restored");
        }
        state.clip.aoi = payload;
        state.clip.geometry = payload.geometry;
        state.clip.name = payload.name || item.name;
        state.clip.areaHa = Number(payload.area_ha || 0);
        state.clip.areaWithinLimit = state.clip.areaHa <= state.clip.maxAreaHa;
        state.clip.areaPending = false;
        state.clip.error = state.clip.areaWithinLimit === false;
        state.clip.message = clipAoiSummary();
        clearPreflight();
        state.mapHandle?.__hbc?.setAoi(payload.geometry, { fit: true });
        rememberAoi({
          ...item,
          geometry: null,
          area_ha: state.clip.areaHa,
          named: item.named,
        });
      } catch (error) {
        state.clip.areaPending = false;
        state.clip.error = true;
        state.clip.message = `Saved AOI could not be restored: ${error.message}`;
      } finally {
        state.clip.busy = false;
        renderClipPanel();
      }
      return;
    }
    state.clip.error = true;
    state.clip.message =
      "This AOI needs the map service or a compact geometry to restore.";
    renderClipPanel();
  }

  function deleteAoiRecord(id) {
    state.aois.items = state.aois.items.filter((item) => item.id !== id);
    saveAoiLibrary();
    renderClipPanel();
  }

  function renderAoiLibraryTemplate() {
    const items = state.aois.items.slice(0, 10);
    return `<div class="clip-aoi-library">
      <div class="clip-aoi-library-head">
        <h3>AOI library</h3>
        <button class="secondary-button" type="button" data-clip-save-aoi ${state.clip.geometry ? "" : "disabled"}>Save current</button>
      </div>
      ${items.length
        ? `<div class="clip-aoi-list">${items
            .map(
              (item) => `<div class="clip-aoi-row">
                <button class="clip-aoi-apply" type="button" data-clip-aoi-apply="${Catalog.escapeHtml(item.id)}">
                  <b>${Catalog.escapeHtml(item.name)}</b>
                  <small>${item.area_ha ? `${Catalog.formatNumber(item.area_ha)} ha · ` : ""}${item.named ? "saved" : "recent"}</small>
                </button>
                <button class="clip-aoi-delete" type="button" data-clip-aoi-delete="${Catalog.escapeHtml(item.id)}" aria-label="Delete ${Catalog.escapeHtml(item.name)}">×</button>
              </div>`
            )
            .join("")}</div>`
        : '<p class="clip-status">Resolved and drawn AOIs appear here automatically.</p>'}
    </div>`;
  }

  async function loadAssistantInfo() {
    const info = await fetchJson("../api/agent");
    if (!info || !info.enabled) {
      if (els.assistantButton) {
        els.assistantButton.hidden = true;
      }
      return;
    }
    state.assistant.enabled = true;
    state.assistant.available = Boolean(info.available);
    els.assistantButton.hidden = false;
    els.assistantButton.setAttribute("aria-expanded", "false");
    const model = info.model ? String(info.model).split("/").pop() : "agent";
    els.assistantModel.textContent = info.available ? model : "opencode unavailable";
    if (!info.available) {
      els.assistantInput.disabled = true;
      els.assistantSend.disabled = true;
      els.assistantStatus.textContent = "opencode is not on the service PATH";
    }
  }

  function assistantContext() {
    const record = state.selectedId ? getRecordSync(state.selectedId) : null;
    return {
      route: window.location.hash,
      view: state.route.view,
      dataset_id: state.route.datasetId || state.selectedId || null,
      dataset_title: record ? Catalog.titleLabel(record) : null,
      query: state.route.query || "",
      family: state.route.family || "all",
      preview: state.route.preview || "all",
      verification: state.route.verification || "all",
      size: state.route.size || "all",
      visible_results:
        document.querySelectorAll(".result-row").length ||
        document.querySelectorAll(".result-card").length,
      map_layer:
        document.querySelector(".map-title-card h1")?.textContent?.trim() || null,
      preview_index: state.previewMeta?.available || 0,
      highres_previews: state.previewMeta?.highresCount || 0,
    };
  }

  function openAssistant(trigger = document.activeElement) {
    if (!state.assistant.enabled) {
      return;
    }
    if (els.clipPanel && !els.clipPanel.hidden) {
      closeClipPanel();
    }
    closeTray();
    closeDiscover();
    rememberPanelTrigger(els.assistantPanel, trigger);
    els.assistantPanel.hidden = false;
    els.assistantButton.setAttribute("aria-expanded", "true");
    els.assistantInput.focus();
  }

  function closeAssistant() {
    if (!els.assistantPanel || els.assistantPanel.hidden) {
      return;
    }
    const panel = els.assistantPanel;
    panel.hidden = true;
    els.assistantButton.setAttribute("aria-expanded", "false");
    restorePanelFocus(panel);
  }

  function newAssistantChat() {
    state.assistant.session = null;
    els.assistantLog.replaceChildren();
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent =
      "New conversation. Ask about the catalog, a layer, AOI clipping, or the map.";
    els.assistantLog.append(hint);
    els.assistantStatus.textContent = "";
    els.assistantInput.focus();
  }

  function appendAssistantMessage(role, content, { html = false } = {}) {
    const node = document.createElement("div");
    node.className = `assistant-msg ${role}`;
    if (html) {
      node.innerHTML = content;
    } else {
      node.textContent = content;
    }
    els.assistantLog.append(node);
    els.assistantLog.scrollTop = els.assistantLog.scrollHeight;
    return node;
  }

  function renderAssistantMarkdown(text) {
    const value = String(text || "");
    const segments = value.split(/```/);
    return segments
      .map((segment, index) => {
        if (index % 2 === 1) {
          return `<pre><code>${Catalog.escapeHtml(segment.trim())}</code></pre>`;
        }
        return renderAssistantInline(segment);
      })
      .join("");
  }

  function renderAssistantInline(text) {
    let escaped = Catalog.escapeHtml(text);
    escaped = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    escaped = escaped.replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)|(https?:\/\/[^\s<]+|\/api\/[^\s<]+)/g,
      (match, label, href, bare) => {
        const url = href || bare;
        if (!url) {
          return match;
        }
        return `<a href="${url}" target="_blank" rel="noreferrer">${label || url}</a>`;
      }
    );
    return escaped.replace(/\n/g, "<br>");
  }

  async function sendAssistantMessage(text) {
    if (!state.assistant.enabled || state.assistant.busy) {
      return;
    }
    if (!state.assistant.available) {
      els.assistantStatus.textContent = "The assistant process is not available.";
      return;
    }
    const message = String(text || "").trim();
    if (!message) {
      return;
    }
    appendAssistantMessage("user", message);
    const thinking = appendAssistantMessage("agent", "thinking…");
    thinking.classList.add("thinking");
    state.assistant.busy = true;
    els.assistantSend.disabled = true;
    els.assistantStatus.textContent = "";
    try {
      const response = await fetch("../api/agent/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message,
          session: state.assistant.session,
          context: assistantContext(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || `assistant failed (${response.status})`);
      }
      state.assistant.session = payload.session || state.assistant.session;
      thinking.remove();
      const reply = appendAssistantMessage(
        "agent",
        renderAssistantMarkdown(payload.reply || "(no reply)"),
        { html: true }
      );
      if (Array.isArray(payload.actions) && payload.actions.length) {
        const row = document.createElement("div");
        row.className = "assistant-actions";
        for (const action of payload.actions) {
          const chip = document.createElement("span");
          chip.className = "assistant-action";
          chip.textContent = `${action.tool}${action.summary ? `: ${action.summary}` : ""}`;
          chip.title = chip.textContent;
          row.append(chip);
        }
        reply.append(row);
      }
    } catch (error) {
      thinking.remove();
      const node = appendAssistantMessage(
        "error",
        `Assistant unavailable: ${error.message}`
      );
      node.classList.add("error");
    } finally {
      state.assistant.busy = false;
      els.assistantSend.disabled = false;
      els.assistantInput.focus();
      els.assistantLog.scrollTop = els.assistantLog.scrollHeight;
    }
  }

  /* ------------------------------------------------------------- discover */

  function validBbox(bounds) {
    return Array.isArray(bounds) &&
      bounds.length === 4 &&
      bounds.every((value) => Number.isFinite(Number(value)))
      ? bounds.map(Number)
      : null;
  }

  function bboxFromPairs(bounds) {
    if (!Array.isArray(bounds) || bounds.length !== 2) {
      return null;
    }
    const west = Math.min(Number(bounds[0][0]), Number(bounds[1][0]));
    const east = Math.max(Number(bounds[0][0]), Number(bounds[1][0]));
    const south = Math.min(Number(bounds[0][1]), Number(bounds[1][1]));
    const north = Math.max(Number(bounds[0][1]), Number(bounds[1][1]));
    if (![west, south, east, north].every(Number.isFinite)) {
      return null;
    }
    return [west, south, east, north];
  }

  function bboxIntersects(left, right) {
    return (
      left[0] <= right[2] &&
      left[2] >= right[0] &&
      left[1] <= right[3] &&
      left[3] >= right[1]
    );
  }

  function geometryBbox(geometry) {
    const coordinates = [];
    const walk = (value) => {
      if (!Array.isArray(value)) {
        return;
      }
      if (
        value.length >= 2 &&
        Number.isFinite(Number(value[0])) &&
        Number.isFinite(Number(value[1]))
      ) {
        coordinates.push([Number(value[0]), Number(value[1])]);
        return;
      }
      value.forEach(walk);
    };
    walk(geometry?.coordinates);
    if (!coordinates.length) {
      return null;
    }
    return [
      Math.min(...coordinates.map((point) => point[0])),
      Math.min(...coordinates.map((point) => point[1])),
      Math.max(...coordinates.map((point) => point[0])),
      Math.max(...coordinates.map((point) => point[1])),
    ];
  }

  function currentAoiBbox() {
    const bounds = validBbox(state.clip.aoi?.bbox_wgs84);
    if (bounds) {
      return bounds;
    }
    return geometryBbox(state.clip.geometry);
  }

  function artifactBbox(artifact) {
    return (
      validBbox(artifact?._map_bounds_wgs84) ||
      validBbox(artifact?.wgs84_bounds)
    );
  }

  function discoverResults() {
    const query = Catalog.normalizeText(state.discover.query);
    return state.discover.results
      .filter(
        (item) =>
          state.discover.family === "all" ||
          item.family === state.discover.family
      )
      .filter(
        (item) =>
          !query ||
          Catalog.normalizeText(`${item.title} ${item.dataset_id}`).includes(
            query
          )
      );
  }

  function runSpatialDiscovery() {
    if (!state.previewIndex) {
      state.discover.results = [];
      renderDiscover();
      return;
    }
    let bbox = null;
    if (state.discover.source === "aoi") {
      bbox = currentAoiBbox();
    } else {
      bbox = bboxFromPairs(state.mapHandle?.__hbc?.getBounds?.());
    }
    if (!bbox) {
      state.discover.results = [];
      renderDiscover();
      return;
    }
    state.discover.results = [...state.previewIndex.values()]
      .filter((artifact) =>
        ["source_derived_preview", "already_present"].includes(
          artifact.artifact_status || artifact.status
        )
      )
      .map((artifact) => ({
        dataset_id: artifact.dataset_id,
        title: artifact.title || artifact.dataset_id,
        family: artifact.source_family || "",
        bounds: artifactBbox(artifact),
      }))
      .filter((item) => item.bounds && bboxIntersects(item.bounds, bbox))
      .sort((left, right) =>
        left.title.localeCompare(right.title, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      );
    renderDiscover();
  }

  function renderDiscover() {
    if (!els?.discoverBody) {
      return;
    }
    const aoiBbox = currentAoiBbox();
    if (state.discover.source === "aoi" && !aoiBbox) {
      state.discover.source = "view";
    }
    const results = discoverResults();
    const capacity = Math.max(0, state.clip.maxLayers - state.tray.ids.length);
    const visible = results.slice(0, 60);
    els.discoverBody.innerHTML = `
      <div class="discover-source" role="group" aria-label="Discovery source">
        <button type="button" data-discover-source="view" class="${state.discover.source === "view" ? "is-active" : ""}">Current view</button>
        <button type="button" data-discover-source="aoi" class="${state.discover.source === "aoi" ? "is-active" : ""}" ${aoiBbox ? "" : "disabled"}>AOI</button>
      </div>
      <div class="discover-actions">
        <button class="primary-button" type="button" data-discover-run>Find layers</button>
        <button class="secondary-button" type="button" data-discover-bulk ${visible.length && capacity ? "" : "disabled"}>Add ${Math.min(capacity, visible.length)} to tray</button>
      </div>
      <p class="clip-status">${Catalog.formatNumber(state.discover.results.length)} previewable layers have bounds intersecting the ${state.discover.source === "aoi" ? "AOI" : "current map view"}. This is a bounds test, not an exact spatial intersection.</p>
      <label class="clip-field">Filter results
        <input id="discover-search" type="search" value="${Catalog.escapeHtml(state.discover.query)}" placeholder="Search discovered layers…" autocomplete="off">
      </label>
      <label class="clip-field">Family
        <select id="discover-family">
          <option value="all" ${state.discover.family === "all" ? "selected" : ""}>All families</option>
          <option value="data_layer" ${state.discover.family === "data_layer" ? "selected" : ""}>Data layers</option>
          <option value="virtual_layer" ${state.discover.family === "virtual_layer" ? "selected" : ""}>Virtual layers</option>
        </select>
      </label>
      ${visible.length
        ? `<div class="discover-results">${visible
            .map(
              (item) => `<div class="discover-result">
                <div>
                  <b>${Catalog.escapeHtml(item.title)}</b>
                  <small>${Catalog.escapeHtml(item.dataset_id)} · ${Catalog.escapeHtml(Catalog.familyLabel(item.family))}</small>
                </div>
                <button class="tray-add" type="button" data-discover-add="${Catalog.escapeHtml(item.dataset_id)}" aria-label="Add ${Catalog.escapeHtml(item.title)} to tray">+</button>
              </div>`
            )
            .join("")}</div>`
        : '<p class="tray-empty">No previewable layers intersect this area. Try a larger view or another AOI.</p>'}
      <p class="clip-status">${state.tray.ids.length}/${state.clip.maxLayers} tray slots used.</p>`;
  }

  function openDiscover(trigger = document.activeElement) {
    closeAssistant();
    closeClipPanel();
    closeTray();
    rememberPanelTrigger(els.discoverPanel, trigger);
    state.discover.open = true;
    els.discoverPanel.hidden = false;
    renderDiscover();
    setDisclosure("[data-discover-open]", true);
    focusPanel(els.discoverPanel, "#discover-close");
    if (state.discover.source === "view") {
      runSpatialDiscovery();
    }
  }

  function closeDiscover() {
    if (!els.discoverPanel || els.discoverPanel.hidden) {
      return;
    }
    const panel = els.discoverPanel;
    state.discover.open = false;
    panel.hidden = true;
    setDisclosure("[data-discover-open]", false);
    restorePanelFocus(panel);
  }

  function handleDiscoverClick(event) {
    const target = event.target;
    if (target.closest("[data-discover-close]")) {
      closeDiscover();
      return;
    }
    const source = target.closest("[data-discover-source]");
    if (source) {
      state.discover.source = source.dataset.discoverSource;
      renderDiscover();
      return;
    }
    if (target.closest("[data-discover-run]")) {
      runSpatialDiscovery();
      return;
    }
    const add = target.closest("[data-discover-add]");
    if (add) {
      addToTray(add.dataset.discoverAdd);
      renderDiscover();
      return;
    }
    if (target.closest("[data-discover-bulk]")) {
      const capacity = Math.max(0, state.clip.maxLayers - state.tray.ids.length);
      for (const item of discoverResults().slice(0, capacity)) {
        if (!state.tray.ids.includes(item.dataset_id)) {
          state.tray.ids.push(item.dataset_id);
        }
      }
      saveTray();
      renderTray();
      renderDiscover();
      showToast("Layers added to tray.");
    }
  }

  function handleDiscoverInput(event) {
    if (event.target.id === "discover-search") {
      state.discover.query = event.target.value;
      renderDiscover();
      const input = els.discoverBody?.querySelector("#discover-search");
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
  }

  function handleDiscoverChange(event) {
    if (event.target.id === "discover-family") {
      state.discover.family = event.target.value;
      renderDiscover();
    }
  }

  /* ------------------------------------------------------------------ clip */


  function currentMapDatasetId() {
    return state.route.datasetId || state.selectedId || null;
  }

  function waitForMapReady(handle, timeout = 15000) {
    if (handle?.__hbcReady) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      const started = Date.now();
      const check = () => {
        if (handle?.__hbcReady) {
          resolve(true);
        } else if (Date.now() - started >= timeout) {
          resolve(false);
        } else {
          window.setTimeout(check, 100);
        }
      };
      check();
    });
  }

  function resetClipState() {
    stopClipPolling();
    state.clip.aoi = null;
    state.clip.geometry = null;
    state.clip.candidates = [];
    state.clip.selected = new Set();
    state.clip.lastResult = null;
    state.clip.message = "";
    state.clip.error = false;
    state.clip.busy = false;
    state.clip.jobId = null;
    state.clip.job = null;
    state.clip.progress = 0;
    state.clip.areaHa = null;
    state.clip.areaWithinLimit = null;
    state.clip.areaPending = false;
    state.clip.areaToken += 1;
    clearPreflight();
    state.mapHandle?.__hbc?.cancelRectangleDraw?.();
    state.mapHandle?.__hbc?.clearAoi?.();
  }

  function clipLayerOptions() {
    if (!state.previewIndex) {
      return [];
    }
    return [...state.previewIndex.values()]
      .filter((artifact) =>
        ["source_derived_preview", "already_present"].includes(
          artifact.artifact_status || artifact.status
        )
      )
      .map((artifact) => ({
        dataset_id: artifact.dataset_id,
        title: artifact.title || artifact.dataset_id,
        family: artifact.source_family || "",
        search: Catalog.normalizeText(
          `${artifact.title || ""} ${artifact.dataset_id || ""}`
        ),
      }))
      .sort((left, right) =>
        left.title.localeCompare(right.title, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      );
  }

  function clipCandidateOptions() {
    return (state.clip.candidates || []).map((candidate) =>
      typeof candidate === "string"
        ? { label: candidate, name: candidate }
        : candidate
    );
  }

  function clipAoiSummary() {
    if (state.clip.areaPending) {
      return "Drawn AOI · checking area…";
    }
    if (state.clip.areaHa != null) {
      const area = Number(state.clip.areaHa);
      const label = state.clip.aoi?.name || state.clip.name || "AOI";
      if (state.clip.areaWithinLimit === false) {
        return `${label} · ${Catalog.formatNumber(area)} ha; limit ${Catalog.formatNumber(state.clip.maxAreaHa)} ha`;
      }
      return `${label} · ${Catalog.formatNumber(area)} ha`;
    }
    if (state.clip.aoi) {
      const area = Number(state.clip.aoi.area_ha || 0);
      return `${state.clip.aoi.name || "AOI"} · ${Catalog.formatNumber(area)} ha`;
    }
    if (state.clip.geometry) {
      return "Drawn AOI";
    }
    return "No AOI selected.";
  }

  function clipAreaPercent() {
    if (state.clip.areaHa == null || !state.clip.maxAreaHa) {
      return 0;
    }
    return Math.min(100, Math.max(0, (Number(state.clip.areaHa) / state.clip.maxAreaHa) * 100));
  }

  function clipAreaTemplate() {
    if (state.clip.areaHa == null) {
      return "";
    }
    const percent = clipAreaPercent();
    const over = state.clip.areaWithinLimit === false;
    const near = !over && percent >= 80;
    const tone = over ? " is-over" : near ? " is-near" : "";
    return `<div class="clip-area${tone}">
      <div class="clip-area-meter" role="meter" aria-label="AOI area against limit" aria-valuemin="0" aria-valuemax="${Math.round(state.clip.maxAreaHa)}" aria-valuenow="${Math.round(Number(state.clip.areaHa))}">
        <div class="clip-area-meter-bar" style="width:${percent}%"></div>
      </div>
      <p class="clip-area-caption">${Catalog.formatNumber(Number(state.clip.areaHa))} ha of ${Catalog.formatNumber(state.clip.maxAreaHa)} ha${over ? " · reduce the AOI before preparing a bundle" : ""}</p>
    </div>`;
  }

  function clipResultTemplate() {
    const result = state.clip.lastResult;
    if (!result) {
      return "";
    }
    const failures = Array.isArray(result.failures) ? result.failures : [];
    const layers = Array.isArray(result.layers) ? result.layers : [];
    const tone =
      result.status === "failed"
        ? " error"
        : result.status === "partial"
          ? " warn"
          : "";
    const parts = [
      `<strong>${Catalog.escapeHtml(result.status || "complete")}</strong>`,
      `${layers.length} layer${layers.length === 1 ? "" : "s"}`,
      result.zip_bytes ? Catalog.formatBytes(result.zip_bytes) : "",
      failures.length ? `${failures.length} failure${failures.length === 1 ? "" : "s"}` : "",
    ].filter(Boolean);
    const failureDetails = failures.length
      ? `<details class="clip-failures">
          <summary>${failures.length} layer failure${failures.length === 1 ? "" : "s"}</summary>
          <ul>${failures
            .map(
              (failure) =>
                `<li><code>${Catalog.escapeHtml(failure?.dataset_id || "unknown")}</code><span>${Catalog.escapeHtml(failure?.error || "Clipping failed.")}</span></li>`
            )
            .join("")}</ul>
        </details>
        <button class="secondary-button clip-retry" type="button" data-clip-retry>Retry failed layer${failures.length === 1 ? "" : "s"}</button>`
      : "";
    return `<div class="clip-result${tone}">
      ${parts.join(" · ")}
      ${result.download_url ? `<a href="${Catalog.escapeHtml(result.download_url)}" target="_blank" rel="noreferrer">Download bundle ZIP</a>` : ""}
      ${failureDetails}
    </div>`;
  }

  function clipRecentTemplate() {
    if (!state.clip.recent.length) {
      return '<p class="clip-status">No bundles yet.</p>';
    }
    return `<div class="clip-recent">${state.clip.recent
      .slice(0, 8)
      .map(
        (bundle) =>
          `<a href="${Catalog.escapeHtml(bundle.download_url || "#")}" target="_blank" rel="noreferrer">
            <span>${Catalog.escapeHtml(bundle.aoi?.name || bundle.bundle_id || "bundle")}</span>
            <span>${Catalog.formatNumber(bundle.layer_count || 0)} layer${Number(bundle.layer_count) === 1 ? "" : "s"} · ${Catalog.escapeHtml(bundle.status || "")}</span>
          </a>`
      )
      .join("")}</div>`;
  }

  function renderClipLayers() {
    const node = els.clipBody?.querySelector("#clip-layer-results");
    if (!node) {
      return;
    }
    const query = Catalog.normalizeText(state.clip.search);
    const layers = clipLayerOptions()
      .filter((layer) => !query || layer.search.includes(query))
      .slice(0, 40);
    if (!layers.length) {
      node.innerHTML = '<p class="clip-status">No matching previewable layers.</p>';
      return;
    }
    node.innerHTML = layers
      .map((layer) => {
        const selected = state.clip.selected.has(layer.dataset_id);
        const disabled = !selected && state.clip.selected.size >= state.clip.maxLayers;
        return `<label class="clip-layer${disabled ? " is-disabled" : ""}">
          <input type="checkbox" data-clip-layer value="${Catalog.escapeHtml(layer.dataset_id)}" ${selected ? "checked" : ""} ${disabled ? "disabled" : ""}>
          <span><b>${Catalog.escapeHtml(layer.title)}</b><small>${Catalog.escapeHtml(layer.dataset_id)}</small></span>
        </label>`;
      })
      .join("");
  }

  function renderClipPanel() {
    if (!els.clipBody) {
      return;
    }
    const selected = clipLayerOptions().filter((layer) =>
      state.clip.selected.has(layer.dataset_id)
    );
    const candidates = clipCandidateOptions();
    const canEstimate =
      !state.clip.busy &&
      !state.preflight.busy &&
      !state.clip.areaPending &&
      state.clip.areaWithinLimit !== false &&
      state.clip.selected.size > 0 &&
      Boolean(state.clip.geometry);
    const canPrepare =
      !state.clip.busy &&
      !state.clip.areaPending &&
      state.clip.areaWithinLimit !== false &&
      state.clip.selected.size > 0 &&
      Boolean(state.clip.geometry);
    const statusText = state.clip.message || clipAoiSummary();
    els.clipBody.innerHTML = `
      <section class="clip-section">
        <h3>Area of interest</h3>
        <label class="clip-field">Boundary layer
          <input id="clip-query" type="text" value="${Catalog.escapeHtml(state.clip.query)}" placeholder="timber supply area boundary">
        </label>
        <label class="clip-field">Feature name
          <input id="clip-name" type="text" value="${Catalog.escapeHtml(state.clip.name)}" placeholder="e.g. TSA 27 or Revelstoke TSA">
        </label>
        <div class="clip-actions">
          <button class="primary-button" type="button" data-clip-resolve ${state.clip.busy ? "disabled" : ""}>Resolve boundary</button>
          <button class="secondary-button" type="button" data-clip-draw ${state.clip.busy ? "disabled" : ""}>Draw box</button>
          <button class="secondary-button" type="button" data-clip-clear ${state.clip.busy ? "disabled" : ""}>Clear AOI</button>
        </div>
        <p class="clip-status${state.clip.error ? " error" : ""}">${Catalog.escapeHtml(statusText)}</p>
        ${clipAreaTemplate()}
        ${renderAoiLibraryTemplate()}
        ${candidates.length ? `<div class="clip-candidates">${candidates
          .map(
            (candidate) =>
              `<button class="clip-candidate" type="button" data-clip-candidate data-name="${Catalog.escapeHtml(candidate.name)}">${Catalog.escapeHtml(candidate.label)}</button>`
          )
          .join("")}</div>` : ""}
      </section>
      <section class="clip-section">
        <h3>Layers <span class="muted">${state.clip.selected.size}/${state.clip.maxLayers}</span></h3>
        <label class="clip-field">Find a previewable layer
          <input id="clip-layer-search" type="search" value="${Catalog.escapeHtml(state.clip.search)}" placeholder="Search layers…" autocomplete="off">
        </label>
        <div class="clip-selected">${selected
          .map(
            (layer) =>
              `<span class="clip-chip">${Catalog.escapeHtml(layer.title)}<button type="button" data-clip-remove="${Catalog.escapeHtml(layer.dataset_id)}" aria-label="Remove ${Catalog.escapeHtml(layer.title)}">×</button></span>`
          )
          .join("")}</div>
        <div id="clip-layer-results" class="clip-layer-results"></div>
      </section>
      <section class="clip-section">
        <h3>Bundle</h3>
        <div class="clip-actions">
          <button class="secondary-button" type="button" data-clip-estimate ${canEstimate ? "" : "disabled"}>${state.preflight.busy ? "Estimating…" : "Estimate"}</button>
          <button class="primary-button" type="button" data-clip-prepare ${canPrepare ? "" : "disabled"}>${state.clip.busy ? "Preparing…" : "Prepare bundle"}</button>
          ${state.clip.jobId ? '<button class="secondary-button" type="button" data-clip-cancel>Cancel job</button>' : ""}
        </div>
        ${clipPreflightTemplate()}
        ${state.clip.jobId ? `<div class="clip-progress" role="progressbar" aria-label="Bundle progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(state.clip.progress || 0)}"><div class="clip-progress-bar" style="width:${Math.max(0, Math.min(100, Number(state.clip.progress || 0)))}%"></div></div>` : ""}
        ${state.clip.jobId ? `<p class="clip-status${state.clip.error ? " error" : ""}">${Catalog.escapeHtml(state.clip.message || "Preparing bundle…")}</p>` : ""}
        ${clipResultTemplate()}
        <p class="clip-status">Bundles are limited to ${state.clip.maxLayers} layers and ${Catalog.formatNumber(state.clip.maxAreaHa)} ha. Clipping runs from the recovered source rasters.</p>
      </section>
      <section class="clip-section">
        <h3>Recent bundles</h3>
        ${clipRecentTemplate()}
      </section>
    `;
    renderClipLayers();
  }

  async function openClipPanel(trigger = document.activeElement) {
    if (!state.serviceAvailable) {
      showToast("Bundle service unavailable.");
      return;
    }
    closeAssistant();
    closeTray();
    closeDiscover();
    rememberPanelTrigger(els.clipPanel, trigger);
    const datasetId = currentMapDatasetId();
    if (state.clip.datasetId && datasetId && state.clip.datasetId !== datasetId) {
      resetClipState();
    }
    state.clip.datasetId = datasetId;
    state.clip.open = true;
    els.clipPanel.hidden = false;
    if (datasetId && state.previewIndex) {
      const artifact = state.previewIndex.get(datasetId);
      if (
        artifact &&
        ["source_derived_preview", "already_present"].includes(
          artifact.artifact_status || artifact.status
        ) &&
        !state.clip.selected.has(datasetId) &&
        state.clip.selected.size < state.clip.maxLayers
      ) {
        state.clip.selected.add(datasetId);
      }
    }
    renderClipPanel();
    setDisclosure("[data-open-clip]", true);
    focusPanel(els.clipPanel, "#clip-query");
    if (state.clip.jobId && state.clip.busy) {
      scheduleClipPoll(0);
    }
    void loadRecentBundles().then(() => {
      if (
        state.clip.open &&
        (document.activeElement === document.body ||
          !els.clipPanel.contains(document.activeElement))
      ) {
        focusPanel(els.clipPanel, "#clip-query");
      }
    });
  }

  function closeClipPanel() {
    if (!els.clipPanel || els.clipPanel.hidden) {
      return;
    }
    const panel = els.clipPanel;
    state.clip.open = false;
    panel.hidden = true;
    stopClipPolling();
    setDisclosure("[data-open-clip]", false);
    state.mapHandle?.__hbc?.cancelRectangleDraw?.();
    restorePanelFocus(panel);
  }

  async function resolveClipAoi() {
    if (state.clip.busy) {
      return;
    }
    const queryInput = els.clipBody.querySelector("#clip-query");
    const nameInput = els.clipBody.querySelector("#clip-name");
    state.clip.query = queryInput?.value.trim() || "";
    state.clip.name = nameInput?.value.trim() || "";
    if (!state.clip.query) {
      state.clip.message = "Enter a boundary layer query.";
      state.clip.error = true;
      renderClipPanel();
      return;
    }
    state.clip.busy = true;
    state.clip.error = false;
    state.clip.message = "Resolving boundary…";
    renderClipPanel();
    try {
      const response = await fetch("../api/aoi/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: state.clip.query,
          name: state.clip.name || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || `resolve failed (${response.status})`);
      }
      if (payload.status === "ok" && payload.geometry) {
        state.clip.areaToken += 1;
        state.clip.aoi = payload;
        state.clip.geometry = payload.geometry;
        state.clip.name = payload.name || state.clip.name;
        state.clip.candidates = [];
        state.clip.areaPending = false;
        state.clip.areaHa = Number.isFinite(Number(payload.area_ha))
          ? Number(payload.area_ha)
          : null;
        state.clip.areaWithinLimit =
          state.clip.areaHa == null
            ? null
            : state.clip.areaHa <= state.clip.maxAreaHa;
        state.clip.error = state.clip.areaWithinLimit === false;
        state.clip.message = clipAoiSummary();
        clearPreflight();
        state.mapHandle?.__hbc?.setAoi(payload.geometry, { fit: true });
        rememberAoi({
          name: payload.name || state.clip.name,
          query: payload.query || state.clip.query,
          area_ha: state.clip.areaHa,
          named: false,
        });
      } else {
        state.clip.areaToken += 1;
        state.clip.aoi = null;
        state.clip.geometry = null;
        state.clip.areaHa = null;
        state.clip.areaWithinLimit = null;
        state.clip.areaPending = false;
        clearPreflight();
        state.clip.candidates =
          payload.candidate_options || payload.candidates || [];
        state.clip.message =
          payload.status === "ambiguous"
            ? "Multiple features match; choose one."
            : "Choose a boundary feature.";
        state.mapHandle?.__hbc?.clearAoi?.();
      }
    } catch (error) {
      state.clip.error = true;
      state.clip.message = `Could not resolve AOI: ${error.message}`;
    } finally {
      state.clip.busy = false;
      renderClipPanel();
    }
  }

  async function inspectClipAoi(geometry) {
    const token = state.clip.areaToken + 1;
    state.clip.areaToken = token;
    state.clip.areaPending = true;
    state.clip.areaHa = null;
    state.clip.areaWithinLimit = null;
    state.clip.error = false;
    state.clip.message = "Drawn AOI · checking area…";
    renderClipPanel();
    try {
      const response = await fetch("../api/aoi/inspect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ geometry }),
      });
      if (token !== state.clip.areaToken) {
        return;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || `area check failed (${response.status})`);
      }
      state.clip.areaHa = Number(payload.area_ha);
      state.clip.areaWithinLimit = payload.within_limit !== false;
      state.clip.areaPending = false;
      state.clip.error = state.clip.areaWithinLimit === false;
      state.clip.message = clipAoiSummary();
      clearPreflight();
      rememberAoi({
        name: state.clip.name || "Drawn AOI",
        geometry,
        area_ha: state.clip.areaHa,
        named: false,
      });
    } catch (error) {
      if (token !== state.clip.areaToken) {
        return;
      }
      state.clip.areaPending = false;
      state.clip.areaHa = null;
      state.clip.areaWithinLimit = null;
      state.clip.error = false;
      state.clip.message =
        "Drawn AOI · area check unavailable; the server will validate the limit.";
    } finally {
      if (token === state.clip.areaToken) {
        renderClipPanel();
      }
    }
  }

  function drawClipAoi() {
    if (!state.mapHandle?.__hbc) {
      showToast("Open a map first.");
      return;
    }
    if (!state.mapHandle.__hbcReady) {
      state.clip.message = "The map is still loading; try again in a moment.";
      state.clip.error = true;
      renderClipPanel();
      return;
    }
    const narrow = window.matchMedia("(max-width: 760px)").matches;
    state.clip.message = "Drag a box on the map to define the AOI.";
    state.clip.error = false;
    renderClipPanel();
    if (narrow) {
      els.clipPanel.hidden = true;
      showToast("Drag a box on the map.");
    }
    state.mapHandle.__hbc.startRectangleDraw((geometry) => {
      state.clip.aoi = null;
      state.clip.geometry = geometry;
      state.clip.name = "Drawn AOI";
      state.clip.candidates = [];
      clearPreflight();
      state.clip.message = "Drawn AOI ready on the map.";
      state.mapHandle.__hbc.setAoi(geometry, { fit: false });
      if (narrow) {
        els.clipPanel.hidden = false;
      }
      renderClipPanel();
      void inspectClipAoi(geometry);
    });
  }

  const ClipTerminalJobStatuses = new Set([
    "complete",
    "partial",
    "failed",
    "canceled",
    "needs_name",
    "ambiguous",
    "interrupted",
  ]);

  function stopClipPolling() {
    if (state.clip.pollTimer) {
      clearTimeout(state.clip.pollTimer);
      state.clip.pollTimer = null;
    }
  }

  function scheduleClipPoll(delay = 1200) {
    stopClipPolling();
    if (!state.clip.open) {
      return;
    }
    state.clip.pollTimer = setTimeout(() => {
      state.clip.pollTimer = null;
      void pollClipJob();
    }, delay);
  }

  async function estimateClipBundle() {
    if (state.preflight.busy || state.clip.busy) {
      return;
    }
    const layerIds = [...state.clip.selected];
    if (!layerIds.length) {
      state.clip.message = "Select at least one layer.";
      state.clip.error = true;
      renderClipPanel();
      return;
    }
    if (!state.clip.geometry) {
      state.clip.message = "Resolve or draw an AOI first.";
      state.clip.error = true;
      renderClipPanel();
      return;
    }
    if (state.clip.areaPending || state.clip.areaWithinLimit === false) {
      state.clip.error = state.clip.areaWithinLimit === false;
      state.clip.message = state.clip.areaPending
        ? "The AOI area check is still running."
        : `AOI is ${Catalog.formatNumber(Number(state.clip.areaHa || 0))} ha; limit ${Catalog.formatNumber(state.clip.maxAreaHa)} ha.`;
      renderClipPanel();
      return;
    }
    state.preflight.busy = true;
    state.preflight.error = false;
    state.clip.message = "Estimating bundle output…";
    state.clip.error = false;
    renderClipPanel();
    try {
      const response = await fetch("../api/bundles/estimate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          layer_ids: layerIds,
          aoi_geometry: state.clip.geometry,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || `estimate failed (${response.status})`);
      }
      state.preflight.result = payload;
      state.clip.message = "Estimate ready.";
    } catch (error) {
      state.preflight.result = null;
      state.preflight.error = true;
      state.clip.error = true;
      state.clip.message = `Could not estimate bundle: ${error.message}`;
    } finally {
      state.preflight.busy = false;
      renderClipPanel();
    }
  }

  async function prepareClipBundle() {
    if (state.clip.busy) {
      return;
    }
    const layerIds = [...state.clip.selected];
    if (!layerIds.length) {
      state.clip.message = "Select at least one layer.";
      state.clip.error = true;
      renderClipPanel();
      return;
    }
    if (!state.clip.geometry) {
      state.clip.message = "Resolve or draw an AOI first.";
      state.clip.error = true;
      renderClipPanel();
      return;
    }
    if (state.clip.areaPending) {
      state.clip.message = "The AOI area check is still running.";
      state.clip.error = false;
      renderClipPanel();
      return;
    }
    if (state.clip.areaWithinLimit === false) {
      state.clip.message = `AOI is ${Catalog.formatNumber(Number(state.clip.areaHa || 0))} ha; limit ${Catalog.formatNumber(state.clip.maxAreaHa)} ha.`;
      state.clip.error = true;
      renderClipPanel();
      return;
    }
    await startClipJob(layerIds);
  }

  async function retryFailedClipLayers() {
    if (state.clip.busy) {
      return;
    }
    const failures = Array.isArray(state.clip.lastResult?.failures)
      ? state.clip.lastResult.failures
      : [];
    const layerIds = [
      ...new Set(
        failures
          .map((failure) => failure?.dataset_id)
          .filter((datasetId) => typeof datasetId === "string" && datasetId)
      ),
    ];
    if (!layerIds.length) {
      state.clip.message = "No failed layers to retry.";
      state.clip.error = true;
      renderClipPanel();
      return;
    }
    if (!state.clip.geometry) {
      state.clip.message = "Resolve or draw the AOI again before retrying.";
      state.clip.error = true;
      renderClipPanel();
      return;
    }
    state.clip.selected = new Set(layerIds);
    await startClipJob(layerIds);
  }

  async function startClipJob(layerIds) {
    if (!layerIds.length || !state.clip.geometry) {
      return;
    }
    if (state.clip.areaPending || state.clip.areaWithinLimit === false) {
      state.clip.error = state.clip.areaWithinLimit === false;
      state.clip.message = state.clip.areaPending
        ? "The AOI area check is still running."
        : `AOI is ${Catalog.formatNumber(Number(state.clip.areaHa || 0))} ha; limit ${Catalog.formatNumber(state.clip.maxAreaHa)} ha.`;
      renderClipPanel();
      return;
    }
    stopClipPolling();
    state.clip.busy = true;
    state.clip.error = false;
    state.clip.lastResult = null;
    state.clip.jobId = null;
    state.clip.job = null;
    state.clip.progress = 0;
    state.clip.message = `Queuing ${layerIds.length} layer${layerIds.length === 1 ? "" : "s"}…`;
    renderClipPanel();
    try {
      const response = await fetch("../api/bundle-jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          layer_ids: layerIds,
          aoi_geometry: state.clip.geometry,
          aoi_name: state.clip.aoi?.name || state.clip.name || "Drawn AOI",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || `bundle job failed (${response.status})`);
      }
      const job = payload.job || {
        job_id: payload.job_id,
        status: payload.status || "queued",
        progress: 0,
        message: "Bundle job queued.",
      };
      state.clip.jobId = payload.job_id || job.job_id;
      state.clip.job = job;
      state.clip.progress = Number(job.progress || 0);
      state.clip.message = job.message || "Bundle job queued.";
      if (ClipTerminalJobStatuses.has(job.status)) {
        await finishClipJob(job);
        return;
      }
      renderClipPanel();
      scheduleClipPoll(750);
    } catch (error) {
      state.clip.busy = false;
      state.clip.jobId = null;
      state.clip.progress = 0;
      state.clip.error = true;
      state.clip.message = `Could not start bundle job: ${error.message}`;
      renderClipPanel();
    }
  }

  async function pollClipJob() {
    const jobId = state.clip.jobId;
    if (!jobId) {
      return;
    }
    try {
      const response = await fetch(
        `../api/bundle-jobs/${encodeURIComponent(jobId)}`
      );
      if (state.clip.jobId !== jobId) {
        return;
      }
      const job = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(job.detail || `job status failed (${response.status})`);
      }
      state.clip.job = job;
      state.clip.progress = Number(job.progress || 0);
      state.clip.message = job.message || "Preparing bundle…";
      state.clip.error = job.status === "failed";
      if (ClipTerminalJobStatuses.has(job.status)) {
        await finishClipJob(job);
        return;
      }
      renderClipPanel();
      scheduleClipPoll(1200);
    } catch (error) {
      if (state.clip.jobId !== jobId) {
        return;
      }
      state.clip.busy = false;
      state.clip.jobId = null;
      state.clip.progress = 0;
      state.clip.error = true;
      state.clip.message = `Could not read bundle job: ${error.message}`;
      renderClipPanel();
    }
  }

  async function finishClipJob(job) {
    state.clip.busy = false;
    state.clip.jobId = null;
    state.clip.job = job;
    const result = job.result;
    if (job.status === "canceled") {
      state.clip.progress = 0;
      state.clip.message = "Bundle job canceled.";
      state.clip.error = false;
    } else if (job.status === "interrupted") {
      state.clip.progress = 0;
      state.clip.message = job.message || "Bundle job was interrupted.";
      state.clip.error = true;
    } else if (
      job.status === "needs_name" ||
      job.status === "ambiguous" ||
      result?.status === "needs_name" ||
      result?.status === "ambiguous"
    ) {
      state.clip.progress = 0;
      state.clip.candidates =
        result?.aoi?.candidate_options || result?.aoi?.candidates || [];
      state.clip.message = "Choose a boundary feature.";
      state.clip.error = false;
    } else if (result) {
      state.clip.lastResult = result;
      state.clip.progress = result.status === "failed" ? 0 : 100;
      state.clip.message =
        result.status === "complete"
          ? "Bundle ready."
          : result.status === "partial"
            ? "Bundle ready with some layer failures."
            : "Bundle failed; inspect the failures.";
      state.clip.error = result.status === "failed";
    } else {
      state.clip.progress = 0;
      state.clip.message = job.message || "Bundle job finished.";
      state.clip.error = job.status === "failed";
    }
    if (job.status === "complete" || job.status === "partial") {
      await loadRecentBundles();
    }
    renderClipPanel();
  }

  async function cancelClipJob() {
    const jobId = state.clip.jobId;
    if (!jobId) {
      return;
    }
    state.clip.message = "Canceling bundle job…";
    state.clip.error = false;
    renderClipPanel();
    try {
      const response = await fetch(
        `../api/bundle-jobs/${encodeURIComponent(jobId)}/cancel`,
        { method: "POST" }
      );
      const job = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(job.detail || `cancel failed (${response.status})`);
      }
      state.clip.job = job;
      state.clip.progress = Number(job.progress || 0);
      state.clip.message = job.message || "Canceling bundle job…";
      if (ClipTerminalJobStatuses.has(job.status)) {
        await finishClipJob(job);
        return;
      }
      renderClipPanel();
      scheduleClipPoll(500);
    } catch (error) {
      state.clip.error = true;
      state.clip.message = `Could not cancel bundle job: ${error.message}`;
      renderClipPanel();
    }
  }

  async function loadRecentBundles() {
    const payload = await fetchJson("../api/bundles");
    if (payload?.bundles) {
      state.clip.recent = payload.bundles;
    }
    if (state.clip.open) {
      renderClipPanel();
    }
  }

  function handleTrayClick(event) {
    const target = event.target;
    if (target.closest("[data-tray-open-map]")) {
      closeTray();
      return;
    }
    if (target.closest("[data-workspace-save]")) {
      saveCurrentWorkspace();
      return;
    }
    if (target.closest("[data-workspace-share]")) {
      void copyWorkspaceLink();
      return;
    }
    const openWorkspace = target.closest("[data-workspace-open]");
    if (openWorkspace) {
      openSavedWorkspace(openWorkspace.dataset.workspaceOpen);
      return;
    }
    const deleteWorkspace = target.closest("[data-workspace-delete]");
    if (deleteWorkspace) {
      deleteSavedWorkspace(deleteWorkspace.dataset.workspaceDelete);
      return;
    }
    const remove = target.closest("[data-tray-remove]");
    if (remove) {
      removeFromTray(remove.dataset.trayRemove);
      return;
    }
    const move = target.closest("[data-tray-move]");
    if (move) {
      const direction = Number.parseInt(move.dataset.direction || "0", 10);
      if (Number.isFinite(direction)) {
        moveTray(move.dataset.trayMove, direction);
      }
      return;
    }
    if (target.closest("[data-tray-clear]")) {
      clearTray();
    }
  }

  function handleClipClick(event) {
    const target = event.target;
    const close = target.closest("[data-clip-close]");
    if (close) {
      closeClipPanel();
      return;
    }
    if (target.closest("[data-clip-resolve]")) {
      void resolveClipAoi();
      return;
    }
    if (target.closest("[data-clip-draw]")) {
      drawClipAoi();
      return;
    }
    if (target.closest("[data-clip-clear]")) {
      state.clip.aoi = null;
      state.clip.geometry = null;
      state.clip.candidates = [];
      state.clip.areaHa = null;
      state.clip.areaWithinLimit = null;
      state.clip.areaPending = false;
      state.clip.areaToken += 1;
      clearPreflight();
      state.clip.message = "AOI cleared.";
      state.clip.error = false;
      state.mapHandle?.__hbc?.clearAoi?.();
      renderClipPanel();
      return;
    }
    if (target.closest("[data-clip-cancel]")) {
      void cancelClipJob();
      return;
    }
    if (target.closest("[data-clip-retry]")) {
      void retryFailedClipLayers();
      return;
    }
    if (target.closest("[data-clip-estimate]")) {
      void estimateClipBundle();
      return;
    }
    if (target.closest("[data-clip-prepare]")) {
      void prepareClipBundle();
      return;
    }
    if (target.closest("[data-clip-save-aoi]")) {
      saveCurrentAoi();
      return;
    }
    const applyAoi = target.closest("[data-clip-aoi-apply]");
    if (applyAoi) {
      void applyAoiRecord(applyAoi.dataset.clipAoiApply);
      return;
    }
    const deleteAoi = target.closest("[data-clip-aoi-delete]");
    if (deleteAoi) {
      deleteAoiRecord(deleteAoi.dataset.clipAoiDelete);
      return;
    }
    const candidate = target.closest("[data-clip-candidate]");
    if (candidate) {
      state.clip.name = candidate.dataset.name || "";
      const input = els.clipBody.querySelector("#clip-name");
      if (input) {
        input.value = state.clip.name;
      }
      void resolveClipAoi();
      return;
    }
    const remove = target.closest("[data-clip-remove]");
    if (remove) {
      state.clip.selected.delete(remove.dataset.clipRemove);
      renderClipPanel();
    }
  }

  function handleClipInput(event) {
    const target = event.target;
    if (target.id === "clip-query") {
      state.clip.query = target.value;
    } else if (target.id === "clip-name") {
      state.clip.name = target.value;
    } else if (target.id === "clip-layer-search") {
      state.clip.search = target.value;
      renderClipLayers();
    }
  }

  function handleClipChange(event) {
    const input = event.target.closest("[data-clip-layer]");
    if (!input) {
      return;
    }
    if (input.checked) {
      if (state.clip.selected.size >= state.clip.maxLayers) {
        input.checked = false;
        showToast(`Select at most ${state.clip.maxLayers} layers.`);
        return;
      }
      state.clip.selected.add(input.value);
    } else {
      state.clip.selected.delete(input.value);
    }
    clearPreflight();
    renderClipPanel();
  }

  /* ---------------------------------------------------------------- events */

  function bindEvents() {
    els.searchForm.addEventListener("submit", (event) => event.preventDefault());
    els.searchInput.addEventListener("input", handleSearchInput);
    els.searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        els.searchInput.value = "";
        navigate({ ...state.route, query: "", page: 1 }, { replace: true });
      }
    });

    els.facets.addEventListener("change", handleFacetChange);
    els.savedBrowse?.addEventListener("click", handleSavedBrowseClick);
    els.clearFilters.addEventListener("click", clearAllFilters);
    els.content.addEventListener("click", handleContentClick);
    els.content.addEventListener("change", handleContentChange);
    els.inspector.addEventListener("click", handleContentClick);
    els.sheetBackdrop.addEventListener("click", () => closeFilters());

    document.querySelector(".skip-link")?.addEventListener("click", (event) => {
      event.preventDefault();
      els.content.focus();
    });
    els.helpButton.addEventListener("click", openHelp);
    els.helpClose.addEventListener("click", () => els.helpDialog.close());
    els.helpDialog.addEventListener("click", (event) => {
      if (event.target === els.helpDialog) {
        els.helpDialog.close();
      }
    });

    els.assistantButton?.addEventListener("click", () => {
      if (els.assistantPanel.hidden) {
        openAssistant();
      } else {
        closeAssistant();
      }
    });
    els.assistantClose?.addEventListener("click", closeAssistant);
    els.assistantNew?.addEventListener("click", newAssistantChat);
    els.assistantForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const message = els.assistantInput.value;
      els.assistantInput.value = "";
      void sendAssistantMessage(message);
    });
    els.assistantInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        els.assistantForm.requestSubmit();
      }
    });
    els.assistantQuick?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-assistant-prompt]");
      if (button) {
        openAssistant();
        void sendAssistantMessage(button.dataset.assistantPrompt);
      }
    });

    els.clipClose?.addEventListener("click", closeClipPanel);
    els.clipPanel?.addEventListener("click", handleClipClick);
    els.clipPanel?.addEventListener("input", handleClipInput);
    els.clipPanel?.addEventListener("change", handleClipChange);

    els.trayButton?.addEventListener("click", toggleTray);
    els.trayClose?.addEventListener("click", closeTray);
    els.trayPanel?.addEventListener("click", handleTrayClick);

    els.discoverClose?.addEventListener("click", closeDiscover);
    els.discoverPanel?.addEventListener("click", handleDiscoverClick);
    els.discoverPanel?.addEventListener("input", handleDiscoverInput);
    els.discoverPanel?.addEventListener("change", handleDiscoverChange);

    document.addEventListener("keydown", handleGlobalKeydown);
    window.addEventListener("hashchange", scheduleSync);
    window.addEventListener("popstate", scheduleSync);
  }

  let syncQueued = false;
  function scheduleSync() {
    if (syncQueued) {
      return;
    }
    syncQueued = true;
    queueMicrotask(() => {
      syncQueued = false;
      syncFromLocation();
    });
  }

  function syncHeaderHeight() {
    const header = document.querySelector(".app-header");
    if (header) {
      document.documentElement.style.setProperty(
        "--header-h",
        `${header.offsetHeight}px`
      );
    }
  }

  function openHelp() {
    if (els.helpDialog.open) {
      return;
    }
    if (typeof els.helpDialog.showModal === "function") {
      els.helpDialog.showModal();
    } else {
      els.helpDialog.setAttribute("open", "");
    }
  }

  /* --------------------------------------------------------------- templates */

  function renderLoading() {
    els.content.innerHTML = `
      <div class="browse-view">
        <div class="result-toolbar">
          <p class="result-count">Loading catalog…</p>
        </div>
        <div class="results">
          <div class="empty-state"><p><span class="spinner"></span>Loading 2,183 recovered records…</p></div>
        </div>
      </div>
    `;
  }

  function loadingTemplate(message) {
    return `<div class="dataset-view"><p class="muted"><span class="spinner"></span>${Catalog.escapeHtml(message)}</p></div>`;
  }

  function renderLoadError(error) {
    document.title = "Catalog unavailable · HectaresBC";
    if (els.liveStatus) {
      els.liveStatus.textContent = "Catalog data unavailable.";
    }
    els.content.innerHTML = `
      <div class="dataset-view">
        <div class="error-state">
          <h3>Catalog data unavailable</h3>
          <p>${Catalog.escapeHtml(error?.message || "The generated catalog could not be loaded.")}</p>
          <p>Generate the catalog with <code>python3 scripts/generate_web_catalog.py</code>, then serve the <code>web/</code> directory.</p>
          <button class="primary-button" type="button" data-retry>Retry</button>
        </div>
      </div>
    `;
    updateHeader(0);
  }

  function notFoundTemplate(datasetId) {
    return `
      <div class="dataset-view">
        <div class="error-state">
          <h3>Dataset not found</h3>
          <p>No recovered catalog record matches <code>${Catalog.escapeHtml(datasetId || "unknown")}</code>.</p>
          <p><a class="primary-button" href="${state.lastBrowseHash || "#/catalog"}">Back to catalog</a></p>
        </div>
      </div>
    `;
  }

  function artifactUrl(artifact, relativePath) {
    if (!relativePath) {
      return null;
    }
    if (/^https?:/i.test(relativePath)) {
      return relativePath;
    }
    const base = String(artifact?._base || "").replace(/\/$/, "");
    const path = String(relativePath).replace(/^\//, "");
    return base ? `${base}/${path}` : path;
  }
})();
