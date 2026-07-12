import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

// ── Seed demo promotional offers when PocketBase is empty ──
async function seedDemoOffers() {
  try {
    const count = await prisma.offer.count();
    if (count > 0) return;

    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 86_400_000);
    const fifteenDays = new Date(now.getTime() + 15 * 86_400_000);
    const sixtyDays = new Date(now.getTime() + 60 * 86_400_000);

    const offers = [
      { title: "Summer Launch Special", code: "LATEX25", description: "Get 20% off on all premium plans — limited time summer offer.", discountPercent: 20, discountAmount: null, offerType: "GLOBAL", userEmail: null, expiresAt: thirtyDays, isActive: true },
      { title: "Student Discount Week", code: "STUDENT10", description: "Flat ₹150 discount for students on any plan.", discountPercent: null, discountAmount: 150, offerType: "GLOBAL", userEmail: null, expiresAt: fifteenDays, isActive: true },
    ];

    // User-targeted offer (needs valid user email)
    try {
      const targetUser = await prisma.user.findFirst({ where: { email: "demo.arjun@latexify.io" }, select: { id: true } });
      if (targetUser) {
        offers.push({ title: "Premium Welcome Offer", code: "WELCOME50", description: "Exclusive 50% off for premium users.", discountPercent: 50, discountAmount: null, offerType: "USER", userEmail: "demo.arjun@latexify.io", expiresAt: sixtyDays, isActive: true } as any);
      }
    } catch { /* skip user-targeted */ }

    for (const o of offers) {
      try { await prisma.offer.create({ data: o }); } catch { /* skip */ }
    }
  } catch (err) {
    console.warn("[OFFERS] Seed error (non-fatal):", err);
  }
}

export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await seedDemoOffers();
    const offers = await prisma.offer.findMany({
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json({ success: true, offers });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { title, code, description, discountPercent, discountAmount, offerType, userEmail, expiresAt } = await req.json();
    
    if (!title || !code || !expiresAt) {
      return NextResponse.json({ error: "Missing required fields: title, code, expiresAt" }, { status: 400 });
    }

    if (offerType === "USER" && !userEmail) {
      return NextResponse.json({ error: "Target email is required for user-specific offers" }, { status: 400 });
    }

    // Verify target email user exists if offerType is USER
    if (offerType === "USER" && userEmail) {
      const targetUser = await prisma.user.findUnique({
        where: { email: userEmail.trim().toLowerCase() }
      });
      if (!targetUser) {
        return NextResponse.json({ error: `User with email "${userEmail}" does not exist` }, { status: 400 });
      }
    }

    // Check if code is already taken
    const existingOffer = await prisma.offer.findUnique({
      where: { code: code.toUpperCase().trim() }
    });
    if (existingOffer) {
      return NextResponse.json({ error: `Promo code "${code.toUpperCase().trim()}" is already in use` }, { status: 400 });
    }

    const parsedPercent = (discountPercent !== undefined && discountPercent !== null && discountPercent !== "") ? parseFloat(discountPercent) : null;
    const parsedAmount = (discountAmount !== undefined && discountAmount !== null && discountAmount !== "") ? parseFloat(discountAmount) : null;

    if (parsedPercent !== null && isNaN(parsedPercent)) {
      return NextResponse.json({ error: "Invalid discount percentage value" }, { status: 400 });
    }
    if (parsedAmount !== null && isNaN(parsedAmount)) {
      return NextResponse.json({ error: "Invalid discount amount value" }, { status: 400 });
    }

    // Normalize expiresAt to the end of the selected day if it is just a date string (YYYY-MM-DD)
    let parsedExpiry = new Date(expiresAt);
    if (/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) {
      parsedExpiry = new Date(`${expiresAt}T23:59:59.999Z`);
    }

    const offer = await prisma.offer.create({
      data: {
        title,
        code: code.toUpperCase().trim(),
        description,
        discountPercent: parsedPercent,
        discountAmount: parsedAmount,
        offerType: offerType || "GLOBAL",
        userEmail: offerType === "USER" ? userEmail.trim().toLowerCase() : null,
        expiresAt: parsedExpiry,
        isActive: true
      }
    });

    // Create notifications for users
    try {
      if (offer.offerType === "USER" && offer.userEmail) {
        const targetUser = await prisma.user.findUnique({
          where: { email: offer.userEmail }
        });
        if (targetUser) {
          await prisma.notification.create({
            data: {
              userId: targetUser.id,
              type: "offer_created",
              title: `🔥 Exclusive Promo: ${offer.code}`,
              body: `You received a private discount offer: "${offer.title}". Use coupon code ${offer.code} at checkout to claim it!`,
              isRead: false
            }
          });
        }
      } else if (offer.offerType === "GLOBAL") {
        const activeUsers = await prisma.user.findMany({
          where: { status: "active" },
          select: { id: true }
        });
        
        if (activeUsers.length > 0) {
          const notificationsPayload = activeUsers.map((u: any) => ({
            userId: u.id,
            type: "offer_created",
            title: `🎉 New Offer: ${offer.code}`,
            body: `A new promotion "${offer.title}" is active for all users! Apply code ${offer.code} during checkout to save!`,
            isRead: false
          }));

          await prisma.notification.createMany({
            data: notificationsPayload
          });
        }
      }
    } catch (notifError) {
      console.error("Failed to generate user notifications for offer:", notifError);
    }

    return NextResponse.json({ success: true, offer });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing offer ID" }, { status: 400 });

    await prisma.offer.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
