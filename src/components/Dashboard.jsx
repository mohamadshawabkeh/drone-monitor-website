import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDronesStore } from "../store/drones";

const Starfield = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });

    let raf = 0;
    let running = true;
    const DPR = Math.min(2, window.devicePixelRatio || 1);

    const state = {
      stars: [],
      w: 0,
      h: 0,
    };

    const resize = () => {
      const vw = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
      const vh = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
      state.w = vw;
      state.h = vh;
      canvas.width = Math.floor(state.w * DPR);
      canvas.height = Math.floor(state.h * DPR);
      canvas.style.width = state.w + "px";
      canvas.style.height = state.h + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      seed();
    };

    const seed = () => {
      const count = Math.round((state.w * state.h) / 1800);
      state.stars = new Array(count).fill(0).map(() => {
        const z = Math.random();
        return {
          x: Math.random() * state.w,
          y: Math.random() * state.h,
          z,
          r: 0.6 + z * 1.6,
          vx: (0.08 + z * 0.35) * (Math.random() * 0.6 + 0.7),
          tw: Math.random() * Math.PI * 2,
        };
      });
    };

    const step = (t) => {
      if (!running) return;
      ctx.clearRect(0, 0, state.w, state.h);
      const g = ctx.createRadialGradient(state.w * 0.7, state.h * 0.3, 0, state.w * 0.7, state.h * 0.3, Math.max(state.w, state.h));
      g.addColorStop(0, "rgba(60,80,120,0.06)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, state.w, state.h);

      for (const s of state.stars) {
        s.x -= s.vx;
        if (s.x < -2) s.x = state.w + 2; 
        s.tw += 0.03 + s.z * 0.02;
        const glow = 0.6 + Math.sin(s.tw) * 0.4;

        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${0.45 + 0.5 * glow})`;
        ctx.arc(s.x, s.y, s.r * (0.9 + glow * 0.3), 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(step);
    };

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(step);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas className="stars" ref={canvasRef} />;
};

const CountUp = ({ value, duration = 400 }) => {
  const [display, setDisplay] = useState(value || 0);
  const startRef = useRef(display);
  useEffect(() => {
    const from = Number(startRef.current) || 0;
    const to = Number(value) || 0;
    if (from === to) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); 
      const v = Math.round(from + (to - from) * eased);
      setDisplay(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  useEffect(() => { startRef.current = value; });
  return <span className="kpi-value">{display}</span>;
};

const Dashboard = ({ onGoToMap = () => {} }) => {
  const drones = useDronesStore((s) => s.drones);
  const isAllowed = useDronesStore((s) => s.isAllowed);
  const counters = useMemo(() => {
    const all = Object.values(drones || {});
    let red = 0;
    for (const d of all) if (!isAllowed(d.registration)) red += 1;
    const total = all.length;
    const green = Math.max(0, total - red);
    return { total, red, green };
  }, [drones, isAllowed]);
  const snapshot = useMemo(() => {
    const list = Object.values(drones || {});
    list.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
    return list.slice(0, 5);
  }, [drones]);
  return (
    <section className="dashboard">
      <Starfield />
      <div className="dash-scrim" />

      <div className="dash-content">
        <div className="dash-surface">
          <header className="dash-hero">
            <h1>SAGER Drone Monitor</h1>
            <p className="lead">
              Real‑time situational awareness for connected drones. Stream positions, draw paths,
              and spot violations at a glance.
            </p>
          </header>
          <div className="kpis">
            <div
              className="kpi clickable"
              onClick={onGoToMap}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onGoToMap(); } }}
              aria-label="Show Live Map filtered to all drones"
              title="Open Live Map"
            >
              <div className="kpi-label">Total Drones</div>
              <CountUp value={counters.total} />
            </div>
            <div
              className="kpi clickable"
              onClick={onGoToMap}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onGoToMap(); } }}
              aria-label="Show Live Map highlighting red (blocked) drones"
              title="Open Live Map"
            >
              <div className="kpi-label">Red (Blocked)</div>
              <div className="kpi-row">
                <span className="dot red" />
                <CountUp value={counters.red} />
              </div>
            </div>
            <div
              className="kpi clickable"
              onClick={onGoToMap}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onGoToMap(); } }}
              aria-label="Show Live Map highlighting green (allowed) drones"
              title="Open Live Map"
            >
              <div className="kpi-label">Green (Allowed)</div>
              <div className="kpi-row">
                <span className="dot green" />
                <CountUp value={counters.green} />
              </div>
            </div>
          </div>
          <div className="dash-cards">
            <div
              className="card hoverable clickable"
              onClick={onGoToMap}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onGoToMap(); } }}
              aria-label="Open Live Map"
            >
              <h3>Live Map</h3>
              <p>
                Powered by Mapbox GL. Every update paints the sky with accurate paths and heading‑aware
                icons rotated by <code>yaw</code>.
              </p>
            </div>
            <div className="card hoverable">
              <span className="ribbon">Coming soon</span>
              <h3>Drone List</h3>
              <p>
                A compact side panel that mirrors the map: select to center, hover to inspect, and
                instantly see registration status.
              </p>
            </div>
            <div className="card hoverable">
              <span className="ribbon">Coming soon</span>
              <h3>Compliance</h3>
              <p>
                Registrations beginning with <strong>B</strong> fly green; others flag red automatically.
              </p>
            </div>
            <div className="card hoverable">
              <span className="ribbon">Coming soon</span>
              <h3>Performance</h3>
              <p>
                GPU‑accelerated layers and a lightweight store handle thousands of drones without
                breaking a sweat.
              </p>
            </div>
          </div>

          <section className="live-snapshot">
            <h2>Live Snapshot</h2>
            <ul className="snapshot-list">
              {snapshot.map((d) => {
                const allowed = isAllowed(d.registration);
                return (
                  <li key={d.serial} className="snapshot-item">
                    <span className={`dot ${allowed ? 'green' : 'red'}`} />
                    <span className="snap-name">{d.name || 'Drone'}</span>
                    <span className="snap-reg">{d.registration || d.serial}</span>
                    <span className="snap-alt">{Math.round(d.altitude || 0)} m</span>
                  </li>
                );
              })}
              {snapshot.length === 0 && (
                <li className="snapshot-empty">Waiting for live data…</li>
              )}
            </ul>
          </section>

          <section className="how-it-works">
            <h2>How it works</h2>
            <ol>
              <li>The backend streams GeoJSON over WebSocket (Socket.IO).</li>
              <li>The app aggregates positions into per‑drone paths.</li>
              <li>Mapbox renders paths, icons, and smart popups.</li>
              <li>The counter calls out non‑compliant (red) drones.</li>
            </ol>
          </section>

          <footer className="dash-footer">
            <span>Built with React, Zustand, Mapbox GL, and Socket.IO</span>
          </footer>
        </div>
      </div>
    </section>
  );
};

export default Dashboard;
