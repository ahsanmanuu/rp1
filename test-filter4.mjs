import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');
await pb.admins.authWithPassword('admin@latexify.io', 'admin123456');

const tests = [
  { col: 'membership_transactions', filter: 'userId != ""' },
  { col: 'membership_transactions', filter: 'paymentStatus = "paid"' },
  { col: 'membership_transactions', filter: 'userId = "x" && paymentStatus = "paid"' },
  { col: 'ai_usage_logs', filter: 'userId != ""' },
  { col: 'ai_usage_logs', filter: 'agent = "latex"' },
  { col: 'projects', filter: 'userId != ""' },
  { col: 'projects', filter: 'status = "draft"' },
  { col: 'platform_stats', filter: 'totalUsers >= 0' },
  { col: 'feature_flags', filter: 'key != ""' },
  { col: 'admin_tasks', filter: 'label != ""' },
  { col: 'support_tickets', filter: 'status = "open"' },
  { col: 'paper_reviews', filter: 'userId != ""' },
  { col: 'admin_users', filter: 'email != ""' },
  { col: 'user_sessions', filter: 'machineId != ""' },
  { col: 'user_session_activities', filter: 'userId != ""' },
  { col: 'tool_usage_logs', filter: 'userId != ""' },
  { col: 'admin_notifications', filter: 'body != ""' },
  // point_transactions: amount exists in schema but column is still 'points'
  { col: 'point_transactions', filter: 'userId != ""' },
  { col: 'announcements', filter: 'isActive = true' },
];

for (const { col, filter } of tests) {
  try {
    const result = await pb.collection(col).getList(1, 5, {
      filter,
      requestKey: 'test_' + Date.now()
    });
    console.log('OK:', col, '-', filter, '->', result.totalItems);
  } catch (e) {
    console.log('FAIL:', col, '-', filter, '->', e.message.substring(0, 100));
  }
}
