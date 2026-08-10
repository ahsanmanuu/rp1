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
let inflightData: Promise<any> | null = null;
const CACHE_TTL = 15_000;

export async function GET(req: NextRequest) {
  const now = Date.now();
  if (cache && cache.expiry > now) {
    return NextResponse.json(cache.data);
  }

  if (inflightData) {
    try {
      const data = await inflightData;
      return NextResponse.json(data);
    } catch {
      // Fall through
    }
  }

  inflightData = (async () => {
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

      const safeAnnouncements = Array.isArray(announcements) ? announcements : [];
      const data = { success: true, announcements: safeAnnouncements };
      cache = { data, expiry: Date.now() + CACHE_TTL };
      return data;
    } catch (error: any) {
      console.warn('[Announcements API] Transient error (returning empty list):', error?.message || error);
      return { success: true, announcements: [] };
    } finally {
      inflightData = null;
    }
  })();

  const resultData = await inflightData;
  return NextResponse.json(resultData, {
    headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
  });
}
