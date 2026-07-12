import { NextRequest, NextResponse } from 'next/server';

const PB_URL = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';

async function handler(request: NextRequest) {
  try {
    // Next.js rewrites: request.nextUrl.pathname may be the rewrite destination
    // (e.g. /api/pb-proxy) rather than the original path. We prefer the pbpath
    // query param (set by the rewrite rule) as the original path.
    let pbPath = request.nextUrl.searchParams.get('pbpath') || request.nextUrl.pathname;
    if (pbPath.startsWith('/pb')) {
      pbPath = pbPath.substring(3); // strip '/pb' prefix
    }
    if (!pbPath.startsWith('/')) {
      pbPath = '/' + pbPath;
    }

    // Solve PocketBase admin UI trailing-slash and relative assets issues:
    // 1. Map /_ (which Next.js normalizes from /_/) back to /_/ so PocketBase serves the dashboard
    if (pbPath === '/_') {
      pbPath = '/_/';
    }
    // 2. Map relative assets (images, libs, assets, fonts) that browser resolves to the base page URL namespace
    //    e.g. /pb/images/... resolves to /images/..., which we map back to /_/images/...
    const adminFolders = ['/images/', '/libs/', '/assets/', '/fonts/'];
    if (adminFolders.some(folder => pbPath.startsWith(folder))) {
      pbPath = '/_' + pbPath;
    }

    const pbUrl = PB_URL + pbPath + request.nextUrl.search;
    console.log('[PB Proxy] Incoming Path:', request.nextUrl.pathname);
    console.log('[PB Proxy] Forwarded to pbUrl:', pbUrl);

    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      if (!['host', 'connection', 'content-length'].includes(key.toLowerCase())) {
        headers[key] = value;
      }
    });

    const body = request.method !== 'GET' && request.method !== 'HEAD'
      ? await request.arrayBuffer()
      : undefined;

    const res = await fetch(pbUrl, {
      method: request.method,
      headers,
      body: body || null,
    });

    const resHeaders = new Headers(res.headers);
    resHeaders.delete('content-encoding');
    resHeaders.delete('transfer-encoding');
    resHeaders.delete('connection');
    resHeaders.delete('content-length');
    resHeaders.set('access-control-allow-origin', '*');

    // For SSE/realtime requests, make sure we keep the headers and stream
    const isSse = pbPath.includes('/api/realtime') && request.method === 'GET';
    if (isSse && res.body) {
      resHeaders.set('content-type', 'text/event-stream');
      resHeaders.set('cache-control', 'no-cache');
      resHeaders.set('connection', 'keep-alive');
      return new NextResponse(res.body as any, {
        status: res.status,
        headers: resHeaders,
      });
    }

    const hasNoBody = res.status === 204 || res.status === 304 || res.status === 205;
    const resBody = hasNoBody ? null : await res.arrayBuffer();

    return new NextResponse(resBody, {
      status: res.status,
      headers: resHeaders,
    });
  } catch (err: any) {
    console.error('[PB Proxy Error]', err?.message || err);
    return new NextResponse(
      JSON.stringify({ error: 'PocketBase proxy failed', detail: err?.message || 'Unknown' }),
      { status: 502, headers: { 'content-type': 'application/json' } }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
export const OPTIONS = handler;
