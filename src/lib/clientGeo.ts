import { NextRequest } from "next/server";

export interface ClientGeoInfo {
  ipAddress: string | null;
  location: string | null;
  country: string | null;
  userAgent: string | null;
}

export async function getClientGeoInfo(req: NextRequest): Promise<ClientGeoInfo> {
  const userAgent = req.headers.get("user-agent") || null;

  // Extract client IP from proxy headers (Vercel, Cloudflare, Supabase, etc.)
  let ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-vercel-forwarded-for") ||
    req.headers.get("x-client-ip") ||
    null;

  // Fallback: if running locally, ip-api can resolve the public IP
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip === "localhost") {
    ip = null;
  }

  let location: string | null = null;
  let country: string | null = null;

  try {
    // Use free ip-api.com geolocation (same service used in SecurityBlockOverlay)
    const targetIp = ip || "";
    const geoUrl = targetIp
      ? `http://ip-api.com/json/${targetIp}?fields=query,country,countryCode,regionName,city`
      : `http://ip-api.com/json/?fields=query,country,countryCode,regionName,city`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const geoRes = await fetch(geoUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (geoRes.ok) {
      const geoData = await geoRes.json();
      if (geoData && geoData.query) {
        ip = ip || geoData.query;
        const parts = [geoData.city, geoData.regionName, geoData.country].filter(Boolean);
        location = parts.length > 0 ? parts.join(", ") : null;
        country = geoData.countryCode || null;
      }
    }
  } catch {
    // Geolocation is best-effort; don't fail ticket creation if it errors
  }

  return {
    ipAddress: ip || null,
    location,
    country,
    userAgent,
  };
}
