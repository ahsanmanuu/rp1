/**
 * PocketBase Setup & Seed Script
 *
 * Prerequisites:
 *   - PocketBase binary running at http://127.0.0.1:8090
 *   - Admin account created via the Web UI (_/)
 *
 * Usage:
 *   npx tsx scripts/setup-pocketbase.ts
 *
 * This script creates all collections mirroring the Prisma schema
 * and seeds default data (AI cap plans, membership plans, services, etc.)
 */

import PocketBase from 'pocketbase';

const PB_URL = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || 'admin@latexify.io';
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || 'Sczone@123';

export interface FieldDef {
  name: string;
  type: string;
  required?: boolean;
  unique?: boolean;
  options?: Record<string, any>;
}

export interface CollectionDef {
  name: string;
  type: 'base' | 'auth';
  schema: FieldDef[];
  listRule?: string | null;
  viewRule?: string | null;
  createRule?: string | null;
  updateRule?: string | null;
  deleteRule?: string | null;
  indexes?: string[];
}

export const COLLECTIONS: CollectionDef[] = [
  // ─── User Sessions ──────────────────────────────────────────────────
  {
    name: 'user_sessions',
    type: 'base',
    schema: [
      { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
      { name: 'sessionToken', type: 'text', required: true, unique: true },
      { name: 'machineId', type: 'text', required: true },
      { name: 'ipAddress', type: 'text' },
      { name: 'location', type: 'text' },
      { name: 'userAgent', type: 'text' },
      { name: 'lastActiveAt', type: 'date' },
      { name: 'expiresAt', type: 'date', required: true },
    ],
    indexes: ['CREATE INDEX idx_us_userId_lastActive ON user_sessions (userId, lastActiveAt);'],
    listRule: '@request.auth.id != "" && userId = @request.auth.id',
    viewRule: '@request.auth.id != "" && userId = @request.auth.id',
    createRule: '@request.auth.id != "" && userId = @request.auth.id',
    updateRule: '@request.auth.id != "" && userId = @request.auth.id',
    deleteRule: '@request.auth.id != "" && userId = @request.auth.id',
  },
  // ─── Layout Settings ────────────────────────────────────────────────
  {
    name: 'layout_settings',
    type: 'base',
    schema: [
      { name: 'userId', type: 'relation', required: true, unique: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
      { name: 'pages', type: 'json' },
      { name: 'windows', type: 'json' },
      { name: 'panels', type: 'json' },
      { name: 'cards', type: 'json' },
    ],
    listRule: '@request.auth.id != "" && userId = @request.auth.id',
    viewRule: '@request.auth.id != "" && userId = @request.auth.id',
    createRule: '@request.auth.id != "" && userId = @request.auth.id',
    updateRule: '@request.auth.id != "" && userId = @request.auth.id',
    deleteRule: '@request.auth.id != "" && userId = @request.auth.id',
  },
  // ─── Projects ──────────────────────────────────────────────────────
  {
    name: 'projects',
    type: 'base',
    schema: [
      { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
      { name: 'title', type: 'text', required: true },
      { name: 'originalFilename', type: 'text' },
      { name: 'templateName', type: 'text' },
      { name: 'latexContent', type: 'editor' },
      { name: 'bibContent', type: 'editor' },
      { name: 'status', type: 'select', required: true, options: { values: ['draft', 'processing', 'completed', 'failed'] } },
      { name: 'projectType', type: 'text' },
      { name: 'wordCount', type: 'number' },
      { name: 'charCount', type: 'number' },
      { name: 'imageCount', type: 'number' },
      { name: 'chartCount', type: 'number' },
      { name: 'tableCount', type: 'number' },
      { name: 'equationCount', type: 'number' },
      { name: 'citationCount', type: 'number' },
      { name: 'referenceCount', type: 'number' },
      { name: 'pseudocodeCount', type: 'number' },
      { name: 'content', type: 'editor' },
      { name: 'structuredContent', type: 'json' },
      { name: 'firstPdfDownloaded', type: 'bool' },
    ],
    indexes: ['CREATE INDEX idx_projects_userId ON projects (userId);'],
  },
  // ─── Project Files ─────────────────────────────────────────────────
  {
    name: 'project_files',
    type: 'base',
    schema: [
      { name: 'projectId', type: 'relation', required: true, options: { collectionId: 'projects', cascadeDelete: true } },
      { name: 'filename', type: 'text', required: true },
      { name: 'file', type: 'file' },
      { name: 'fileType', type: 'text' },
      { name: 'size', type: 'number' },
      { name: 'content', type: 'editor' },
    ],
    indexes: ['CREATE UNIQUE INDEX idx_project_files_unique ON project_files (projectId, filename);'],
  },
  // ─── Project Collaborators ─────────────────────────────────────────
  {
    name: 'project_collaborators',
    type: 'base',
    schema: [
      { name: 'projectId', type: 'relation', required: true, options: { collectionId: 'projects', cascadeDelete: true } },
      { name: 'userEmail', type: 'email', required: true },
      { name: 'role', type: 'select', required: true, options: { values: ['viewer', 'editor', 'owner'] } },
    ],
    indexes: ['CREATE UNIQUE INDEX idx_project_collab_unique ON project_collaborators (projectId, userEmail);'],
  },
  // ─── Templates ─────────────────────────────────────────────────────
  {
    name: 'templates',
    type: 'base',
    schema: [
      { name: 'name', type: 'text', required: true },
      { name: 'description', type: 'text' },
      { name: 'category', type: 'text', required: true },
      { name: 'thumbnailUrl', type: 'url' },
      { name: 'templateContent', type: 'editor', required: true },
      { name: 'clsContent', type: 'editor' },
      { name: 'bstContent', type: 'editor' },
      { name: 'assetsJson', type: 'json' },
      { name: 'isBuiltin', type: 'bool' },
      { name: 'userId', type: 'relation', options: { collectionId: '_pb_users_collection_' } },
    ],
  },
  // ─── Share Links ───────────────────────────────────────────────────
  {
    name: 'share_links',
    type: 'base',
    schema: [
      { name: 'projectId', type: 'relation', required: true, options: { collectionId: 'projects', cascadeDelete: true } },
      { name: 'shareToken', type: 'text', required: true, unique: true },
      { name: 'expiresAt', type: 'date' },
    ],
  },
  // ─── Point Transactions ────────────────────────────────────────────
  {
    name: 'point_transactions',
    type: 'base',
    schema: [
      { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
      { name: 'amount', type: 'number', required: true },
      { name: 'type', type: 'select', required: true, options: { values: ['recharge', 'deduct', 'exchange', 'pending', 'refund', 'refund_pending', 'failed'] } },
      { name: 'description', type: 'text' },
    ],
    indexes: ['CREATE INDEX idx_pt_userId ON point_transactions (userId);'],
  },
  // ─── Citation Projects ─────────────────────────────────────────────
  {
    name: 'citation_projects',
    type: 'base',
    schema: [
      { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
      { name: 'name', type: 'text' },
      { name: 'style', type: 'text' },
    ],
  },
  // ─── Citations ─────────────────────────────────────────────────────
  {
    name: 'citations',
    type: 'base',
    schema: [
      { name: 'projectId', type: 'relation', required: true, options: { collectionId: 'citation_projects', cascadeDelete: true } },
      { name: 'sourceType', type: 'text', required: true },
      { name: 'rawData', type: 'json', required: true },
      { name: 'cslJson', type: 'json', required: true },
      { name: 'doi', type: 'text' },
      { name: 'isbn', type: 'text' },
      { name: 'url', type: 'url' },
      { name: 'title', type: 'text', required: true },
      { name: 'authors', type: 'json', required: true },
      { name: 'year', type: 'text' },
      { name: 'sortOrder', type: 'number' },
    ],
  },
  // ─── Paper Reviews ─────────────────────────────────────────────────
  {
    name: 'paper_reviews',
    type: 'base',
    schema: [
      { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
      { name: 'title', type: 'text', required: true },
      { name: 'fileType', type: 'text', required: true },
      { name: 'overallScore', type: 'number', required: true },
      { name: 'reviewJson', type: 'json', required: true },
      { name: 'journalsJson', type: 'json', required: true },
    ],
  },
  // ─── Report History ────────────────────────────────────────────────
  {
    name: 'report_history',
    type: 'base',
    schema: [
      { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
      { name: 'projectId', type: 'text' },
      { name: 'title', type: 'text', required: true },
      { name: 'statsJson', type: 'json', required: true },
      { name: 'authorsJson', type: 'json', required: true },
      { name: 'affiliationsJson', type: 'json', required: true },
      { name: 'keywordsJson', type: 'json', required: true },
      { name: 'status', type: 'select', required: true, options: { values: ['verified', 'pending', 'rejected'] } },
      { name: 'pdfUrl', type: 'url' },
      { name: 'latexUrl', type: 'url' },
      { name: 'zipUrl', type: 'url' },
    ],
  },
  // ─── Journal Registry ──────────────────────────────────────────────
  {
    name: 'journal_registry',
    type: 'base',
    schema: [
      { name: 'name', type: 'text', required: true, unique: true },
      { name: 'publisher', type: 'text', required: true },
      { name: 'quartile', type: 'select', required: true, options: { values: ['Q1', 'Q2', 'Q3', 'Q4'] } },
      { name: 'accessType', type: 'select', required: true, options: { values: ['Open Access', 'Subscription', 'Hybrid'] } },
      { name: 'apc', type: 'number' },
      { name: 'impactFactor', type: 'number', required: true },
      { name: 'indexing', type: 'json' },
      { name: 'reviewTimeWeeks', type: 'text', required: true },
      { name: 'publicationTimeWeeks', type: 'text', required: true },
      { name: 'latexTemplateUrl', type: 'url', required: true },
      { name: 'homeUrl', type: 'url', required: true },
      { name: 'domains', type: 'json' },
      { name: 'sjrScore', type: 'number', required: true },
      { name: 'keywords', type: 'json' },
      { name: 'scopeText', type: 'text', required: true },
      { name: 'minRecommendedScore', type: 'number' },
      { name: 'methodologyFocus', type: 'json' },
    ],
  },
  // ─── Platform Stats ────────────────────────────────────────────────
  {
    name: 'platform_stats',
    type: 'base',
    schema: [
      { name: 'date', type: 'text', required: true, unique: true },
      { name: 'totalUsers', type: 'number' },
      { name: 'activeUsers24h', type: 'number' },
      { name: 'totalProjects', type: 'number' },
      { name: 'totalReviews', type: 'number' },
      { name: 'creditsDistributed', type: 'number' },
      { name: 'creditsSpent', type: 'number' },
    ],
  },
  // ─── Audit Log ─────────────────────────────────────────────────────
  {
    name: 'audit_log',
    type: 'base',
    schema: [
      { name: 'adminId', type: 'text', required: true },
      { name: 'action', type: 'text', required: true },
      { name: 'targetTable', type: 'text', required: true },
      { name: 'targetId', type: 'text' },
      { name: 'previousValue', type: 'json' },
      { name: 'newValue', type: 'json' },
      { name: 'ipAddress', type: 'text' },
    ],
    indexes: ['CREATE INDEX idx_audit_action ON audit_log (action);'],
  },
  // ─── Feature Flags ─────────────────────────────────────────────────
  {
    name: 'feature_flags',
    type: 'base',
    schema: [
      { name: 'key', type: 'text', required: true, unique: true },
      { name: 'description', type: 'text' },
      { name: 'isEnabled', type: 'bool' },
      { name: 'rolloutPercentage', type: 'number' },
    ],
  },
  // ─── Announcements ─────────────────────────────────────────────────
  {
    name: 'announcements',
    type: 'base',
    schema: [
      { name: 'title', type: 'text', required: true },
      { name: 'content', type: 'text', required: true },
      { name: 'priority', type: 'select', required: true, options: { values: ['info', 'warning', 'critical'] } },
      { name: 'startsAt', type: 'date' },
      { name: 'endsAt', type: 'date' },
      { name: 'isActive', type: 'bool' },
    ],
  },
  // ─── AI Usage Logs ─────────────────────────────────────────────────
  {
    name: 'ai_usage_logs',
    type: 'base',
    schema: [
      { name: 'userId', type: 'relation', options: { collectionId: '_pb_users_collection_' } },
      { name: 'agent', type: 'text', required: true },
      { name: 'model', type: 'text', required: true },
      { name: 'promptTokens', type: 'number' },
      { name: 'completionTokens', type: 'number' },
      { name: 'totalTokens', type: 'number' },
      { name: 'durationMs', type: 'number' },
    ],
    indexes: [
      'CREATE INDEX idx_ai_usage_created ON ai_usage_logs (created);',
      'CREATE INDEX idx_ai_usage_userId ON ai_usage_logs (userId);',
    ],
  },
  // ─── Admin Tasks ───────────────────────────────────────────────────
  {
    name: 'admin_tasks',
    type: 'base',
    schema: [
      { name: 'label', type: 'text', required: true },
      { name: 'completed', type: 'bool' },
    ],
  },
  // ─── Marketing Campaigns ───────────────────────────────────────────
  {
    name: 'marketing_campaigns',
    type: 'base',
    schema: [
      { name: 'title', type: 'text', required: true },
      { name: 'code', type: 'text', required: true, unique: true },
      { name: 'status', type: 'select', required: true, options: { values: ['active', 'paused'] } },
      { name: 'clicks', type: 'number' },
      { name: 'expiry', type: 'date', required: true },
    ],
  },
  // ─── User Session Activities ───────────────────────────────────────
  {
    name: 'user_session_activities',
    type: 'base',
    schema: [
      { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
      { name: 'ipAddress', type: 'text', required: true },
      { name: 'location', type: 'text' },
      { name: 'latitude', type: 'number' },
      { name: 'longitude', type: 'number' },
      { name: 'userAgent', type: 'text' },
    ],
  },
  // ─── Tool Usage Logs ───────────────────────────────────────────────
  {
    name: 'tool_usage_logs',
    type: 'base',
    schema: [
      { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
      { name: 'toolName', type: 'text', required: true },
      { name: 'action', type: 'text', required: true },
    ],
  },
  // ─── Membership Transactions ───────────────────────────────────────
  {
    name: 'membership_transactions',
    type: 'base',
    schema: [
      { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
      { name: 'orderId', type: 'text', required: true, unique: true },
      { name: 'planType', type: 'text', required: true },
      { name: 'amount', type: 'number', required: true },
      { name: 'currency', type: 'text' },
      { name: 'durationMonths', type: 'number', required: true },
      { name: 'paymentStatus', type: 'select', required: true, options: { values: ['pending', 'paid', 'failed', 'refunded', 'refund_pending'] } },
      { name: 'startsAt', type: 'date', required: true },
      { name: 'expiresAt', type: 'date', required: true },
    ],
    indexes: ['CREATE INDEX idx_mt_userId ON membership_transactions (userId);'],
  },
  // ─── User Membership Logs (Lifecycle) ──────────────────────────────
  {
    name: 'user_membership_logs',
    type: 'base',
    schema: [
      { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
      { name: 'fromPlan', type: 'text', required: true },
      { name: 'toPlan', type: 'text', required: true },
      { name: 'eventType', type: 'select', required: true, options: { values: ['activation', 'renewal', 'upgrade', 'downgrade', 'expiry', 'cancellation'] } },
      { name: 'source', type: 'select', required: true, options: { values: ['payment', 'admin', 'points_exchange', 'auto_expiry', 'promo'] } },
      { name: 'metadata', type: 'json' },
    ],
  },
  // ─── Blacklist Records ─────────────────────────────────────────────
  {
    name: 'blacklist_records',
    type: 'base',
    schema: [
      { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
      { name: 'action', type: 'select', required: true, options: { values: ['blacklisted', 'reactivated'] } },
      { name: 'reason', type: 'text' },
      { name: 'adminEmail', type: 'email' },
      { name: 'adminId', type: 'text' },
    ],
  },
  // ─── Membership Plans ──────────────────────────────────────────────
  {
    name: 'membership_plans',
    type: 'base',
    schema: [
      { name: 'planId', type: 'text', required: true, unique: true },
      { name: 'name', type: 'text', required: true },
      { name: 'description', type: 'text' },
      { name: 'priceINR', type: 'number', required: true },
      { name: 'durationMonths', type: 'number', required: true },
      { name: 'pointsExchange', type: 'number', required: true },
    ],
  },
  // ─── Support Tickets ───────────────────────────────────────────────
  {
    name: 'support_tickets',
    type: 'base',
    schema: [
      { name: 'ticketId', type: 'text', required: true, unique: true },
      { name: 'subject', type: 'text', required: true },
      { name: 'description', type: 'text', required: true },
      { name: 'status', type: 'select', required: true, options: { values: ['open', 'in_progress', 'resolved'] } },
      { name: 'priority', type: 'select', required: true, options: { values: ['P1', 'P2', 'P3', 'P4'] } },
      { name: 'userName', type: 'text', required: true },
      { name: 'userEmail', type: 'email', required: true },
      { name: 'customerId', type: 'relation', options: { collectionId: '_pb_users_collection_' } },
      { name: 'reason', type: 'text' },
      { name: 'ipAddress', type: 'text' },
      { name: 'location', type: 'text' },
      { name: 'country', type: 'text' },
      { name: 'userAgent', type: 'text' },
      { name: 'archivedAt', type: 'date' },
    ],
    indexes: ['CREATE INDEX idx_st_status ON support_tickets (status);'],
  },
  // ─── Ticket Messages ───────────────────────────────────────────────
  {
    name: 'ticket_messages',
    type: 'base',
    schema: [
      { name: 'ticketId', type: 'relation', required: true, options: { collectionId: 'support_tickets', cascadeDelete: true } },
      { name: 'senderId', type: 'text', required: true },
      { name: 'senderType', type: 'select', required: true, options: { values: ['customer', 'admin'] } },
      { name: 'message', type: 'text', required: true },
    ],
    indexes: ['CREATE INDEX idx_tm_ticketId ON ticket_messages (ticketId);'],
  },
  // ─── User FAQs ─────────────────────────────────────────────────────
  {
    name: 'user_faqs',
    type: 'base',
    schema: [
      { name: 'question', type: 'text', required: true },
      { name: 'answer', type: 'text', required: true },
      { name: 'views', type: 'number' },
    ],
  },
  // ─── Service Health ────────────────────────────────────────────────
  {
    name: 'service_health',
    type: 'base',
    schema: [
      { name: 'serviceKey', type: 'text', required: true, unique: true },
      { name: 'name', type: 'text', required: true },
      { name: 'status', type: 'select', required: true, options: { values: ['stable', 'normal', 'high_load', 'degraded', 'down'] } },
      { name: 'uptime', type: 'number' },
      { name: 'latencyMs', type: 'number' },
      { name: 'queueJobs', type: 'number' },
      { name: 'usagePercent', type: 'number' },
      { name: 'manualOverrideAt', type: 'date' },
    ],
  },
  // ─── Admin Documentation ───────────────────────────────────────────
  {
    name: 'admin_documentations',
    type: 'base',
    schema: [
      { name: 'title', type: 'text', required: true },
      { name: 'content', type: 'text', required: true },
      { name: 'category', type: 'text' },
    ],
  },
  // ─── Notifications ─────────────────────────────────────────────────
  {
    name: 'notifications',
    type: 'base',
    schema: [
      { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
      { name: 'type', type: 'text', required: true },
      { name: 'title', type: 'text', required: true },
      { name: 'body', type: 'text', required: true },
      { name: 'ticketId', type: 'text' },
      { name: 'isRead', type: 'bool' },
    ],
    indexes: ['CREATE INDEX idx_notif_user_read ON notifications (userId, isRead);'],
  },
  // ─── Admin Notifications ───────────────────────────────────────────
  {
    name: 'admin_notifications',
    type: 'base',
    schema: [
      { name: 'type', type: 'text', required: true },
      { name: 'title', type: 'text', required: true },
      { name: 'body', type: 'text', required: true },
      { name: 'ticketId', type: 'text' },
      { name: 'isRead', type: 'bool' },
    ],
    indexes: ['CREATE INDEX idx_admin_notif_read ON admin_notifications (isRead);'],
  },
  // ─── Offers ────────────────────────────────────────────────────────
  {
    name: 'offers',
    type: 'base',
    schema: [
      { name: 'title', type: 'text', required: true },
      { name: 'code', type: 'text', required: true, unique: true },
      { name: 'description', type: 'text' },
      { name: 'discountPercent', type: 'number' },
      { name: 'discountAmount', type: 'number' },
      { name: 'offerType', type: 'select', required: true, options: { values: ['GLOBAL', 'USER'] } },
      { name: 'userEmail', type: 'email' },
      { name: 'expiresAt', type: 'date', required: true },
      { name: 'isActive', type: 'bool' },
    ],
  },
  // ─── Chat Sessions ─────────────────────────────────────────────────
  {
    name: 'chat_sessions',
    type: 'base',
    schema: [
      { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
      { name: 'status', type: 'select', required: true, options: { values: ['open', 'closed', 'terminated', 'aborted'] } },
      { name: 'userName', type: 'text', required: true },
      { name: 'userEmail', type: 'email', required: true },
      { name: 'location', type: 'text' },
      { name: 'ipAddress', type: 'text' },
    ],
  },
  // ─── Chat Messages ─────────────────────────────────────────────────
  {
    name: 'chat_messages',
    type: 'base',
    schema: [
      { name: 'sessionId', type: 'relation', required: true, options: { collectionId: 'chat_sessions', cascadeDelete: true } },
      { name: 'senderType', type: 'select', required: true, options: { values: ['user', 'admin'] } },
      { name: 'content', type: 'text', required: true },
      { name: 'attachment', type: 'file' },
      { name: 'attachmentName', type: 'text' },
    ],
  },
  // ─── Sync Logs ─────────────────────────────────────────────────────
  {
    name: 'sync_logs',
    type: 'base',
    schema: [
      { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
      { name: 'action', type: 'text', required: true },
      { name: 'status', type: 'select', required: true, options: { values: ['success', 'failed', 'pending'] } },
      { name: 'details', type: 'text' },
    ],
  },
  // ─── Email Logs ────────────────────────────────────────────────────
  {
    name: 'email_logs',
    type: 'base',
    schema: [
      { name: 'to', type: 'email', required: true },
      { name: 'toName', type: 'text' },
      { name: 'subject', type: 'text', required: true },
      { name: 'body', type: 'text', required: true },
      { name: 'emailType', type: 'text', required: true },
      { name: 'status', type: 'select', required: true, options: { values: ['sent', 'failed'] } },
      { name: 'userId', type: 'text' },
      { name: 'errorMsg', type: 'text' },
    ],
    indexes: [
      'CREATE INDEX idx_el_type ON email_logs (emailType);',
      'CREATE INDEX idx_el_to ON email_logs (to);',
    ],
  },
  // ─── AI Cap Plans ──────────────────────────────────────────────────
  {
    name: 'ai_cap_plans',
    type: 'base',
    schema: [
      { name: 'name', type: 'text', required: true, unique: true },
      { name: 'label', type: 'text', required: true },
      { name: 'dailyTokenCap', type: 'number', required: true },
      { name: 'description', type: 'text' },
      { name: 'isActive', type: 'bool' },
    ],
  },
  // ─── User AI Caps ──────────────────────────────────────────────────
  {
    name: 'user_ai_caps',
    type: 'base',
    schema: [
      { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
      { name: 'planId', type: 'relation', required: true, options: { collectionId: 'ai_cap_plans', cascadeDelete: true } },
      { name: 'customDailyCap', type: 'number' },
      { name: 'assignedBy', type: 'text' },
    ],
    indexes: ['CREATE UNIQUE INDEX idx_uac_unique ON user_ai_caps (userId, planId);'],
  },
  // ─── AI Usage Daily Summaries ──────────────────────────────────────
  {
    name: 'ai_usage_daily_summaries',
    type: 'base',
    schema: [
      { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
      { name: 'date', type: 'text', required: true },
      { name: 'totalTokens', type: 'number' },
      { name: 'promptTokens', type: 'number' },
      { name: 'completionTokens', type: 'number' },
      { name: 'requestCount', type: 'number' },
      { name: 'agentBreakdown', type: 'json' },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_auds_unique ON ai_usage_daily_summaries (userId, date);',
      'CREATE INDEX idx_auds_date ON ai_usage_daily_summaries (date);',
    ],
  },
  // ─── AI Cap Rules ──────────────────────────────────────────────────
  {
    name: 'ai_cap_rules',
    type: 'base',
    schema: [
      { name: 'name', type: 'text', required: true, unique: true },
      { name: 'description', type: 'text' },
      { name: 'isActive', type: 'bool' },
      { name: 'matchType', type: 'select', required: true, options: { values: ['email_exact', 'email_domain', 'email_regex', 'ip_exact', 'ip_cidr', 'location_country', 'location_city'] } },
      { name: 'matchValue', type: 'text', required: true },
      { name: 'capType', type: 'select', required: true, options: { values: ['daily_tokens', 'daily_requests', 'block'] } },
      { name: 'capValue', type: 'number', required: true },
      { name: 'agentFilter', type: 'text' },
      { name: 'priority', type: 'number' },
      { name: 'createdBy', type: 'text' },
      { name: 'hitCount', type: 'number' },
      { name: 'lastHitAt', type: 'date' },
    ],
    indexes: ['CREATE INDEX idx_acr_active_priority ON ai_cap_rules (isActive, priority);'],
  },
  // ─── Anomaly Alerts ───────────────────────────────────────────────
  {
    name: 'anomaly_alerts',
    type: 'base',
    schema: [
      { name: 'type', type: 'text', required: true },
      { name: 'severity', type: 'select', required: true, options: { values: ['low', 'medium', 'high', 'critical'] } },
      { name: 'title', type: 'text', required: true },
      { name: 'description', type: 'text' },
      { name: 'entityType', type: 'text' },
      { name: 'entityId', type: 'text' },
      { name: 'entityLabel', type: 'text' },
      { name: 'metadata', type: 'json' },
      { name: 'source', type: 'select', required: true, options: { values: ['auto_detect', 'admin_report', 'system'] } },
      { name: 'status', type: 'select', required: true, options: { values: ['open', 'investigating', 'resolved', 'dismissed'] } },
      { name: 'detectorKey', type: 'text' },
      { name: 'resolvedBy', type: 'text' },
      { name: 'resolvedAt', type: 'date' },
    ],
    indexes: [
      'CREATE INDEX idx_aa_type_status ON anomaly_alerts (type, status);',
      'CREATE INDEX idx_aa_severity_status ON anomaly_alerts (severity, status);',
    ],
  },
  // ─── Tax Rules ──────────────────────────────────────────────────────
  {
    name: 'tax_rules',
    type: 'base',
    schema: [
      { name: 'region', type: 'text', required: true },
      { name: 'jurisdiction', type: 'text' },
      { name: 'taxType', type: 'text', required: true },
      { name: 'rate', type: 'number', required: true },
      { name: 'threshold', type: 'text' },
      { name: 'status', type: 'text' },
      { name: 'isActive', type: 'bool' },
      { name: 'createdBy', type: 'text' },
    ],
  },
  // ─── Tax Transactions ──────────────────────────────────────────────
  {
    name: 'tax_transactions',
    type: 'base',
    schema: [
      { name: 'userId', type: 'text', required: true },
      { name: 'transactionId', type: 'text' },
      { name: 'amount', type: 'number', required: true },
      { name: 'taxAmount', type: 'number', required: true },
      { name: 'taxRate', type: 'number', required: true },
      { name: 'taxType', type: 'text', required: true },
      { name: 'region', type: 'text', required: true },
      { name: 'jurisdiction', type: 'text' },
      { name: 'isExempt', type: 'bool' },
      { name: 'exemptionReason', type: 'text' },
      { name: 'transactionDate', type: 'date' },
    ],
    indexes: [
      'CREATE INDEX idx_tt_userId ON tax_transactions (userId);',
      'CREATE INDEX idx_tt_region ON tax_transactions (region);',
    ],
  },
  // ─── Tax Filings ────────────────────────────────────────────────────
  {
    name: 'tax_filings',
    type: 'base',
    schema: [
      { name: 'region', type: 'text', required: true },
      { name: 'jurisdiction', type: 'text' },
      { name: 'taxType', type: 'text', required: true },
      { name: 'dueDate', type: 'date', required: true },
      { name: 'status', type: 'text' },
      { name: 'totalTax', type: 'number' },
      { name: 'totalAmount', type: 'number' },
      { name: 'dataValidation', type: 'number' },
      { name: 'filedAt', type: 'date' },
    ],
    indexes: ['CREATE INDEX idx_tf_region ON tax_filings (region);'],
  },
  // ─── User Sessions ─────────────────────────────────────────────────
  {
    name: 'user_sessions',
    type: 'base',
    schema: [
      { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
      { name: 'sessionToken', type: 'text', required: true, unique: true },
      { name: 'machineId', type: 'text', required: true },
      { name: 'ipAddress', type: 'text' },
      { name: 'location', type: 'text' },
      { name: 'userAgent', type: 'text' },
      { name: 'lastActiveAt', type: 'date' },
      { name: 'expiresAt', type: 'date', required: true },
    ],
    indexes: ['CREATE INDEX idx_us_userId_lastActive ON user_sessions (userId, lastActiveAt);'],
  },

  // ─── Verification Tokens (Password Recovery) ───────────────
  {
    name: 'verification_tokens',
    type: 'base',
    schema: [
      { name: 'identifier', type: 'email', required: true },
      { name: 'token', type: 'text', required: true, unique: true },
      { name: 'expires', type: 'date', required: true },
    ],
  },

  // ─── Promo Codes ───────────────────────────────────────────
  {
    name: 'promo_codes',
    type: 'base',
    schema: [
      { name: 'code', type: 'text', required: true, unique: true },
      { name: 'discountPercent', type: 'number' },
      { name: 'discountAmount', type: 'number' },
      { name: 'maxUses', type: 'number' },
      { name: 'currentUses', type: 'number' },
      { name: 'expiresAt', type: 'date' },
      { name: 'isActive', type: 'bool' },
      { name: 'userId', type: 'relation', options: { collectionId: '_pb_users_collection_' } },
    ],
  },

  // ─── Currency Rates ─────────────────────────────────────────
  {
    name: 'currency_rates',
    type: 'base',
    schema: [
      { name: 'fromCurrency', type: 'text', required: true },
      { name: 'toCurrency', type: 'text', required: true },
      { name: 'rate', type: 'number', required: true },
      { name: 'updatedAt', type: 'date' },
    ],
  },

  // ─── Histories (Project/Session history) ────────────────────
  {
    name: 'histories',
    type: 'base',
    schema: [
      { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
      { name: 'action', type: 'text', required: true },
      { name: 'details', type: 'json' },
      { name: 'projectId', type: 'relation', options: { collectionId: 'projects' } },
    ],
  },

  // ─── Admin Users ────────────────────────────────────────────
  {
    name: 'admin_users',
    type: 'base',
    schema: [
      { name: 'email', type: 'email', required: true },
      { name: 'name', type: 'text' },
      { name: 'passwordHash', type: 'text' },
      { name: 'role', type: 'select', options: { values: ['editor', 'admin', 'superadmin'] } },
      { name: 'isActive', type: 'bool' },
    ],
  },

  // ─── Cashfree Orders ────────────────────────────────────────
  {
    name: 'cashfree_orders',
    type: 'base',
    schema: [
      { name: 'orderId', type: 'text', required: true },
      { name: 'orderAmount', type: 'number', required: true },
      { name: 'orderCurrency', type: 'text' },
      { name: 'orderStatus', type: 'text' },
      { name: 'paymentSessionId', type: 'text' },
      { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_' } },
      { name: 'membershipPlan', type: 'text' },
      { name: 'pointsAmount', type: 'number' },
      { name: 'paymentMethod', type: 'text' },
      { name: 'bankReference', type: 'text' },
    ],
  },

  // ─── Admin Live Status ──────────────────────────────────────
  {
    name: 'admin_live_status',
    type: 'base',
    schema: [
      { name: 'isLive', type: 'bool' },
      { name: 'lastSeenAt', type: 'date' },
    ],
  },
  // ─── Layout Settings ───────────────────────────────────────────────
  {
    name: 'layout_settings',
    type: 'base',
    schema: [
      { name: 'userId', type: 'text', required: true, unique: true },
      { name: 'pages', type: 'json' },
      { name: 'windows', type: 'json' },
      { name: 'panels', type: 'json' },
      { name: 'cards', type: 'json' },
    ],
    indexes: ['CREATE UNIQUE INDEX idx_ls_userId ON layout_settings (userId);'],
  },
  // ─── General Queries ───────────────────────────────────────────────
  {
    name: 'general_queries',
    type: 'base',
    schema: [
      { name: 'name', type: 'text', required: true },
      { name: 'email', type: 'email', required: true },
      { name: 'phone', type: 'text' },
      { name: 'subject', type: 'text', required: true },
      { name: 'message', type: 'text', required: true },
      { name: 'isRead', type: 'bool' },
      { name: 'status', type: 'text' },
      { name: 'reply', type: 'text' },
    ],
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '', // public can create
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
    indexes: ['CREATE INDEX idx_gq_isRead ON general_queries (isRead);', 'CREATE INDEX idx_gq_created ON general_queries (created);'],
  },
  // ─── Term Acceptances ──────────────────────────────────────────────
  {
    name: 'term_acceptances',
    type: 'base',
    schema: [
      { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
      { name: 'acceptedAt', type: 'date', required: true },
      { name: 'ipAddress', type: 'text' },
      { name: 'userAgent', type: 'text' },
    ],
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '', // public can create during signup
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
    indexes: ['CREATE INDEX idx_ta_userId ON term_acceptances (userId);'],
  },
  // ─── Banners ───────────────────────────────────────────────────────
  {
    name: 'banners',
    type: 'base',
    schema: [
      { name: 'title', type: 'text', required: true },
      { name: 'subtitle', type: 'text' },
      { name: 'imageUrl', type: 'text', required: true },
      { name: 'linkUrl', type: 'text' },
      { name: 'isActive', type: 'bool' },
      { name: 'sortOrder', type: 'number' },
    ],
    listRule: '', // public read
    viewRule: '', // public read
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
    indexes: ['CREATE INDEX idx_b_active_sort ON banners (isActive, sortOrder);'],
  },
  // ─── Testimonials ──────────────────────────────────────────────────
  {
    name: 'testimonials',
    type: 'base',
    schema: [
      { name: 'name', type: 'text', required: true },
      { name: 'role', type: 'text' },
      { name: 'avatarUrl', type: 'text' },
      { name: 'content', type: 'text', required: true },
      { name: 'rating', type: 'number' },
      { name: 'isActive', type: 'bool' },
      { name: 'sortOrder', type: 'number' },
    ],
    listRule: '', // public read
    viewRule: '', // public read
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
    indexes: ['CREATE INDEX idx_t_active_sort ON testimonials (isActive, sortOrder);'],
  },
];

async function main() {
  console.log(`Connecting to PocketBase at ${PB_URL}...`);
  const pb = new PocketBase(PB_URL);

  try {
    await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log('Admin authenticated.');
  } catch (err) {
    console.error('Failed to authenticate as admin. Make sure PocketBase is running and the admin account exists.');
    console.error('Visit http://127.0.0.1:8090/_/ to create the admin account.');
    process.exit(1);
  }

  // Get existing collections to avoid duplicates
  const existingCollections = await pb.collections.getFullList();
  const existingNames = new Set(existingCollections.map((c: any) => c.name));

  // Fetch the actual users collection ID for relation references
  const usersCollection = existingCollections.find((c: any) => c.name === 'users');
  if (!usersCollection) {
    console.error('The built-in "users" collection was not found. PocketBase might not be set up correctly.');
    process.exit(1);
  }
  const usersCollectionId = usersCollection.id;

  console.log(`\nFound ${existingCollections.length} existing collections. Users collection ID: ${usersCollectionId}\n`);

  // Extend users collection with custom fields
  console.log('Extending users collection with custom fields...');
  const existingUserFields = new Set((usersCollection as any).schema?.map((f: any) => f.name) || []);
  const userFieldsToAdd: FieldDef[] = [
    { name: 'points', type: 'number' },
    { name: 'theme', type: 'text' },
    { name: 'status', type: 'select', options: { values: ['active', 'blacklisted', 'abnormal'] } },
    { name: 'role', type: 'select', options: { values: ['user', 'admin', 'editor'] } },
    { name: 'blockedUntil', type: 'date' },
    { name: 'blacklistReason', type: 'text' },
    { name: 'membership', type: 'text' },
    { name: 'membershipExpiresAt', type: 'date' },
    { name: 'aiDailyCapOverride', type: 'number' },
    { name: 'aiAgentReactivatesAt', type: 'date' },
    { name: 'aiCapPlanId', type: 'relation', options: { collectionId: '' } },
  ];

  const newSchema: any[] = [...((usersCollection as any).schema || [])];
  for (const field of userFieldsToAdd) {
    if (!existingUserFields.has(field.name)) {
      const f: any = { name: field.name, type: field.type, required: false, unique: false };
      if (field.options) f.options = field.options;
      newSchema.push(f);
      console.log(`  + Added field: ${field.name} (${field.type})`);
    }
  }
  await pb.collections.update(usersCollectionId, { schema: newSchema });
  console.log('  Users collection updated.\n');

  // Create base collections
  for (const def of COLLECTIONS) {
    const name = def.name;
    if (existingNames.has(name)) {
      console.log(`  Syncing rules and schema for existing collection ${name}...`);
      try {
        const existing = await pb.collections.getOne(name);
        const existingFields = new Set((existing as any).schema?.map((f: any) => f.name) || []);
        const newSchema = [...((existing as any).schema || [])];
        for (const field of def.schema) {
          if (!existingFields.has(field.name)) {
            const f: any = { name: field.name, type: field.type, required: field.required || false, unique: field.unique || false };
            if (field.options) {
              f.options = { ...field.options };
              if (f.options.collectionId === '_pb_users_collection_') {
                f.options.collectionId = usersCollectionId;
              }
            }
            newSchema.push(f);
            console.log(`  + Added missing field: ${field.name} (${field.type}) to existing collection ${name}`);
          }
        }
        await pb.collections.update(existing.id, {
          schema: newSchema,
          listRule: def.listRule !== undefined ? def.listRule : existing.listRule,
          viewRule: def.viewRule !== undefined ? def.viewRule : existing.viewRule,
          createRule: def.createRule !== undefined ? def.createRule : existing.createRule,
          updateRule: def.updateRule !== undefined ? def.updateRule : existing.updateRule,
          deleteRule: def.deleteRule !== undefined ? def.deleteRule : existing.deleteRule,
        });
      } catch (err: any) {
        console.warn(`    Failed to sync collection ${name}: ${err.message || err}`);
      }
      continue;
    }

    console.log(`  Creating ${name}...`);
    const fields = def.schema.map((f: FieldDef) => {
      const field: any = { name: f.name, type: f.type, required: f.required || false, unique: f.unique || false };
      if (f.options) {
        field.options = { ...f.options };
        // Fix relation references - replace placeholder with actual users collection ID
        if (field.options.collectionId === '_pb_users_collection_') {
          field.options.collectionId = usersCollectionId;
        }
      }
      return field;
    });

    try {
      const created = await pb.collections.create({
        name: def.name,
        type: def.type,
        fields,
        listRule: def.listRule !== undefined ? def.listRule : null,
        viewRule: def.viewRule !== undefined ? def.viewRule : null,
        createRule: def.createRule !== undefined ? def.createRule : null,
        updateRule: def.updateRule !== undefined ? def.updateRule : null,
        deleteRule: def.deleteRule !== undefined ? def.deleteRule : null,
      });
      console.log(`    OK (id: ${created.id})`);

      // Create indexes
      if (def.indexes) {
        for (const idxSql of def.indexes) {
          try {
            await pb.send(`/api/collections/${created.id}/indexes`, {
              method: 'POST',
              body: { expression: idxSql },
            });
          } catch (idxErr: any) {
            console.warn(`    Index warning: ${idxErr.message || idxErr}`);
          }
        }
      }
    } catch (err: any) {
      console.error(`    FAILED: ${err.message || err}`);
    }
  }

  // ─── Seed default data ─────────────────────────────────────────────

  console.log('\nSeeding default data...');

  // Membership Plans
  const existingPlans = await pb.collection('membership_plans').getFullList();
  if (existingPlans.length === 0) {
    const defaultPlans = [
      { planId: 'premium_1m', name: 'Premium Monthly', priceINR: 250, durationMonths: 1, pointsExchange: 250, description: '1 Month Premium Access' },
      { planId: 'premium_3m', name: 'Premium Quarterly', priceINR: 600, durationMonths: 3, pointsExchange: 500, description: '3 Months Premium Access' },
      { planId: 'premium_6m', name: 'Premium Biannual', priceINR: 1000, durationMonths: 6, pointsExchange: 1000, description: '6 Months Premium Access' },
      { planId: 'premium_12m', name: 'Premium Annual', priceINR: 2200, durationMonths: 12, pointsExchange: 2200, description: '12 Months Premium Access' },
    ];
    for (const plan of defaultPlans) {
      await pb.collection('membership_plans').create(plan);
      console.log(`  + Membership plan: ${plan.planId}`);
    }
  }

  // AI Cap Plans
  const existingCapPlans = await pb.collection('ai_cap_plans').getFullList();
  if (existingCapPlans.length === 0) {
    const defaultCapPlans = [
      { name: 'free', label: 'Free Tier', dailyTokenCap: 50000, isActive: true, description: 'Default free plan — 50K tokens/day' },
      { name: 'pro', label: 'Pro Plan', dailyTokenCap: 200000, isActive: true, description: 'Pro plan — 200K tokens/day' },
      { name: 'enterprise', label: 'Enterprise', dailyTokenCap: 1000000, isActive: true, description: 'Enterprise — 1M tokens/day' },
    ];
    for (const plan of defaultCapPlans) {
      await pb.collection('ai_cap_plans').create(plan);
      console.log(`  + AI Cap Plan: ${plan.name}`);
    }
  }

  // Service Health
  const existingServices = await pb.collection('service_health').getFullList();
  if (existingServices.length === 0) {
    const services = [
      { serviceKey: 'latex_editor', name: 'LaTeX Editor', status: 'stable', uptime: 99.98 },
      { serviceKey: 'doc2latex', name: 'Doc2Latex Converter', status: 'stable', uptime: 99.9, latencyMs: 142 },
      { serviceKey: 'template_migrator', name: 'Template Migrator', status: 'normal', uptime: 99.9, queueJobs: 12 },
      { serviceKey: 'ai_diagram', name: 'AI Diagram Generator', status: 'high_load', uptime: 99.9, usagePercent: 84 },
      { serviceKey: 'ai_reviewer', name: 'AI Peer Reviewer', status: 'stable', uptime: 99.95 },
      { serviceKey: 'citation_studio', name: 'Citation Studio', status: 'stable', uptime: 99.99 },
    ];
    for (const svc of services) {
      await pb.collection('service_health').create(svc);
      console.log(`  + Service: ${svc.serviceKey}`);
    }
  }

  // Banners
  const existingBanners = await pb.collection('banners').getFullList();
  if (existingBanners.length === 0) {
    const defaultBanners = [
      { title: 'Welcome to Latexify', subtitle: 'The modern, intelligent platform for the entire research writing lifecycle.', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAfrx0rEK6VFLoe2g-XBz3W3v-F9ySny3wIO0GvOU4er61lUuTBVHvwYLUuqIs0AJoAKS007oi-Eol9Htta-GTRBF4xxAzzuqQgAhgqDtjr8p6Z7Q6hg2CSB3wQNqCGWWMQXkcp8v6Lso_Le622A3nyeH7Lev3cMioXKpnxZKCMHLPVS0ExSKUiPxYmzKIWcN6Coo758Jx_tmEY5RDPLzN1a48mBPKfpqaAgI6i5xGtO4pQLyEzyTTvYn2VnmuYr49zlqcD5RuJ2VLq', linkUrl: '/latex-studio', isActive: true, sortOrder: 1 },
      { title: 'AI Peer Reviewer', subtitle: 'Get instant, scholarly feedback on clarity, argumentation, and methodology.', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAfrx0rEK6VFLoe2g-XBz3W3v-F9ySny3wIO0GvOU4er61lUuTBVHvwYLUuqIs0AJoAKS007oi-Eol9Htta-GTRBF4xxAzzuqQgAhgqDtjr8p6Z7Q6hg2CSB3wQNqCGWWMQXkcp8v6Lso_Le622A3nyeH7Lev3cMioXKpnxZKCMHLPVS0ExSKUiPxYmzKIWcN6Coo758Jx_tmEY5RDPLzN1a48mBPKfpqaAgI6i5xGtO4pQLyEzyTTvYn2VnmuYr49zlqcD5RuJ2VLq', linkUrl: '/reviewer', isActive: true, sortOrder: 2 },
      { title: 'Create TikZ Diagrams visually', subtitle: 'Create beautiful TikZ diagrams with an intuitive visual canvas. No more coordinate wrestling.', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCOfpdp7avfxHVymJ06UtjZny3PXYwWBlHy4rpi8PV7-YGXFfygei_YZV65NdCKAQfE4DuhwJVAdCrE4-JoRKmljz10dSgkNXgv5F3blSGIPbm-6vQRe0_OrtZzV49Mxi7nwF-XXZzkzf8YjZrLYr2o4KLZflRtfrY3WY0NNTblCY-q7F0rLGOfjwoHMxC6LNP6KqqBj_jnRgs7NOX4Me-ldmMJtt38-V4YCjxpmuUxTRgfP3TncR6coVeklb0q5ABJYPH4zCIbqmoe', linkUrl: '/diagrams', isActive: true, sortOrder: 3 }
    ];
    for (const banner of defaultBanners) {
      await pb.collection('banners').create(banner);
      console.log(`  + Banner: ${banner.title}`);
    }
  }

  // Testimonials
  const existingTestimonials = await pb.collection('testimonials').getFullList();
  if (existingTestimonials.length === 0) {
    const defaultTestimonials = [
      { name: 'Dr. Elena Rostova', role: 'Postdoctoral Fellow, MIT', content: 'Latexify\'s template migrator saved me weeks of reformatting when my paper was transferred between journals. The UI is incredibly clean.', rating: 5, isActive: true, sortOrder: 1 },
      { name: 'James Chen', role: 'PhD Candidate, Stanford University', content: 'The AI Peer Reviewer caught several logical gaps in my methodology section before submission. An absolute game-changer for solo researchers.', rating: 5, isActive: true, sortOrder: 2 },
      { name: 'Prof. Sarah Jenkins', role: 'Principal Investigator, University of Oxford', content: 'I\'ve moved my entire lab to Latexify. Collaborative writing is finally seamless, and the Doc2Latex feature means my undergrads can contribute easily.', rating: 5, isActive: true, sortOrder: 3 }
    ];
    for (const t of defaultTestimonials) {
      await pb.collection('testimonials').create(t);
      console.log(`  + Testimonial: ${t.name}`);
    }
  }

  console.log('\n✓ PocketBase setup complete!');
  console.log(`  Admin UI: ${PB_URL}/_/`);
  console.log(`  API: ${PB_URL}/api/`);
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
