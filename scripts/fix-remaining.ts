import PocketBase from 'pocketbase';

const PB_URL = 'http://127.0.0.1:8090';

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');
  const allCols = await pb.collections.getFullList();
  const getCol = (name: string) => allCols.find((c: any) => c.name === name);
  const getFields = (name: string) => new Set(((getCol(name) as any)?.schema || []).map((f: any) => f.name));

  // ── announcements ──
  {
    const col = getCol('announcements');
    if (col) {
      const existing = getFields('announcements');
      const toAdd: any[] = [];
      if (!existing.has('startsAt')) toAdd.push({ name: 'startsAt', type: 'autodate', options: { noTime: false } });
      if (!existing.has('endsAt')) toAdd.push({ name: 'endsAt', type: 'autodate', options: { noTime: false } });
      if (!existing.has('createdAt')) toAdd.push({ name: 'createdAt', type: 'autodate', options: { noTime: false } });
      if (!existing.has('updatedAt')) toAdd.push({ name: 'updatedAt', type: 'autodate', options: { noTime: false } });
      if (toAdd.length) {
        await pb.collections.update(col.id, { schema: [...((col as any).schema || []), ...toAdd] });
        console.log('announcements: added', toAdd.map((f: any) => f.name).join(', '));
      } else {
        console.log('announcements: OK');
      }
    }
  }

  // ── ai_cap_plans ──
  {
    const col = getCol('ai_cap_plans');
    if (col) {
      const existing = getFields('ai_cap_plans');
      const toAdd: any[] = [];
      if (!existing.has('createdAt')) toAdd.push({ name: 'createdAt', type: 'autodate', options: { noTime: false } });
      if (!existing.has('updatedAt')) toAdd.push({ name: 'updatedAt', type: 'autodate', options: { noTime: false } });
      if (toAdd.length) {
        await pb.collections.update(col.id, { schema: [...((col as any).schema || []), ...toAdd] });
        console.log('ai_cap_plans: added', toAdd.map((f: any) => f.name).join(', '));
      } else {
        console.log('ai_cap_plans: OK');
      }
    }
  }

  // ── ai_cap_rules ──
  {
    const col = getCol('ai_cap_rules');
    if (col) {
      const existing = getFields('ai_cap_rules');
      const toAdd: any[] = [];
      if (!existing.has('createdAt')) toAdd.push({ name: 'createdAt', type: 'autodate', options: { noTime: false } });
      if (!existing.has('updatedAt')) toAdd.push({ name: 'updatedAt', type: 'autodate', options: { noTime: false } });
      if (toAdd.length) {
        await pb.collections.update(col.id, { schema: [...((col as any).schema || []), ...toAdd] });
        console.log('ai_cap_rules: added', toAdd.map((f: any) => f.name).join(', '));
      } else {
        console.log('ai_cap_rules: OK');
      }
    }
  }

  // ── user_sessions ──
  {
    const col = getCol('user_sessions');
    if (col) {
      const existing = getFields('user_sessions');
      const toAdd: any[] = [];
      if (!existing.has('createdAt')) toAdd.push({ name: 'createdAt', type: 'autodate', options: { noTime: false } });
      if (toAdd.length) {
        await pb.collections.update(col.id, { schema: [...((col as any).schema || []), ...toAdd] });
        console.log('user_sessions: added', toAdd.map((f: any) => f.name).join(', '));
      } else {
        console.log('user_sessions: OK');
      }
    }
  }

  // ── Enable listRule for user-facing collections ──
  const userReadable = ['announcements', 'ai_cap_plans', 'offers'];
  for (const name of userReadable) {
    const col = getCol(name);
    if (col) {
      if (!col.listRule || !col.viewRule) {
        await pb.collections.update(col.id, { listRule: '', viewRule: '' });
        console.log(name + ': enabled public read');
      } else {
        console.log(name + ': read already enabled');
      }
    }
  }

  console.log('All done!');
}

main().catch(console.error);
