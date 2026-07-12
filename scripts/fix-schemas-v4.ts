import PocketBase from 'pocketbase';

const PB_URL = 'http://127.0.0.1:8090';

/**
 * PB v0.27: autodate fields use `onCreate`/`onUpdate` at top level, NOT inside `options`.
 */
const ALL_FIELDS: Record<string, any[]> = {
  announcements: [
    { name: 'title', type: 'text', required: true },
    { name: 'content', type: 'text', required: true },
    { name: 'priority', type: 'text' },
    { name: 'startsAt', type: 'autodate', onCreate: true },
    { name: 'endsAt', type: 'autodate', onCreate: false, onUpdate: false },
    { name: 'isActive', type: 'bool' },
    { name: 'createdAt', type: 'autodate', onCreate: true },
    { name: 'updatedAt', type: 'autodate', onUpdate: true },
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
    { name: 'createdAt', type: 'autodate', onCreate: true },
    { name: 'updatedAt', type: 'autodate', onUpdate: true },
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
    { name: 'createdAt', type: 'autodate', onCreate: true },
    { name: 'updatedAt', type: 'autodate', onUpdate: true },
  ],
  ai_usage_daily_summaries: [
    { name: 'date', type: 'text' },
    { name: 'totalTokens', type: 'number' },
    { name: 'promptTokens', type: 'number' },
    { name: 'completionTokens', type: 'number' },
    { name: 'requestCount', type: 'number' },
    { name: 'agentBreakdown', type: 'json' },
    { name: 'createdAt', type: 'autodate', onCreate: true },
    { name: 'updatedAt', type: 'autodate', onUpdate: true },
  ],
  point_transactions: [
    { name: 'userId', type: 'text' },
    { name: 'type', type: 'text' },
    { name: 'points', type: 'number' },
    { name: 'description', type: 'text' },
    { name: 'referenceId', type: 'text' },
    { name: 'metadata', type: 'json' },
    { name: 'createdAt', type: 'autodate', onCreate: true },
    { name: 'updatedAt', type: 'autodate', onUpdate: true },
  ],
  user_sessions: [
    { name: 'userId', type: 'text', required: true },
    { name: 'sessionToken', type: 'text', required: true },
    { name: 'expires', type: 'autodate', onCreate: true },
    { name: 'createdAt', type: 'autodate', onCreate: true },
  ],
  verification_tokens: [
    { name: 'identifier', type: 'text', required: true },
    { name: 'token', type: 'text', required: true },
    { name: 'expires', type: 'autodate', onCreate: true },
  ],
  notifications: [
    { name: 'userId', type: 'text' },
    { name: 'type', type: 'text' },
    { name: 'title', type: 'text' },
    { name: 'message', type: 'text' },
    { name: 'isRead', type: 'bool' },
    { name: 'link', type: 'text' },
    { name: 'createdAt', type: 'autodate', onCreate: true },
    { name: 'updatedAt', type: 'autodate', onUpdate: true },
  ],
  admin_notifications: [
    { name: 'type', type: 'text' },
    { name: 'title', type: 'text' },
    { name: 'message', type: 'text' },
    { name: 'isRead', type: 'bool' },
    { name: 'link', type: 'text' },
    { name: 'createdAt', type: 'autodate', onCreate: true },
    { name: 'updatedAt', type: 'autodate', onUpdate: true },
  ],
};

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

  // Add userId relation to ai_usage_daily_summaries
  const allCols = await pb.send('/api/collections', { method: 'GET' });
  const usersCol = (allCols as any)?.items?.find((c: any) => c.name === 'users');
  const usersColId = usersCol?.id;

  let totalAdded = 0;
  for (const [colName, desiredFields] of Object.entries(ALL_FIELDS)) {
    const col = await pb.send(`/api/collections/${colName}`, { method: 'GET' });
    const existingFields = col.fields || [];
    const existingNames = new Set(existingFields.map((f: any) => f.name));

    const toAdd = desiredFields.filter(f => !existingNames.has(f.name));

    if (toAdd.length > 0) {
      console.log(`${colName}: adding ${toAdd.map(f => f.name).join(', ')}`);
      await pb.send(`/api/collections/${colName}`, {
        method: 'PATCH',
        body: { fields: [...existingFields, ...toAdd] },
      });
      totalAdded += toAdd.length;
    } else {
      console.log(`${colName}: OK`);
    }
  }

  // Add userId relation field specifically to ai_usage_daily_summaries
  const summaryCol = await pb.send('/api/collections/ai_usage_daily_summaries', { method: 'GET' });
  const summaryFieldNames = new Set(summaryCol.fields?.map((f: any) => f.name) || []);
  if (!summaryFieldNames.has('userId') && usersColId) {
    console.log(`ai_usage_daily_summaries: adding userId (relation -> users)`);
    const updatedFields = [...(summaryCol.fields || []), {
      name: 'userId',
      type: 'relation',
      required: false,
      options: { collectionId: usersColId, maxSelect: 1, cascadeDelete: true },
    }];
    await pb.send('/api/collections/ai_usage_daily_summaries', {
      method: 'PATCH',
      body: { fields: updatedFields },
    });
    totalAdded++;
  }

  console.log(`\nDone! Total fields added: ${totalAdded}`);
}

main().catch(console.error);
