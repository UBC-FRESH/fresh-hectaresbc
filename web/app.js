(function initHectaresApp() {
  const Catalog = window.CatalogBrowser;
  const PublishedPreviewRoot =
    "../external/fresh-hectaresbc-data/derived/web_map_previews/v1";
  const LocalPreviewRoot = "data/map_previews";
  const NarrowInspectorQuery = "(max-width: 1080px)";

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
      tabMap: document.querySelector("#tab-map"),
      tabBundles: document.querySelector("#tab-bundles"),
      filterRail: document.querySelector("#filter-rail"),
      facets: document.querySelector("#facets"),
      previewNote: document.querySelector("#preview-note"),
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
    };
    bindEvents();
    loadTray();
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
    } else if (route.view === "bundles") {
      void renderBundles();
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
    resetIdentifyState();
    window.HectaresBCMap?.destroy();
    closeClipPanel();
    document.body.dataset.view = "catalog";
    document.body.classList.remove("filters-open", "inspector-open");
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

  async function renderMap() {
    const token = ++state.renderToken;
    stopHistoryPolling();
    document.body.dataset.view = "map";
    document.body.classList.remove("filters-open", "inspector-open");
    els.content.innerHTML = loadingTemplate("Loading map preview…");
    let datasetId = state.route.datasetId;
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
      if (state.clip.geometry && !els.clipPanel.hidden) {
        state.mapHandle.__hbc?.setAoi(state.clip.geometry, { fit: false });
      }
      state.identify.datasetId = datasetId;
      updateIdentifyButton();
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
            <button class="secondary-button" type="button" data-tray-add="${Catalog.escapeHtml(record.dataset_id)}">Add to tray</button>
            <button class="secondary-button" type="button" data-identify-toggle ${state.serviceAvailable ? "" : "hidden"}>Identify</button>
            <button class="secondary-button" type="button" data-open-clip ${state.serviceAvailable ? "" : "hidden"}>Clip AOI</button>
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
            <input id="map-layer-search" type="search" placeholder="Find a previewable layer…" autocomplete="off">
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
      void openClipPanel();
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
    const openFilters = target.closest("[data-open-filters]");
    if (openFilters) {
      document.body.classList.add("filters-open");
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
      document.body.classList.remove("filters-open", "inspector-open");
      if (els.helpDialog.open) {
        els.helpDialog.close();
      }
      if (els.trayPanel && !els.trayPanel.hidden) {
        closeTray();
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
      document.body.classList.toggle("filters-open");
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
    els.tabBrowse.href = state.lastBrowseHash || "#/catalog";
    els.tabBrowse.setAttribute(
      "aria-selected",
      state.route.view === "catalog" ? "true" : "false"
    );
    if (datasetId) {
      els.tabMap.href = `#/dataset/${encodeURIComponent(datasetId)}/map`;
      els.tabMap.title = "Open the map workspace for the selected layer";
    } else {
      els.tabMap.href = "#/map";
      els.tabMap.title = "Open the map workspace";
    }
    els.tabMap.removeAttribute("aria-disabled");
    els.tabMap.setAttribute(
      "aria-selected",
      state.route.view === "map" ||
        (state.route.view === "dataset" && state.route.map)
        ? "true"
        : "false"
    );
    if (els.tabBundles) {
      els.tabBundles.setAttribute(
        "aria-selected",
        state.route.view === "bundles" ? "true" : "false"
      );
    }
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
    if (!artifact) {
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
        </div>`;
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
        <button class="secondary-button" type="button" data-tray-clear>Clear tray</button>
      </div>
      <p class="clip-status">The first tray layer becomes the primary map layer. Up to three additional tray layers render as context overlays.</p>`;
  }

  function openTray() {
    closeAssistant();
    if (els.clipPanel && !els.clipPanel.hidden) {
      closeClipPanel();
    }
    state.tray.open = true;
    els.trayPanel.hidden = false;
    renderTray();
    syncTrayButton();
  }

  function closeTray() {
    state.tray.open = false;
    if (els.trayPanel) {
      els.trayPanel.hidden = true;
    }
    syncTrayButton();
  }

  function toggleTray() {
    if (state.tray.open) {
      closeTray();
    } else {
      openTray();
    }
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

  function openAssistant() {
    if (!state.assistant.enabled) {
      return;
    }
    if (els.clipPanel && !els.clipPanel.hidden) {
      closeClipPanel();
    }
    closeTray();
    els.assistantPanel.hidden = false;
    els.assistantButton.setAttribute("aria-expanded", "true");
    els.assistantInput.focus();
  }

  function closeAssistant() {
    els.assistantPanel.hidden = true;
    els.assistantButton.setAttribute("aria-expanded", "false");
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

  /* -------------------------------------------------------------- clip panel */

  function currentMapDatasetId() {
    return state.route.datasetId || state.selectedId || null;
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
          <button class="primary-button" type="button" data-clip-prepare ${canPrepare ? "" : "disabled"}>${state.clip.busy ? "Preparing…" : "Prepare bundle"}</button>
          ${state.clip.jobId ? '<button class="secondary-button" type="button" data-clip-cancel>Cancel job</button>' : ""}
        </div>
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

  async function openClipPanel() {
    if (!state.serviceAvailable) {
      showToast("Bundle service unavailable.");
      return;
    }
    closeAssistant();
    closeTray();
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
    if (state.clip.jobId && state.clip.busy) {
      scheduleClipPoll(0);
    }
    void loadRecentBundles();
  }

  function closeClipPanel() {
    state.clip.open = false;
    els.clipPanel.hidden = true;
    stopClipPolling();
    state.mapHandle?.__hbc?.cancelRectangleDraw?.();
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
        state.mapHandle?.__hbc?.setAoi(payload.geometry, { fit: true });
      } else {
        state.clip.areaToken += 1;
        state.clip.aoi = null;
        state.clip.geometry = null;
        state.clip.areaHa = null;
        state.clip.areaWithinLimit = null;
        state.clip.areaPending = false;
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
    if (target.closest("[data-clip-prepare]")) {
      void prepareClipBundle();
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
    els.clearFilters.addEventListener("click", clearAllFilters);
    els.content.addEventListener("click", handleContentClick);
    els.content.addEventListener("change", handleContentChange);
    els.inspector.addEventListener("click", handleContentClick);
    els.sheetBackdrop.addEventListener("click", () => {
      document.body.classList.remove("filters-open");
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
