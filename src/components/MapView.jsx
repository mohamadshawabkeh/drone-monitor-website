import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useDronesStore } from "../store/drones";
import debounce from "lodash.debounce";
import greenDroneUrl from "../assets/icons/green-drone.svg";
import redDroneUrl from "../assets/icons/red-drone.svg";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

const toFeatures = (drones, filterMode = 'all') => {
  const points = [];
  const lines = [];
  for (const d of Object.values(drones)) {
    const coords = d.feature?.geometry?.coordinates;
    if (!Array.isArray(coords)) continue;
    const allowed = useDronesStore.getState().isAllowed(d.registration);
    if (filterMode === 'red' && allowed) continue;
    if (filterMode === 'green' && !allowed) continue;
    points.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: coords },
      properties: {
        serial: d.serial,
        name: d.name,
        registration: d.registration,
        altitude: d.altitude,
        yaw: d.yaw,
        allowed: allowed ? 1 : 0,
      },
    });
    if (Array.isArray(d.path) && d.path.length > 1) {
      const fullCoords = d.path;
      if (fullCoords.length > 1) {
        lines.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: fullCoords },
          properties: { serial: d.serial, allowed: allowed ? 1 : 0 },
        });
      }
    }
  }
  return {
    points: { type: "FeatureCollection", features: points },
    lines: { type: "FeatureCollection", features: lines },
  };
};

const MapView = () => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const initOnceRef = useRef(false);
  const popupRef = useRef(null);
  

  useEffect(() => {
    if (initOnceRef.current) {
      return;
    }

    if (!mapboxgl.accessToken) {
      console.warn("Missing REACT_APP_MAPBOX_TOKEN for Mapbox");
    }
    if (containerRef.current) {
      try { containerRef.current.innerHTML = ""; } catch (_) {}
    }

    let map;
    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [35.9306, 31.9539],
        zoom: 10,
        minZoom: 2,
        maxZoom: 16,
        cooperativeGestures: true,
        renderWorldCopies: false,
        attributionControl: false,
      });
    } catch (e) {
      console.error("[MapView] map construction failed", e);
      return;
    }
    mapRef.current = map;
    initOnceRef.current = true;

    const handleResize = () => {
      try { map.resize(); } catch (e) {  }
    };
    window.addEventListener("resize", handleResize);

    map.on("error", (e) => console.error("[MapView] mapbox error event", e?.error || e));

    map.on("load", () => {
      console.log("--- MAP LOADED ---")
      const loadIcon = (name, url) =>
        new Promise((resolve) => {
          try {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              try {
                if (map.hasImage && map.hasImage(name)) map.removeImage(name);
                map.addImage(name, img);
              } catch (e) {
                console.error(`[MapView] addImage(${name}) failed`, e);
              }
              resolve();
            };
            img.onerror = (e) => {
              console.error(`[MapView] failed to load icon ${name}`, e);
              resolve();
            };
            img.src = url;
          } catch (e) {
            console.error(`[MapView] exception while loading icon ${name}`, e);
            resolve();
          }
        });

      Promise.all([
        loadIcon("drone-green", greenDroneUrl),
        loadIcon("drone-red", redDroneUrl),
      ]).then(() => {

      const stateAtInit = useDronesStore.getState();
      const { points, lines } = toFeatures(stateAtInit.drones, stateAtInit.filterMode);
      map.addSource("drones-points", { type: "geojson", data: points });
      map.addSource("drones-lines", { type: "geojson", data: lines });

      map.addLayer({
        id: "drone-paths-halo",
        type: "line",
        source: "drones-lines",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            10, 5,
            13, 7,
            16, 10
          ],
          "line-color": ["case", ["==", ["get", "allowed"], 1], "#1b6119", "#6b1515"],
          "line-opacity": 0.45,
        },
      });
      map.addLayer({
        id: "drone-paths",
        type: "line",
        source: "drones-lines",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            10, 3,
            13, 4.5,
            16, 6
          ],
          "line-color": ["case", ["==", ["get", "allowed"], 1], "#35d335", "#e02424"],
        },
      });
      map.addLayer({
        id: "drone-arrows",
        type: "symbol",
        source: "drones-points",
        layout: {
          "icon-image": [
            "case",
            ["==", ["get", "allowed"], 1],
            "drone-green",
            "drone-red",
          ],
          "icon-size": 0.55,
          "icon-anchor": "center",
          "icon-rotate": ["get", "yaw"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
        },
      });
      
      try {
        map.resize();
        map.triggerRepaint && map.triggerRepaint();
      } catch (_) {}

      popupRef.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, className: 'drone-popup' });

      const handleMove = (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["drone-arrows"] });
        if (features.length) {
          const f = features[0];
          const { serial, name, altitude } = f.properties;
          const d = useDronesStore.getState().drones[serial];
          if (!d) return;
          const elapsedMs = Date.now() - d.startedAt;
          const hours = Math.floor(elapsedMs / 3600000).toString().padStart(2, '0');
          const mins = Math.floor((elapsedMs % 3600000) / 60000).toString().padStart(2, '0');
          const secs = Math.floor((elapsedMs % 60000) / 1000).toString().padStart(2, '0');
          popupRef.current
            .setLngLat(f.geometry.coordinates)
            .setHTML(`
              <div class="dp">
                <div class="dp-title">${name}</div>
                <div class="dp-grid">
                  <div class="dp-col">
                    <div class="dp-label">Altitude</div>
                    <div class="dp-value">${Number(altitude).toFixed(1)} m</div>
                  </div>
                  <div class="dp-col">
                    <div class="dp-label">Flight Time</div>
                    <div class="dp-value">${hours}:${mins}:${secs}</div>
                  </div>
                </div>
              </div>
            `)
            .addTo(map);
          useDronesStore.getState().hover(serial);
        } else {
          popupRef.current.remove();
          useDronesStore.getState().hover(null);
        }
      };
      map.on("mousemove", handleMove);

      map.on("click", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["drone-arrows"] });
        if (features.length) {
          const f = features[0];
          const { serial } = f.properties;
          useDronesStore.getState().select(serial);
          map.flyTo({ center: f.geometry.coordinates, zoom: Math.max(map.getZoom(), 13) });
        }
      });

      const updateSources = debounce((stateOverride) => {
        const state = stateOverride || useDronesStore.getState();
        const { points, lines } = toFeatures(state.drones, state.filterMode);
        const p = map.getSource("drones-points");
        const l = map.getSource("drones-lines");
        if (p) p.setData(points); else console.warn("[MapView] drones-points source missing");
        if (l) l.setData(lines); else console.warn("[MapView] drones-lines source missing");
      }, 200);

      const unsub = useDronesStore.subscribe((state, prev) => {
        const dronesChanged = state.drones !== prev.drones;
        const selectionChanged = state.selectedId !== prev.selectedId;
        const reselection = state.selectedAt !== prev.selectedAt;
        const filterChanged = state.filterMode !== prev.filterMode;
        if (dronesChanged) {
          updateSources(state);
        }
        if ((selectionChanged || reselection) && state.selectedId) {
          const d = state.drones[state.selectedId];
          const coords = d?.feature?.geometry?.coordinates;
          if (coords) map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 13) });
        }
        if (filterChanged) {
          updateSources(state);
        }
      });

      updateSources();
      map.on("data", (e) => {
        if (e.sourceId === "drones-lines" && e.isSourceLoaded) {
        }
      });

      return () => {
        unsub();
        popupRef.current?.remove();
        map.remove();
        mapRef.current = null;
        initOnceRef.current = false;
      };
      });
    });
  }, []);

  return <div ref={containerRef} className="map-container" />;
};

export default MapView;
