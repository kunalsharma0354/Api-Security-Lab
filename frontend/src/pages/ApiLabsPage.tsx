import { useState } from "react";
import { LabCard } from "../components/LabCard";
import {
  API_LABS,
  DEFAULT_PAYLOAD_BODY,
  DEFAULT_VALIDATE_BODY,
  PAYLOAD_PRESETS,
  VALIDATION_PRESETS,
  WIRED_LAB_IDS,
} from "../utils/constants";
import { useLabRunner } from "../hooks/useLabRunner";
import { useServicesHealth } from "../hooks/useServicesHealth";

export function ApiLabsPage() {
  const { state: health, refresh: refreshHealth } = useServicesHealth();
  const [authKey, setAuthKey] = useState("");
  const [validateBody, setValidateBody] = useState(DEFAULT_VALIDATE_BODY);
  const [payloadBody, setPayloadBody] = useState(DEFAULT_PAYLOAD_BODY);
  const runner = useLabRunner({
    onSettled: () => void refreshHealth(),
  });
  const { runBurst } = runner;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-kicker">Lab Environment</div>
          <h1 className="page-title">API Labs</h1>
          <p className="page-desc">
            Seven isolated endpoints, each demonstrating one protection
            technique. Wired labs run live against the local backend; the
            remaining variants arrive in later parts.
          </p>
        </div>
      </div>

      {health.online === false && (
        <div className="banner" role="alert">
          <span className="banner-icon" aria-hidden="true">!</span>
          <span>
            <strong>Backend offline.</strong> Requests will fail until the
            backend server is running on port 3001.
          </span>
        </div>
      )}

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
                      onClick: () => void runBurst(lab, 5),
                    }
                  : lab.id === "protected"
                    ? {
                        label: "Send 6 Requests (Flood Shield)",
                        onClick: () => void runBurst(lab, 6),
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
    </>
  );
}
