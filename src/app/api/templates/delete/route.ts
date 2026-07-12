import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { getServerSession } from "@/lib/auth-pb";
export async function DELETE(req: NextRequest) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const templateId = searchParams.get('id');

        if (!templateId) {
            return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
        }

        // Find the template and ensure it belongs to the user
        const template = await prisma.template.findFirst({
            where: {
                id: templateId,
                userId: session.user.id
            }
        });

        if (!template) {
            return NextResponse.json({ error: "Template not found or unauthorized" }, { status: 404 });
        }

        await prisma.template.delete({
            where: {
                id: templateId
            }
        });

        return NextResponse.json({ success: true, message: "Template deleted successfully" });
    } catch (error: any) {
        console.error("[TEMPLATE_DELETE_ERROR]", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
