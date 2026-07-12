/**
 * PocketBase Schema Migration — Adds missing fields to all collections
 * to match the Prisma schema (prisma/schema.prisma).
 *
 * Run: node prisma/migrate-pb.mjs
 */

import PocketBase from 'pocketbase';

const PB_URL = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || 'admin@latexify.io';
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || 'Sczone@123';

const pb = new PocketBase(PB_URL);
await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

console.log('Authenticated to PocketBase admin API');

// ── Field type helpers ──────────────────────────────────────────────────────
function text(opts = {}) {
  return { type: 'text', required: false, unique: false, min: null, max: null, pattern: '', ...opts };
}
function number(opts = {}) {
  return { type: 'number', required: false, unique: false, min: null, max: null, onlyInt: false, ...opts };
}
function bool(opts = {}) {
  return { type: 'bool', required: false, ...opts };
}
function date(opts = {}) {
  return { type: 'date', required: false, min: '', max: '', ...opts };
}
function autodate(opts = {}) {
  return { type: 'autodate', required: false, onCreate: true, onUpdate: true, ...opts };
}
function email(opts = {}) {
  return { type: 'email', required: false, ...opts };
}
function url(opts = {}) {
  return { type: 'url', required: false, ...opts };
}
function json(opts = {}) {
  return { type: 'json', required: false, ...opts };
}
function editor(opts = {}) {
  return { type: 'editor', required: false, ...opts };
}
function select(opts = {}) {
  return { type: 'select', required: false, values: [], maxSelect: 1, ...opts };
}
function relation(opts = {}) {
  return { type: 'relation', required: false, maxSelect: 1, collectionId: '', cascadeDelete: false, ...opts };
}
function file(opts = {}) {
  return { type: 'file', required: false, maxSelect: 1, maxSize: 0, mimeTypes: [], thumbs: [], ...opts };
}

// ── Collection field definitions ────────────────────────────────────────────
// Map of collection name → array of field definitions (fields that should exist)
const COLLECTION_FIELDS = {
  admin_users: [
    { name: 'email', ...text({ required: true }) },
    { name: 'name', ...text() },
    { name: 'passwordHash', ...text() },
    { name: 'role', ...text({ required: true }) },
    { name: 'isActive', ...bool() },
    { name: 'createdAt', ...autodate({ onCreate: true, onUpdate: false }) },
    { name: 'updatedAt', ...autodate({ onCreate: true, onUpdate: true }) },
  ],
  announcements: [
    { name: 'title', ...text({ required: true }) },
    { name: 'content', ...editor() },
    { name: 'priority', ...text() },
    { name: 'isActive', ...bool() },
    { name: 'startsAt', ...date() },
    { name: 'endsAt', ...date() },
    { name: 'createdAt', ...autodate({ onCreate: true, onUpdate: false }) },
    { name: 'updatedAt', ...autodate({ onCreate: true, onUpdate: true }) },
  ],
  platform_stats: [
    { name: 'date', ...text({ required: true }) },
    { name: 'totalUsers', ...number({ onlyInt: true }) },
    { name: 'activeUsers24h', ...number({ onlyInt: true }) },
    { name: 'totalProjects', ...number({ onlyInt: true }) },
    { name: 'totalReviews', ...number({ onlyInt: true }) },
    { name: 'creditsDistributed', ...number({ onlyInt: true }) },
    { name: 'creditsSpent', ...number({ onlyInt: true }) },
    { name: 'updatedAt', ...autodate({ onCreate: true, onUpdate: true }) },
  ],
  ai_usage_logs: [
    { name: 'userId', ...text() },
    { name: 'agent', ...text() },
    { name: 'model', ...text() },
    { name: 'promptTokens', ...number({ onlyInt: true }) },
    { name: 'completionTokens', ...number({ onlyInt: true }) },
    { name: 'totalTokens', ...number({ onlyInt: true }) },
    { name: 'durationMs', ...number({ onlyInt: true }) },
    { name: 'createdAt', ...autodate({ onCreate: true, onUpdate: false }) },
  ],
  projects: [
    { name: 'userId', ...text() },
    { name: 'title', ...text() },
    { name: 'originalFilename', ...text() },
    { name: 'templateName', ...text() },
    { name: 'latexContent', ...editor() },
    { name: 'bibContent', ...editor() },
    { name: 'status', ...text() },
    { name: 'projectType', ...text() },
    { name: 'wordCount', ...number({ onlyInt: true }) },
    { name: 'charCount', ...number({ onlyInt: true }) },
    { name: 'imageCount', ...number({ onlyInt: true }) },
    { name: 'chartCount', ...number({ onlyInt: true }) },
    { name: 'tableCount', ...number({ onlyInt: true }) },
    { name: 'equationCount', ...number({ onlyInt: true }) },
    { name: 'citationCount', ...number({ onlyInt: true }) },
    { name: 'referenceCount', ...number({ onlyInt: true }) },
    { name: 'pseudocodeCount', ...number({ onlyInt: true }) },
    { name: 'content', ...editor() },
    { name: 'structuredContent', ...editor() },
    { name: 'firstPdfDownloaded', ...bool() },
    { name: 'createdAt', ...autodate({ onCreate: true, onUpdate: false }) },
    { name: 'updatedAt', ...autodate({ onCreate: true, onUpdate: true }) },
  ],
  paper_reviews: [
    { name: 'userId', ...text() },
    { name: 'title', ...text() },
    { name: 'fileType', ...text() },
    { name: 'overallScore', ...number({ onlyInt: true }) },
    { name: 'reviewJson', ...editor() },
    { name: 'journalsJson', ...editor() },
    { name: 'createdAt', ...autodate({ onCreate: true, onUpdate: false }) },
  ],
  feature_flags: [
    { name: 'key', ...text({ required: true }) },
    { name: 'description', ...text() },
    { name: 'isEnabled', ...bool() },
    { name: 'rolloutPercentage', ...number({ onlyInt: true }) },
    { name: 'createdAt', ...autodate({ onCreate: true, onUpdate: false }) },
    { name: 'updatedAt', ...autodate({ onCreate: true, onUpdate: true }) },
  ],
  admin_tasks: [
    { name: 'label', ...text() },
    { name: 'completed', ...bool() },
    { name: 'createdAt', ...autodate({ onCreate: true, onUpdate: false }) },
    { name: 'updatedAt', ...autodate({ onCreate: true, onUpdate: true }) },
  ],
  support_tickets: [
    { name: 'ticketId', ...text({ required: true }) },
    { name: 'subject', ...text() },
    { name: 'description', ...editor() },
    { name: 'status', ...text() },
    { name: 'priority', ...text() },
    { name: 'userName', ...text() },
    { name: 'userEmail', ...text() },
    { name: 'customerId', ...text() },
    { name: 'reason', ...editor() },
    { name: 'ipAddress', ...text() },
    { name: 'location', ...text() },
    { name: 'country', ...text() },
    { name: 'userAgent', ...text() },
    { name: 'createdAt', ...autodate({ onCreate: true, onUpdate: false }) },
    { name: 'updatedAt', ...autodate({ onCreate: true, onUpdate: true }) },
    { name: 'archivedAt', ...date() },
  ],
  user_sessions: [
    { name: 'userId', ...text({ required: true }) },
    { name: 'sessionToken', ...text({ required: true }) },
    { name: 'machineId', ...text() },
    { name: 'ipAddress', ...text() },
    { name: 'location', ...text() },
    { name: 'userAgent', ...text() },
    { name: 'expiresAt', ...date() },
    { name: 'createdAt', ...autodate({ onCreate: true, onUpdate: false }) },
    { name: 'updatedAt', ...autodate({ onCreate: true, onUpdate: true }) },
  ],
  point_transactions: [
    { name: 'userId', ...text() },
    { name: 'amount', ...number({ onlyInt: true }) },
    { name: 'type', ...text() },
    { name: 'description', ...text() },
    { name: 'createdAt', ...autodate({ onCreate: true, onUpdate: false }) },
  ],
  membership_transactions: [
    { name: 'userId', ...text() },
    { name: 'orderId', ...text({ required: true }) },
    { name: 'planType', ...text() },
    { name: 'amount', ...number() },
    { name: 'currency', ...text() },
    { name: 'durationMonths', ...number({ onlyInt: true }) },
    { name: 'paymentStatus', ...text() },
    { name: 'startsAt', ...date() },
    { name: 'expiresAt', ...date() },
    { name: 'createdAt', ...autodate({ onCreate: true, onUpdate: false }) },
  ],
  admin_notifications: [
    { name: 'type', ...text() },
    { name: 'title', ...text() },
    { name: 'body', ...text() },
    { name: 'ticketId', ...text() },
    { name: 'isRead', ...bool() },
    { name: 'createdAt', ...autodate({ onCreate: true, onUpdate: false }) },
  ],
  user_session_activities: [
    { name: 'userId', ...text() },
    { name: 'ipAddress', ...text() },
    { name: 'location', ...text() },
    { name: 'userAgent', ...text() },
    { name: 'createdAt', ...autodate({ onCreate: true, onUpdate: false }) },
  ],
  tool_usage_logs: [
    { name: 'userId', ...text() },
    { name: 'toolName', ...text() },
    { name: 'action', ...text() },
    { name: 'createdAt', ...autodate({ onCreate: true, onUpdate: false }) },
  ],
};

// ── Migration logic ─────────────────────────────────────────────────────────
async function migrateCollection(name, expectedFields) {
  // Get or create the collection
  let collection;
  try {
    const all = await pb.collections.getFullList({ requestKey: `get_${name}` });
    collection = all.find(c => c.name === name);
  } catch (e) {
    console.log(`  [SKIP] Cannot list collections: ${e.message}`);
    return;
  }

  if (!collection) {
    console.log(`  [CREATE] Collection "${name}" does not exist — creating...`);
    try {
      collection = await pb.collections.create({
        name,
        type: 'base',
        schema: expectedFields,
      }, { requestKey: `create_${name}` });
      console.log(`  [OK] Created "${name}"`);
    } catch (e) {
      console.log(`  [FAIL] Cannot create "${name}": ${e.message}`);
    }
    return;
  }

  // Collection exists — add missing fields
  const existingFields = new Set((collection.fields || []).map(f => f.name));
  const fieldsToAdd = expectedFields.filter(f => !existingFields.has(f.name));

  if (fieldsToAdd.length === 0) {
    console.log(`  [OK] "${name}" — all fields present`);
    return;
  }

  console.log(`  [UPDATE] "${name}" — adding ${fieldsToAdd.length} field(s): ${fieldsToAdd.map(f => f.name).join(', ')}`);
  try {
    const updatedSchema = [...(collection.fields || []), ...fieldsToAdd];
    await pb.collections.update(collection.id, { schema: updatedSchema }, { requestKey: `update_${name}` });
    console.log(`  [OK] "${name}" updated`);
  } catch (e) {
    console.log(`  [FAIL] Cannot update "${name}": ${e.message}`);
    if (e.response?.data) {
      console.log(`         Details: ${JSON.stringify(e.response.data)}`);
    }
  }
}

// ── Run migrations ──────────────────────────────────────────────────────────
console.log('\nStarting PocketBase schema migration...\n');

for (const [name, fields] of Object.entries(COLLECTION_FIELDS)) {
  console.log(`Processing "${name}"...`);
  await migrateCollection(name, fields);
}

console.log('\nMigration complete!\n');
