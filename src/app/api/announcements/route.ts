import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
  ]);
};

let cache: { data: any; expiry: number } | null = null;
let inflight: Promise<NextResponse> | null = null;
const CACHE_TTL = 15_000;

export async function GET(req: NextRequest) {
  const now = Date.now();
  if (cache && cache.expiry > now) {
    return NextResponse.json(cache.data);
  }

  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const announcements = await withTimeout(
        prisma.announcement.findMany({
          where: {
            isActive: true,
            startsAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            OR: [
              { endsAt: null },
              { endsAt: { gte: new Date() } }
            ]
          },
          orderBy: { startsAt: "desc" }
        }),
        4000,
        []
      );

      // Guard: PocketBase may return non-array on auth failure
      const safeAnnouncements = Array.isArray(announcements) ? announcements : [];

      const data = { success: true, announcements: safeAnnouncements };
      cache = { data, expiry: Date.now() + CACHE_TTL };

      return NextResponse.json(data, {
        headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
      });
    } catch (error: any) {
      // Return empty list gracefully — never 500 the announcements endpoint.
      // Transient PocketBase / DB errors should fail silently so the banner
      // doesn't show a console error on every page load during compilation.
      console.warn('[Announcements API] Transient error (returning empty list):', error?.message || error);
      const fallback = { success: true, announcements: [] };
      return NextResponse.json(fallback, { status: 200 });
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
