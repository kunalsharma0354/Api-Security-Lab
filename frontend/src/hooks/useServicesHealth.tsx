import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "../utils/apiClient";
import type { HealthInfo } from "../types";

export interface ServicesHealthState {
  checking: boolean;
  online: boolean | null;
  latencyMs: number | null;
  lastCheckedAt: string | null;
  error: string | null;
  /** Last successful /health payload (rate-limiter config, etc.). */
  info: HealthInfo | null;
}

const POLL_INTERVAL_MS = 20_000;

const ServicesHealthContext = createContext<{
  state: ServicesHealthState;
  refresh: () => Promise<void>;
} | null>(null);

/** Polls GET /health so header + status panel reflect real backend state. */
export function ServicesHealthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ServicesHealthState>({
    checking: true,
    online: null,
    latencyMs: null,
    lastCheckedAt: null,
    error: null,
    info: null,
  });

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, checking: true }));
    try {
      const result = await api.health();
      setState({
        checking: false,
        online: true,
        latencyMs: result.latencyMs,
        lastCheckedAt: new Date().toISOString(),
        error: null,
        info: result.data,
      });
    } catch (err) {
      setState((prev) => ({
        checking: false,
        online: false,
        latencyMs: null,
        lastCheckedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : "Unknown error",
        info: prev.info,
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const value = useMemo(() => ({ state, refresh }), [state, refresh]);

  return (
    <ServicesHealthContext.Provider value={value}>
      {children}
    </ServicesHealthContext.Provider>
  );
}

export function useServicesHealth() {
  const ctx = useContext(ServicesHealthContext);
  if (!ctx) {
    throw new Error(
      "useServicesHealth must be used inside <ServicesHealthProvider>",
    );
  }
  return ctx;
}
