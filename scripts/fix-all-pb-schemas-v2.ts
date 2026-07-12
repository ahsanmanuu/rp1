import PocketBase from 'pocketbase';

const PB_URL = 'http://127.0.0.1:8090';

const ALL_SCHEMAS: Record<string, any[]> = {
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

  let totalAdded = 0;
  for (const [colName, desiredFields] of Object.entries(ALL_SCHEMAS)) {
    const col = await pb.send(`/api/collections/${colName}`, { method: 'GET' });
    const existingFields = col.fields || [];
    const existingNames = new Set(existingFields.map((f: any) => f.name));

    const toAdd = desiredFields.filter(f => !existingNames.has(f.name));

    if (toAdd.length > 0) {
      console.log(`${colName}: adding ${toAdd.map(f => f.name + '(' + f.type + ')').join(', ')}`);
      await pb.send(`/api/collections/${colName}`, {
        method: 'PATCH',
        body: { fields: [...existingFields, ...toAdd] },
      });
      totalAdded += toAdd.length;
    } else {
      console.log(`${colName}: OK`);
    }
  }

  console.log(`\nTotal fields added: ${totalAdded}`);

  if (totalAdded > 0) {
    console.log('Restart PocketBase to apply changes...');
  }
}

main().catch(console.error);
