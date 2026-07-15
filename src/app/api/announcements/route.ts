import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
  return Promise.race([
    promise,
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

      const data = { success: true, announcements };
      cache = { data, expiry: Date.now() + CACHE_TTL };

      return NextResponse.json(data, {
        headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
      });
    } catch (error: any) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
