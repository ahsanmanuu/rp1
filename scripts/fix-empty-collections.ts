import PocketBase from 'pocketbase';

const PB_URL = 'http://127.0.0.1:8090';

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');
  const allCols = await pb.collections.getFullList();
  const getCol = (name: string) => allCols.find((c: any) => c.name === name);

  const schemas: Record<string, any[]> = {
    announcements: [
      { name: 'title', type: 'text', required: true },
      { name: 'content', type: 'text', required: true },
      { name: 'type', type: 'text', required: false },
      { name: 'isActive', type: 'bool', required: false },
      { name: 'isDismissible', type: 'bool', required: false },
      { name: 'priority', type: 'text', required: false },
      { name: 'publishedAt', type: 'autodate', options: { noTime: false } },
    ],
    ai_cap_plans: [
      { name: 'name', type: 'text', required: true },
      { name: 'description', type: 'text', required: false },
      { name: 'defaultDailyTokenLimit', type: 'number', required: false },
      { name: 'maxDailyTokenLimit', type: 'number', required: false },
      { name: 'maxDailyRequests', type: 'number', required: false },
      { name: 'maxAgents', type: 'number', required: false },
      { name: 'isDefault', type: 'bool', required: false },
      { name: 'price', type: 'number', required: false },
      { name: 'sortOrder', type: 'number', required: false },
    ],
    ai_cap_rules: [
      { name: 'name', type: 'text', required: true },
      { name: 'description', type: 'text', required: false },
      { name: 'isActive', type: 'bool', required: false },
      { name: 'matchType', type: 'text', required: true },
      { name: 'matchValue', type: 'text', required: true },
      { name: 'capType', type: 'text', required: true },
      { name: 'dailyTokenLimit', type: 'number', required: false },
      { name: 'dailyRequestLimit', type: 'number', required: false },
      { name: 'blockDuration', type: 'number', required: false },
      { name: 'priority', type: 'number', required: true },
      { name: 'createdBy', type: 'text', required: false },
    ],
    user_sessions: [
      { name: 'userId', type: 'text', required: true },
      { name: 'sessionToken', type: 'text', required: true },
      { name: 'expires', type: 'autodate', options: { noTime: false } },
    ],
    verification_tokens: [
      { name: 'identifier', type: 'text', required: true },
      { name: 'token', type: 'text', required: true },
      { name: 'expires', type: 'autodate', options: { noTime: false } },
    ],
  };

  for (const [colName, fields] of Object.entries(schemas)) {
    const col = getCol(colName);
    if (!col) {
      console.log(colName + ': collection not found, creating...');
      const created = await pb.collections.create({
        name: colName, type: 'base', schema: fields, indexes: [],
      });
      console.log('  created as', created.id);
    } else {
      const existing = new Set(((col as any).schema || []).map((f: any) => f.name));
      const toAdd = fields.filter((f: any) => !existing.has(f.name));
      if (toAdd.length > 0) {
        await pb.collections.update(col.id, { schema: [...((col as any).schema || []), ...toAdd] });
        console.log(colName + ': added', toAdd.map((f: any) => f.name).join(', '));
      } else {
        console.log(colName + ': OK');
      }
    }
  }

  console.log('All collection schemas fixed!');
}

main().catch(console.error);
