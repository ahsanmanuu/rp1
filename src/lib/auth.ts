import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        machineId: { label: "MachineId", type: "text" },
      },
      async authorize(credentials) {
        console.log("[AUTH] Authorize start for:", credentials?.email);
        try {
          if (!credentials?.email || !credentials?.password) {
            console.warn("[AUTH] Missing credentials");
            throw new Error("Missing credentials");
          }

          if (!prisma) {
            console.error("[AUTH] Prisma client is NULL");
            throw new Error("Database connection failed");
          }

          console.log("[AUTH] Searching for user...");

          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          let isValid = false;

          if (user && user.password) {
            console.log("[AUTH] Comparing passwords from public User table...");
            isValid = await bcrypt.compare(credentials.password, user.password);
          }

          if (!isValid || !user) {
            console.warn("[AUTH] Invalid password or user not found:", credentials.email);
            throw new Error("Invalid credentials");
          }

          // Enforce local database match & auto-heal
          try {
            const { verifyUserInLocalDb, syncUserPasswordToLocalDb } = await import("@/lib/localDbSync");
            const localValid = await verifyUserInLocalDb(credentials.email, credentials.password);
            if (!localValid && user.password) {
              console.log("[AUTH] Local user DB out of sync. Auto-healing password hash...");
              syncUserPasswordToLocalDb(credentials.email, user.password);
            }
          } catch (syncErr: any) {
            console.warn("[AUTH] Failed to verify/sync user in local DB:", syncErr.message);
          }

          // ─── DUP LOGIN CHECK & RECORD CREATION ────────────────────────────
          const machineId = credentials.machineId || "unknown";

          // 1. Check for active sessions for this user on other devices
          const activeSessions = await prisma.userSession.findMany({
            where: {
              userId: user.id,
              expiresAt: { gte: new Date() },
            },
          });

          if (activeSessions.length > 0) {
            const otherDevice = activeSessions.find((s: any) => s.machineId !== machineId);
            if (otherDevice) {
              console.warn(`[AUTH] User ${user.email} already has active session on device ${otherDevice.machineId}`);
              throw new Error("ALREADY_LOGGED_IN");
            }
          }

          // 2. Clear out any legacy or current sessions for this user on the SAME device
          await prisma.userSession.deleteMany({
            where: {
              userId: user.id,
              machineId,
            },
          });

          // 3. Extract request metadata
          let ip: string | null = null;
          let userAgent: string | null = null;
          let location: string | null = null;
          let country: string | null = null;

          try {
            const reqHeaders = await headers();
            userAgent = reqHeaders.get("user-agent") || null;
            ip =
              reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
              reqHeaders.get("x-real-ip") ||
              reqHeaders.get("cf-connecting-ip") ||
              reqHeaders.get("x-vercel-forwarded-for") ||
              reqHeaders.get("x-client-ip") ||
              null;
              
            if (ip && ip !== "127.0.0.1" && ip !== "::1" && ip !== "localhost") {
              const geoUrl = `http://ip-api.com/json/${ip}?fields=query,country,countryCode,regionName,city`;
              const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(5000) }).then(r => r.json()).catch(() => null);
              if (geoRes && geoRes.query) {
                const parts = [geoRes.city, geoRes.regionName, geoRes.country].filter(Boolean);
                location = parts.length > 0 ? parts.join(", ") : null;
                country = geoRes.countryCode || null;
              }
            }
          } catch (e) {
            console.warn("[AUTH] Failed to extract request details from headers:", e);
          }

          // 4. Create new UserSession record in database
          const sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
          await prisma.userSession.create({
            data: {
              userId: user.id,
              sessionToken,
              machineId,
              ipAddress: ip,
              location: location || country || "Unknown Location",
              userAgent: userAgent,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            },
          });

          console.log("[AUTH] Authorize successful:", user.id);
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            points: user.points,
            theme: user.theme,
            membership: user.membership,
            sessionToken,
          };
        } catch (error: any) {
          console.error("[AUTH] AUTHORIZE CRITICAL ERROR:");
          console.error("[AUTH] Message:", error.message);
          console.error("[AUTH] Stack:", error.stack);
          throw error;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.points = (user as any).points;
        token.theme = (user as any).theme;
        token.membership = (user as any).membership;
        token.sessionToken = (user as any).sessionToken;
      }
      if (trigger === "update" && session) {
        if (session.points !== undefined) token.points = session.points;
        if (session.theme !== undefined) token.theme = session.theme;
        if (session.name !== undefined) token.name = session.name;
        if (session.membership !== undefined) token.membership = session.membership;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).points = token.points as number;
        (session.user as any).theme = token.theme as string;
        (session.user as any).membership = token.membership as string;
        (session.user as any).sessionToken = token.sessionToken as string;

        // Verify session remains active in database
        if (token.sessionToken && typeof token.sessionToken === "string" && !token.sessionToken.startsWith("admin-bypass")) {
          const active = await prisma.userSession.findUnique({
            where: { sessionToken: token.sessionToken },
          });
          if (!active || active.expiresAt < new Date()) {
            // Session invalid — return empty object so getServerSession returns null
            // (RSC mode strips body.expires, so just setting expires doesn't work)
            return {} as any;
          }
          // Refresh expiry so actively used sessions don't die mid-session
          if (active.expiresAt.getTime() - Date.now() < 12 * 60 * 60 * 1000) {
            await prisma.userSession.update({
              where: { id: active.id },
              data: { expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
            }).catch(() => {});
          }
        }
      }
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      console.log("[AUTH] Native signOut event triggered for token:", token?.sessionToken);
      if (token && token.sessionToken) {
        try {
          await prisma.userSession.deleteMany({
            where: { sessionToken: token.sessionToken as string },
          });
          console.log("[AUTH] Successfully deleted UserSession on signOut");
        } catch (e: any) {
          console.error("[AUTH] Failed to delete UserSession on signOut:", e.message);
        }
      }
    }
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET || "word-to-latex-super-secret-key-change-in-production-2024",
  debug: process.env.NODE_ENV === "development",
};
