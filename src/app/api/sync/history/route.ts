import { NextResponse } from "next/server";
import { getAllEntries } from "@/lib/sync/syncQueue";

export async function GET() {
  try {
    const entries = getAllEntries();
    const gitLog = await getGitLog();
    return NextResponse.json({
      success: true,
      data: {
        queue: entries,
        gitLog,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

async function getGitLog(): Promise<any[]> {
  try {
    const { execSync } = await import("child_process");
    const raw = execSync("git log --oneline -20", {
      cwd: process.cwd(),
      encoding: "utf-8",
      timeout: 10000,
    });
    return raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line: string) => {
        const [hash, ...rest] = line.split(" ");
        return { hash, message: rest.join(" ") };
      });
  } catch {
    return [];
  }
}
