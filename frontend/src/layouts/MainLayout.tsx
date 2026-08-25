import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Header } from "../components/Header";
import { Sidebar } from "../components/Sidebar";
import { ServicesHealthProvider } from "../hooks/useServicesHealth";

/** Application shell: fixed sidebar + sticky header + routed content.
 *  Handles the mobile drawer state (open/close/scrim/Escape) and provides
 *  live backend-health polling to the header and status panel.
 */
export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSidebarOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ServicesHealthProvider>
      <div className="app-shell">
        <div className="ambient" aria-hidden="true" />
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div
          className={`scrim${sidebarOpen ? " visible" : ""}`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
        <div className="main-column">
          <Header onMenuToggle={() => setSidebarOpen((v) => !v)} />
          <main className="content">
            <Outlet />
          </main>
        </div>
      </div>
    </ServicesHealthProvider>
  );
}
