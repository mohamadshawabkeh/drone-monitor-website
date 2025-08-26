import React from "react";
import SagerLogo from "../assets/icons/sager.svg";
import PickIcon from "../assets/icons/pick.svg";
import WorldIcon from "../assets/icons/world.svg";
import NotificationIcon from "../assets/icons/notification.svg";

const Header = () => {
  return (
    <header className="topbar">
      <div className="brand">
        <img src={SagerLogo} alt="Sager" className="brand-logo" />
      </div>
      <div className="spacer" />
      <div className="topbar-actions">
        <button className="icon-btn" title="Pick">
          <img src={PickIcon} alt="Pick" />
        </button>
        <button className="icon-btn" title="World">
          <img src={WorldIcon} alt="World" />
        </button>
        <button className="icon-btn" title="Notifications">
          <img src={NotificationIcon} alt="Notifications" />
        </button>
        <div className="divider" />
        <div className="user-chip">
          <div className="greeting">Hello, <strong>Mohammed Omar</strong></div>
          <span className="role">Technical Support</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
