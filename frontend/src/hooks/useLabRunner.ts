import { useCallback, useState } from "react";
import { ApiRequestError } from "../utils/apiClient";
import { api } from "../utils/apiClient";
import { PART3_NOTICE, WIRED_LAB_IDS } from "../utils/constants";
import { useToast } from "../components/Toast";
import type {
  ApiLab,
  LabRequestOutcome,
  RateLimitInfo,
} from "../types";

interface LabRunnerOptions {
  /** Called after wired lab requests settle (success or failure). */
  onSettled?: () => void;
}

interface LabCallResult {
  status: number;
  latencyMs: number;
  data: { message?: string };
  rateLimit?: RateLimitInfo;
}

type LabCaller = (input?: string) => Promise<LabCallResult>;

const LAB_CALLERS: Record<string, LabCaller> = {
  "normal-api": () => api.demo(),
  "rate-limit": () => api.rateLimit(),
  // The auth lab sends whatever key the user typed; null omits the header.
  auth: (apiKey) => api.auth(apiKey ? apiKey : null),
  // The validation lab sends the raw JSON text exactly as typed —
  // the backend performs the real server-side checks.
  validate: (bodyText) => api.validate(bodyText ?? ""),
  // The payload lab sends the raw JSON text exactly as typed — oversized
  // bodies get a structured 413 from the backend.
  payload: (bodyText) => api.payload(bodyText ?? ""),
  // The timeout lab triggers deliberately slow backend work that gets cut
  // off at the server deadline (structured 504).
  timeout: () => api.timeout(),
  // The multi-layer lab stacks its strict shield + API-key auth; same key
  // input pattern as the auth lab.
  protectedApi: (apiKey) => api.protectedApi(apiKey ? apiKey : null),
};

const BURST_SIZE = 5;

export function useLabRunner(options?: LabRunnerOptions) {
  const { showToast } = useToast();
  const [outcomes, setOutcomes] = useState<
    Record<string, LabRequestOutcome>
  >({});
  const [running, setRunning] = useState<Record<string, boolean>>({});

  const performOnce = useCallback(
    async (labId: string, input?: string): Promise<LabRequestOutcome> => {
      const caller = LAB_CALLERS[labId];
      if (!caller) {
        return {
          kind: "error",
          httpStatus: null,
          latencyMs: null,
          message: `No handler registered for this lab yet.`,
        };
      }

      try {
        const result = await caller(input);
        return {
          kind: "success",
          httpStatus: result.status,
          latencyMs: result.latencyMs,
          message:
            result.data.message ?? "Request processed by the backend.",
          payload: result.data,
          rateLimit: result.rateLimit,
        };
      } catch (err) {
        if (err instanceof ApiRequestError && err.statusCode === 429) {
          return {
            kind: "limited",
            httpStatus: err.statusCode,
            latencyMs: null,
            message: err.message,
            retryAfterSeconds: err.retryAfterSeconds,
            rateLimit: err.rateLimitInfo,
          };
        }
        if (
          err instanceof ApiRequestError &&
          err.statusCode === 400 &&
          err.fields &&
          Object.keys(err.fields).length > 0
        ) {
          return {
            kind: "invalid",
            httpStatus: err.statusCode,
            latencyMs: null,
            message: err.message,
            fields: err.fields,
          };
        }
        if (err instanceof ApiRequestError && err.statusCode === 413) {
          return {
            kind: "too-large",
            httpStatus: err.statusCode,
            latencyMs: null,
            message: err.message,
            limitBytes: err.limitBytes,
            receivedBytes: err.receivedBytes,
          };
        }
        if (err instanceof ApiRequestError && err.statusCode === 504) {
          return {
            kind: "timeout",
            httpStatus: err.statusCode,
            latencyMs: null,
            message: err.message,
            timeoutMs: err.timeoutMs,
          };
        }
        if (err instanceof ApiRequestError && err.statusCode === 401) {
          const trimmedKey = input?.trim() ?? "";
          return {
            kind: "unauthorized",
            httpStatus: err.statusCode,
            latencyMs: null,
            message: err.message,
            reason: trimmedKey.length === 0 ? "missing" : "invalid",
          };
        }
        return {
          kind: "error",
          httpStatus: err instanceof ApiRequestError ? err.statusCode : null,
          latencyMs: null,
          message:
            err instanceof Error
              ? err.message
              : "The request failed for an unknown reason.",
        };
      }
    },
    [],
  );

  const isWired = useCallback(
    (lab: ApiLab) => (WIRED_LAB_IDS as readonly string[]).includes(lab.id),
    [],
  );

  const runLab = useCallback(
    async (lab: ApiLab, input?: string) => {
      if (!isWired(lab)) {
        showToast(PART3_NOTICE);
        return;
      }

      setRunning((prev) => ({ ...prev, [lab.id]: true }));
      try {
        const outcome = await performOnce(lab.id, input);
        setOutcomes((prev) => ({ ...prev, [lab.id]: outcome }));
      } finally {
        setRunning((prev) => ({ ...prev, [lab.id]: false }));
        options?.onSettled?.();
      }
    },
    [isWired, options, performOnce],
  );

  /** Sends a fixed number of sequential requests — controlled testing only. */
  const runBurst = useCallback(
    async (lab: ApiLab, times: number = BURST_SIZE) => {
      if (!isWired(lab)) {
        showToast(PART3_NOTICE);
        return;
      }

      const count = Math.min(Math.max(times, 1), 10);
      setRunning((prev) => ({ ...prev, [lab.id]: true }));

      let okCount = 0;
      let blockedCount = 0;
      try {
        for (let i = 0; i < count; i += 1) {
          const outcome = await performOnce(lab.id);
          if (outcome.kind === "limited") blockedCount += 1;
          else if (outcome.kind === "success") okCount += 1;
          setOutcomes((prev) => ({ ...prev, [lab.id]: outcome }));
        }
        showToast(
          `Sent ${count} requests · ${okCount} passed · ${blockedCount} blocked`,
        );
      } finally {
        setRunning((prev) => ({ ...prev, [lab.id]: false }));
        options?.onSettled?.();
      }
    },
    [isWired, options, performOnce, showToast],
  );

  return { outcomes, running, runLab, runBurst };
}
