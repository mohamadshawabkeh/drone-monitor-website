import { io } from "socket.io-client";
import { useDronesStore } from "./store/drones";

let socketInstance = null;

export function initSocket() {
  if (socketInstance) return socketInstance;

  const envUrl = process.env.REACT_APP_SOCKET_URL;
  const defaultRemote = "https://drone-monitor-backend.onrender.com";
  const isProd = process.env.NODE_ENV === "production";
  const isPageHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';

  // Build candidates based on environment
  let candidates = [];
  if (isProd) {
    // In production, prefer remote first
    candidates = [envUrl || defaultRemote, "http://localhost:9013"]; 
  } else {
    // In dev, prefer localhost first then remote
    candidates = ["http://localhost:9013", envUrl || defaultRemote];
  }

  // If page is https, trying to connect to http localhost will be blocked as mixed content.
  if (isPageHttps) {
    candidates = candidates.filter(u => !/^http:\/\/localhost/i.test(u));
  }

  // De-duplicate and remove falsy
  candidates = Array.from(new Set(candidates.filter(Boolean)));

  const upsert = useDronesStore.getState().upsertFromFeatureCollection;

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

  const attachAfterConnect = (socket, url) => {
    console.log("Socket connected", socket.id, "->", url);
    socket.on("message", (fc) => {
      batch.push(fc);
      if (!timer) timer = setTimeout(flush, FLUSH_MS);
    });
    socket.on("disconnect", () => {});
  };

  let attemptIndex = 0;
  const attemptNext = () => {
    if (attemptIndex >= candidates.length) {
      console.error("Socket: all connection attempts failed", candidates);
      return;
    }
    const url = candidates[attemptIndex++];
    console.log("Socket: attempting", url);
    const socket = io(url, { transports: ["websocket", "polling"], timeout: 4000 });

    let connected = false;
    const cleanFailAndRetry = (reason) => {
      if (connected) return; // already connected
      try {
        socket.removeAllListeners();
        socket.disconnect();
      } catch (_) {}
      console.warn(`Socket: failed to connect to ${url} (${reason}). Trying next...`);
      attemptNext();
    };

    socket.on("connect", () => {
      connected = true;
      socketInstance = socket;
      attachAfterConnect(socket, url);
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connect_error ->", url, err?.message || err);
      cleanFailAndRetry("connect_error");
    });

    socket.on("error", (err) => {
      console.error("Socket error ->", url, err?.message || err);
    });

    setTimeout(() => {
      if (!connected) cleanFailAndRetry("timeout");
    }, 4500);
  };

  attemptNext();
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
