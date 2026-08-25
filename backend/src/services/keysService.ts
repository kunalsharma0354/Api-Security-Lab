import { createHash, randomBytes, randomUUID } from "node:crypto";

/**
 * API-key issuer service (in-memory, like every store in this lab).
 *
 * Real-world issuance semantics, scaled down:
 * - The full key value is returned EXACTLY ONCE at creation.
 * - Only a SHA-256 hash plus a display prefix is stored — the database can
 *   never leak usable key material.
 * - Issued keys authenticate against /api/auth alongside the configured
 *   demo key.
 */
export interface ApiKeyRecord {
  id: string;
  /** Display form only, e.g. `nxk_7f3a9c12…` — never the full secret. */
  prefix: string;
  createdAt: string;
}

export interface IssuedKey extends ApiKeyRecord {
  /** Full value — shown once in the creation response. */
  key: string;
}

const KEY_MARKER = "nxk_";
const SECRET_BYTES = 24;

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

class KeysService {
  private readonly byId = new Map<string, ApiKeyRecord & { hash: string }>();
  private readonly byHash = new Set<string>();

  /** Mints a fresh key. Unlimited total; throttling is the limiter's job. */
  issue(): IssuedKey {
    const key = `${KEY_MARKER}${randomBytes(SECRET_BYTES).toString("hex")}`;
    const record = {
      id: randomUUID(),
      prefix: `${key.slice(0, KEY_MARKER.length + 8)}…`,
      hash: sha256Hex(key),
      createdAt: new Date().toISOString(),
    };
    this.byId.set(record.id, record);
    this.byHash.add(record.hash);
    return { id: record.id, prefix: record.prefix, createdAt: record.createdAt, key };
  }

  /** Metadata list for UIs — hashes and secrets are stripped here. */
  list(): ApiKeyRecord[] {
    return [...this.byId.values()].map(({ hash: _hash, ...rest }) => rest);
  }

  get count(): number {
    return this.byId.size;
  }

  /** Constant-work membership check used by the auth middleware. */
  verify(candidate: string): boolean {
    if (typeof candidate !== "string" || candidate.length === 0) {
      return false;
    }
    return this.byHash.has(sha256Hex(candidate));
  }
}

export const keysService = new KeysService();
