import React from "react";
import { ReactComponent as DashboardIcon } from "../assets/icons/dashboard.svg";
import { ReactComponent as MapIcon } from "../assets/icons/map.svg";

const NavRail = ({ active = "map", onSelect = () => {} }) => {
  return (
    <nav className="nav-rail" style={{ overflowY: 'auto', minWidth: 120 }}>

      <div
        className={`nav-item ${active === 'dashboard' ? 'active' : ''}`}
        title="Dashboard"
        onClick={() => onSelect('dashboard')}
        role="button"
        tabIndex={0}
      >
        <DashboardIcon className="nav-icon" />
        <span>DASHBOARD</span>
      </div>
      <div className="nav-separator" aria-hidden="true" />
      <div
        className={`nav-item ${active === 'map' ? 'active' : ''}`}
        title="Map"
        onClick={() => onSelect('map')}
        role="button"
        tabIndex={0}
      >
        <MapIcon className="nav-icon" />
        <span>MAP</span>
      </div>
    </nav>
  );
};

export default NavRail;
