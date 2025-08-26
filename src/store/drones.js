import { create } from "zustand";
import { nanoid } from "nanoid";

const SINGLE_FLIGHT_MODE = false;


const getStableId = (feature) => {
  const p = feature?.properties || {};
  return (
    p.registration ||
    p.serial ||
    p.Registration ||
    p.Name ||
    p.name ||
    p.id ||
    p.droneId ||
    null
  );
};

const makeDrone = (feature, forcedSerial) => {
  const registration = feature.properties?.registration || "";
  const identity = forcedSerial || registration || feature.properties?.serial || nanoid();
  const now = Date.now();
  return {
    serial: identity,
    name: feature.properties?.Name || "Drone",
    registration,
    altitude: feature.properties?.altitude ?? 0,
    yaw: feature.properties?.yaw ?? 0,
    organization: feature.properties?.organization || "",
    pilot: feature.properties?.pilot || "",
    currentSerial: feature.properties?.serial || null,
    startedAt: now,
    lastUpdated: now,
    feature,
    paths: [ [feature.geometry?.coordinates || [0, 0]] ],
    path: [feature.geometry?.coordinates || [0, 0]],
  };
};

const toRad = (d) => (d * Math.PI) / 180;
const haversineMeters = (a, b) => {
  if (!a || !b) return Infinity;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const aa = s1 * s1 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
};

const findNearestDroneId = (coords, drones, maxMeters = 800) => {
  if (!coords) return null;
  let best = { id: null, dist: Infinity };
  for (const d of Object.values(drones)) {
    const last = d.path?.[d.path.length - 1] || d.feature?.geometry?.coordinates;
    const dist = haversineMeters(coords, last);
    if (dist < best.dist) best = { id: d.serial, dist };
  }
  return best.dist <= maxMeters ? best.id : null;
};

const isAllowed = (registration) => {
  if (!registration) return false;
  const parts = String(registration).split("-");
  const part = parts.length > 1 ? parts[1] : parts[0];
  return part?.[0] === "B";
};

export const useDronesStore = create((set, get) => ({
  drones: {},
  selectedId: null,
  selectedAt: 0,
  hoveredId: null,
  filterMode: 'all',
  simPoolSize: 20,
  simIndex: 0,
  ingestEnabled: false,

  upsertFromFeatureCollection: (fc) => {
    if (!get().ingestEnabled) return;
    if (!fc || !Array.isArray(fc.features)) return;
    const now = Date.now();

    set((state) => {
      const next = { ...state.drones };
      const single = SINGLE_FLIGHT_MODE && fc.features.length === 1;
      const poolSize = get().simPoolSize || 20;
      const poolSlot = single ? (state.simIndex % poolSize) : null;
      for (const f of fc.features) {
        let serialKey = getStableId(f);
        if (single) {
          serialKey = `SIM-${poolSlot}`;
        }
        if (!serialKey) {
          const coordsForId = f?.geometry?.coordinates;
          if (Array.isArray(coordsForId) && coordsForId.length === 2) {
            try {
              serialKey = `${Number(coordsForId[0]).toFixed(3)},${Number(coordsForId[1]).toFixed(3)}`;
            } catch (_) {}
          }
        }
        const coords = f?.geometry?.coordinates;
        if (!serialKey) {
          const nn = findNearestDroneId(coords, next, 800);
          if (nn) serialKey = nn;
        }
        if (!serialKey) continue;
        const prev = next[serialKey];
        if (prev) {
          let paths = Array.isArray(prev.paths) ? prev.paths.map(seg => seg.slice()) : [prev.path.slice()];
          const backendSerial = f.properties?.serial || null;
          if (Array.isArray(coords) && coords.length === 2) {
            const currentSerial = prev.currentSerial || null;
            if (backendSerial && backendSerial !== currentSerial) {
              paths.push([coords]);
            } else {
              const lastSeg = paths[paths.length - 1] || [];
              const last = lastSeg[lastSeg.length - 1];
              if (!last || last[0] !== coords[0] || last[1] !== coords[1]) {
                lastSeg.push(coords);
              }
              paths[paths.length - 1] = lastSeg;
            }
          }
          let flat = [].concat(...paths);
          next[serialKey] = {
            ...prev,
            altitude: f.properties?.altitude ?? prev.altitude,
            yaw: f.properties?.yaw ?? prev.yaw,
            registration: prev.registration || f.properties?.registration || prev.registration,
            name: prev.name ?? f.properties?.Name ?? f.properties?.name ?? prev.name,
            serial: prev.serial || serialKey,
            currentSerial: backendSerial ?? prev.currentSerial ?? null,
            feature: f,
            lastUpdated: now,
            paths,
            path: flat,
          };
        } else {
          const d = makeDrone(f, serialKey);
          if (single) {
            const idx = Number(String(serialKey).split('-')[1] || 0);
            const isGreen = idx % 2 === 0;
            d.registration = isGreen ? 'SG-BA' : 'SD-CA';
          }
          next[d.serial] = d;
        }
      }
      if (single) {
        return { drones: next, simIndex: state.simIndex + 1 };
      }
      return { drones: next };
    });
  },

  select: (id) => set(() => ({ selectedId: id, selectedAt: Date.now() })),
  hover: (id) => set({ hoveredId: id }),
  clearUI: () => set({ selectedId: null, hoveredId: null }),
  setFilterMode: (mode) => set({ filterMode: mode }),
  enableIngest: () => set({ ingestEnabled: true }),
  disableIngest: () => set({ ingestEnabled: false }),
  cycleFilterMode: () => set((s) => {
    const order = ['red', 'green', 'all'];
    const idx = order.indexOf(s.filterMode);
    const next = order[(idx + 1) % order.length];
    return { filterMode: next };
  }),

  getCounters: () => {
    const all = Object.values(get().drones);
    let red = 0;
    for (const d of all) if (!isAllowed(d.registration)) red += 1;
    const total = all.length;
    const green = Math.max(0, total - red);
    return { red, green, total };
  },

  isAllowed,
}));
