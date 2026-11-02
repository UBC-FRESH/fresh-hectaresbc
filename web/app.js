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
    };
    bindEvents();
    const header = document.querySelector(".app-header");
    if (header && window.ResizeObserver) {
      new ResizeObserver(() => syncHeaderHeight()).observe(header);
    }
    renderLoading();
    loadCatalog();
    void loadAssistantInfo();
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
    window.HectaresBCMap?.destroy();
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
    window.HectaresBCMap?.destroy();
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
              `<li><span class="layer-swatch" style="background: rgb(${(item.rgb || []).join(", ")})"></span>${Catalog.escapeHtml(`${item.value}: ${item.label}`)}</li>`
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

  async function renderMap() {
    const token = ++state.renderToken;
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
    const bounds =
      window.HectaresBCMap?.validBounds(artifact?._map_bounds_wgs84) ||
      window.HectaresBCMap?.validBounds(artifact?.wgs84_bounds);
    let previewUrl = artifact?._map_path
      ? artifactUrl({ _base: artifact._map_base }, artifact._map_path)
      : artifact?.artifact_path
        ? artifactUrl(artifact, artifact.artifact_path)
        : null;
    if (previewUrl && artifact?._map_path && state.mapPreviewVersion) {
      previewUrl += `${previewUrl.includes("?") ? "&" : "?"}v=${encodeURIComponent(state.mapPreviewVersion)}`;
    }
    const canMap = preview.status === "available" && previewUrl && bounds;

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
    els.content.innerHTML = mapTemplate(record, preview, artifact, bounds);
    bindMapLayerSearch();
    updateHeader();
    updateTabs();
    if (els.liveStatus) {
      els.liveStatus.textContent = `Map preview for ${Catalog.titleLabel(record)}.`;
    }
    document.title = `${Catalog.titleLabel(record)} map · HectaresBC`;
    els.content.querySelector("h1")?.focus();

    try {
      await window.HectaresBCMap.create({
        container: document.querySelector("#map-canvas"),
        previewUrl,
        referenceUrl,
        referenceBounds: reference?.wgs84_bounds || null,
        bounds,
        categorical: Boolean(
          artifact?.value_class_count || artifact?.value_classes?.length
        ),
        panel: document.querySelector("#map-layer-panel"),
        loading: document.querySelector("#map-loading"),
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
    } catch (error) {
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

  function mapTemplate(record, preview, artifact, bounds) {
    const datasetHref = `#/dataset/${encodeURIComponent(record.dataset_id)}`;
    const legend = mapLegendTemplate(artifact);
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
          <p>${Catalog.escapeHtml(previewExplanation(record, preview))}</p>
          <dl class="kv-list" style="margin-top:0.5rem">
            <dt>Bounds</dt><dd class="mono">${Catalog.escapeHtml(formatBounds(bounds))}</dd>
            <dt>Map CRS</dt><dd>${Catalog.escapeHtml(artifact?._map_crs || artifact?.crs || "unknown")}</dd>
            <dt>Artifact</dt><dd>${Catalog.escapeHtml(artifact?.artifact_status || "unknown")}</dd>
          </dl>
        </div>
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
          `<li><span class="layer-swatch" style="background: rgb(${(item.rgb || []).join(", ")})"></span>${Catalog.escapeHtml(`${item.value}: ${item.label}`)}</li>`
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
  }

  /* --------------------------------------------------------------- assistant */

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
