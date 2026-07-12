import Database from 'better-sqlite3';
const db = new Database('C:/Users/MANUU/OneDrive/Desktop/rp/pb_data/data.db');

function getCollection(name) {
  return db.prepare("SELECT * FROM _collections WHERE name = ?").get(name);
}

function updateSchema(name, fields) {
  db.prepare("UPDATE _collections SET fields = ? WHERE name = ?").run(JSON.stringify(fields), name);
  console.log(`Updated "${name}" schema`);
}

// ── Helper to create PocketBase field objects ──────────────────────────────
const text = (name, opts = {}) => ({
  autogeneratePattern: "", hidden: false, max: 0, min: 0, name, pattern: "", presentable: false,
  primaryKey: false, required: false, system: false, type: "text", ...opts
});

const number = (name, opts = {}) => ({
  hidden: false, max: null, min: null, name, onlyInt: false, presentable: false,
  required: false, system: false, type: "number", ...opts
});

const bool = (name, opts = {}) => ({
  hidden: false, name, presentable: false, required: false, system: false, type: "bool", ...opts
});

const date = (name, opts = {}) => ({
  hidden: false, max: "", min: "", name, presentable: false, required: false, system: false, type: "date", ...opts
});

const autodate = (name, onCreate, onUpdate, opts = {}) => ({
  hidden: false, name, onCreate, onUpdate, presentable: false, system: false, type: "autodate", ...opts
});

const editor = (name, opts = {}) => ({
  hidden: false, name, presentable: false, required: false, system: false, type: "editor", ...opts
});

const email = (name, opts = {}) => ({
  hidden: false, name, presentable: false, required: false, system: false, type: "email", ...opts
});

const json = (name, opts = {}) => ({
  hidden: false, name, presentable: false, required: false, system: false, type: "json", ...opts
});

// ── Helper to build field definitions with proper IDs ──────────────────────
const idField = (name = "id") => ({
  autogeneratePattern: "[a-z0-9]{15}", hidden: false, id: "text3208210256", max: 15, min: 15,
  name, pattern: "^[a-z0-9]+$", presentable: false, primaryKey: true, required: true, system: true, type: "text"
});

// ── Generator for consistent field IDs (type-based) ────────────────────────
let fieldCounter = 1000000000;
function fieldId(type) {
  const prefix = type === 'autodate' ? 'autodate' :
    type === 'date' ? 'date' :
    type === 'bool' ? 'bool' :
    type === 'number' ? 'number' :
    type === 'editor' ? 'editor' :
    type === 'email' ? 'email' :
    type === 'json' ? 'json' : 'text';
  fieldCounter++;
  return prefix + fieldCounter;
}

// Apply type defaults and assign an id
function makeField(def) {
  const type = def.type || 'text';
  return { ...def, id: def.id || fieldId(type) };
}

// ══════════════════════════════════════════════════════════════════════════
// SCHEMA DEFINITIONS — each collection's complete field list
// ══════════════════════════════════════════════════════════════════════════

const schemas = {
  ai_usage_logs: [
    makeField(idField()),
    makeField(text("userId")),
    makeField(text("agent")),
    makeField(text("model")),
    makeField(number("promptTokens", { onlyInt: true })),
    makeField(number("completionTokens", { onlyInt: true })),
    makeField(number("totalTokens", { onlyInt: true })),
    makeField(number("durationMs", { onlyInt: true })),
    makeField(autodate("createdAt", true, false)),
  ],

  projects: [
    makeField(idField()),
    makeField(text("userId")),
    makeField(text("title")),
    makeField(text("originalFilename")),
    makeField(text("templateName")),
    makeField(editor("latexContent")),
    makeField(editor("bibContent")),
    makeField(text("status")),
    makeField(text("projectType")),
    makeField(number("wordCount", { onlyInt: true })),
    makeField(number("charCount", { onlyInt: true })),
    makeField(number("imageCount", { onlyInt: true })),
    makeField(number("chartCount", { onlyInt: true })),
    makeField(number("tableCount", { onlyInt: true })),
    makeField(number("equationCount", { onlyInt: true })),
    makeField(number("citationCount", { onlyInt: true })),
    makeField(number("referenceCount", { onlyInt: true })),
    makeField(number("pseudocodeCount", { onlyInt: true })),
    makeField(editor("content")),
    makeField(editor("structuredContent")),
    makeField(bool("firstPdfDownloaded")),
    makeField(autodate("createdAt", true, false)),
    makeField(autodate("updatedAt", false, true)),
  ],

  platform_stats: [
    makeField(idField()),
    makeField(text("date")),
    makeField(number("totalUsers", { onlyInt: true })),
    makeField(number("activeUsers24h", { onlyInt: true })),
    makeField(number("totalProjects", { onlyInt: true })),
    makeField(number("totalReviews", { onlyInt: true })),
    makeField(number("creditsDistributed", { onlyInt: true })),
    makeField(number("creditsSpent", { onlyInt: true })),
    makeField(autodate("updatedAt", false, true)),
  ],

  feature_flags: [
    makeField(idField()),
    makeField(text("key")),
    makeField(text("description")),
    makeField(bool("isEnabled")),
    makeField(number("rolloutPercentage", { onlyInt: true })),
    makeField(autodate("createdAt", true, false)),
    makeField(autodate("updatedAt", false, true)),
  ],

  admin_tasks: [
    makeField(idField()),
    makeField(text("label")),
    makeField(bool("completed")),
    makeField(autodate("createdAt", true, false)),
    makeField(autodate("updatedAt", false, true)),
  ],

  support_tickets: [
    makeField(idField()),
    makeField(text("ticketId")),
    makeField(text("subject")),
    makeField(editor("description")),
    makeField(text("status")),
    makeField(text("priority")),
    makeField(text("userName")),
    makeField(text("userEmail")),
    makeField(text("customerId")),
    makeField(editor("reason")),
    makeField(text("ipAddress")),
    makeField(text("location")),
    makeField(text("country")),
    makeField(text("userAgent")),
    makeField(autodate("createdAt", true, false)),
    makeField(autodate("updatedAt", false, true)),
    makeField(date("archivedAt")),
  ],

  paper_reviews: [
    makeField(idField()),
    makeField(text("userId")),
    makeField(text("title")),
    makeField(text("fileType")),
    makeField(number("overallScore", { onlyInt: true })),
    makeField(editor("reviewJson")),
    makeField(editor("journalsJson")),
    makeField(autodate("createdAt", true, false)),
  ],

  admin_users: [
    makeField(idField()),
    makeField(email("email")),
    makeField(text("name")),
    makeField(text("passwordHash")),
    makeField(text("role")),
    makeField(bool("isActive")),
    makeField(autodate("createdAt", true, false)),
    makeField(autodate("updatedAt", false, true)),
  ],

  admin_notifications: [
    makeField(idField()),
    makeField(text("type")),
    makeField(text("title")),
    makeField(text("body")),
    makeField(text("ticketId")),
    makeField(bool("isRead")),
    makeField(autodate("createdAt", true, false)),
  ],

  membership_transactions: [
    makeField(idField()),
    makeField(text("userId")),
    makeField(text("orderId")),
    makeField(text("planType")),
    makeField(number("amount")),
    makeField(text("currency")),
    makeField(number("durationMonths", { onlyInt: true })),
    makeField(text("paymentStatus")),
    makeField(date("startsAt")),
    makeField(date("expiresAt")),
    makeField(autodate("createdAt", true, false)),
  ],

  user_session_activities: [
    makeField(idField()),
    makeField(text("userId")),
    makeField(text("ipAddress")),
    makeField(text("location")),
    makeField(text("userAgent")),
    makeField(autodate("createdAt", true, false)),
  ],

  tool_usage_logs: [
    makeField(idField()),
    makeField(text("userId")),
    makeField(text("toolName")),
    makeField(text("action")),
    makeField(autodate("createdAt", true, false)),
  ],

  point_transactions: [
    makeField(idField()),
    makeField(text("userId")),
    makeField(number("amount", { onlyInt: true })),
    makeField(text("type")),
    makeField(text("description")),
    makeField(autodate("createdAt", true, false)),
  ],

  user_sessions: [
    makeField(idField()),
    makeField(text("userId", { required: true })),
    makeField(text("sessionToken", { required: true })),
    makeField(date("expires")),
    makeField(autodate("createdAt", true, false)),
    makeField(text("machineId")),
    makeField(text("ipAddress")),
    makeField(text("location")),
    makeField(text("userAgent")),
    makeField(date("expiresAt")),
    makeField(autodate("updatedAt", false, true)),
  ],

  membership_plans: [
    makeField(idField()),
    makeField(text("planId", { required: true })),
    makeField(text("name", { required: true })),
    makeField(text("description")),
    makeField(number("priceINR", { required: true })),
    makeField(number("durationMonths", { required: true })),
    makeField(number("pointsExchange", { required: true })),
  ],

  ai_cap_plans: [
    makeField(idField()),
    makeField(text("name", { required: true })),
    makeField(text("label", { required: true })),
    makeField(text("description")),
    makeField(number("dailyTokenCap", { required: true })),
    makeField(bool("isActive")),
  ],
};

// ══════════════════════════════════════════════════════════════════════════
// APPLY SCHEMAS
// ══════════════════════════════════════════════════════════════════════════

console.log('Updating collection schemas...\n');
for (const [name, fields] of Object.entries(schemas)) {
  const existing = getCollection(name);
  if (existing) {
    const oldFields = JSON.parse(existing.fields);
    const oldNames = oldFields.map(f => f.name);
    const newNames = fields.map(f => f.name);
    const added = fields.filter(f => !oldNames.includes(f.name)).map(f => f.name);
    const removed = oldFields.filter(f => !newNames.includes(f.name) && !f.system).map(f => f.name);
    console.log(`"${name}": +${added.length}/${removed.length ? '-' + removed.length + ' old fields removed' : 'no removals'}`);
    if (added.length) console.log(`  Added: ${added.join(', ')}`);
    if (removed.length) console.log(`  Removed: ${removed.join(', ')}`);
    updateSchema(name, fields);
  } else {
    console.log(`"${name}" not found!`);
  }
}

console.log('\nAll schemas updated!');
db.close();
