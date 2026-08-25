import { useCallback, useEffect, useState } from "react";
import { RequestActivityTable } from "../components/RequestActivityTable";
import { api } from "../utils/apiClient";
import { toLogEntry } from "../utils/format";
import type { LogEntry } from "../types";

const LOG_LIMIT = 25;

export function RequestLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await api.logs(LOG_LIMIT);
      setLogs(result.data.logs.map(toLogEntry));
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load request logs.",
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-kicker">Monitoring</div>
          <h1 className="page-title">Request Logs</h1>
          <p className="page-desc">
            Requests recorded by the backend logger — timestamp, method,
            endpoint, status code and latency. No sensitive data is logged.
          </p>
        </div>
        <button type="button" className="btn btn-sm" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      {error && (
        <div className="banner" role="alert">
          <span className="banner-icon" aria-hidden="true">!</span>
          <span>
            <strong>Log stream unavailable.</strong>{" "}
            {error.split("\n").join(" ")}
          </span>
          <button
            type="button"
            className="btn btn-sm banner-action"
            onClick={() => void refresh()}
          >
            Retry
          </button>
        </div>
      )}

      <RequestActivityTable entries={logs} />
    </>
  );
}
