import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";

export function syncUserPasswordToLocalDb(email: string, passwordHash: string) {
  try {
    const dbPath = path.resolve(process.cwd(), "prisma/dev.db");
    if (!fs.existsSync(dbPath)) {
      console.log("[LocalDbSync] Local SQLite database not found at", dbPath);
      return;
    }
    // Dynamic require better-sqlite3
    const Database = require("better-sqlite3");
    const db = new Database(dbPath);
    
    // Update or Insert user in SQLite dev.db
    const user = db.prepare("SELECT id FROM User WHERE email = ?").get(email);
    if (user) {
      db.prepare("UPDATE User SET password = ?, updatedAt = ? WHERE email = ?").run(
        passwordHash,
        new Date().toISOString(),
        email
      );
      console.log(`[LocalDbSync] Updated user password in local SQLite for: ${email}`);
    } else {
      // Create user in SQLite if not exist
      db.prepare("INSERT INTO User (id, email, password, points, theme, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
        "local-" + Math.random().toString(36).substring(2),
        email,
        passwordHash,
        50,
        "indigo",
        new Date().toISOString(),
        new Date().toISOString()
      );
      console.log(`[LocalDbSync] Created new user with password in local SQLite for: ${email}`);
    }
    db.close();
  } catch (err: any) {
    console.warn("[LocalDbSync] Failed to sync user password to local SQLite:", err.message);
  }
}

export function syncAdminPasswordToLocalDb(email: string, passwordHash: string) {
  try {
    const dbPath = path.resolve(process.cwd(), "prisma/dev.db");
    if (!fs.existsSync(dbPath)) {
      console.log("[LocalDbSync] Local SQLite database not found at", dbPath);
      return;
    }
    const Database = require("better-sqlite3");
    const db = new Database(dbPath);
    
    const admin = db.prepare("SELECT id FROM admin_users WHERE email = ?").get(email);
    if (admin) {
      db.prepare("UPDATE admin_users SET passwordHash = ?, updatedAt = ? WHERE email = ?").run(
        passwordHash,
        new Date().toISOString(),
        email
      );
      console.log(`[LocalDbSync] Updated admin password in local SQLite for: ${email}`);
    } else {
      db.prepare("INSERT INTO admin_users (id, email, passwordHash, role, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
        "local-admin-" + Math.random().toString(36).substring(2),
        email,
        passwordHash,
        "editor",
        1,
        new Date().toISOString(),
        new Date().toISOString()
      );
      console.log(`[LocalDbSync] Created new admin with password in local SQLite for: ${email}`);
    }
    db.close();
  } catch (err: any) {
    console.warn("[LocalDbSync] Failed to sync admin password to local SQLite:", err.message);
  }
}

export async function verifyUserInLocalDb(email: string, password: string): Promise<boolean> {
  try {
    const dbPath = path.resolve(process.cwd(), "prisma/dev.db");
    if (!fs.existsSync(dbPath)) return true; // Default to true if local DB is not present
    
    const Database = require("better-sqlite3");
    const db = new Database(dbPath);
    const user = db.prepare("SELECT password FROM User WHERE email = ?").get(email);
    db.close();
    
    if (!user || !user.password) return false;
    return await bcrypt.compare(password, user.password);
  } catch {
    return true; // Ignore failures if sqlite fails
  }
}

export async function verifyAdminInLocalDb(email: string, password: string): Promise<boolean> {
  try {
    const dbPath = path.resolve(process.cwd(), "prisma/dev.db");
    if (!fs.existsSync(dbPath)) return false;
    
    const Database = require("better-sqlite3");
    const db = new Database(dbPath);
    const admin = db.prepare("SELECT passwordHash FROM admin_users WHERE email = ?").get(email);
    db.close();
    
    if (!admin || !admin.passwordHash) return false;
    
    if (!admin.passwordHash.startsWith("$2")) {
      return password === admin.passwordHash;
    }
    return await bcrypt.compare(password, admin.passwordHash);
  } catch {
    return false;
  }
}

export function getAdminFromLocalDb(email: string): { email: string; passwordHash: string; role: string; isActive: boolean } | null {
  try {
    const dbPath = path.resolve(process.cwd(), "prisma/dev.db");
    if (!fs.existsSync(dbPath)) return null;

    const Database = require("better-sqlite3");
    const db = new Database(dbPath);
    const admin = db.prepare("SELECT email, passwordHash, role, isActive FROM admin_users WHERE email = ?").get(email);
    db.close();

    if (!admin || !admin.passwordHash) return null;
    return {
      email: admin.email,
      passwordHash: admin.passwordHash,
      role: admin.role || "editor",
      isActive: admin.isActive === 1 || admin.isActive === true,
    };
  } catch {
    return null;
  }
}
