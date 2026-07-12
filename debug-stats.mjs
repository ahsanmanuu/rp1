import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');
await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

async function test(label, fn) {
  try {
    const result = await fn();
    console.log(`OK: ${label}`);
    return result;
  } catch (e) {
    console.log(`FAIL: ${label} -> ${e.message.substring(0, 120)}`);
    return null;
  }
}

// Test all the query patterns used in stats/route.ts

// 1. Basic counts
await test('user.count()', () => pb.collection('users').getList(1, 1, { requestKey: 't1' }));
await test('project.count()', () => pb.collection('projects').getList(1, 1, { requestKey: 't2' }));
await test('paperReview.count()', () => pb.collection('paper_reviews').getList(1, 1, { requestKey: 't3' }));

// 2. pointTransaction findMany with select
await test('pointTransaction.findMany(type=recharge, select amount)', async () => {
  const r = await pb.collection('point_transactions').getList(1, 200, {
    filter: 'type = "recharge"',
    fields: 'amount',
    requestKey: 't4'
  });
  return r;
});

// 3. membershipTransaction findMany with select
await test('membershipTransaction.findMany(paymentStatus=paid, select amount)', async () => {
  const r = await pb.collection('membership_transactions').getList(1, 200, {
    filter: 'paymentStatus = "paid"',
    fields: 'amount',
    requestKey: 't5'
  });
  return r;
});

// 4. aiUsageLog aggregate - test sum manually
await test('aiUsageLog aggregate sum(totalTokens)', async () => {
  const r = await pb.collection('ai_usage_logs').getList(1, 200, {
    fields: 'totalTokens',
    requestKey: 't6'
  });
  return r;
});

// 5. userSession count with filter
await test('userSession.count(expiresAt >= now)', () => pb.collection('user_sessions').getList(1, 1, {
  filter: 'expiresAt >= "2026-07-08 20:00:00.000Z"',
  requestKey: 't7'
}));

// 6. user.count with membership filter
await test('user.count(membership IN premium)', async () => {
  const r = await pb.collection('users').getList(1, 200, {
    filter: '(membership = "premium_1m" || membership = "premium_3m" || membership = "premium_6m" || membership = "premium_12m") && membershipExpiresAt > "2026-07-08 20:00:00.000Z"',
    requestKey: 't8'
  });
  return r;
});

// 7. supportTicket counts
await test('supportTicket.count()', () => pb.collection('support_tickets').getList(1, 1, { requestKey: 't9' }));
await test('supportTicket.count(status=open)', () => pb.collection('support_tickets').getList(1, 1, {
  filter: 'status = "open"',
  requestKey: 't10'
}));
await test('supportTicket.count(status=in_progress)', () => pb.collection('support_tickets').getList(1, 1, {
  filter: 'status = "in_progress"',
  requestKey: 't11'
}));
await test('supportTicket.count(status=resolved)', () => pb.collection('support_tickets').getList(1, 1, {
  filter: 'status = "resolved"',
  requestKey: 't12'
}));

// 8. paperReview findMany with include (expand user)
await test('paperReview findMany with expand user', async () => {
  const r = await pb.collection('paper_reviews').getList(1, 2, {
    sort: '-createdAt',
    expand: 'userId',
    requestKey: 't13'
  });
  return r;
});

// 9. pointTransaction findMany with expand user
await test('pointTransaction findMany with expand user', async () => {
  const r = await pb.collection('point_transactions').getList(1, 2, {
    sort: '-createdAt',
    expand: 'userId',
    fields: '*,expand.userId.name,expand.userId.email',
    requestKey: 't14'
  });
  return r;
});

// 10. project findMany with expand user
await test('project findMany with expand user', async () => {
  const r = await pb.collection('projects').getList(1, 2, {
    sort: '-createdAt',
    expand: 'userId',
    requestKey: 't15'
  });
  return r;
});

// 11. aiUsageLog findMany
await test('aiUsageLog findMany(sort createdAt desc)', async () => {
  const r = await pb.collection('ai_usage_logs').getList(1, 4, {
    sort: '-createdAt',
    requestKey: 't16'
  });
  return r;
});

// 12. announcement findMany
await test('announcement.findMany(isActive=true)', () => pb.collection('announcements').getList(1, 50, {
  filter: 'isActive = true',
  sort: '-startsAt',
  requestKey: 't17'
}));

// 13. aiUsageLog findMany with date filter
await test('aiUsageLog.findMany(createdAt >= 30days)', () => pb.collection('ai_usage_logs').getList(1, 200, {
  filter: 'createdAt >= "2026-06-08 20:00:00.000Z"',
  sort: 'createdAt',
  requestKey: 't18'
}));

// 14. adminTask findMany
await test('adminTask.findMany()', () => pb.collection('admin_tasks').getList(1, 50, {
  sort: 'createdAt',
  requestKey: 't19'
}));

// 15. userSession.count with date range (trend calc)
await test('userSession.count(expiresAt >= 1h_ago)', () => pb.collection('user_sessions').getList(1, 1, {
  filter: 'expiresAt >= "2026-07-08 19:00:00.000Z"',
  requestKey: 't20'
}));

console.log('\nDone debugging.');
