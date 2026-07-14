import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { SyncConfig } from "@/lib/sync/types";

const CONFIG_PATH = path.resolve(process.cwd(), ".sync-config.json");

const DEFAULT_CONFIG: SyncConfig = {
  enabled: true,
  watchInterval: 2000,
  syncInterval: 60000,
  retryInterval: 30000,
  maxAttempts: 5,
  watchedPaths: ["src", "scripts", "prisma/schema.prisma", "public", "next.config.ts"],
  ignoredPaths: ["node_modules", ".next", "pb_data", ".git"],
  autoCommit: true,
  autoPush: true,
  autoPull: true,
  branch: "main",
  commitMessagePrefix: "auto-sync",
};

function readConfig(): SyncConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.error("[SyncConfig] Failed to read config:", err);
  }
  return { ...DEFAULT_CONFIG };
}

function writeConfig(config: SyncConfig): boolean {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("[SyncConfig] Failed to write config:", err);
    return false;
  }
}

export async function GET() {
  try {
    const config = readConfig();
    return NextResponse.json({ success: true, data: config });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const current = readConfig();
    const updated = { ...current, ...body };
    const ok = writeConfig(updated);
    if (!ok) {
      return NextResponse.json({ success: false, error: "Failed to save config" }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
