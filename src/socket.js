import { io } from "socket.io-client";
import { useDronesStore } from "./store/drones";

let socketInstance = null;

export function initSocket() {
  if (socketInstance) return socketInstance;
  const url = process.env.REACT_APP_SOCKET_URL || "http://localhost:9013";
  const socket = io(url, { transports: ["websocket", "polling"] });

  const upsert = useDronesStore.getState().upsertFromFeatureCollection;

  socket.on("connect", () => {
    console.log("Socket connected", socket.id);
  });

  let batch = [];
  let timer = null;
  const FLUSH_MS = 80;
  const flush = () => {
    if (!batch.length) return;
    try {
      const merged = { type: "FeatureCollection", features: [] };
      for (const fc of batch) {
        if (fc && Array.isArray(fc.features)) merged.features.push(...fc.features);
      }
      upsert(merged);
    } finally {
      batch = [];
      timer = null;
    }
  };
  socket.on("message", (fc) => {
    batch.push(fc);
    if (!timer) timer = setTimeout(flush, FLUSH_MS);
  });

  socket.on("disconnect", () => {});

  socketInstance = socket;
  return socketInstance;
}

export function disconnectSocket() {
  if (!socketInstance) return;
  try {
    socketInstance.off("message");
    socketInstance.disconnect();
  } catch (_) {}
  socketInstance = null;
}
