import { SERVICE_STATUSES, WIRED_LAB_IDS } from "../utils/constants";
import { BACKEND_OFFLINE_MESSAGE } from "../utils/apiClient";
import type { AuthHealth, RateLimiterHealth } from "../types";

interface ApiStatusPanelProps {
  online: boolean | null;
  checking: boolean;
  latencyMs: number | null;
  lastCheckedAt: string | null;
  error: string | null;
  rateLimiter?: RateLimiterHealth | null;
  auth?: AuthHealth | null;
  onRefresh: () => void;
}

function formatLastChecked(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** Service-health panel. Backend + Rate Limiter rows are live (GET /health);
 *  other rows stay honest placeholders until their parts are implemented. */
export function ApiStatusPanel({
  online,
  checking,
  latencyMs,
  lastCheckedAt,
  error,
  rateLimiter,
  auth,
  onRefresh,
}: ApiStatusPanelProps) {
  const checkedTime = formatLastChecked(lastCheckedAt);

  let backendDetail: string;
  let backendState: "online" | "waiting" | "down";

  if (online) {
    backendState = "online";
    backendDetail = `Online · responded in ${latencyMs ?? "--"} ms`;
    if (checkedTime) backendDetail += ` at ${checkedTime}`;
  } else if (checking && online === null) {
    backendState = "waiting";
    backendDetail = "Checking…";
  } else {
    backendState = "down";
    backendDetail =
      error === BACKEND_OFFLINE_MESSAGE || error === null
        ? BACKEND_OFFLINE_MESSAGE.replace("\n", " ")
        : (error ?? "Offline");
  }

  const limiterActive = online && (rateLimiter?.active ?? false);
  const authActive = online && (auth?.active ?? false);

  return (
    <section className="card" aria-label="API service status">
      <div className="panel-head">
        <h3 className="panel-title">API Status</h3>
        <button type="button" className="btn btn-sm" onClick={onRefresh}>
          Refresh
        </button>
      </div>
      <div className="status-list">
        <div className="status-row">
          <span className={`service-dot ${backendState}`} />
          <span>
            <span className="service-name">Backend</span>
            <br />
            <span className="service-detail">{backendDetail}</span>
          </span>
        </div>

        <div className="status-row">
          <span
            className={`service-dot ${limiterActive ? "online" : "idle"}`}
          />
          <span>
            <span className="service-name">Rate Limiter</span>
            <br />
            <span className="service-detail">
              {limiterActive
                ? `Active · ${rateLimiter?.max} requests / ${rateLimiter?.windowSeconds}s window`
                : online
                  ? "Not configured"
                  : "Unknown · backend offline"}
            </span>
          </span>
        </div>

        <div className="status-row">
          <span className={`service-dot ${authActive ? "online" : "idle"}`} />
          <span>
            <span className="service-name">API Key Authentication</span>
            <br />
            <span className="service-detail">
              {authActive
                ? "Active · X-API-Key required on /api/auth"
                : online
                  ? "Not configured"
                  : "Unknown · backend offline"}
            </span>
          </span>
        </div>

        {SERVICE_STATUSES.map((svc) => (
          <div className="status-row" key={svc.id}>
            <span className={`service-dot ${svc.state}`} />
            <span>
              <span className="service-name">{svc.name}</span>
              <br />
              <span className="service-detail">{svc.detail}</span>
            </span>
          </div>
        ))}
      </div>
      {WIRED_LAB_IDS.length > 0 && (
        <div className="panel-foot">
          Wired labs this part: {WIRED_LAB_IDS.length} of 7
        </div>
      )}
    </section>
  );
}
