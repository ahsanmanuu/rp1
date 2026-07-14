import { NextResponse } from "next/server";
import { getSyncWorker } from "@/lib/sync/syncWorker";

export async function GET() {
  try {
    const worker = getSyncWorker();
    const status = worker.getStatus();
    return NextResponse.json({ success: true, data: status });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
