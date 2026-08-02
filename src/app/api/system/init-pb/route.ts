import { NextResponse } from "next/server";
import { ensurePbUserCollectionFields } from "@/lib/pb-sync";
import { ensureContentSizeLimits } from "@/lib/pbContentLimits";

export const dynamic = "force-dynamic";

/**
 * POST /api/system/init-pb
 *
 * Ensures all PocketBase collections have the required custom fields.
 * Safe to call multiple times — only adds missing fields.
 */
export async function POST() {
  try {
    const results: string[] = [];

    // Ensure users collection has all custom fields
    try {
      await ensurePbUserCollectionFields();
      results.push("users collection fields verified/updated");
    } catch (err: any) {
      results.push(`users collection error: ${err.message}`);
    }

    // Ensure content-bearing fields allow large documents (DOCX rawHtml etc.)
    try {
      const limit = await ensureContentSizeLimits();
      results.push(`content field maxSize raised to ${limit} bytes`);
    } catch (err: any) {
      results.push(`content limits error: ${err.message}`);
    }

    return NextResponse.json({
      success: true,
      message: "PB initialization complete",
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
