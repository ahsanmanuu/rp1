import PocketBase from 'pocketbase';

const PB_URL = 'http://127.0.0.1:8090';

// Map from Prisma @@map to PB collection name
// Key = Prisma model name (from @@map), Value = expected fields
const EXPECTED_FIELDS: Record<string, { name: string; type: string }[]> = {
  announcements: [
    { name: 'title', type: 'text' },
    { name: 'content', type: 'text' },
    { name: 'priority', type: 'text' },
    { name: 'startsAt', type: 'autodate' },
    { name: 'endsAt', type: 'autodate' },
    { name: 'isActive', type: 'bool' },
  ],
  ai_cap_plans: [
    { name: 'name', type: 'text' },
    { name: 'description', type: 'text' },
    { name: 'defaultDailyTokenLimit', type: 'number' },
    { name: 'maxDailyTokenLimit', type: 'number' },
    { name: 'maxDailyRequests', type: 'number' },
    { name: 'maxAgents', type: 'number' },
    { name: 'isDefault', type: 'bool' },
    { name: 'price', type: 'number' },
    { name: 'sortOrder', type: 'number' },
  ],
  ai_cap_rules: [
    { name: 'name', type: 'text' },
    { name: 'description', type: 'text' },
    { name: 'isActive', type: 'bool' },
    { name: 'matchType', type: 'text' },
    { name: 'matchValue', type: 'text' },
    { name: 'capType', type: 'text' },
    { name: 'dailyTokenLimit', type: 'number' },
    { name: 'dailyRequestLimit', type: 'number' },
    { name: 'blockDuration', type: 'number' },
    { name: 'priority', type: 'number' },
    { name: 'createdBy', type: 'text' },
  ],
  ai_usage_daily_summaries: [
    { name: 'userId', type: 'relation' },
    { name: 'date', type: 'text' },
    { name: 'totalTokens', type: 'number' },
    { name: 'promptTokens', type: 'number' },
    { name: 'completionTokens', type: 'number' },
    { name: 'requestCount', type: 'number' },
    { name: 'agentBreakdown', type: 'json' },
  ],
  user_sessions: [
    { name: 'userId', type: 'text' },
    { name: 'sessionToken', type: 'text' },
    { name: 'expires', type: 'autodate' },
  ],
  verification_tokens: [
    { name: 'identifier', type: 'text' },
    { name: 'token', type: 'text' },
    { name: 'expires', type: 'autodate' },
  ],
  point_transactions: [
    { name: 'userId', type: 'text' },
    { name: 'type', type: 'text' },
    { name: 'points', type: 'number' },
    { name: 'description', type: 'text' },
    { name: 'referenceId', type: 'text' },
    { name: 'metadata', type: 'json' },
  ],
  notifications: [
    { name: 'userId', type: 'text' },
    { name: 'type', type: 'text' },
    { name: 'title', type: 'text' },
    { name: 'message', type: 'text' },
    { name: 'isRead', type: 'bool' },
    { name: 'link', type: 'text' },
  ],
  admin_notifications: [
    { name: 'type', type: 'text' },
    { name: 'title', type: 'text' },
    { name: 'message', type: 'text' },
    { name: 'isRead', type: 'bool' },
    { name: 'link', type: 'text' },
    { name: 'createdAt', type: 'autodate' },
  ],
};

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');
  const allCols = await pb.collections.getFullList();

  for (const [colName, expected] of Object.entries(EXPECTED_FIELDS)) {
    const col = allCols.find((c: any) => c.name === colName);
    if (!col) {
      console.log(colName + ': COLLECTION MISSING');
      continue;
    }
    const schema = ((col as any).schema || []);
    const existing = new Set(schema.map((f: any) => f.name));
    const missing = expected.filter((f) => !existing.has(f.name));
    if (missing.length > 0) {
      console.log(colName + ': MISSING FIELDS -> ' + missing.map((f) => f.name).join(', '));
    } else {
      console.log(colName + ': OK (' + schema.length + ' fields)');
    }
  }
}

main().catch(console.error);
