import React, { useEffect, useRef } from "react";
import { useDronesStore } from "../store/drones";
import greenIcon from "../assets/icons/green-icon.svg";
import redIcon from "../assets/icons/red-icon.svg";

const Sidebar = () => {
  const drones = useDronesStore((s) => s.drones);
  const selectedId = useDronesStore((s) => s.selectedId);
  const selectedAt = useDronesStore((s) => s.selectedAt);
  const select = useDronesStore((s) => s.select);
  const isAllowed = useDronesStore((s) => s.isAllowed);

  const list = Object.values(drones);

  const itemRefs = useRef({});

  useEffect(() => {
    if (!selectedId) return;
    const el = itemRefs.current[selectedId];
    if (el && typeof el.scrollIntoView === 'function') {
      try {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } catch (_) {
        el.scrollIntoView();
      }
    }
  }, [selectedId, selectedAt]);

  return (
    <div className="sidebar-list">
      {list.map((d) => {
        const allowed = isAllowed(d.registration);
        const active = selectedId === d.serial;
        return (
          <div
            key={d.serial}
            className={`list-item ${active ? "active" : ""}`}
            onClick={() => select(d.serial)}
            ref={(node) => { if (node) itemRefs.current[d.serial] = node; }}
            aria-selected={active}
          >
            <div className="status-img">
              <img src={allowed ? greenIcon : redIcon} alt={allowed ? "Allowed" : "Blocked"} />
            </div>
            <div className="title-row">
              <div className="name">{d.name}</div>
            </div>
            <div className="meta grid">
              <div className="cell">
                <div className="label">Serial #</div>
                <div className="value">{d.currentSerial || d.feature?.properties?.serial || "--"}</div>
              </div>
              <div className="cell">
                <div className="label">Registration #</div>
                <div className="value">{d.registration || "--"}</div>
              </div>
              <div className="cell">
                <div className="label">Pilot</div>
                <div className="value">{d.pilot || "--"}</div>
              </div>
              <div className="cell">
                <div className="label">Organization</div>
                <div className="value">{d.organization || "--"}</div>
              </div>
            </div>
          </div>
        );
      })}
      {list.length === 0 && (
        <div className="empty">Waiting for drones data...</div>
      )}
    </div>
  );
};

export default Sidebar;
