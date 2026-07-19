import { prisma } from "./prisma";

// Known temp/disposable email domains list for cross-identification
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', '10minutemail.com', 'tempmail.com', 'guerrillamail.com', 
  'sharklasers.com', 'yopmail.com', 'dispostable.com', 'getairmail.com', 
  'burnermail.io', 'generator.email', 'temp-mail.org', 'fakeinbox.com',
  'maildrop.cc', 'throwawaymail.com', 'tempmailaddress.com'
]);

/**
 * Checks if email uses a disposable / temporary domain.
 */
export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return true;
  return DISPOSABLE_DOMAINS.has(domain);
}

/**
 * Logs a user's session IP and location.
 */
export async function logUserActivity(userId: string, ipAddress: string, location?: string, userAgent?: string) {
  try {
    await prisma.userSessionActivity.create({
      data: {
        userId,
        ipAddress: ipAddress || "unknown",
        location: location || "Unknown Location",
        userAgent: userAgent || "Unknown"
      }
    });
  } catch (e) {
    console.warn("[Security Audit] Failed to log user session activity:", e);
  }
}

/**
 * Logs a user's interaction with specific tools.
 */
export async function logToolUsage(userId: string, toolName: string, action: string) {
  try {
    await prisma.toolUsageLog.create({
      data: {
        userId,
        toolName,
        action
      }
    });
  } catch (e) {
    console.warn("[Security Audit] Failed to log tool usage:", e);
  }
}

/**
 * Audit checks user operations in real-time. If anomalies are found,
 * it flags the account as 'abnormal' and blocks access for 2 hours (or 24 hours for billing).
 */
export async function checkUserAnomaly(
  userId: string, 
  ipAddress?: string, 
  location?: string
): Promise<{ blocked: boolean; blockedUntil: Date | null; reason: string | null }> {
  const now = new Date();
  
  // 1. Fetch user status and block settings
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, blockedUntil: true, email: true, points: true }
  });

  if (!user) return { blocked: false, blockedUntil: null, reason: null };

  // Check if currently blocked
  if (user.blockedUntil && user.blockedUntil > now) {
    return { 
      blocked: true, 
      blockedUntil: user.blockedUntil, 
      reason: user.points >= 999999 ? "System Administrator block override" : "You have overused the tools. Please try again after 2 hours." 
    };
  }

  // If blacklisted, block permanently
  if (user.status === 'blacklisted') {
    return { 
      blocked: true, 
      blockedUntil: new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000), 
      reason: "This account has been permanently blacklisted by administrators." 
    };
  }

  // Admin bypass
  if (user.email === 'admin@latexify.io') {
    return { blocked: false, blockedUntil: null, reason: null };
  }

  // 2. IP / Location Anomaly Detection (IP Hopping)
  if (ipAddress) {
    await logUserActivity(userId, ipAddress, location);

    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const activities = await prisma.userSessionActivity.findMany({
      where: { userId, createdAt: { gte: oneHourAgo } },
      select: { ipAddress: true, location: true }
    });

    const uniqueIps = new Set(activities.map((a: any) => a.ipAddress));
    const uniqueLocations = new Set(activities.map((a: any) => a.location).filter(Boolean));

    if (uniqueIps.size > 5 || uniqueLocations.size > 3) {
      const blockExpiry = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      await prisma.user.update({
        where: { id: userId },
        data: {
          status: "abnormal",
          blockedUntil: blockExpiry
        }
      });
      
      await prisma.announcement.create({
        data: {
          title: "Security Threat Blocked",
          content: `User ${user.email} blocked for 2h due to IP conflict (IPs: ${uniqueIps.size}, Locations: ${uniqueLocations.size}).`,
          priority: "critical",
          startsAt: new Date(),
          isActive: true
        }
      });

      return { blocked: true, blockedUntil: blockExpiry, reason: "Multiple login conflicts / IP hopping detected" };
    }
  }

  // 3. AI API Overusage Check
  const fiveMinsAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const recentAiLogs = await prisma.aiUsageLog.findMany({
    where: { userId, createdAt: { gte: fiveMinsAgo } },
    select: { totalTokens: true }
  });

  const aiRequestCount = recentAiLogs.length;
  const aiTokensCount = recentAiLogs.reduce((sum: any, log: any) => sum + log.totalTokens, 0);

  if (aiRequestCount > 25 || aiTokensCount > 200000) {
    const blockExpiry = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: "abnormal",
        blockedUntil: blockExpiry
      }
    });

    await prisma.announcement.create({
      data: {
        title: "AI Exploitation Suspected",
        content: `User ${user.email} blocked for 2h due to extreme AI rate limit (Requests: ${aiRequestCount}, Tokens: ${aiTokensCount}).`,
        priority: "critical",
        startsAt: new Date(),
        isActive: true
      }
    });

    return { blocked: true, blockedUntil: blockExpiry, reason: "Extreme AI resource consumption detected" };
  }

  // 4. Excessive Tool Usage Check (Projects count >= 50 AND high frequency tool actions)
  const projectsCount = await prisma.project.count({ where: { userId } });
  const recentToolLogs = await prisma.toolUsageLog.count({
    where: { userId, createdAt: { gte: fiveMinsAgo } }
  });

  if (projectsCount >= 50 && recentToolLogs > 15) {
    const blockExpiry = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: "abnormal",
        blockedUntil: blockExpiry
      }
    });

    await prisma.announcement.create({
      data: {
        title: "Excessive Tool Usage Block",
        content: `User ${user.email} blocked for 2h (Projects: ${projectsCount}, Tool Actions in 5m: ${recentToolLogs}).`,
        priority: "warning",
        startsAt: new Date(),
        isActive: true
      }
    });

    return { blocked: true, blockedUntil: blockExpiry, reason: "You have overused the tools. Please try again after 2 hours." };
  }

  // 5. Transaction Anomalies Check (Duplicate billing attempts)
  const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);
  const recentTransactions = await prisma.pointTransaction.findMany({
    where: { userId, createdAt: { gte: fifteenMinsAgo } },
    select: { amount: true, type: true, createdAt: true }
  });

  if (recentTransactions.length > 5) {
    let consecutiveDuplicates = 0;
    for (let i = 0; i < recentTransactions.length - 1; i++) {
      const t1 = recentTransactions[i];
      const t2 = recentTransactions[i + 1];
      const diffTimeMs = Math.abs(new Date(t1.createdAt).getTime() - new Date(t2.createdAt).getTime());
      if (t1.amount === t2.amount && t1.type === t2.type && diffTimeMs < 60000) {
        consecutiveDuplicates++;
      }
    }

    if (consecutiveDuplicates >= 3) {
      const blockExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h block for financial risk
      await prisma.user.update({
        where: { id: userId },
        data: {
          status: "abnormal",
          blockedUntil: blockExpiry
        }
      });

      await prisma.announcement.create({
        data: {
          title: "Fraudulent Billing Flagged",
          content: `User ${user.email} suspended 24h due to rapid duplicate transactions.`,
          priority: "critical",
          startsAt: new Date(),
          isActive: true
        }
      });

      return { blocked: true, blockedUntil: blockExpiry, reason: "Abnormal transaction patterns detected (duplicate billing attempt)" };
    }
  }

  return { blocked: false, blockedUntil: null, reason: null };
}
