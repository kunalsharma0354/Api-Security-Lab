import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiRequestError } from "../utils/apiClient";
import type { ApiKeyMeta, RateLimitInfo } from "../types";

interface CreatedKey {
  id: string;
  key: string;
  prefix: string;
  createdAt: string;
}

/** Seconds until the issuance window resets, derived from X-RateLimit-Reset. */
function secondsUntilReset(rateLimit: RateLimitInfo | undefined): number | null {
  if (!rateLimit?.resetAtEpochSec) return null;
  return Math.max(0, Math.round(rateLimit.resetAtEpochSec - Date.now() / 1000));
}

export function GetApiKeyPage() {
  const [issuing, setIssuing] = useState(false);
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [quota, setQuota] = useState<RateLimitInfo | null>(null);
  const [blockedSeconds, setBlockedSeconds] = useState<number | null>(null);
  const [keys, setKeys] = useState<ApiKeyMeta[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const copyTimer = useRef<number | null>(null);

  const refreshKeys = useCallback(async () => {
    try {
      const res = await api.listKeys();
      setKeys(res.data.keys);
      setListError(null);
    } catch (err) {
      setListError(
        err instanceof ApiRequestError && err.statusCode === null
          ? "Backend offline — start the server to see issued keys."
          : "Could not load the key list.",
      );
    }
  }, []);

  useEffect(() => {
    void refreshKeys();
  }, [refreshKeys]);

  // Live countdown while the issuer is cooling down.
  useEffect(() => {
    if (blockedSeconds === null) return;
    if (blockedSeconds <= 0) {
      setBlockedSeconds(null);
      return;
    }
    const t = window.setTimeout(() => setBlockedSeconds((s) => (s === null ? null : s - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [blockedSeconds]);

  useEffect(() => () => {
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
  }, []);

  async function handleGenerate() {
    if (issuing || blockedSeconds !== null) return;
    setIssuing(true);
    setCreated(null);
    setCopied(false);
    try {
      const res = await api.createKey();
      setCreated({
        id: res.data.data.id,
        key: res.data.data.key,
        prefix: res.data.data.prefix,
        createdAt: res.data.data.createdAt,
      });
      if (res.rateLimit) setQuota(res.rateLimit);
      void refreshKeys();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.rateLimitInfo) setQuota(err.rateLimitInfo);
        if (err.statusCode === 429) {
          setBlockedSeconds(err.retryAfterSeconds ?? 60);
        }
      }
    } finally {
      setIssuing(false);
    }
  }

  async function handleCopy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.key);
      setCopied(true);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const limit = quota?.limit ?? null;
  const remaining = quota?.remaining ?? null;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-kicker">Part 9 · Key Issuer</div>
          <h1 className="page-title">Get API Key</h1>
          <p className="page-desc">
            Mint your own API keys for the authentication and multi-layer labs.
            You can create as many keys as you like over time — but the issuer
            itself is rate-limited to a fixed burst per window.
          </p>
        </div>
      </div>

      <section className="card" aria-label="Issue a new API key">
        <div className="panel-head">
          <h3 className="panel-title">Mint a new key</h3>
          <span className="section-note">POST /api/keys</span>
        </div>

        <p className="keys-note">
          Every click asks the backend to generate a cryptographically random
          key. The full value is shown <strong>exactly once</strong> — the
          server stores only a SHA-256 hash, so it can never show it again.
        </p>

        <div className="keys-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleGenerate()}
            disabled={issuing || blockedSeconds !== null}
          >
            {issuing ? "Generating…" : blockedSeconds !== null ? `Rate limited — wait ${blockedSeconds}s` : "Generate New Key"}
          </button>

          {limit !== null && remaining !== null && (
            <span className={`keys-quota${remaining === 0 ? " exhausted" : ""}`}>
              {remaining} of {limit} left this window
              {quota?.resetAtEpochSec != null && remaining > 0 && (
                <> · resets in {secondsUntilReset(quota)}s</>
              )}
            </span>
          )}
        </div>

        {created && (
          <div className="key-reveal" role="status">
            <div className="key-reveal-head">
              <span className="key-reveal-title">Your new API key</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void handleCopy()}>
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <code className="key-reveal-value">{created.key}</code>
            <p className="key-reveal-warning">{created.prefix} — copy it now, it will not be shown again.</p>
          </div>
        )}
      </section>

      <section className="card" aria-label="Issued keys">
        <div className="panel-head">
          <h3 className="panel-title">Issued keys ({keys.length})</h3>
          <span className="section-note">GET /api/keys</span>
        </div>

        {listError !== null ? (
          <p className="keys-note">{listError}</p>
        ) : keys.length === 0 ? (
          <p className="keys-note">No keys yet — generate your first one above.</p>
        ) : (
          <table className="keys-table">
            <thead>
              <tr>
                <th>Prefix</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td><code className="key-prefix">{k.prefix}</code></td>
                  <td>{new Date(k.createdAt).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="keys-note">
          Only display prefixes live here — full secrets were never stored by
          the backend, so this list can never leak usable key material.
        </p>
      </section>

      <section className="card" aria-label="How the key issuer works">
        <div className="panel-head">
          <h3 className="panel-title">Unlimited keys, throttled issuance</h3>
          <span className="section-note">rate-limited</span>
        </div>
        <ul className="keys-facts">
          <li>Create as many keys as you need — there is no total cap.</li>
          <li>Issuance runs through its own limiter: 10 mints per 5 minutes.</li>
          <li>Burst past it and you get the same structured 429 as every other lab.</li>
          <li>Minted keys work immediately on /api/auth and /api/protected.</li>
        </ul>
      </section>
    </>
  );
}
