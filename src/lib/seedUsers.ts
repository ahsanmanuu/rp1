import { prisma } from "@/lib/prisma";
import { pbAdmin } from "@/lib/pb";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";

export async function seedUsersDemoData() {
  try {
    const userCount = await prisma.user.count();
    if (userCount > 0) return;

    const pb = await pbAdmin();
    const now = new Date();

    const demoUsers = [
      { email: "demo.arjun@latexify.io", name: "Arjun Sharma", points: 1240, membership: "premium_12m", status: "active", role: "user", daysAgo: 120 },
      { email: "demo.priya@latexify.io", name: "Priya Patel", points: 450, membership: "premium_6m", status: "active", role: "user", daysAgo: 80 },
      { email: "demo.rajesh@latexify.io", name: "Dr. Rajesh Kumar", points: 890, membership: "premium_3m", status: "active", role: "user", daysAgo: 60 },
      { email: "demo.sneha@latexify.io", name: "Sneha Gupta", points: 200, membership: "free", status: "active", role: "user", daysAgo: 30 },
      { email: "demo.amit@latexify.io", name: "Prof. Amit Verma", points: 2500, membership: "premium_12m", status: "active", role: "user", daysAgo: 180 },
      { email: "demo.neha@latexify.io", name: "Neha Singh", points: 75, membership: "free", status: "abnormal", role: "user", daysAgo: 20 },
      { email: "demo.vikram@latexify.io", name: "Vikram Reddy", points: 0, membership: "free", status: "blacklisted", reason: "Multiple failed payments & AI abuse", daysAgo: 15 },
      { email: "demo.ananya@latexify.io", name: "Ananya Joshi", points: 600, membership: "premium_6m", status: "active", role: "user", daysAgo: 45, blockedDays: 2 },
    ];

    const createdIds: string[] = [];

    for (const u of demoUsers) {
      try {
        const record = await pb.collection("users").create({
          email: u.email,
          password: "Demo@123456",
          passwordConfirm: "Demo@123456",
          name: u.name,
          points: u.points,
          membership: u.membership,
          status: u.status,
          role: u.role,
          createdAt: new Date(now.getTime() - u.daysAgo * 24 * 60 * 60 * 1000),
        });
        createdIds.push(record.id);

        if (u.reason) {
          await prisma.blacklistRecord.create({
            data: { userId: record.id, action: "blacklisted", reason: u.reason, adminEmail: ADMIN_EMAIL },
          });
        }
        if (u.blockedDays) {
          await prisma.user.update({
            where: { id: record.id },
            data: { blockedUntil: new Date(now.getTime() + u.blockedDays * 24 * 60 * 60 * 1000) },
          });
        }
      } catch { /* skip individual failure */ }
    }

    if (createdIds.length === 0) return;

    const locations = [
      { ip: "103.95.80.1", loc: "Mumbai, India" },
      { ip: "106.51.20.5", loc: "Bengaluru, India" },
      { ip: "203.122.45.10", loc: "Delhi, India" },
      { ip: "182.73.100.3", loc: "Pune, India" },
      { ip: "45.79.200.15", loc: "New York, USA" },
    ];

    for (const uid of createdIds) {
      const loc = locations[createdIds.indexOf(uid) % locations.length];
      try {
        await prisma.userSessionActivity.create({
          data: { userId: uid, ipAddress: loc.ip, location: loc.loc, userAgent: "Mozilla/5.0", createdAt: new Date(now.getTime() - Math.floor(Math.random() * 24) * 60 * 60 * 1000) },
        });
      } catch { /* skip */ }
    }

    // Point transactions for specific users
    if (createdIds[5]) {
      try {
        await prisma.pointTransaction.create({ data: { userId: createdIds[5], amount: 1000, type: "failed", description: "Failed Gold Pack", createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000) } });
      } catch { /* skip */ }
    }
    if (createdIds[6]) {
      try {
        await prisma.pointTransaction.create({ data: { userId: createdIds[6], amount: -200, type: "refund", description: "Forced refund", createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000) } });
      } catch { /* skip */ }
    }
  } catch (err) {
    console.warn("[SEED_USERS] Demo seed error (non-fatal):", err);
  }
}
