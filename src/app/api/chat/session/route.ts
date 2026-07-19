import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { getServerSession } from "@/lib/auth-pb";
export const dynamic = "force-dynamic";

const PREMIUM_PLANS = ["premium_1m", "premium_3m", "premium_6m", "premium_12m", "premium"];

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isPremium = PREMIUM_PLANS.includes(user.membership) && 
      (!user.membershipExpiresAt || new Date(user.membershipExpiresAt) > new Date());

    if (!isPremium) {
      return NextResponse.json({ error: "Premium membership required" }, { status: 403 });
    }

    let chatSession = await prisma.chatSession.findFirst({
      where: {
        userId: user.id,
        status: "open"
      },
      orderBy: { createdAt: "desc" }
    });

    if (!chatSession) {
      const { getClientGeoInfo } = await import("@/lib/clientGeo");
      const geo = await getClientGeoInfo(req);
      const ipAddress = geo.ipAddress || "unknown";
      const location = geo.location || "Unknown Location";
      
      chatSession = await prisma.chatSession.create({
        data: {
          userId: user.id,
          userName: user.name || "Scholar User",
          userEmail: user.email,
          location,
          ipAddress,
          status: "open"
        }
      });
    }

    return NextResponse.json({ success: true, session: chatSession });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isPremium = PREMIUM_PLANS.includes(user.membership) && 
      (!user.membershipExpiresAt || new Date(user.membershipExpiresAt) > new Date());

    if (!isPremium) {
      return NextResponse.json({ error: "Premium membership required" }, { status: 403 });
    }

    const body = await req.json();
    const { location, ipAddress } = body;

    // Terminate any previous open sessions
    await prisma.chatSession.updateMany({
      where: { userId: user.id, status: "open" },
      data: { status: "terminated" }
    });

    const newSession = await prisma.chatSession.create({
      data: {
        userId: user.id,
        userName: user.name || "Scholar User",
        userEmail: user.email,
        location: location || "Unknown Location",
        ipAddress: ipAddress || "127.0.0.1",
        status: "open"
      }
    });

    return NextResponse.json({ success: true, session: newSession });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
