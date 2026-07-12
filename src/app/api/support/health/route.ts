import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const services = await prisma.serviceHealth.findMany({
      orderBy: { name: "asc" }
    });

    const statuses = services.map((s: any) => s.status);
    let overallStatus = "operational";
    if (statuses.includes("down")) overallStatus = "major_outage";
    else if (statuses.includes("degraded")) overallStatus = "partial_outage";
    else if (statuses.includes("high_load")) overallStatus = "elevated";

    return NextResponse.json({ success: true, services, overallStatus });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
