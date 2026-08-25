import { NavLink } from "react-router-dom";
import { Icon } from "./icons";
import { NAV_MAIN, NAV_MONITORING, NAV_RESOURCES } from "../utils/constants";
import type { NavEntry } from "../utils/constants";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

function NavSection({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: NavEntry[];
  onNavigate: () => void;
}) {
  return (
    <>
      <div className="nav-section-title">{title}</div>
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === "/"}
          className={({ isActive }) =>
            `nav-item${isActive ? " active" : ""}`
          }
          onClick={onNavigate}
        >
          <Icon name={item.icon} size={17} />
          {item.label}
          {item.tag && <span className="nav-tag">{item.tag}</span>}
        </NavLink>
      ))}
    </>
  );
}

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <aside className={`sidebar${open ? " open" : ""}`} aria-label="Main navigation">
      <div className="sidebar-brand">
        <span className="brand-mark">
          <Icon name="shield" size={16} />
        </span>
        <span className="brand-text">
          <span className="brand-name">NEXORA</span>
          <span className="brand-sub">API Security Lab</span>
        </span>
        <button
          type="button"
          className="drawer-close"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M5 5l14 14M19 5L5 19" />
          </svg>
        </button>
      </div>

      <nav className="nav">
        <NavSection title="General" items={NAV_MAIN} onNavigate={onClose} />
        <NavSection title="Monitoring" items={NAV_MONITORING} onNavigate={onClose} />
        <NavSection title="Resources" items={NAV_RESOURCES} onNavigate={onClose} />
      </nav>

      <div className="sidebar-foot">
        <div className="foot-line">
          <span>Environment</span>
          <span className="foot-value">PRODUCTION</span>
        </div>
        <div className="foot-line">
          <span>Version</span>
          <span className="foot-value">v1.0</span>
        </div>
      </div>
    </aside>
  );
}
