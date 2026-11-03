(function initHectaresMap(globalScope) {
  const MAPLIBRE_JS = "vendor/maplibre-gl.js";
  const MAPLIBRE_CSS = "vendor/maplibre-gl.css";
  const OSM_TILES = ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"];
  let maplibrePromise = null;
  let activeMap = null;

  function ensureStylesheet() {
    const existing = document.querySelector(`link[data-maplibre-css]`);
    if (existing) {
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = MAPLIBRE_CSS;
    link.dataset.maplibreCss = "true";
    document.head.append(link);
  }

  function ensureMaplibre() {
    if (globalScope.maplibregl) {
      return Promise.resolve(globalScope.maplibregl);
    }
    if (maplibrePromise) {
      return maplibrePromise;
    }
    ensureStylesheet();
    maplibrePromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = MAPLIBRE_JS;
      script.async = true;
      script.onload = () => {
        if (globalScope.maplibregl) {
          resolve(globalScope.maplibregl);
        } else {
          reject(new Error("MapLibre loaded but did not expose maplibregl."));
        }
      };
      script.onerror = () => reject(new Error("MapLibre could not be loaded."));
      document.head.append(script);
    });
    return maplibrePromise;
  }

  function validBounds(bounds) {
    if (!Array.isArray(bounds) || bounds.length !== 4) {
      return null;
    }
    const values = bounds.map(Number);
    if (!values.every(Number.isFinite)) {
      return null;
    }
    const [west, south, east, north] = values;
    if (west >= east || south >= north) {
      return null;
    }
    return values;
  }

  function imageCoordinates(bounds) {
    const [west, south, east, north] = bounds;
    return [
      [west, north],
      [east, north],
      [east, south],
      [west, south],
    ];
  }

  function styleFor({
    previewUrl,
    tileUrl,
    tileSize,
    minzoom,
    maxzoom,
    referenceUrl,
    referenceBounds,
    bounds,
    categorical,
    extraLayers = [],
  }) {
    const sources = {
      osm: {
        type: "raster",
        tiles: OSM_TILES,
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      },
    };
    if (tileUrl) {
      sources.preview = {
        type: "raster",
        tiles: [tileUrl],
        tileSize: tileSize || 256,
        minzoom: minzoom || 0,
        maxzoom: maxzoom || 14,
        bounds: [bounds[0], bounds[1], bounds[2], bounds[3]],
      };
    } else {
      sources.preview = {
        type: "image",
        url: previewUrl,
        coordinates: imageCoordinates(bounds),
      };
    }
    const layers = [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#e8eef1" },
      },
      {
        id: "osm",
        type: "raster",
        source: "osm",
        paint: { "raster-opacity": 0.72 },
      },
    ];

    if (referenceUrl && referenceBounds) {
      sources.reference = {
        type: "image",
        url: referenceUrl,
        coordinates: imageCoordinates(referenceBounds),
      };
      layers.push({
        id: "reference",
        type: "raster",
        source: "reference",
        paint: { "raster-opacity": 0.9 },
      });
    }

    extraLayers.forEach((layer, index) => {
      const sourceId = `context-${index}`;
      if (!layer?.bounds) {
        return;
      }
      if (layer.tileUrl) {
        sources[sourceId] = {
          type: "raster",
          tiles: [layer.tileUrl],
          tileSize: layer.tileSize || 256,
          minzoom: layer.minzoom || 0,
          maxzoom: layer.maxzoom || 14,
          bounds: [
            layer.bounds[0],
            layer.bounds[1],
            layer.bounds[2],
            layer.bounds[3],
          ],
        };
      } else if (layer.previewUrl) {
        sources[sourceId] = {
          type: "image",
          url: layer.previewUrl,
          coordinates: imageCoordinates(layer.bounds),
        };
      } else {
        return;
      }
      layers.push({
        id: sourceId,
        type: "raster",
        source: sourceId,
        paint: {
          "raster-opacity": layer.opacity ?? 0.55,
          "raster-resampling":
            layer.tileUrl || layer.categorical ? "nearest" : "linear",
          "raster-fade-duration": 0,
        },
      });
    });

    layers.push({
      id: "preview",
      type: "raster",
      source: "preview",
      paint: {
        "raster-opacity": 0.88,
        "raster-resampling": tileUrl || categorical ? "nearest" : "linear",
        "raster-fade-duration": 0,
      },
    });

    return { version: 8, sources, layers };
  }

  function bindPanel(map, panel, bounds, _extraLayers = []) {
    if (!panel) {
      return;
    }
    const visible = panel.querySelector("#layer-visible");
    const opacity = panel.querySelector("#layer-opacity");
    const opacityValue = panel.querySelector("#layer-opacity-value");
    const basemap = panel.querySelector("#basemap-select");
    const fitButton = panel.querySelector("#map-fit-layer");

    visible?.addEventListener("change", () => {
      map.setLayoutProperty(
        "preview",
        "visibility",
        visible.checked ? "visible" : "none"
      );
    });

    opacity?.addEventListener("input", () => {
      const value = Math.min(1, Math.max(0, Number(opacity.value)));
      map.setPaintProperty("preview", "raster-opacity", value);
      if (opacityValue) {
        opacityValue.textContent = `${Math.round(value * 100)}%`;
      }
    });

    basemap?.addEventListener("change", () => {
      const mode = basemap.value;
      if (map.getLayer("osm")) {
        map.setLayoutProperty(
          "osm",
          "visibility",
          mode === "osm" ? "visible" : "none"
        );
      }
    });

    fitButton?.addEventListener("click", () => {
      map.fitBounds(
        [
          [bounds[0], bounds[1]],
          [bounds[2], bounds[3]],
        ],
        { padding: 48, duration: 400 }
      );
    });

    panel.querySelectorAll("[data-context-visible]").forEach((input) => {
      input.addEventListener("change", () => {
        const layerId = `context-${input.dataset.contextVisible}`;
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(
            layerId,
            "visibility",
            input.checked ? "visible" : "none"
          );
        }
      });
    });

    panel.querySelectorAll("[data-context-opacity]").forEach((input) => {
      input.addEventListener("input", () => {
        const layerId = `context-${input.dataset.contextOpacity}`;
        const value = Math.min(1, Math.max(0, Number(input.value)));
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, "raster-opacity", value);
        }
      });
    });
  }

  function geometryCoordinates(value, output) {
    if (!Array.isArray(value)) {
      return;
    }
    if (
      value.length >= 2 &&
      Number.isFinite(Number(value[0])) &&
      Number.isFinite(Number(value[1]))
    ) {
      output.push([Number(value[0]), Number(value[1])]);
      return;
    }
    for (const item of value) {
      geometryCoordinates(item, output);
    }
  }

  function geometryBounds(geometry) {
    const coordinates = [];
    if (!geometry) {
      return null;
    }
    if (geometry.type === "FeatureCollection") {
      for (const feature of geometry.features || []) {
        geometryCoordinates(feature.geometry?.coordinates, coordinates);
      }
    } else if (geometry.type === "Feature") {
      geometryCoordinates(geometry.geometry?.coordinates, coordinates);
    } else {
      geometryCoordinates(geometry.coordinates, coordinates);
    }
    if (!coordinates.length) {
      return null;
    }
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    for (const [lng, lat] of coordinates) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    return [
      [minLng, minLat],
      [maxLng, maxLat],
    ];
  }

  function ensureAoiLayers(map) {
    if (!map.getSource("hbc-aoi")) {
      map.addSource("hbc-aoi", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }
    if (!map.getLayer("hbc-aoi-fill")) {
      map.addLayer({
        id: "hbc-aoi-fill",
        type: "fill",
        source: "hbc-aoi",
        paint: { "fill-color": "#b45309", "fill-opacity": 0.12 },
      });
    }
    if (!map.getLayer("hbc-aoi-line")) {
      map.addLayer({
        id: "hbc-aoi-line",
        type: "line",
        source: "hbc-aoi",
        paint: { "line-color": "#8a3f06", "line-width": 2 },
      });
    }
  }

  function setAoi(map, geometry, { fit = true } = {}) {
    if (!map || !geometry) {
      return;
    }
    if (!map.isStyleLoaded()) {
      map.once("load", () => setAoi(map, geometry, { fit }));
      return;
    }
    ensureAoiLayers(map);
    const feature =
      geometry.type === "FeatureCollection"
        ? geometry
        : {
            type: "FeatureCollection",
            features: [
              geometry.type === "Feature"
                ? geometry
                : { type: "Feature", properties: {}, geometry },
            ],
          };
    map.getSource("hbc-aoi")?.setData(feature);
    if (fit) {
      const bounds = geometryBounds(feature);
      if (bounds) {
        map.fitBounds(bounds, { padding: 48, duration: 400 });
      }
    }
  }

  function clearAoi(map) {
    if (!map || !map.isStyleLoaded()) {
      return;
    }
    map?.getSource("hbc-aoi")?.setData({
      type: "FeatureCollection",
      features: [],
    });
  }

  function ensureIdentifyLayers(map) {
    if (!map.getSource("hbc-identify")) {
      map.addSource("hbc-identify", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }
    if (!map.getLayer("hbc-identify-point")) {
      map.addLayer({
        id: "hbc-identify-point",
        type: "circle",
        source: "hbc-identify",
        paint: {
          "circle-radius": 6,
          "circle-color": "#b45309",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
    }
  }

  function setIdentifyPoint(map, lngLat) {
    ensureIdentifyLayers(map);
    map.getSource("hbc-identify")?.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Point",
            coordinates: [lngLat.lng, lngLat.lat],
          },
        },
      ],
    });
  }

  function clearIdentify(map) {
    if (!map || !map.isStyleLoaded()) {
      return;
    }
    map.getSource("hbc-identify")?.setData({
      type: "FeatureCollection",
      features: [],
    });
  }

  function setIdentifyMode(map, enabled, callback) {
    if (!map) {
      return;
    }
    let styleLoaded = false;
    try {
      styleLoaded = map.isStyleLoaded();
    } catch (error) {
      return;
    }
    if (!styleLoaded) {
      if (enabled) {
        map.once("load", () => setIdentifyMode(map, true, callback));
      }
      return;
    }
    if (map.__hbcIdentify) {
      map.off("click", map.__hbcIdentify.handler);
      map.getCanvas().style.cursor = map.__hbcIdentify.previousCursor || "";
      map.__hbcIdentify = null;
    }
    clearIdentify(map);
    if (!enabled) {
      return;
    }
    map.getCanvas().style.cursor = "crosshair";
    const handler = (event) => {
      setIdentifyPoint(map, event.lngLat);
      callback(event.lngLat);
    };
    map.on("click", handler);
    map.__hbcIdentify = {
      handler,
      previousCursor: "grab",
    };
  }

  function rectangleGeometry(start, end) {
    const west = Math.min(start.lng, end.lng);
    const east = Math.max(start.lng, end.lng);
    const south = Math.min(start.lat, end.lat);
    const north = Math.max(start.lat, end.lat);
    return {
      type: "Polygon",
      coordinates: [
        [
          [west, north],
          [east, north],
          [east, south],
          [west, south],
          [west, north],
        ],
      ],
    };
  }

  function startRectangleDraw(map, callback) {
    if (!map) {
      return;
    }
    if (!map.isStyleLoaded()) {
      map.once("load", () => startRectangleDraw(map, callback));
      return;
    }
    if (!map.getSource("hbc-draw")) {
      map.addSource("hbc-draw", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "hbc-draw-fill",
        type: "fill",
        source: "hbc-draw",
        paint: { "fill-color": "#b45309", "fill-opacity": 0.12 },
      });
      map.addLayer({
        id: "hbc-draw-line",
        type: "line",
        source: "hbc-draw",
        paint: {
          "line-color": "#8a3f06",
          "line-width": 2,
          "line-dasharray": [2, 1],
        },
      });
    }
    const canvas = map.getCanvas();
    const previousCursor = canvas.style.cursor;
    canvas.style.cursor = "crosshair";
    map.dragPan.disable();
    let start = null;
    let drawing = false;
    let lastTouch = null;

    const cleanup = () => {
      map.off("mousedown", onDown);
      map.off("mousemove", onMove);
      map.off("mouseup", onUp);
      map.off("touchstart", onTouchStart);
      map.off("touchmove", onTouchMove);
      map.off("touchend", onTouchEnd);
      map.dragPan.enable();
      canvas.style.cursor = previousCursor || "grab";
      map.getSource("hbc-draw")?.setData({
        type: "FeatureCollection",
        features: [],
      });
      map.__hbcCancelDraw = null;
    };
    map.__hbcCancelDraw = cleanup;

    const update = (end) => {
      const geometry = rectangleGeometry(start, end);
      map.getSource("hbc-draw")?.setData({
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: {}, geometry }],
      });
      return geometry;
    };

    const finish = (end) => {
      if (!drawing || !start) {
        return;
      }
      drawing = false;
      const geometry = update(end);
      const bounds = geometryBounds(geometry);
      cleanup();
      if (
        bounds &&
        (Math.abs(bounds[1][0] - bounds[0][0]) > 0.0005 ||
          Math.abs(bounds[1][1] - bounds[0][1]) > 0.0005)
      ) {
        callback(geometry);
      }
    };

    const onDown = (event) => {
      if (event.originalEvent && event.originalEvent.button !== 0) {
        return;
      }
      start = event.lngLat;
      drawing = true;
      update(start);
    };
    const onMove = (event) => {
      if (drawing && start) {
        update(event.lngLat);
      }
    };
    const onUp = (event) => {
      finish(event.lngLat);
    };
    const onTouchStart = (event) => {
      if (event.originalEvent?.touches?.length !== 1) {
        return;
      }
      start = event.lngLat;
      lastTouch = start;
      drawing = true;
      update(start);
    };
    const onTouchMove = (event) => {
      if (drawing && start) {
        lastTouch = event.lngLat;
        update(lastTouch);
      }
    };
    const onTouchEnd = () => {
      finish(lastTouch);
    };

    map.on("mousedown", onDown);
    map.on("mousemove", onMove);
    map.on("mouseup", onUp);
    map.on("touchstart", onTouchStart);
    map.on("touchmove", onTouchMove);
    map.on("touchend", onTouchEnd);
  }

  async function create(options) {
    const {
      container,
      previewUrl = null,
      tileUrl = null,
      tileSize = 256,
      minzoom = 0,
      maxzoom = 14,
      referenceUrl = null,
      referenceBounds = null,
      bounds,
      panel = null,
      loading = null,
      onError = null,
      categorical = false,
      extraLayers = [],
    } = options;

    const parsed = validBounds(bounds);
    if (!parsed) {
      throw new Error("The preview artifact does not have usable WGS84 bounds.");
    }
    if (!previewUrl && !tileUrl) {
      throw new Error("The preview image or tile URL is missing.");
    }

    const maplibregl = await ensureMaplibre();
    destroy();

    const map = new maplibregl.Map({
      container,
      style: styleFor({
        previewUrl,
        tileUrl,
        tileSize,
        minzoom,
        maxzoom,
        referenceUrl,
        referenceBounds: validBounds(referenceBounds),
        bounds: parsed,
        categorical,
        extraLayers,
      }),
      bounds: [
        [parsed[0], parsed[1]],
        [parsed[2], parsed[3]],
      ],
      fitBoundsOptions: { padding: 48 },
      minZoom: 1,
      maxZoom: 15,
      attributionControl: true,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();

    map.on("load", () => {
      map.__hbcReady = true;
      map.fitBounds(
        [
          [parsed[0], parsed[1]],
          [parsed[2], parsed[3]],
        ],
        { padding: 48, duration: 0 }
      );
      requestAnimationFrame(() => map.resize());
      loading?.remove();
    });

    map.on("error", (event) => {
      if (onError && event?.error && event?.sourceId === "preview") {
        onError(event.error);
      }
    });

    bindPanel(map, panel, parsed, extraLayers);
    map.__hbc = {
      setAoi: (geometry, options) => setAoi(map, geometry, options),
      clearAoi: () => clearAoi(map),
      startRectangleDraw: (callback) => startRectangleDraw(map, callback),
      cancelRectangleDraw: () => map.__hbcCancelDraw?.(),
      setIdentifyMode: (enabled, callback) =>
        setIdentifyMode(map, enabled, callback),
      clearIdentify: () => clearIdentify(map),
    };
    activeMap = map;
    return map;
  }

  function destroy() {
    if (activeMap) {
      try {
        activeMap.remove();
      } catch (error) {
        // A removed container is harmless.
      }
      activeMap = null;
    }
  }

  globalScope.HectaresBCMap = {
    create,
    destroy,
    validBounds,
  };
})(typeof window !== "undefined" ? window : globalThis);
