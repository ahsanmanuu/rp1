// Tamper-evident audit logging for API requests, executed inside the edge
// middleware. Every entry is chained via SHA-256 over (previousHash | entry),
// so any post-hoc modification of the log stream is detectable. Logs are
// emitted to the server console (stdout) and never block or alter responses.

export interface AuditEntry {
  requestId: string;
  ip: string;
  method: string;
  path: string;
  outcome:
    | "allowed"
    | "blocked-malicious-path"
    | "blocked-body-size"
    | "rate-limited";
  status?: number;
  detail?: Record<string, unknown>;
  ts?: string;
}

const globalRef = globalThis as unknown as { __secAuditChain?: string };
const ZERO = "0".repeat(64);

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function auditRequest(entry: AuditEntry): Promise<void> {
  const record = {
    ...entry,
    ts: new Date().toISOString(),
  };
  const line = JSON.stringify(record);

  try {
    const prev = globalRef.__secAuditChain ?? ZERO;
    const data = new TextEncoder().encode(`${prev}|${line}`);
    const digest = await crypto.subtle.digest("SHA-256", data);
    const hash = toHex(digest);
    globalRef.__secAuditChain = hash;
    console.log(`[SEC-AUDIT] ${line} chain=${hash}`);
  } catch {
    // Auditing must never break a request; fall back to a plain log.
    console.log(`[SEC-AUDIT] ${line}`);
  }
}
