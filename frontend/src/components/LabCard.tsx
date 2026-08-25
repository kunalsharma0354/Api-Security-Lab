import { useState } from "react";
import { Badge } from "./Badge";
import { useServicesHealth } from "../hooks/useServicesHealth";
import type {
  ApiLab,
  LabRequestOutcome,
  RateLimitInfo,
} from "../types";

interface LabCardProps {
  lab: ApiLab;
  outcome?: LabRequestOutcome;
  running?: boolean;
  wired?: boolean;
  onRun: (lab: ApiLab, input?: string) => void;
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Optional single-line input rendered under the endpoint meta (auth lab). */
  textInput?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    autoComplete?: string;
  };
  /** Optional multi-line JSON editor with presets (validation lab). */
  bodyInput?: {
    value: string;
    onChange: (value: string) => void;
    presets?: { label: string; json: string }[];
  };
}

function formatPayload(payload: unknown): string | null {
  if (payload === undefined || payload === null) return null;
  try {
    const json = JSON.stringify(payload, null, 2);
    return json.length > 320 ? `${json.slice(0, 320)}…` : json;
  } catch {
    return null;
  }
}

function formatResetTime(epochSec: number | null): string | null {
  if (epochSec === null) return null;
  const date = new Date(epochSec * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function RateLimitBox({
  info,
  retryAfterSeconds,
  windowSeconds,
}: {
  info?: RateLimitInfo;
  retryAfterSeconds: number | null;
  windowSeconds: number | null;
}) {
  const limit = info?.limit ?? null;
  const remaining = info?.remaining ?? null;
  const used = limit !== null && remaining !== null ? limit - remaining : null;
  const resetLabel = formatResetTime(info?.resetAtEpochSec ?? null);
  const windowLabel = `${windowSeconds ?? 60}s window`;

  return (
    <div className="rl-box">
      {limit !== null && (
        <div className="rl-row">
          <span className="rl-label">Limit</span>
          <span className="rl-value">
            {limit} requests / {windowLabel}
          </span>
        </div>
      )}
      {used !== null && (
        <div className="rl-row">
          <span className="rl-label">Requests</span>
          <span className="rl-value">{used}</span>
        </div>
      )}
      {remaining !== null && (
        <div className="rl-row">
          <span className="rl-label">Remaining</span>
          <span className="rl-value">{remaining}</span>
        </div>
      )}
      {resetLabel && (
        <div className="rl-row">
          <span className="rl-label">Window resets</span>
          <span className="rl-value rl-mono">{resetLabel}</span>
        </div>
      )}
      {retryAfterSeconds !== null && (
        <div className="rl-row">
          <span className="rl-label">Retry in</span>
          <span className="rl-value">{retryAfterSeconds} seconds</span>
        </div>
      )}
    </div>
  );
}

export function LabCard({
  lab,
  outcome,
  running = false,
  wired = false,
  onRun,
  secondaryAction,
  textInput,
  bodyInput,
}: LabCardProps) {
  const { state: health } = useServicesHealth();
  const [syntaxError, setSyntaxError] = useState<string | null>(null);
  const payloadText =
    outcome?.kind === "success" ? formatPayload(outcome.payload) : null;

  const rateLimitInfo =
    outcome &&
    outcome.kind !== "error" &&
    outcome.kind !== "unauthorized" &&
    outcome.kind !== "invalid"
      ? outcome.rateLimit
      : undefined;
  const retryAfter =
    outcome && outcome.kind === "limited" ? outcome.retryAfterSeconds : null;

  const limiterConfig = health.online
    ? (health.info?.rateLimiter ?? null)
    : null;

  /** Before the first request, show the backend-reported configuration. */
  const staticInfo: RateLimitInfo | undefined =
    lab.id === "rate-limit" && !outcome && limiterConfig !== null
      ? { limit: limiterConfig.max, remaining: null, resetAtEpochSec: null }
      : undefined;

  const rlBoxInfo = rateLimitInfo ?? staticInfo;
  const isAuthLab = lab.id === "auth";
  const isValidateLab = lab.id === "validate";

  /**
   * Educational headline blocks for protection outcomes. The backend is the
   * source of truth — these blocks only visualize its verdict.
   */
  const alertBlock = (() => {
    if (!outcome) return null;
    if (isAuthLab) {
      if (outcome.kind === "success") {
        return { tone: "ok", title: "AUTHORIZED", lines: [outcome.message], fields: null };
      }
      if (outcome.kind === "unauthorized") {
        return {
          tone: "blocked",
          title: "UNAUTHORIZED",
          lines: [
            `HTTP ${outcome.httpStatus}`,
            outcome.reason === "missing" ? "API key required" : "Request rejected",
          ],
          fields: null,
        };
      }
      return null;
    }
    if (isValidateLab) {
      if (outcome.kind === "success") {
        return { tone: "ok", title: "VALIDATED", lines: ["HTTP 200", outcome.message], fields: null };
      }
      if (outcome.kind === "invalid") {
        return {
          tone: "blocked",
          title: "VALIDATION BLOCKED",
          lines: [`HTTP ${outcome.httpStatus}`, outcome.message],
          fields: outcome.fields,
        };
      }
      return null;
    }
    return null;
  })();

  function handleSend(): void {
    if (running) return;
    if (bodyInput) {
      // Frontend syntax feedback is UX only — the backend re-checks everything.
      try {
        JSON.parse(bodyInput.value);
        setSyntaxError(null);
      } catch {
        setSyntaxError("Invalid JSON — please provide a valid JSON object.");
        return;
      }
      onRun(lab, bodyInput.value);
      return;
    }
    onRun(lab, textInput?.value || undefined);
  }

  return (
    <article className="card lab-card">
      <div className="lab-top">
        <span className="lab-index">{String(lab.order).padStart(2, "0")}</span>
        <Badge label={lab.statusLabel} tone={lab.statusTone} />
      </div>

      <h3 className="lab-name">{lab.name}</h3>
      <p className="lab-desc">{lab.description}</p>

      <div className="lab-divider" />

      <div className="lab-meta">
        <div className="meta-row">
          <span className="meta-label">Method</span>
          <span className="method-chip">{lab.method}</span>
        </div>
        <div className="meta-row">
          <span className="meta-label">Endpoint</span>
          <code className="endpoint-code">{lab.endpoint}</code>
        </div>
        {lab.protection && (
          <div className="meta-row">
            <span className="meta-label">Protection</span>
            <Badge label={lab.protection} tone="protection" dot={false} />
          </div>
        )}
      </div>

      {textInput && (
        <div className="lab-input">
          <span className="meta-label">API Key</span>
          <input
            type="text"
            className="field-input lab-key-input"
            value={textInput.value}
            placeholder={textInput.placeholder ?? "Paste the demo API key…"}
            autoComplete={textInput.autoComplete ?? "off"}
            spellCheck={false}
            onChange={(event) => textInput.onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !running) handleSend();
            }}
          />
        </div>
      )}

      {bodyInput && (
        <div className="lab-input">
          <span className="meta-label">Request Body</span>
          <textarea
            className="field-input lab-textarea"
            value={bodyInput.value}
            spellCheck={false}
            rows={7}
            onChange={(event) => {
              bodyInput.onChange(event.target.value);
              if (syntaxError) setSyntaxError(null);
            }}
          />
          {bodyInput.presets && bodyInput.presets.length > 0 && (
            <div className="preset-row">
              <span className="meta-label">Presets</span>
              <div className="preset-buttons">
                {bodyInput.presets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className="preset-btn"
                    disabled={running}
                    onClick={() => {
                      bodyInput.onChange(preset.json);
                      setSyntaxError(null);
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {outcome && (
        <div className={`lab-result ${outcome.kind}`}>
          {alertBlock && (
            <div className={`auth-alert ${alertBlock.tone}`}>
              <strong>{alertBlock.title}</strong>
              {alertBlock.lines.map((line) => (
                <span key={line}>{line}</span>
              ))}
              {alertBlock.fields && (
                <div className="vf-list">
                  {Object.entries(alertBlock.fields).map(([field, msg]) => (
                    <div className="vf-row" key={field}>
                      <code>{field}</code>
                      <span>→ {msg}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {outcome.kind === "limited" && (
            <div className="rl-alert">
              <strong>RATE LIMIT REACHED</strong>
              <span>Too many requests.</span>
              {retryAfter !== null && (
                <span>Retry in: {retryAfter} seconds</span>
              )}
            </div>
          )}

          <div className="result-row">
            <span
              className={`result-chip ${outcome.kind}`}
              title={
                outcome.kind === "success"
                  ? "HTTP response status"
                  : outcome.httpStatus
                    ? "HTTP protection response"
                    : "Network / connection failure"
              }
            >
              {outcome.kind === "error"
                ? outcome.httpStatus !== null
                  ? `${outcome.httpStatus} ERROR`
                  : "NETWORK ERROR"
                : outcome.kind === "limited"
                  ? `${outcome.httpStatus} BLOCKED`
                  : outcome.kind === "unauthorized"
                    ? `${outcome.httpStatus} REJECTED`
                    : outcome.kind === "invalid"
                      ? `${outcome.httpStatus} BLOCKED`
                      : `${outcome.httpStatus} OK`}
            </span>
            <span className="result-latency">
              {outcome.latencyMs !== null ? `${outcome.latencyMs} ms` : "-- ms"}
            </span>
          </div>

          {!alertBlock && <p className="result-message">{outcome.message}</p>}
          {payloadText && <pre className="result-json">{payloadText}</pre>}
        </div>
      )}

      {syntaxError && (
        <div className="syntax-note" role="alert">
          {syntaxError}
        </div>
      )}

      {rlBoxInfo && (
        <RateLimitBox
          info={rlBoxInfo}
          retryAfterSeconds={retryAfter}
          windowSeconds={limiterConfig?.windowSeconds ?? null}
        />
      )}

      <div className="lab-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={running}
          onClick={handleSend}
        >
          {running ? "Sending…" : "Send Request"}
        </button>

        {secondaryAction && (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={running}
            onClick={secondaryAction.onClick}
          >
            {secondaryAction.label}
          </button>
        )}

        <div className={`lab-note${wired ? " ok" : ""}`}>
          {wired
            ? "Live · connected to the local backend"
            : "Not wired to the backend yet"}
        </div>
      </div>
    </article>
  );
}
