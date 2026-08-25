import { useCallback, useEffect, useState } from "react";
import { StatCard } from "../components/StatCard";
import { LabCard } from "../components/LabCard";
import { RequestActivityTable } from "../components/RequestActivityTable";
import { ApiStatusPanel } from "../components/ApiStatusPanel";
import {
  API_LABS,
  DASHBOARD_STATS,
  DEFAULT_PAYLOAD_BODY,
  DEFAULT_VALIDATE_BODY,
  PAYLOAD_PRESETS,
  VALIDATION_PRESETS,
  WIRED_LAB_IDS,
} from "../utils/constants";
import { useLabRunner } from "../hooks/useLabRunner";
import { useServicesHealth } from "../hooks/useServicesHealth";
import { api } from "../utils/apiClient";
import { toLogEntry } from "../utils/format";
import type { LogEntry, MetricsSnapshot, StatItem } from "../types";

const ACTIVITY_LOG_LIMIT = 10;

function applySnapshot(stat: StatItem, snapshot: MetricsSnapshot | null): StatItem {
  if (!snapshot) return stat;
  switch (stat.id) {
    case "total":
      return { ...stat, value: String(snapshot.totalRequests) };
    case "success":
      return { ...stat, value: String(snapshot.successfulRequests) };
    case "blocked":
      return { ...stat, value: String(snapshot.blockedRequests) };
    case "errors":
      return { ...stat, value: String(snapshot.errorRequests) };
    case "latency":
      return { ...stat, value: String(snapshot.averageLatency) };
    default:
      return stat;
  }
}

export function DashboardPage() {
  const { state: health, refresh: refreshHealth } = useServicesHealth();
  const [snapshot, setSnapshot] = useState<MetricsSnapshot | null>(null);
  const [activity, setActivity] = useState<LogEntry[]>([]);
  const [telemetryError, setTelemetryError] = useState<string | null>(null);
  const [authKey, setAuthKey] = useState("");
const [validateBody, setValidateBody] = useState(DEFAULT_VALIDATE_BODY);
const [payloadBody, setPayloadBody] = useState(DEFAULT_PAYLOAD_BODY);

  const refreshTelemetry = useCallback(async () => {
    try {
      const [metricsResult, logsResult] = await Promise.all([
        api.metrics(),
        api.logs(ACTIVITY_LOG_LIMIT),
      ]);
      setSnapshot(metricsResult.data);
      setActivity(logsResult.data.logs.map(toLogEntry));
      setTelemetryError(null);
    } catch (err) {
      setTelemetryError(
        err instanceof Error
          ? err.message
          : "Failed to load dashboard statistics.",
      );
    }
  }, []);

  useEffect(() => {
    void refreshTelemetry();
  }, [refreshTelemetry]);

  const runner = useLabRunner({
    onSettled: () => {
      void refreshTelemetry();
      void refreshHealth();
    },
  });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-kicker">Overview</div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-desc">
            A local sandbox for exploring how common API protection mechanisms
            behave. Statistics below come straight from the local backend.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            void refreshTelemetry();
            void refreshHealth();
          }}
        >
          Refresh Data
        </button>
      </div>

      {telemetryError && (
        <div className="banner" role="alert">
          <span className="banner-icon" aria-hidden="true">!</span>
          <span>
            <strong>Live statistics unavailable.</strong>{" "}
            {telemetryError.split("\n").join(" ")}
          </span>
          <button
            type="button"
            className="btn btn-sm banner-action"
            onClick={() => void refreshTelemetry()}
          >
            Retry
          </button>
        </div>
      )}

      <section aria-label="Traffic statistics">
        <div className="stats-grid">
          {DASHBOARD_STATS.map((stat) => (
            <StatCard
              key={stat.id}
              stat={applySnapshot(stat, snapshot)}
            />
          ))}
        </div>
      </section>

      <div className="section-head">
        <h2 className="section-title">API Labs</h2>
        <span className="section-note">
          {WIRED_LAB_IDS.length} of 7 connected · remaining arrive in later parts
        </span>
      </div>

      <section aria-label="API lab modules">
        <div className="labs-grid">
          {API_LABS.map((lab) => (
            <LabCard
              key={lab.id}
              lab={lab}
              wired={(WIRED_LAB_IDS as readonly string[]).includes(lab.id)}
              outcome={runner.outcomes[lab.id]}
              running={runner.running[lab.id] ?? false}
              onRun={runner.runLab}
              secondaryAction={
                lab.id === "rate-limit"
                  ? {
                      label: "Send 5 Test Requests",
                      onClick: () => void runner.runBurst(lab, 5),
                    }
                  : lab.id === "protected"
                    ? {
                        label: "Send 6 Requests (Flood Shield)",
                        onClick: () => void runner.runBurst(lab, 6),
                      }
                    : undefined
              }
              textInput={
                lab.id === "auth" || lab.id === "protected"
                  ? {
                      value: authKey,
                      onChange: setAuthKey,
                      placeholder: "Paste your API key…",
                    }
                  : undefined
              }
              bodyInput={
                lab.id === "validate"
                  ? {
                      value: validateBody,
                      onChange: setValidateBody,
                      presets: VALIDATION_PRESETS,
                    }
                  : lab.id === "payload"
                    ? {
                        value: payloadBody,
                        onChange: setPayloadBody,
                        presets: PAYLOAD_PRESETS,
                      }
                    : undefined
              }
            />
          ))}
        </div>
      </section>

      <div className="section-head">
        <h2 className="section-title">Activity</h2>
        <span className="section-note">
          Latest requests recorded by the backend
        </span>
      </div>

      <div className="bottom-grid">
        <RequestActivityTable entries={activity} />
        <ApiStatusPanel
          online={health.online}
          checking={health.checking}
          latencyMs={health.latencyMs}
          lastCheckedAt={health.lastCheckedAt}
          error={health.error}
          rateLimiter={health.info?.rateLimiter ?? null}
          auth={health.info?.auth ?? null}
          payload={health.info?.payload ?? null}
          timeout={health.info?.timeout ?? null}
          onRefresh={() => void refreshHealth()}
        />
      </div>
    </>
  );
}
