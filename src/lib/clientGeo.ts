import { NextRequest } from "next/server";

export interface ClientGeoInfo {
  ipAddress: string | null;
  location: string | null;
  country: string | null;
  userAgent: string | null;
}

interface CacheEntry {
  data: ClientGeoInfo;
  expiresAt: number;
}

const geoCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCacheKey(req: NextRequest): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-vercel-forwarded-for") ||
    req.headers.get("x-client-ip") ||
    "unknown";
  return `geo:${ip}`;
}

async function fetchGeoInfo(ip: string | null, userAgent: string | null): Promise<ClientGeoInfo> {
  let location: string | null = null;
  let country: string | null = null;
  let resolvedIp = ip;

  if (ip && ip !== "127.0.0.1" && ip !== "::1" && ip !== "localhost") {
    try {
      const geoUrl = `http://ip-api.com/json/${ip}?fields=query,country,countryCode,regionName,city`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const geoRes = await fetch(geoUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData && geoData.query) {
          resolvedIp = geoData.query;
          const parts = [geoData.city, geoData.regionName, geoData.country].filter(Boolean);
          location = parts.length > 0 ? parts.join(", ") : null;
          country = geoData.countryCode || null;
        }
      }
    } catch {
      // Geolocation is best-effort; don't fail
    }
  }

  return {
    ipAddress: resolvedIp,
    location,
    country,
    userAgent,
  };
}

export async function getClientGeoInfo(req: NextRequest): Promise<ClientGeoInfo> {
  const userAgent = req.headers.get("user-agent") || null;
  const cacheKey = getCacheKey(req);

  const cached = geoCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  let ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-vercel-forwarded-for") ||
    req.headers.get("x-client-ip") ||
    null;

  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip === "localhost") {
    ip = null;
  }

  const geoInfo = await fetchGeoInfo(ip, userAgent);

  geoCache.set(cacheKey, {
    data: geoInfo,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return geoInfo;
}

export function clearGeoCache(): void {
  geoCache.clear();
}

export function getGeoCacheStats(): { size: number; keys: string[] } {
  const now = Date.now();
  const validKeys: string[] = [];
  for (const [key, entry] of geoCache.entries()) {
    if (entry.expiresAt > now) {
      validKeys.push(key);
    } else {
      geoCache.delete(key);
    }
  }
  return { size: validKeys.length, keys: validKeys };
}
