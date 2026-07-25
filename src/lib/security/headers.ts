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
    "Cross-Origin-Resource-Policy": "cross-origin",
    // Standard application CSP policy: permits scripts, styles, images, fonts, and websockets
    "Content-Security-Policy":
      "default-src 'self' https: http: data: blob: 'unsafe-inline' 'unsafe-eval'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https: http:; font-src 'self' data: https:; connect-src 'self' https: http: wss: ws:;",
    // Mark responses as processed by the hardening layer + correlation id.
    "X-Security-Policy": "hardened",
    "X-Request-Id": requestId,
    // Discourage DNS prefetching of API hosts.
    "X-DNS-Prefetch-Control": "off",
  };
}
