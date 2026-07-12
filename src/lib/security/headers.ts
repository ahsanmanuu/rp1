// Centralized, edge-safe security header definitions.
// These are applied to every API response by src/middleware.ts and are
// designed to be non-intrusive: they protect the transport/response envelope
// without altering any API business logic or request/response payloads.

export function securityHeaders(requestId: string): Record<string, string> {
  return {
    // Force HTTPS for 2 years, including subdomains, and signal preload support.
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    // Prevent MIME sniffing (stops polyglot payload attacks).
    "X-Content-Type-Options": "nosniff",
    // Disallow framing of API responses (clickjacking protection).
    "X-Frame-Options": "DENY",
    // Tight referrer leakage control.
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // Disable powerful browser features not used by the API surface.
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=(), usb=(), payment=()",
    // Isolate the browsing context from cross-origin documents.
    "Cross-Origin-Opener-Policy": "same-origin",
    // Prevent other origins from embedding API responses as subresources.
    "Cross-Origin-Resource-Policy": "same-origin",
    // Hard deny policy for JSON API responses: nothing can load/execute in
    // browser context, no framing, no inline base/form actions.
    "Content-Security-Policy":
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'",
    // Mark responses as processed by the hardening layer + correlation id.
    "X-Security-Policy": "hardened",
    "X-Request-Id": requestId,
    // Discourage DNS prefetching of API hosts.
    "X-DNS-Prefetch-Control": "off",
  };
}
