import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromCookies } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

function parseField(field: any) {
  if (typeof field === "string") {
    try {
      return JSON.parse(field || "{}");
    } catch {
      return {};
    }
  }
  return field || {};
}

function ensureObject(field: any) {
  if (typeof field === "string") {
    try {
      return JSON.parse(field || "{}");
    } catch {
      return {};
    }
  }
  return field && typeof field === "object" ? field : {};
}

// GET: Fetch layout settings for the logged-in admin
export async function GET() {
  const admin = await getAdminSessionFromCookies();
  if (!admin?.adminId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = admin.adminId;

  try {
    let settings = await prisma.layoutSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      // Fallback: check in PocketBase
      try {
        const { pbAdmin } = await import("@/lib/pb");
        const admPb = await pbAdmin();
        const settingsPb = await admPb.collection("layout_settings").getFirstListItem(`userId = "admin"`);
        if (settingsPb) {
          settings = await prisma.layoutSettings.create({
            data: {
              userId,
              pages: JSON.stringify(settingsPb.pages || {}),
              windows: JSON.stringify(settingsPb.windows || {}),
              panels: JSON.stringify(settingsPb.panels || {}),
              cards: JSON.stringify(settingsPb.cards || {}),
            }
          });
        }
      } catch (pbErr) {}
    }

    if (!settings) {
      return NextResponse.json({
        success: true,
        settings: {
          pages: {},
          windows: {},
          panels: {},
          cards: {},
        },
      });
    }

    return NextResponse.json({
      success: true,
      settings: {
        pages: parseField(settings.pages),
        windows: parseField(settings.windows),
        panels: parseField(settings.panels),
        cards: parseField(settings.cards),
      },
    });
  } catch (error: any) {
    console.error("[AdminLayoutSettings GET] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT: Save/Upsert layout settings for the logged-in admin
export async function PUT(req: NextRequest) {
  const admin = await getAdminSessionFromCookies();
  if (!admin?.adminId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = admin.adminId;

  try {
    const body = await req.json();
    const { pages, windows, panels, cards } = body;

    const dataToSave = {
      pages: ensureObject(pages),
      windows: ensureObject(windows),
      panels: ensureObject(panels),
      cards: ensureObject(cards),
    };

    const settings = await prisma.layoutSettings.upsert({
      where: { userId },
      create: {
        userId,
        ...dataToSave,
      },
      update: dataToSave,
    });

    // Sync to PocketBase layout_settings collection
    try {
      const { pbAdmin } = await import("@/lib/pb");
      const admPb = await pbAdmin();
      let settingsPb = null;
      try {
        settingsPb = await admPb.collection("layout_settings").getFirstListItem(`userId = "admin"`);
      } catch (pbErr) {
        // Doesn't exist yet
      }

      if (settingsPb) {
        await admPb.collection("layout_settings").update(settingsPb.id, {
          pages: dataToSave.pages,
          windows: dataToSave.windows,
          panels: dataToSave.panels,
          cards: dataToSave.cards,
        });
      } else {
        await admPb.collection("layout_settings").create({
          userId: "admin",
          pages: dataToSave.pages,
          windows: dataToSave.windows,
          panels: dataToSave.panels,
          cards: dataToSave.cards,
        });
      }
    } catch (pbErr: any) {
      console.error("[AdminLayoutSettings PUT] PocketBase sync failed:", pbErr.message);
    }

    return NextResponse.json({
      success: true,
      settings: {
        pages: parseField(settings.pages),
        windows: parseField(settings.windows),
        panels: parseField(settings.panels),
        cards: parseField(settings.cards),
      },
    });
  } catch (error: any) {
    console.error("[AdminLayoutSettings PUT] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
