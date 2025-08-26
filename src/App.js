import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { initSocket, disconnectSocket } from "./socket";
import { useDronesStore } from "./store/drones";
import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import NavRail from "./components/NavRail";
import Dashboard from "./components/Dashboard";
import CloseIcon from "./assets/icons/x-button.svg";

function App() {
  const drones = useDronesStore((s) => s.drones);
  const isAllowed = useDronesStore((s) => s.isAllowed);
  const redCount = useMemo(() => {
    const all = Object.values(drones || {});
    let red = 0;
    for (const d of all) if (!isAllowed(d.registration)) red += 1;
    return red;
  }, [drones, isAllowed]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");

  useEffect(() => {
    try { useDronesStore.getState().enableIngest(); } catch (_) {}
    initSocket();
    return () => {
      try { useDronesStore.getState().disableIngest(); } catch (_) {}
      disconnectSocket();
    };
  }, []);

  useEffect(() => {
    if (activeView === "map") {
      setShowSidebar(true);
    } else {
      setShowSidebar(false);
      try { useDronesStore.getState().clearUI(); } catch (_) {}
    }
  }, [activeView]);

  const handleSelectView = (view) => {
    setActiveView(view);
  };

  const counterLabel = "red drones";
  const counterValue = redCount;
  const dotClass = "dot red";

  return (
    <div className="app-frame">
      <Header />
      <NavRail active={activeView} onSelect={handleSelectView} />
      {showSidebar && (
        <aside className="sidebar">
          <div className="sidebar-header">
            <span>DRONE FLYING</span>
            <button
              className="sidebar-close"
              title="Close"
              aria-label="Close sidebar"
              onClick={() => setShowSidebar(false)}
            >
              <img src={CloseIcon} alt="Close" />
            </button>
          </div>
          <div className="tabs">
            <button className="tab active">Drones</button>
            <button className="tab">Flights History</button>
          </div>
          <Sidebar />
        </aside>
      )}
      <main className={`map-area ${activeView === 'dashboard' ? 'is-dashboard' : 'is-map'}`}>
        {activeView === "map" ? (
          <>
            <MapView />
            {!showSidebar && (
              <button
                onClick={() => setShowSidebar(true)}
                style={{
                  position: "absolute",
                  top: 16,
                  left: 16,
                  zIndex: 10,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(20,20,20,0.7)",
                  color: "#fff",
                  cursor: "pointer",
                  backdropFilter: "blur(4px)",
                }}
              >
                Open Sidebar
              </button>
            )}
            <button
              className="counter"
              title="Number of red (non-compliant) drones"
              aria-label="Red drones count"
            >
              <span className={dotClass} /> {counterValue} {counterLabel}
            </button>
          </>
        ) : (
          <Dashboard onGoToMap={() => setActiveView('map')} />
        )}
      </main>
    </div>
  );
}

export default App;
