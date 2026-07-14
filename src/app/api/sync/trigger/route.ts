import { NextResponse } from "next/server";
import { getSyncWorker } from "@/lib/sync/syncWorker";

export async function POST() {
  try {
    const worker = getSyncWorker();
    const result = await worker.triggerSync();
    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
