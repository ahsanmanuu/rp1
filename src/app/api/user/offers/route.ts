import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { getServerSession } from "@/lib/auth-pb";
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userEmail = session.user.email.toLowerCase().trim();
    const now = new Date();

    // Seed default offers if offers table is completely empty
    const count = await prisma.offer.count();
    if (count === 0) {
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      await prisma.offer.createMany({
        data: [
          {
            title: "Festive Upgrade Discount",
            code: "FESTIVE25",
            description: "Get 25% off on all Premium membership subscriptions.",
            discountPercent: 25,
            offerType: "GLOBAL",
            expiresAt,
            isActive: true
          },
          {
            title: "Super Saver Flat Discount",
            code: "SAVER500",
            description: "Get flat ₹500 discount on 6-month and 12-month packages.",
            discountAmount: 500,
            offerType: "GLOBAL",
            expiresAt,
            isActive: true
          },
          {
            title: "Exclusive Creator Discount",
            code: "EXCLUSIVE50",
            description: "Exclusive creator discount: 50% off on monthly and yearly plans.",
            discountPercent: 50,
            offerType: "USER",
            userEmail: userEmail,
            expiresAt,
            isActive: true
          }
        ]
      });
    }

    const activeOffers = await prisma.offer.findMany({
      where: {
        isActive: true,
        expiresAt: {
          gt: now
        },
        OR: [
          { offerType: "GLOBAL" },
          { 
            AND: [
              { offerType: "USER" },
              { userEmail: userEmail }
            ]
          }
        ]
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ success: true, offers: activeOffers });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
