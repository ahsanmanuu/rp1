/**
 * Fix PocketBase SQLite table columns to match collection schemas.
 * Stop PocketBase before running this.
 */
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('C:/Users/MANUU/OneDrive/Desktop/rp/pb_data/data.db');
const db = new Database(dbPath);

// Helper: add column if it doesn't exist
function addColumn(table, colName, colType, defaultValue = '') {
  // Check if column exists
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = cols.some(c => c.name === colName);
  if (!exists) {
    const sql = `ALTER TABLE ${table} ADD COLUMN ${colName} ${colType} DEFAULT ${defaultValue}`;
    db.prepare(sql).run();
    console.log(`  + ${table}.${colName} (${colType})`);
  }
}

// Helper: drop column (SQLite doesn't support DROP COLUMN directly in older versions, 
// but recent versions do. We'll use a safer approach: just leave old columns, they'll be ignored)
function renameTable(from, to) {
  try {
    db.prepare(`ALTER TABLE ${from} RENAME TO ${to}`).run();
    console.log(`  Renamed ${from} -> ${to}`);
  } catch (e) {
    // Table might not exist
  }
}

console.log('Adding missing columns to PocketBase tables...\n');

// ── membership_transactions ──────────────────────────────────────────────
console.log('membership_transactions:');
addColumn('membership_transactions', 'userId', 'TEXT', "''");
addColumn('membership_transactions', 'orderId', 'TEXT', "''");
addColumn('membership_transactions', 'planType', 'TEXT', "''");
addColumn('membership_transactions', 'amount', 'NUMERIC', '0');
addColumn('membership_transactions', 'currency', 'TEXT', "'INR'");
addColumn('membership_transactions', 'durationMonths', 'INTEGER', '0');
addColumn('membership_transactions', 'paymentStatus', 'TEXT', "'pending'");
addColumn('membership_transactions', 'startsAt', 'TEXT', "''");
addColumn('membership_transactions', 'expiresAt', 'TEXT', "''");
addColumn('membership_transactions', 'createdAt', 'TEXT', "''");

// ── ai_usage_logs ────────────────────────────────────────────────────────
console.log('\nai_usage_logs:');
addColumn('ai_usage_logs', 'userId', 'TEXT', "''");
addColumn('ai_usage_logs', 'agent', 'TEXT', "''");
addColumn('ai_usage_logs', 'model', 'TEXT', "''");
addColumn('ai_usage_logs', 'promptTokens', 'INTEGER', '0');
addColumn('ai_usage_logs', 'completionTokens', 'INTEGER', '0');
addColumn('ai_usage_logs', 'totalTokens', 'INTEGER', '0');
addColumn('ai_usage_logs', 'durationMs', 'INTEGER', '0');
addColumn('ai_usage_logs', 'createdAt', 'TEXT', "''");

// ── projects ─────────────────────────────────────────────────────────────
console.log('\nprojects:');
addColumn('projects', 'userId', 'TEXT', "''");
addColumn('projects', 'title', 'TEXT', "''");
addColumn('projects', 'originalFilename', 'TEXT', "''");
addColumn('projects', 'templateName', 'TEXT', "''");
addColumn('projects', 'latexContent', 'TEXT', "''");
addColumn('projects', 'bibContent', 'TEXT', "''");
addColumn('projects', 'status', 'TEXT', "'draft'");
addColumn('projects', 'projectType', 'TEXT', "'LATEX_STUDIO'");
addColumn('projects', 'wordCount', 'INTEGER', '0');
addColumn('projects', 'charCount', 'INTEGER', '0');
addColumn('projects', 'imageCount', 'INTEGER', '0');
addColumn('projects', 'chartCount', 'INTEGER', '0');
addColumn('projects', 'tableCount', 'INTEGER', '0');
addColumn('projects', 'equationCount', 'INTEGER', '0');
addColumn('projects', 'citationCount', 'INTEGER', '0');
addColumn('projects', 'referenceCount', 'INTEGER', '0');
addColumn('projects', 'pseudocodeCount', 'INTEGER', '0');
addColumn('projects', 'content', 'TEXT', "''");
addColumn('projects', 'structuredContent', 'TEXT', "'{}'");
addColumn('projects', 'firstPdfDownloaded', 'INTEGER', '0');
addColumn('projects', 'createdAt', 'TEXT', "''");
addColumn('projects', 'updatedAt', 'TEXT', "''");

// ── platform_stats ───────────────────────────────────────────────────────
console.log('\nplatform_stats:');
addColumn('platform_stats', 'date', 'TEXT', "''");
addColumn('platform_stats', 'totalUsers', 'INTEGER', '0');
addColumn('platform_stats', 'activeUsers24h', 'INTEGER', '0');
addColumn('platform_stats', 'totalProjects', 'INTEGER', '0');
addColumn('platform_stats', 'totalReviews', 'INTEGER', '0');
addColumn('platform_stats', 'creditsDistributed', 'INTEGER', '0');
addColumn('platform_stats', 'creditsSpent', 'INTEGER', '0');
addColumn('platform_stats', 'updatedAt', 'TEXT', "''");

// ── feature_flags ────────────────────────────────────────────────────────
console.log('\nfeature_flags:');
addColumn('feature_flags', 'key', 'TEXT', "''");
addColumn('feature_flags', 'description', 'TEXT', "''");
addColumn('feature_flags', 'isEnabled', 'INTEGER', '0');
addColumn('feature_flags', 'rolloutPercentage', 'INTEGER', '100');
addColumn('feature_flags', 'createdAt', 'TEXT', "''");
addColumn('feature_flags', 'updatedAt', 'TEXT', "''");

// ── admin_tasks ──────────────────────────────────────────────────────────
console.log('\nadmin_tasks:');
addColumn('admin_tasks', 'label', 'TEXT', "''");
addColumn('admin_tasks', 'completed', 'INTEGER', '0');
addColumn('admin_tasks', 'createdAt', 'TEXT', "''");
addColumn('admin_tasks', 'updatedAt', 'TEXT', "''");

// ── support_tickets ──────────────────────────────────────────────────────
console.log('\nsupport_tickets:');
addColumn('support_tickets', 'ticketId', 'TEXT', "''");
addColumn('support_tickets', 'subject', 'TEXT', "''");
addColumn('support_tickets', 'description', 'TEXT', "''");
addColumn('support_tickets', 'status', 'TEXT', "'open'");
addColumn('support_tickets', 'priority', 'TEXT', "'P4'");
addColumn('support_tickets', 'userName', 'TEXT', "''");
addColumn('support_tickets', 'userEmail', 'TEXT', "''");
addColumn('support_tickets', 'customerId', 'TEXT', "''");
addColumn('support_tickets', 'reason', 'TEXT', "''");
addColumn('support_tickets', 'ipAddress', 'TEXT', "''");
addColumn('support_tickets', 'location', 'TEXT', "''");
addColumn('support_tickets', 'country', 'TEXT', "''");
addColumn('support_tickets', 'userAgent', 'TEXT', "''");
addColumn('support_tickets', 'createdAt', 'TEXT', "''");
addColumn('support_tickets', 'updatedAt', 'TEXT', "''");
addColumn('support_tickets', 'archivedAt', 'TEXT', "''");

// ── paper_reviews ────────────────────────────────────────────────────────
console.log('\npaper_reviews:');
addColumn('paper_reviews', 'userId', 'TEXT', "''");
addColumn('paper_reviews', 'title', 'TEXT', "''");
addColumn('paper_reviews', 'fileType', 'TEXT', "''");
addColumn('paper_reviews', 'overallScore', 'INTEGER', '0');
addColumn('paper_reviews', 'reviewJson', 'TEXT', "'{}'");
addColumn('paper_reviews', 'journalsJson', 'TEXT', "'[]'");
addColumn('paper_reviews', 'createdAt', 'TEXT', "''");

// ── admin_users ──────────────────────────────────────────────────────────
console.log('\nadmin_users:');
addColumn('admin_users', 'email', 'TEXT', "''");
addColumn('admin_users', 'name', 'TEXT', "''");
addColumn('admin_users', 'passwordHash', 'TEXT', "''");
addColumn('admin_users', 'role', 'TEXT', "'editor'");
addColumn('admin_users', 'isActive', 'INTEGER', '1');
addColumn('admin_users', 'createdAt', 'TEXT', "''");
addColumn('admin_users', 'updatedAt', 'TEXT', "''");

// ── user_sessions ────────────────────────────────────────────────────────
console.log('\nuser_sessions:');
addColumn('user_sessions', 'machineId', 'TEXT', "''");
addColumn('user_sessions', 'ipAddress', 'TEXT', "''");
addColumn('user_sessions', 'location', 'TEXT', "''");
addColumn('user_sessions', 'userAgent', 'TEXT', "''");
addColumn('user_sessions', 'expiresAt', 'TEXT', "''");
addColumn('user_sessions', 'updatedAt', 'TEXT', "''");

// ── user_session_activities ─────────────────────────────────────────────
console.log('\nuser_session_activities:');
addColumn('user_session_activities', 'userId', 'TEXT', "''");
addColumn('user_session_activities', 'ipAddress', 'TEXT', "''");
addColumn('user_session_activities', 'location', 'TEXT', "''");
addColumn('user_session_activities', 'userAgent', 'TEXT', "''");
addColumn('user_session_activities', 'createdAt', 'TEXT', "''");

// ── tool_usage_logs ─────────────────────────────────────────────────────
console.log('\ntool_usage_logs:');
addColumn('tool_usage_logs', 'userId', 'TEXT', "''");
addColumn('tool_usage_logs', 'toolName', 'TEXT', "''");
addColumn('tool_usage_logs', 'action', 'TEXT', "''");
addColumn('tool_usage_logs', 'createdAt', 'TEXT', "''");

// ── admin_notifications ──────────────────────────────────────────────────
console.log('\nadmin_notifications:');
// Old columns that need to be renamed: message->body, link->ticketId
// We'll add new columns, old ones will be ignored by PocketBase
addColumn('admin_notifications', 'body', 'TEXT', "''");
addColumn('admin_notifications', 'ticketId', 'TEXT', "''");

console.log('\nDone! All columns added.');
db.close();
