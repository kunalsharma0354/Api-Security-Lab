import type { LogEntry } from "../types";

interface RequestActivityTableProps {
  /** Real entries arrive with the backend in Part 2. Empty for now. */
  entries?: LogEntry[];
}

const HEADERS = ["Time", "Method", "Endpoint", "Status", "Latency"] as const;

export function RequestActivityTable({ entries = [] }: RequestActivityTableProps) {
  return (
    <section className="card">
      <div className="panel-head">
        <h3 className="panel-title">Request Activity</h3>
        <span className="section-note">
          Live log streaming connects in Part 2
        </span>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {HEADERS.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td className="cell-time">--</td>
                <td>--</td>
                <td className="empty-state">No requests yet</td>
                <td>--</td>
                <td>--</td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="cell-time">{entry.time}</td>
                  <td>{entry.method}</td>
                  <td className="cell-endpoint">{entry.endpoint}</td>
                  <td className={`cell-status ${statusTone(entry.statusCode)}`}>
                    {entry.statusCode}
                  </td>
                  <td>{entry.latencyMs !== null ? `${entry.latencyMs} ms` : "--"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function statusTone(statusCode: number | null): string {
  if (statusCode === null) return "";
  if (statusCode < 400) return "ok";
  // 400 (rejected input), 401 (rejected key), 413 (oversized body),
  // 429 (rate limited) and 504 (timed out) are expected protection
  // responses, not failures — render them as warnings.
  if ([400, 401, 413, 429, 504].includes(statusCode)) {
    return "warn";
  }
  return "err";
}
