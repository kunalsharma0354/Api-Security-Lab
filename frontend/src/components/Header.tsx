import { Icon } from "./icons";
import { useServicesHealth } from "../hooks/useServicesHealth";

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { state: health } = useServicesHealth();

  const online = health.online === true;
  const checking = health.checking && health.online === null;
  const pillLabel = checking
    ? "API Checking…"
    : online
      ? "API Online"
      : "API Offline";
  const dotClass = online ? "ok" : checking ? "" : "warn";
  const pillTitle = online
    ? `Backend responded in ${health.latencyMs ?? "--"} ms`
    : (health.error ?? "The backend service is not reachable");

  return (
    <header className="topbar">
      <button
        type="button"
        className="menu-btn"
        onClick={onMenuToggle}
        aria-label="Open navigation menu"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <span className="brand-mark" aria-hidden="true">
        <Icon name="shield" size={16} />
      </span>
      <span className="brand-text">
        <span className="brand-name">NEXORA</span>
        <span className="brand-sub">API Security Lab</span>
      </span>

      <span className="env-chip" title="Local demonstration environment">
        <span className="chip-dot" />
        LOCAL / DEMO
      </span>

      <div className="topbar-spacer" />

      <span className="api-pill" title={pillTitle}>
        <span className={`status-dot ${dotClass}`} />
        {pillLabel}
      </span>

      <button type="button" className="user-chip" title="Signed in as local demo user">
        <span className="avatar" aria-hidden="true">NX</span>
        <span className="user-meta">
          <span className="user-name">Local User</span>
          <span className="user-role">demo session</span>
        </span>
      </button>
    </header>
  );
}
