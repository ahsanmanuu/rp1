import PocketBase from 'pocketbase';

const PB_URL = 'http://127.0.0.1:8090';

/** Every PB collection → field list needed by the adapter */
const ALL_SCHEMAS: Record<string, { name: string; type: string; required?: boolean; options?: any }[]> = {
  announcements: [
    { name: 'title', type: 'text', required: true },
    { name: 'content', type: 'text', required: true },
    { name: 'priority', type: 'text' },
    { name: 'startsAt', type: 'autodate', options: { noTime: false } },
    { name: 'endsAt', type: 'autodate', options: { noTime: false } },
    { name: 'isActive', type: 'bool' },
    { name: 'createdAt', type: 'autodate', options: { noTime: false } },
    { name: 'updatedAt', type: 'autodate', options: { noTime: false } },
  ],
  ai_cap_plans: [
    { name: 'name', type: 'text', required: true },
    { name: 'description', type: 'text' },
    { name: 'defaultDailyTokenLimit', type: 'number' },
    { name: 'maxDailyTokenLimit', type: 'number' },
    { name: 'maxDailyRequests', type: 'number' },
    { name: 'maxAgents', type: 'number' },
    { name: 'isDefault', type: 'bool' },
    { name: 'price', type: 'number' },
    { name: 'sortOrder', type: 'number' },
    { name: 'createdAt', type: 'autodate', options: { noTime: false } },
    { name: 'updatedAt', type: 'autodate', options: { noTime: false } },
  ],
  ai_cap_rules: [
    { name: 'name', type: 'text', required: true },
    { name: 'description', type: 'text' },
    { name: 'isActive', type: 'bool' },
    { name: 'matchType', type: 'text', required: true },
    { name: 'matchValue', type: 'text', required: true },
    { name: 'capType', type: 'text', required: true },
    { name: 'dailyTokenLimit', type: 'number' },
    { name: 'dailyRequestLimit', type: 'number' },
    { name: 'blockDuration', type: 'number' },
    { name: 'priority', type: 'number', required: true },
    { name: 'createdBy', type: 'text' },
    { name: 'createdAt', type: 'autodate', options: { noTime: false } },
    { name: 'updatedAt', type: 'autodate', options: { noTime: false } },
  ],
  ai_usage_daily_summaries: [
    { name: 'date', type: 'text' },
    { name: 'totalTokens', type: 'number' },
    { name: 'promptTokens', type: 'number' },
    { name: 'completionTokens', type: 'number' },
    { name: 'requestCount', type: 'number' },
    { name: 'agentBreakdown', type: 'json' },
    { name: 'createdAt', type: 'autodate', options: { noTime: false } },
    { name: 'updatedAt', type: 'autodate', options: { noTime: false } },
  ],
  point_transactions: [
    { name: 'userId', type: 'text' },
    { name: 'type', type: 'text' },
    { name: 'points', type: 'number' },
    { name: 'description', type: 'text' },
    { name: 'referenceId', type: 'text' },
    { name: 'metadata', type: 'json' },
    { name: 'createdAt', type: 'autodate', options: { noTime: false } },
    { name: 'updatedAt', type: 'autodate', options: { noTime: false } },
  ],
  user_sessions: [
    { name: 'userId', type: 'text', required: true },
    { name: 'sessionToken', type: 'text', required: true },
    { name: 'expires', type: 'autodate', options: { noTime: false } },
    { name: 'createdAt', type: 'autodate', options: { noTime: false } },
  ],
  verification_tokens: [
    { name: 'identifier', type: 'text', required: true },
    { name: 'token', type: 'text', required: true },
    { name: 'expires', type: 'autodate', options: { noTime: false } },
  ],
  notifications: [
    { name: 'userId', type: 'text' },
    { name: 'type', type: 'text' },
    { name: 'title', type: 'text' },
    { name: 'message', type: 'text' },
    { name: 'isRead', type: 'bool' },
    { name: 'link', type: 'text' },
    { name: 'createdAt', type: 'autodate', options: { noTime: false } },
    { name: 'updatedAt', type: 'autodate', options: { noTime: false } },
  ],
  admin_notifications: [
    { name: 'type', type: 'text' },
    { name: 'title', type: 'text' },
    { name: 'message', type: 'text' },
    { name: 'isRead', type: 'bool' },
    { name: 'link', type: 'text' },
    { name: 'createdAt', type: 'autodate', options: { noTime: false } },
    { name: 'updatedAt', type: 'autodate', options: { noTime: false } },
  ],
};

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');
  const allCols = await pb.collections.getFullList();

  let totalAdded = 0;
  for (const [colName, desiredFields] of Object.entries(ALL_SCHEMAS)) {
    const col = allCols.find((c: any) => c.name === colName);
    if (!col) {
      console.log(colName + ': NOT FOUND, creating...');
      const created = await pb.collections.create({ name: colName, type: 'base', schema: desiredFields });
      console.log('  created ' + created.id);
      totalAdded += desiredFields.length;
      continue;
    }

    const existingSchema = (col as any).schema || [];
    const existingNames = new Set(existingSchema.map((f: any) => f.name));

    // Remove system fields (id, created, updated) from desired list
    const nonSystemDesired = desiredFields.filter(f => !['id', 'created', 'updated'].includes(f.name));

    // Check which are already present vs need adding
    const toAdd = nonSystemDesired.filter(f => !existingNames.has(f.name));

    if (toAdd.length > 0) {
      console.log(colName + ': adding ' + toAdd.map(f => f.name + '(' + f.type + ')').join(', '));
      await pb.collections.update(col.id, { schema: [...existingSchema, ...toAdd] });
      totalAdded += toAdd.length;
    } else {
      console.log(colName + ': OK (' + existingSchema.length + ' fields)');
    }
  }

  console.log('\nTotal fields added: ' + totalAdded);
  console.log('Done! Kill and restart PB if some changes still not visible.');
}

main().catch(console.error);
