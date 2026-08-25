/** Small formatting helpers shared across the UI.
 *  These are pure functions so they can be reused and tested once the
 *  backend starts feeding real data in Part 2.
 */

import type { BackendLogRecord, LogEntry } from "../types";

export function formatLatency(ms: number): string {
  return `${ms} ms`;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function toLogEntry(record: BackendLogRecord): LogEntry {
  return {
    id: record.id,
    time: formatTime(new Date(record.timestamp)),
    method: record.method as LogEntry["method"],
    endpoint: record.endpoint,
    statusCode: record.statusCode,
    latencyMs: record.latencyMs,
  };
}
