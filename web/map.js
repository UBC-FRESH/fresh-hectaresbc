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

  function styleFor({ previewUrl, referenceUrl, referenceBounds, bounds, categorical }) {
    const sources = {
      osm: {
        type: "raster",
        tiles: OSM_TILES,
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      },
      preview: {
        type: "image",
        url: previewUrl,
        coordinates: imageCoordinates(bounds),
      },
    };
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

    layers.push({
      id: "preview",
      type: "raster",
      source: "preview",
      paint: {
        "raster-opacity": 0.88,
        "raster-resampling": categorical ? "nearest" : "linear",
        "raster-fade-duration": 0,
      },
    });

    return { version: 8, sources, layers };
  }

  function bindPanel(map, panel, bounds) {
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
  }

  async function create(options) {
    const {
      container,
      previewUrl,
      referenceUrl = null,
      referenceBounds = null,
      bounds,
      panel = null,
      loading = null,
      onError = null,
      categorical = false,
    } = options;

    const parsed = validBounds(bounds);
    if (!parsed) {
      throw new Error("The preview artifact does not have usable WGS84 bounds.");
    }
    if (!previewUrl) {
      throw new Error("The preview artifact URL is missing.");
    }

    const maplibregl = await ensureMaplibre();
    destroy();

    const map = new maplibregl.Map({
      container,
      style: styleFor({
        previewUrl,
        referenceUrl,
        referenceBounds: validBounds(referenceBounds),
        bounds: parsed,
        categorical,
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

    bindPanel(map, panel, parsed);
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
