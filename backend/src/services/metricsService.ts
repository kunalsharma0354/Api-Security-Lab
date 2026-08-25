import type { MetricsSnapshot, RequestLogEntry } from "../types";

const MAX_STORED_RECORDS = 500;

interface RecordedRequest {
  timestamp: string;
  method: string;
  endpoint: string;
  statusCode: number;
  latencyMs: number;
  blocked: boolean;
}

function classify(statusCode: number): "successful" | "error" | "other" {
  if (statusCode >= 200 && statusCode < 400) return "successful";
  if (statusCode >= 400) return "error";
  return "other";
}

class InMemoryMetricsService {
  private records: RecordedRequest[] = [];
  private blockedCount = 0;

  record(entry: {
    timestamp?: string;
    method: string;
    endpoint: string;
    statusCode: number;
    latencyMs: number;
    blocked?: boolean;
  }): void {
    this.records.push({
      timestamp: entry.timestamp ?? new Date().toISOString(),
      method: entry.method,
      endpoint: entry.endpoint,
      statusCode: entry.statusCode,
      latencyMs: entry.latencyMs,
      blocked: entry.blocked ?? false,
    });
    if (this.records.length > MAX_STORED_RECORDS) {
      this.records.shift();
    }
  }

  /** Future security middleware will call this when a request is blocked. */
  recordBlocked(): void {
    this.blockedCount += 1;
  }

  getSnapshot(): MetricsSnapshot {
    let successful = 0;
    let errors = 0;
    let latencySum = 0;

    for (const record of this.records) {
      latencySum += record.latencyMs;
      if (record.blocked) continue;
      const bucket = classify(record.statusCode);
      if (bucket === "successful") successful += 1;
      if (bucket === "error") errors += 1;
    }

    const total = this.records.length;

    return {
      totalRequests: total,
      successfulRequests: successful,
      errorRequests: errors,
      blockedRequests: this.blockedCount,
      averageLatency:
        total === 0 ? 0 : Math.round(latencySum / total),
    };
  }

  getRecentLogs(limit: number): RequestLogEntry[] {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    return this.records
      .slice(-safeLimit)
      .reverse()
      .map((record, index) => ({
        id: `${record.timestamp}-${index}`,
        timestamp: record.timestamp,
        method: record.method,
        endpoint: record.endpoint,
        statusCode: record.statusCode,
        latencyMs: record.latencyMs,
      }));
  }
}

export const metricsService = new InMemoryMetricsService();
