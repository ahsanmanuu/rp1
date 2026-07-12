import PocketBase from 'pocketbase';

const PB_URL = 'http://127.0.0.1:8090';

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');
  const allCols = await pb.collections.getFullList();
  const getCol = (name: string) => allCols.find((c: any) => c.name === name);

  // ── Fix ai_usage_daily_summaries ─────────────────────────
  const summaryCol = getCol('ai_usage_daily_summaries');
  if (summaryCol) {
    const schema = [...(summaryCol as any).schema || []];
    const fields = new Set(schema.map((f: any) => f.name));
    const adds: any[] = [];
    if (!fields.has('totalTokens')) adds.push({ name: 'totalTokens', type: 'number', required: false });
    if (!fields.has('promptTokens')) adds.push({ name: 'promptTokens', type: 'number', required: false });
    if (!fields.has('completionTokens')) adds.push({ name: 'completionTokens', type: 'number', required: false });
    if (!fields.has('userId')) {
      const usersCol = getCol('users');
      adds.push({ name: 'userId', type: 'relation', required: false, options: { collectionId: usersCol?.id, maxSelect: 1 } });
    }
    if (adds.length) {
      await pb.collections.update(summaryCol.id, { schema: [...schema, ...adds] });
      console.log('ai_usage_daily_summaries: added', adds.map((f: any) => f.name).join(', '));
    } else {
      console.log('ai_usage_daily_summaries: OK');
    }
  }

  // ── Fix admin_notifications ───────────────────────────────
  const anCol = getCol('admin_notifications');
  if (anCol) {
    const schema = [...(anCol as any).schema || []];
    const fields = new Set(schema.map((f: any) => f.name));
    const adds: any[] = [];
    if (!fields.has('type')) adds.push({ name: 'type', type: 'text', required: false });
    if (!fields.has('isRead')) adds.push({ name: 'isRead', type: 'bool', required: false });
    if (adds.length) {
      await pb.collections.update(anCol.id, { schema: [...schema, ...adds] });
      console.log('admin_notifications: added', adds.map((f: any) => f.name).join(', '));
    } else {
      console.log('admin_notifications: OK');
    }
  }

  console.log('Done!');
}

main().catch(console.error);
