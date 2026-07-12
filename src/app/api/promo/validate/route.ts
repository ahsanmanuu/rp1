import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { getServerSession } from "@/lib/auth-pb";
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ success: false, error: "Promo code is required" }, { status: 400 });
    }

    const uppercaseCode = code.toUpperCase().trim();
    const offer = await prisma.offer.findUnique({
      where: { code: uppercaseCode }
    });

    if (!offer) {
      return NextResponse.json({ success: false, error: "INVALID", message: "This promo code is invalid." });
    }

    if (!offer.isActive) {
      return NextResponse.json({ success: false, error: "INACTIVE", message: "This promo code is inactive." });
    }

    const now = new Date();
    if (new Date(offer.expiresAt).getTime() <= now.getTime()) {
      return NextResponse.json({ success: false, error: "EXPIRED", message: "This promo code has expired." });
    }

    if (offer.offerType === "USER") {
      const userEmail = session.user.email.toLowerCase().trim();
      if (offer.userEmail?.toLowerCase().trim() !== userEmail) {
        return NextResponse.json({ success: false, error: "NOT_TARGETED", message: "This promo code is not valid for your account." });
      }
    }

    return NextResponse.json({
      success: true,
      offer: {
        id: offer.id,
        title: offer.title,
        code: offer.code,
        description: offer.description,
        discountPercent: offer.discountPercent,
        discountAmount: offer.discountAmount,
        expiresAt: offer.expiresAt
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "ERROR", message: error.message }, { status: 500 });
  }
}
