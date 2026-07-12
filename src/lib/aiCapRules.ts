import { prisma } from './prisma';

export type MatchType = 'all_users' | 'email_exact' | 'email_domain' | 'email_regex' | 'ip_exact' | 'ip_cidr' | 'location_country' | 'location_city';
export type CapType = 'daily_tokens' | 'daily_requests' | 'block';

export interface AiCapRuleData {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  matchType: MatchType;
  matchValue: string;
  capType: CapType;
  capValue: number;
  agentFilter: string | null;
  priority: number;
  createdBy: string | null;
  hitCount: number;
  lastHitAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RuleMatchResult {
  matched: boolean;
  ruleId?: string;
  ruleName?: string;
  capType?: CapType;
  capValue?: number;
  agentFilter?: string | null;
}

export interface EnforceResult {
  capped: boolean;
  ruleMatched: boolean;
  ruleName?: string;
  reason?: string;
  dailyCapOverride?: number;
  requestCapOverride?: number;
  remaining?: number;
}

export interface MatchContext {
  email?: string | null;
  ipAddress?: string | null;
  location?: string | null;
  country?: string | null;
  agent?: string;
}

function matchesEmail(value: string, email: string, matchType: MatchType): boolean {
  switch (matchType) {
    case 'email_exact':
      return email.toLowerCase() === value.toLowerCase();
    case 'email_domain': {
      const domain = value.startsWith('@') ? value : `@${value}`;
      return email.toLowerCase().endsWith(domain.toLowerCase());
    }
    case 'email_regex': {
      try {
        return new RegExp(value, 'i').test(email);
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

function matchesIp(value: string, ip: string, matchType: MatchType): boolean {
  switch (matchType) {
    case 'ip_exact':
      return ip === value;
    case 'ip_cidr': {
      try {
        const [rangeIp, bitsStr] = value.split('/');
        const bits = parseInt(bitsStr, 10);
        if (!bits || bits < 0 || bits > 32) return false;

        const ipLong = ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0);
        const rangeLong = rangeIp.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0);
        const mask = ~(2 ** (32 - bits) - 1);
        return (ipLong & mask) === (rangeLong & mask);
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

function matchesLocation(value: string, location: string | null, country: string | null, matchType: MatchType): boolean {
  const target = (location || '').toLowerCase();
  const targetCountry = (country || '').toLowerCase();
  value = value.toLowerCase();

  switch (matchType) {
    case 'location_country':
      return targetCountry === value || targetCountry.startsWith(value);
    case 'location_city':
      return target.includes(value);
    default:
      return false;
  }
}

const rulesCache: { rules: AiCapRuleData[]; fetchedAt: number } = { rules: [], fetchedAt: 0 };
const CACHE_TTL = 10_000;

async function getActiveRules(): Promise<AiCapRuleData[]> {
  const now = Date.now();
  if (rulesCache.rules.length > 0 && now - rulesCache.fetchedAt < CACHE_TTL) {
    return rulesCache.rules;
  }
  const rules = await prisma.aiCapRule.findMany({
    where: { isActive: true },
    orderBy: { priority: 'asc' },
  });
  rulesCache.rules = rules as AiCapRuleData[];
  rulesCache.fetchedAt = now;
  return rulesCache.rules;
}

export function clearRulesCache(): void {
  rulesCache.rules = [];
  rulesCache.fetchedAt = 0;
}

export async function findMatchingRule(ctx: MatchContext): Promise<RuleMatchResult | null> {
  const rules = await getActiveRules();
  if (rules.length === 0) {
    return null;
  }

  for (const rule of rules) {
    let matched = false;

    switch (rule.matchType) {
      case 'all_users':
        matched = true;
        break;
      case 'email_exact':
      case 'email_domain':
      case 'email_regex':
        if (ctx.email) matched = matchesEmail(rule.matchValue, ctx.email, rule.matchType);
        break;
      case 'ip_exact':
      case 'ip_cidr':
        if (ctx.ipAddress) matched = matchesIp(rule.matchValue, ctx.ipAddress, rule.matchType);
        break;
      case 'location_country':
      case 'location_city':
        matched = matchesLocation(rule.matchValue, ctx.location ?? null, ctx.country ?? null, rule.matchType);
        break;
    }

    if (matched) {
      if (rule.agentFilter && rule.agentFilter !== '*' && ctx.agent) {
        const agents: string[] = JSON.parse(rule.agentFilter);
        if (!agents.includes(ctx.agent)) continue;
      }

      // Fire-and-forget hit count update — never block enforcement on this
      prisma.aiCapRule.update({
        where: { id: rule.id },
        data: { hitCount: { increment: 1 }, lastHitAt: new Date() },
      }).catch(() => {});

      return {
        matched: true,
        ruleId: rule.id,
        ruleName: rule.name,
        capType: rule.capType,
        capValue: rule.capValue,
        agentFilter: rule.agentFilter,
      };
    }
  }

  return null;
}

export async function enforceAiCapRules(
  userId: string,
  ctx: MatchContext
): Promise<EnforceResult> {
  try {
    const match = await findMatchingRule(ctx);
    if (!match || !match.matched) {
      return { capped: false, ruleMatched: false };
    }

    const today = new Date().toISOString().slice(0, 10);

    if (match.capType === 'block') {
      const blockDurationMs = match.capValue !== undefined && match.capValue > 0 ? match.capValue : 7200000;
      const reactivatesAt = new Date(Date.now() + blockDurationMs);
      await prisma.user.update({
        where: { id: userId },
        data: { aiAgentReactivatesAt: reactivatesAt },
      });
      return {
        capped: true,
        ruleMatched: true,
        ruleName: match.ruleName,
        reason: `Matched cap rule: ${match.ruleName}`,
      };
    }

    if (match.capType === 'daily_tokens') {
      const capVal = match.capValue ?? 0;
      const summary = await prisma.aiUsageDailySummary.findUnique({
        where: { userId_date: { userId, date: today } },
        select: { totalTokens: true },
      });
      const usedToday = summary?.totalTokens ?? 0;
      const remaining = Math.max(0, capVal - usedToday);

      if (usedToday >= capVal) {
        return {
          capped: true,
          ruleMatched: true,
          ruleName: match.ruleName,
          reason: `Token cap (${capVal}/day) from rule: ${match.ruleName}`,
          dailyCapOverride: capVal,
          remaining: 0,
        };
      }

      return {
        capped: false,
        ruleMatched: true,
        ruleName: match.ruleName,
        dailyCapOverride: capVal,
        remaining,
      };
    }

    if (match.capType === 'daily_requests') {
      const capVal = match.capValue ?? 0;
      const summary = await prisma.aiUsageDailySummary.findUnique({
        where: { userId_date: { userId, date: today } },
        select: { requestCount: true },
      });
      const usedToday = summary?.requestCount ?? 0;
      const remaining = Math.max(0, capVal - usedToday);

      if (usedToday >= capVal) {
        return {
          capped: true,
          ruleMatched: true,
          ruleName: match.ruleName,
          reason: `Request cap (${capVal}/day) from rule: ${match.ruleName}`,
          requestCapOverride: capVal,
          remaining: 0,
        };
      }

      return {
        capped: false,
        ruleMatched: true,
        ruleName: match.ruleName,
        requestCapOverride: capVal,
        remaining,
      };
    }

    return { capped: false, ruleMatched: true, ruleName: match.ruleName };
  } catch (error) {
    console.warn('[AiCapRules] Error enforcing rules:', error);
    return { capped: false, ruleMatched: false };
  }
}
