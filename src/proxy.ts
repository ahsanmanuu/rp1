import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { securityHeaders } from '@/lib/security/headers';
import { checkRateLimit, type RateLimitConfig } from '@/lib/security/rateLimit';
import { auditRequest, type AuditEntry } from '@/lib/security/audit';

const COOKIE_NAME = 'admin_session';

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return atob(base64);
}

// --- Security hardening config (the "military-grade" option) ---
//   SECURITY_HARDENING unset  -> ON in production, OFF in development
//   SECURITY_HARDENING=true   -> forced ON
//   SECURITY_HARDENING=false  -> forced OFF (no workflow change)
function isHardeningEnabled(): boolean {
  const v = process.env.SECURITY_HARDENING;
  if (v === undefined) return process.env.NODE_ENV === 'production';
  return !['false', '0', 'off', 'no', 'disable', 'disabled'].includes(v.trim().toLowerCase());
}

// JSON payload cap (protects against oversized JSON DoS). File uploads use
// multipart/form-data and are explicitly exempt so workflows are never broken.
const MAX_JSON_BODY_BYTES =
  (Number(process.env.SECURITY_MAX_JSON_BODY_MB) || 5) * 1024 * 1024;

// Rate-limit profiles. GET/HEAD are nearly unlimited (dashboards poll heavily);
// mutating methods get a generous sustained rate with a small burst.
const READ_CFG: RateLimitConfig = { burst: 2000, refillPerWindow: 2000, windowMs: 60_000 };
const MUTATE_CFG: RateLimitConfig = { burst: 120, refillPerWindow: 600, windowMs: 60_000 };

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-vercel-forwarded-for') ||
    req.headers.get('x-client-ip') ||
    'unknown'
  );
}

// Only blocks URLs that can never be legitimate: control chars, path
// traversal, and encoded nulls. Never matches real API paths.
function hasMaliciousPath(path: string): boolean {
  for (let i = 0; i < path.length; i++) {
    if (path.charCodeAt(i) < 0x20) return true;
  }
  if (path.includes('../')) return true;
  if (path.includes('..\\')) return true;
  if (path.includes('%00')) return true;
  if (path.includes('%2e%2e')) return true;
  return false;
}

function applySecurityHeaders(res: NextResponse, requestId: string): void {
  const headers = securityHeaders(requestId);
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
}

function blockedResponse(
  requestId: string,
  status: number,
  message: string,
  extra: Record<string, string> = {},
): NextResponse {
  const res = new NextResponse(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
  applySecurityHeaders(res, requestId);
  return res;
}

function audit(
  requestId: string,
  ip: string,
  method: string,
  path: string,
  outcome: AuditEntry['outcome'],
  detail?: Record<string, unknown>,
): Promise<void> {
  return auditRequest({ requestId, ip, method, path, outcome, detail });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = crypto.randomUUID();
  const ip = getClientIp(request);
  const method = request.method;

  // --- Existing admin route protection (unchanged behavior) ---
  if (pathname === '/admin' || pathname === '/admin-access') {
    const res = NextResponse.redirect(new URL('/admin/login', request.url));
    applySecurityHeaders(res, requestId);
    return res;
  }

  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    const loginUrl = new URL('/admin/login', request.url);

    if (!token) {
      loginUrl.searchParams.set('redirect', pathname);
      const res = NextResponse.redirect(loginUrl);
      applySecurityHeaders(res, requestId);
      return res;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      const res = NextResponse.redirect(loginUrl);
      applySecurityHeaders(res, requestId);
      return res;
    }

    try {
      const payload = JSON.parse(base64UrlDecode(parts[1]));
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        loginUrl.searchParams.set('expired', 'true');
        const res = NextResponse.redirect(loginUrl);
        applySecurityHeaders(res, requestId);
        return res;
      }
    } catch {
      const res = NextResponse.redirect(loginUrl);
      applySecurityHeaders(res, requestId);
      return res;
    }
  }

  // --- API hardening (the new security layer) ---
  if (pathname.startsWith('/api') || pathname.startsWith('/pb')) {
    if (isHardeningEnabled()) {
      // 1) Malicious URL screening (attack-only, never matches real paths).
      if (hasMaliciousPath(pathname)) {
        await audit(requestId, ip, method, pathname, 'blocked-malicious-path');
        return blockedResponse(requestId, 400, 'Bad Request');
      }

      // 2) JSON body-size cap (multipart/file uploads are exempt).
      const contentType = request.headers.get('content-type') || '';
      if (method !== 'GET' && method !== 'HEAD' && contentType.includes('application/json')) {
        const len = Number(request.headers.get('content-length'));
        if (!Number.isNaN(len) && len > MAX_JSON_BODY_BYTES) {
          await audit(requestId, ip, method, pathname, 'blocked-body-size', {
            bytes: len,
            limit: MAX_JSON_BODY_BYTES,
          });
          return blockedResponse(requestId, 413, 'Payload Too Large');
        }
      }

      // 3) Per-IP rate limiting.
      const cfg = method === 'GET' || method === 'HEAD' ? READ_CFG : MUTATE_CFG;
      const rl = checkRateLimit(`${ip}:${method}`, cfg);
      if (!rl.allowed) {
        await audit(requestId, ip, method, pathname, 'rate-limited', {
          retryAfter: rl.retryAfter,
        });
        return blockedResponse(requestId, 429, 'Too Many Requests', {
          'Retry-After': String(rl.retryAfter),
          'X-RateLimit-Limit': String(cfg.refillPerWindow),
          'X-RateLimit-Remaining': '0',
        });
      }

      await audit(requestId, ip, method, pathname, 'allowed');
      const res = NextResponse.next();
      applySecurityHeaders(res, requestId);
      res.headers.set('X-RateLimit-Limit', String(cfg.refillPerWindow));
      res.headers.set('X-RateLimit-Remaining', String(rl.remaining));
      return res;
    }

    // Hardening disabled: pass through with correlation id only.
    const res = NextResponse.next();
    res.headers.set('X-Request-Id', requestId);
    return res;
  }

  // Non-api, non-admin paths: leave untouched (no workflow change).
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/admin-access', '/api/:path*', '/pb/:path*', '/pb'],
};