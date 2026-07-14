import PocketBase from 'pocketbase';
import bcrypt from 'bcryptjs';


const PB_URL = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || 'admin@latexify.io';
let _setupPwd = process.env.POCKETBASE_ADMIN_PASSWORD;
if (_setupPwd === 'admin123456') _setupPwd = undefined; // Ignore stale old default
const ADMIN_PASSWORD = _setupPwd || 'Sczone@123';

const COLLECTIONS = [
  { name: 'projects', type: 'base', schema: [
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
  ], indexes: ['CREATE INDEX idx_projects_userId ON projects (userId);'] },
  { name: 'project_files', type: 'base', schema: [
    { name: 'projectId', type: 'relation', required: true, options: { collectionId: 'projects', cascadeDelete: true } },
    { name: 'filename', type: 'text', required: true },
    { name: 'file', type: 'file' },
    { name: 'fileType', type: 'text' },
    { name: 'size', type: 'number' },
    { name: 'content', type: 'editor' },
  ], indexes: ['CREATE UNIQUE INDEX idx_project_files_unique ON project_files (projectId, filename);'] },
  { name: 'project_collaborators', type: 'base', schema: [
    { name: 'projectId', type: 'relation', required: true, options: { collectionId: 'projects', cascadeDelete: true } },
    { name: 'userEmail', type: 'email', required: true },
    { name: 'role', type: 'select', required: true, options: { values: ['viewer', 'editor', 'owner'] } },
  ], indexes: ['CREATE UNIQUE INDEX idx_project_collab_unique ON project_collaborators (projectId, userEmail);'] },
  { name: 'templates', type: 'base', schema: [
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
  ] },
  { name: 'share_links', type: 'base', schema: [
    { name: 'projectId', type: 'relation', required: true, options: { collectionId: 'projects', cascadeDelete: true } },
    { name: 'shareToken', type: 'text', required: true, unique: true },
    { name: 'expiresAt', type: 'date' },
  ] },
  { name: 'point_transactions', type: 'base', schema: [
    { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
    { name: 'amount', type: 'number', required: true },
    { name: 'type', type: 'select', required: true, options: { values: ['recharge', 'deduct', 'exchange'] } },
    { name: 'description', type: 'text' },
  ], indexes: ['CREATE INDEX idx_pt_userId ON point_transactions (userId);'] },
  { name: 'citation_projects', type: 'base', schema: [
    { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
    { name: 'name', type: 'text' },
    { name: 'style', type: 'text' },
  ] },
  { name: 'citations', type: 'base', schema: [
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
  ] },
  { name: 'paper_reviews', type: 'base', schema: [
    { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
    { name: 'title', type: 'text', required: true },
    { name: 'fileType', type: 'text', required: true },
    { name: 'overallScore', type: 'number', required: true },
    { name: 'reviewJson', type: 'json', required: true },
    { name: 'journalsJson', type: 'json', required: true },
  ] },
  { name: 'report_history', type: 'base', schema: [
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
  ] },
  { name: 'journal_registry', type: 'base', schema: [
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
  ] },
  { name: 'platform_stats', type: 'base', schema: [
    { name: 'date', type: 'text', required: true, unique: true },
    { name: 'totalUsers', type: 'number' },
    { name: 'activeUsers24h', type: 'number' },
    { name: 'totalProjects', type: 'number' },
    { name: 'totalReviews', type: 'number' },
    { name: 'creditsDistributed', type: 'number' },
    { name: 'creditsSpent', type: 'number' },
  ] },
  { name: 'audit_log', type: 'base', schema: [
    { name: 'adminId', type: 'text', required: true },
    { name: 'action', type: 'text', required: true },
    { name: 'targetTable', type: 'text', required: true },
    { name: 'targetId', type: 'text' },
    { name: 'previousValue', type: 'json' },
    { name: 'newValue', type: 'json' },
    { name: 'ipAddress', type: 'text' },
  ], indexes: ['CREATE INDEX idx_audit_action ON audit_log (action);'] },
  { name: 'feature_flags', type: 'base', schema: [
    { name: 'key', type: 'text', required: true, unique: true },
    { name: 'description', type: 'text' },
    { name: 'isEnabled', type: 'bool' },
    { name: 'rolloutPercentage', type: 'number' },
  ] },
  { name: 'announcements', type: 'base', schema: [
    { name: 'title', type: 'text', required: true },
    { name: 'content', type: 'text', required: true },
    { name: 'priority', type: 'select', required: true, options: { values: ['info', 'warning', 'critical'] } },
    { name: 'startsAt', type: 'date' },
    { name: 'endsAt', type: 'date' },
    { name: 'isActive', type: 'bool' },
  ] },
  { name: 'ai_usage_logs', type: 'base', schema: [
    { name: 'userId', type: 'relation', options: { collectionId: '_pb_users_collection_' } },
    { name: 'agent', type: 'text', required: true },
    { name: 'model', type: 'text', required: true },
    { name: 'promptTokens', type: 'number' },
    { name: 'completionTokens', type: 'number' },
    { name: 'totalTokens', type: 'number' },
    { name: 'durationMs', type: 'number' },
  ], indexes: ['CREATE INDEX idx_ai_usage_created ON ai_usage_logs (created);', 'CREATE INDEX idx_ai_usage_userId ON ai_usage_logs (userId);'] },
  { name: 'admin_tasks', type: 'base', schema: [
    { name: 'label', type: 'text', required: true },
    { name: 'completed', type: 'bool' },
  ] },
  { name: 'marketing_campaigns', type: 'base', schema: [
    { name: 'title', type: 'text', required: true },
    { name: 'code', type: 'text', required: true, unique: true },
    { name: 'status', type: 'select', required: true, options: { values: ['active', 'paused'] } },
    { name: 'clicks', type: 'number' },
    { name: 'expiry', type: 'date', required: true },
  ] },
  { name: 'user_session_activities', type: 'base', schema: [
    { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
    { name: 'ipAddress', type: 'text', required: true },
    { name: 'location', type: 'text' },
    { name: 'userAgent', type: 'text' },
  ] },
  { name: 'tool_usage_logs', type: 'base', schema: [
    { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
    { name: 'toolName', type: 'text', required: true },
    { name: 'action', type: 'text', required: true },
  ] },
  { name: 'membership_transactions', type: 'base', schema: [
    { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
    { name: 'orderId', type: 'text', required: true, unique: true },
    { name: 'planType', type: 'text', required: true },
    { name: 'amount', type: 'number', required: true },
    { name: 'currency', type: 'text' },
    { name: 'durationMonths', type: 'number', required: true },
    { name: 'paymentStatus', type: 'select', required: true, options: { values: ['pending', 'paid', 'failed'] } },
    { name: 'startsAt', type: 'date' },
    { name: 'expiresAt', type: 'date', required: true },
  ], indexes: ['CREATE INDEX idx_mt_userId ON membership_transactions (userId);'] },
  { name: 'blacklist_records', type: 'base', schema: [
    { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
    { name: 'action', type: 'select', required: true, options: { values: ['blacklisted', 'reactivated'] } },
    { name: 'reason', type: 'text' },
    { name: 'adminEmail', type: 'email' },
    { name: 'adminId', type: 'text' },
  ] },
  { name: 'membership_plans', type: 'base', schema: [
    { name: 'planId', type: 'text', required: true, unique: true },
    { name: 'name', type: 'text', required: true },
    { name: 'description', type: 'text' },
    { name: 'priceINR', type: 'number', required: true },
    { name: 'durationMonths', type: 'number', required: true },
    { name: 'pointsExchange', type: 'number', required: true },
  ] },
  { name: 'support_tickets', type: 'base', schema: [
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
  ], indexes: ['CREATE INDEX idx_st_status ON support_tickets (status);'] },
  { name: 'ticket_messages', type: 'base', schema: [
    { name: 'ticketId', type: 'relation', required: true, options: { collectionId: 'support_tickets', cascadeDelete: true } },
    { name: 'senderId', type: 'text', required: true },
    { name: 'senderType', type: 'select', required: true, options: { values: ['customer', 'admin'] } },
    { name: 'message', type: 'text', required: true },
  ], indexes: ['CREATE INDEX idx_tm_ticketId ON ticket_messages (ticketId);'] },
  { name: 'user_faqs', type: 'base', schema: [
    { name: 'question', type: 'text', required: true },
    { name: 'answer', type: 'text', required: true },
    { name: 'views', type: 'number' },
  ] },
  { name: 'service_health', type: 'base', schema: [
    { name: 'serviceKey', type: 'text', required: true, unique: true },
    { name: 'name', type: 'text', required: true },
    { name: 'status', type: 'select', required: true, options: { values: ['stable', 'normal', 'high_load', 'degraded', 'down'] } },
    { name: 'uptime', type: 'number' },
    { name: 'latencyMs', type: 'number' },
    { name: 'queueJobs', type: 'number' },
    { name: 'usagePercent', type: 'number' },
    { name: 'manualOverrideAt', type: 'date' },
  ] },
  { name: 'admin_documentations', type: 'base', schema: [
    { name: 'title', type: 'text', required: true },
    { name: 'content', type: 'text', required: true },
    { name: 'category', type: 'text' },
  ] },
  { name: 'notifications', type: 'base', schema: [
    { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
    { name: 'type', type: 'text', required: true },
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'text', required: true },
    { name: 'ticketId', type: 'text' },
    { name: 'isRead', type: 'bool' },
  ], indexes: ['CREATE INDEX idx_notif_user_read ON notifications (userId, isRead);'] },
  { name: 'admin_notifications', type: 'base', schema: [
    { name: 'type', type: 'text', required: true },
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'text', required: true },
    { name: 'ticketId', type: 'text' },
    { name: 'isRead', type: 'bool' },
  ], indexes: ['CREATE INDEX idx_admin_notif_read ON admin_notifications (isRead);'] },
  { name: 'offers', type: 'base', schema: [
    { name: 'title', type: 'text', required: true },
    { name: 'code', type: 'text', required: true, unique: true },
    { name: 'description', type: 'text' },
    { name: 'discountPercent', type: 'number' },
    { name: 'discountAmount', type: 'number' },
    { name: 'offerType', type: 'select', required: true, options: { values: ['GLOBAL', 'USER'] } },
    { name: 'userEmail', type: 'email' },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'isActive', type: 'bool' },
  ] },
  { name: 'chat_sessions', type: 'base', schema: [
    { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
    { name: 'status', type: 'select', required: true, options: { values: ['open', 'closed', 'terminated', 'aborted'] } },
    { name: 'userName', type: 'text', required: true },
    { name: 'userEmail', type: 'email', required: true },
    { name: 'location', type: 'text' },
    { name: 'ipAddress', type: 'text' },
  ] },
  { name: 'chat_messages', type: 'base', schema: [
    { name: 'sessionId', type: 'relation', required: true, options: { collectionId: 'chat_sessions', cascadeDelete: true } },
    { name: 'senderType', type: 'select', required: true, options: { values: ['user', 'admin'] } },
    { name: 'content', type: 'text', required: true },
    { name: 'attachment', type: 'file' },
    { name: 'attachmentName', type: 'text' },
  ] },
  { name: 'sync_logs', type: 'base', schema: [
    { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
    { name: 'action', type: 'text', required: true },
    { name: 'status', type: 'select', required: true, options: { values: ['success', 'failed', 'pending'] } },
    { name: 'details', type: 'text' },
  ] },
  { name: 'email_logs', type: 'base', schema: [
    { name: 'to', type: 'email', required: true },
    { name: 'toName', type: 'text' },
    { name: 'subject', type: 'text', required: true },
    { name: 'body', type: 'text', required: true },
    { name: 'emailType', type: 'text', required: true },
    { name: 'status', type: 'select', required: true, options: { values: ['sent', 'failed'] } },
    { name: 'userId', type: 'text' },
    { name: 'errorMsg', type: 'text' },
  ], indexes: ['CREATE INDEX idx_el_type ON email_logs (emailType);', 'CREATE INDEX idx_el_to ON email_logs (to);'] },
  { name: 'ai_cap_plans', type: 'base', schema: [
    { name: 'name', type: 'text', required: true, unique: true },
    { name: 'label', type: 'text', required: true },
    { name: 'dailyTokenCap', type: 'number', required: true },
    { name: 'description', type: 'text' },
    { name: 'isActive', type: 'bool' },
  ] },
  { name: 'user_ai_caps', type: 'base', schema: [
    { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
    { name: 'planId', type: 'relation', required: true, options: { collectionId: 'ai_cap_plans', cascadeDelete: true } },
    { name: 'customDailyCap', type: 'number' },
    { name: 'assignedBy', type: 'text' },
  ], indexes: ['CREATE UNIQUE INDEX idx_uac_unique ON user_ai_caps (userId, planId);'] },
  { name: 'ai_usage_daily_summaries', type: 'base', schema: [
    { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
    { name: 'date', type: 'text', required: true },
    { name: 'totalTokens', type: 'number' },
    { name: 'promptTokens', type: 'number' },
    { name: 'completionTokens', type: 'number' },
    { name: 'requestCount', type: 'number' },
    { name: 'agentBreakdown', type: 'json' },
  ], indexes: ['CREATE UNIQUE INDEX idx_auds_unique ON ai_usage_daily_summaries (userId, date);', 'CREATE INDEX idx_auds_date ON ai_usage_daily_summaries (date);'] },
  { name: 'ai_cap_rules', type: 'base', schema: [
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
  ], indexes: ['CREATE INDEX idx_acr_active_priority ON ai_cap_rules (isActive, priority);'] },
  { name: 'user_sessions', type: 'base', schema: [
    { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
    { name: 'sessionToken', type: 'text', required: true, unique: true },
    { name: 'machineId', type: 'text', required: true },
    { name: 'ipAddress', type: 'text' },
    { name: 'location', type: 'text' },
    { name: 'userAgent', type: 'text' },
    { name: 'expiresAt', type: 'date', required: true },
  ], indexes: ['CREATE INDEX idx_us_userId ON user_sessions (userId);'] },
  { name: 'verification_tokens', type: 'base', schema: [
    { name: 'identifier', type: 'email', required: true },
    { name: 'token', type: 'text', required: true, unique: true },
    { name: 'expires', type: 'date', required: true },
  ] },
  { name: 'promo_codes', type: 'base', schema: [
    { name: 'code', type: 'text', required: true, unique: true },
    { name: 'discountPercent', type: 'number' },
    { name: 'discountAmount', type: 'number' },
    { name: 'maxUses', type: 'number' },
    { name: 'currentUses', type: 'number' },
    { name: 'expiresAt', type: 'date' },
    { name: 'isActive', type: 'bool' },
    { name: 'userId', type: 'relation', options: { collectionId: '_pb_users_collection_' } },
  ] },
  { name: 'currency_rates', type: 'base', schema: [
    { name: 'fromCurrency', type: 'text', required: true },
    { name: 'toCurrency', type: 'text', required: true },
    { name: 'rate', type: 'number', required: true },
    { name: 'updatedAt', type: 'date' },
  ] },
  { name: 'histories', type: 'base', schema: [
    { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_', cascadeDelete: true } },
    { name: 'action', type: 'text', required: true },
    { name: 'details', type: 'json' },
    { name: 'projectId', type: 'relation', options: { collectionId: 'projects' } },
  ] },
  { name: 'admin_users', type: 'base', schema: [
    { name: 'email', type: 'email', required: true },
    { name: 'name', type: 'text' },
    { name: 'passwordHash', type: 'text' },
    { name: 'role', type: 'select', options: { values: ['editor', 'admin', 'superadmin'] } },
    { name: 'isActive', type: 'bool' },
  ] },
  { name: 'cashfree_orders', type: 'base', schema: [
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
  ] },
  { name: 'admin_live_status', type: 'base', schema: [
    { name: 'isLive', type: 'bool' },
    { name: 'lastSeenAt', type: 'date' },
  ] },
  { name: 'general_queries', type: 'base', schema: [
    { name: 'name', type: 'text', required: true },
    { name: 'email', type: 'email', required: true },
    { name: 'phone', type: 'text' },
    { name: 'subject', type: 'text', required: true },
    { name: 'message', type: 'editor', required: true },
    { name: 'isRead', type: 'bool' },
    { name: 'status', type: 'text' },
    { name: 'reply', type: 'text' },
  ], indexes: ['CREATE INDEX idx_general_queries_created ON general_queries (created);', 'CREATE INDEX idx_general_queries_read ON general_queries (isRead);'] },
  { name: 'term_acceptances', type: 'base', schema: [
    { name: 'userId', type: 'relation', required: true, options: { collectionId: '_pb_users_collection_' } },
    { name: 'ipAddress', type: 'text' },
    { name: 'userAgent', type: 'text' },
  ], indexes: ['CREATE INDEX idx_term_acceptances_userId ON term_acceptances (userId);'] },
  { name: 'banners', type: 'base', schema: [
    { name: 'title', type: 'text', required: true },
    { name: 'subtitle', type: 'text' },
    { name: 'imageUrl', type: 'text', required: true },
    { name: 'linkUrl', type: 'text' },
    { name: 'isActive', type: 'bool' },
    { name: 'sortOrder', type: 'number' },
  ], indexes: ['CREATE INDEX idx_banners_active ON banners (isActive, sortOrder);'] },
  { name: 'testimonials', type: 'base', schema: [
    { name: 'name', type: 'text', required: true },
    { name: 'role', type: 'text' },
    { name: 'avatarUrl', type: 'text' },
    { name: 'content', type: 'editor', required: true },
    { name: 'rating', type: 'number' },
    { name: 'isActive', type: 'bool' },
    { name: 'sortOrder', type: 'number' },
  ], indexes: ['CREATE INDEX idx_testimonials_active ON testimonials (isActive, sortOrder);'] },
  // ── Home page content collections ─────────────────────────────────────
  { name: 'home_content', type: 'base', schema: [
    { name: 'key', type: 'text', required: true },
    { name: 'value', type: 'json' },
    { name: 'section', type: 'text' },
    { name: 'isActive', type: 'bool' },
    { name: 'sortOrder', type: 'number' },
  ], indexes: ['CREATE UNIQUE INDEX idx_home_content_key ON home_content (key);'] },
  { name: 'how_it_works', type: 'base', schema: [
    { name: 'title', type: 'text', required: true },
    { name: 'description', type: 'text' },
    { name: 'stepNumber', type: 'number', required: true },
    { name: 'icon', type: 'text' },
    { name: 'videoUrl', type: 'url' },
    { name: 'imageUrl', type: 'url' },
    { name: 'isActive', type: 'bool' },
    { name: 'sortOrder', type: 'number' },
  ], indexes: ['CREATE INDEX idx_how_it_works_step ON how_it_works (stepNumber);'] },
  { name: 'gallery_items', type: 'base', schema: [
    { name: 'title', type: 'text', required: true },
    { name: 'imageUrl', type: 'url' },
    { name: 'icon', type: 'text' },
    { name: 'category', type: 'text' },
    { name: 'isActive', type: 'bool' },
    { name: 'sortOrder', type: 'number' },
  ], indexes: [] },
  { name: 'institution_logos', type: 'base', schema: [
    { name: 'name', type: 'text', required: true },
    { name: 'logoUrl', type: 'url' },
    { name: 'icon', type: 'text' },
    { name: 'isActive', type: 'bool' },
    { name: 'sortOrder', type: 'number' },
  ], indexes: [] },
  { name: 'features', type: 'base', schema: [
    { name: 'title', type: 'text', required: true },
    { name: 'description', type: 'text' },
    { name: 'icon', type: 'text' },
    { name: 'iconBg', type: 'text' },
    { name: 'glow', type: 'text' },
    { name: 'tags', type: 'json' },
    { name: 'href', type: 'url' },
    { name: 'isActive', type: 'bool' },
    { name: 'sortOrder', type: 'number' },
  ], indexes: [] },
  { name: 'benefits', type: 'base', schema: [
    { name: 'title', type: 'text', required: true },
    { name: 'description', type: 'text' },
    { name: 'icon', type: 'text' },
    { name: 'color', type: 'text' },
    { name: 'isActive', type: 'bool' },
    { name: 'sortOrder', type: 'number' },
  ], indexes: [] },
  { name: 'product_details', type: 'base', schema: [
    { name: 'key', type: 'text', required: true },
    { name: 'title', type: 'text', required: true },
    { name: 'description', type: 'text' },
    { name: 'icon', type: 'text' },
    { name: 'color', type: 'text' },
    { name: 'features', type: 'json' },
    { name: 'href', type: 'url' },
    { name: 'isActive', type: 'bool' },
    { name: 'sortOrder', type: 'number' },
  ], indexes: ['CREATE UNIQUE INDEX idx_product_details_key ON product_details (key);'] },
  { name: 'footer_links', type: 'base', schema: [
    { name: 'groupTitle', type: 'text', required: true },
    { name: 'label', type: 'text', required: true },
    { name: 'href', type: 'text' },
    { name: 'linkKey', type: 'text' },
    { name: 'isTargetBlank', type: 'bool' },
    { name: 'isActive', type: 'bool' },
    { name: 'sortOrder', type: 'number' },
  ], indexes: ['CREATE INDEX idx_footer_links_group ON footer_links (groupTitle);'] },
  { name: 'tasar_stats', type: 'base', schema: [
    { name: 'label', type: 'text', required: true },
    { name: 'value', type: 'text', required: true },
    { name: 'suffix', type: 'text' },
    { name: 'icon', type: 'text' },
    { name: 'color', type: 'text' },
    { name: 'category', type: 'text' },
    { name: 'isActive', type: 'bool' },
    { name: 'sortOrder', type: 'number' },
  ], indexes: [] },
  { name: 'floating_banners', type: 'base', schema: [
    { name: 'title', type: 'text', required: true },
    { name: 'imageUrl', type: 'url' },
    { name: 'linkUrl', type: 'url' },
    { name: 'targetType', type: 'select', required: true, options: { values: ['global', 'specific'] } },
    { name: 'targetEmail', type: 'email' },
    { name: 'width', type: 'number' },
    { name: 'height', type: 'number' },
    { name: 'duration', type: 'number' },
    { name: 'isActive', type: 'bool' },
    { name: 'sortOrder', type: 'number' },
  ], indexes: ['CREATE INDEX idx_floating_banners_active ON floating_banners (isActive, sortOrder);'] },
  { name: 'site_settings', type: 'base', schema: [
    { name: 'key', type: 'text', required: true, unique: true },
    { name: 'value', type: 'json' },
    { name: 'label', type: 'text' },
    { name: 'logo', type: 'file' },
  ], indexes: ['CREATE UNIQUE INDEX idx_site_settings_key ON site_settings (key);'] },
  { name: 'uploads', type: 'base', schema: [
    { name: 'file', type: 'file', required: true },
  ], indexes: [] },
];

const USER_FIELDS_TO_ADD = [
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
  { name: 'aiCapPlanId', type: 'relation', options: { collectionId: 'ai_cap_plans' } },
];

const DEFAULT_MEMBERSHIP_PLANS = [
  { planId: 'premium_1m', name: 'Premium Monthly', priceINR: 415, durationMonths: 1, pointsExchange: 50, description: '1 Month Premium Access' },
  { planId: 'premium_3m', name: 'Premium Quarterly', priceINR: 1245, durationMonths: 3, pointsExchange: 200, description: '3 Months Premium Access' },
  { planId: 'premium_6m', name: 'Premium Biannual', priceINR: 2490, durationMonths: 6, pointsExchange: 500, description: '6 Months Premium Access' },
  { planId: 'premium_12m', name: 'Premium Annual', priceINR: 4150, durationMonths: 12, pointsExchange: 1000, description: '12 Months Premium Access' },
];

const DEFAULT_CAP_PLANS = [
  { name: 'free', label: 'Free Tier', dailyTokenCap: 50000, isActive: true, description: 'Default free plan — 50K tokens/day' },
  { name: 'pro', label: 'Pro Plan', dailyTokenCap: 200000, isActive: true, description: 'Pro plan — 200K tokens/day' },
  { name: 'enterprise', label: 'Enterprise', dailyTokenCap: 1000000, isActive: true, description: 'Enterprise — 1M tokens/day' },
];

const DEFAULT_SERVICES = [
  { serviceKey: 'latex_editor', name: 'LaTeX Editor', status: 'stable', uptime: 99.98 },
  { serviceKey: 'doc2latex', name: 'Doc2Latex Converter', status: 'stable', uptime: 99.9, latencyMs: 142 },
  { serviceKey: 'template_migrator', name: 'Template Migrator', status: 'normal', uptime: 99.9, queueJobs: 12, usagePercent: 20 },
  { serviceKey: 'ai_diagram', name: 'AI Diagram Generator', status: 'high_load', uptime: 99.9, usagePercent: 84 },
  { serviceKey: 'ai_reviewer', name: 'AI Peer Reviewer', status: 'stable', uptime: 99.95 },
  { serviceKey: 'citation_studio', name: 'Citation Studio', status: 'stable', uptime: 99.99 },
];

export async function setupPocketBase() {
  console.log('[PB Setup] Connecting to PocketBase...');
  const pb = new PocketBase(PB_URL);

  const fs = await import('fs');
  const path = await import('path');
  const pbDataDir = process.env.PB_DATA_DIR || path.resolve(process.cwd(), 'pb_data');
  const credsPath = path.resolve(pbDataDir, 'admin_creds.json');

  // ── Wait for PocketBase to be accepting connections ──────────────────────
  let ready = false;
  for (let i = 0; i < 10; i++) {
    try {
      await fetch(PB_URL, { signal: AbortSignal.timeout(3000) });
      ready = true;
      break;
    } catch {
      if (i === 0) console.log('[PB Setup] Waiting for PocketBase to be ready...');
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  if (!ready) {
    console.error('[PB Setup] PocketBase not reachable after 30s. Skipping setup.');
    return;
  }
  console.log('[PB Setup] PocketBase is reachable.');

  let activeEmail = ADMIN_EMAIL;
  let activePassword = ADMIN_PASSWORD;

  // Load credentials from persisted file (survives redeploys)
  if (fs.existsSync(credsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
      if (data.email) activeEmail = data.email;
      if (data.password) activePassword = data.password;
      console.log(`[PB Setup] Active admin credentials loaded from ${credsPath}`);
    } catch (e) {
      console.warn('[PB Setup] Failed to parse admin_creds.json:', e.message);
    }
  }

  // ── Step 1: Try to create superuser ──────────────────────────────────────
  const emailsToCreate = Array.from(new Set([
    activeEmail,
    process.env.ADMIN_EMAIL || 'sid.ilm6@gmail.com'
  ].filter(Boolean)));

  const isWindows = process.platform === 'win32';
  const pbBinary = path.resolve(process.cwd(), isWindows ? 'pocketbase.exe' : 'pocketbase');
  const { execSync } = await import('child_process');

  for (const emailToCreate of emailsToCreate) {
    // Try CLI first (guaranteed to work directly on the database file)
    if (fs.existsSync(pbBinary)) {
      try {
        console.log(`[PB Setup] Upserting superuser via CLI for ${emailToCreate}...`);
        const cmd = `"${pbBinary}" superuser upsert ${emailToCreate} ${activePassword} --dir="${pbDataDir}"`;
        execSync(cmd, { stdio: 'inherit' });
        console.log(`[PB Setup] Superuser upserted via CLI successfully for ${emailToCreate}.`);
      } catch (cliErr) {
        console.warn(`[PB Setup] CLI upsert failed for ${emailToCreate}:`, cliErr.message);
      }
    } else {
      console.warn(`[PB Setup] PocketBase binary not found at ${pbBinary} for CLI upsert.`);
    }

    let created = false;
    // Try POST /api/admins first (backward compat with some PB versions)
    for (const endpoint of ['/api/admins', '/api/collections/_superusers/records']) {
      try {
        const createRes = await fetch(`${PB_URL}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailToCreate,
            password: activePassword,
            passwordConfirm: activePassword,
          }),
        });
        if (createRes.ok) {
          console.log(`[PB Setup] Superuser created for ${emailToCreate} via ${endpoint}.`);
          created = true;
          break;
        }
        const body = await createRes.json().catch(() => ({}));
        if (createRes.status === 400 && JSON.stringify(body).includes('email')) {
          console.log(`[PB Setup] Superuser for ${emailToCreate} already exists. Continuing...`);
          created = true;
          break;
        }
        // 403/other — try next endpoint
      } catch (err) {
        console.warn(`[PB Setup] ${endpoint} failed for ${emailToCreate}:`, err?.message);
      }
    }

    if (created && emailToCreate === activeEmail) {
      try {
        fs.mkdirSync(path.dirname(credsPath), { recursive: true });
        fs.writeFileSync(credsPath, JSON.stringify({ email: activeEmail, password: activePassword }, null, 2));
        console.log('[PB Setup] Admin credentials saved to disk.');
      } catch (err) {
        console.warn('[PB Setup] Failed to save credentials to disk:', err.message);
      }
    }
  }

  // ── Step 2: Authenticate (with retry and fallback) ──────────────────────
  let authenticated = false;
  let authError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await pb.collection('_superusers').authWithPassword(activeEmail, activePassword);
      console.log('[PB Setup] Superuser authenticated.');
      authenticated = true;
      break;
    } catch (err) {
      authError = err?.message || String(err);
      console.warn(`[PB Setup] Auth attempt ${attempt + 1} failed: ${authError}`);
      if (attempt === 0) {
        // Maybe the password changed — try reading admin_creds.json for the actual password
        if (fs.existsSync(credsPath)) {
          try {
            const data = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
            if (data.password && data.password !== activePassword) {
              activePassword = data.password;
              console.log('[PB Setup] Retrying with password from admin_creds.json...');
              continue;
            }
          } catch {}
        }
      }
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (!authenticated) {
    console.error(`[PB Setup] Failed to authenticate as superuser after 3 attempts. Last error: ${authError}`);
    console.error('[PB Setup] You may need to set POCKETBASE_ADMIN_PASSWORD in Render dashboard to match the existing superuser password.');
    console.log('[PB Setup] Skipping collections creation/updates (not authenticated).');
    return;
  }

  // Get existing collections
  const existing = await pb.collections.getFullList();
  const existingNames = new Set(existing.map(c => c.name));
  console.log('[PB Setup] Existing collections in PocketBase:', Array.from(existingNames));

  // Find users collection
  const usersCol = existing.find(c => c.name === 'users');
  if (!usersCol) {
    console.error('[PB Setup] Users collection not found!');
    return;
  }
  const usersColId = usersCol.id;

  // Track created collection IDs for relation resolution
  const createdColIds = new Map();
  for (const col of existing) {
    createdColIds.set(col.name, col.id);
  }

  // Create base collections
  for (const def of COLLECTIONS) {
    if (existingNames.has(def.name)) continue;

    const fields = def.schema.map(f => {
      const field = { name: f.name, type: f.type, required: f.required || false, unique: f.unique || false, ...f.options };
      if (field.collectionId === '_pb_users_collection_') {
        field.collectionId = usersColId;
      } else if (field.type === 'relation' && createdColIds.has(field.collectionId)) {
        field.collectionId = createdColIds.get(field.collectionId);
      }
      return field;
    });

    // PocketBase v0.23+ does not automatically add system fields (created/updated) to SQLite tables
    // when collections are created programmatically. We append them so that indexes and queries work.
    if (!fields.some(f => f.name === 'created')) {
      fields.push({ name: 'created', type: 'autodate', onCreate: true, onUpdate: false });
    }
    if (!fields.some(f => f.name === 'updated')) {
      fields.push({ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true });
    }

    const tryCreate = async (retries = 2) => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const created = await pb.collections.create({
            name: def.name,
            type: def.type,
            fields: fields,
            indexes: def.indexes || [],
            listRule: null,
            viewRule: null,
            createRule: null,
            updateRule: null,
            deleteRule: null,
          });
          console.log(`[PB Setup] Created collection: ${def.name} (${created.id})`);
          createdColIds.set(def.name, created.id);
          return true;
        } catch (err) {
          const detail = err?.data ? JSON.stringify(err.data) : err?.message || String(err);
          if (attempt < retries) {
            console.warn(`[PB Setup] Retry ${attempt + 1}/${retries} for ${def.name}: ${detail}`);
            await new Promise(r => setTimeout(r, 1000));
          } else {
            console.error(`[PB Setup] Failed to create ${def.name}: ${detail}`);
          }
        }
      }
      return false;
    };
    await tryCreate();
  }

  // Extend users collection with custom fields — deferred until after base collections are created
  // so that relation fields like aiCapPlanId pointing to ai_cap_plans can resolve successfully.
  const existingUserFields = new Set((usersCol.fields || []).map(f => f.name));
  const newFields = [...(usersCol.fields || [])];
  for (const field of USER_FIELDS_TO_ADD) {
    if (!existingUserFields.has(field.name)) {
      const f = { name: field.name, type: field.type, required: false, unique: false, ...field.options };
      if (f.type === 'relation' && createdColIds.has(f.collectionId)) {
        f.collectionId = createdColIds.get(f.collectionId);
      }
      newFields.push(f);
    }
  }
  if (newFields.length > (usersCol.fields || []).length) {
    await pb.collections.update(usersColId, { fields: newFields });
    console.log('[PB Setup] Users collection extended.');
  }

  // Seed default data
  const planCount = (await pb.collection('membership_plans').getFullList()).length;
  if (planCount === 0) {
    for (const plan of DEFAULT_MEMBERSHIP_PLANS) {
      await pb.collection('membership_plans').create(plan);
    }
    console.log('[PB Setup] Membership plans seeded.');
  }

  const capCount = (await pb.collection('ai_cap_plans').getFullList()).length;
  if (capCount === 0) {
    for (const plan of DEFAULT_CAP_PLANS) {
      await pb.collection('ai_cap_plans').create(plan);
    }
    console.log('[PB Setup] AI cap plans seeded.');
  }

  const svcCount = (await pb.collection('service_health').getFullList()).length;
  if (svcCount === 0) {
    for (const svc of DEFAULT_SERVICES) {
      await pb.collection('service_health').create(svc);
    }
    console.log('[PB Setup] Service health seeded.');
  }

  // Seed default banners
  try {
    const bannerCount = (await pb.collection('banners').getFullList()).length;
    if (bannerCount === 0) {
      const defaultBanners = [
        { title: 'Welcome to Latexify', subtitle: 'The modern, intelligent platform for the entire research writing lifecycle.', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAfrx0rEK6VFLoe2g-XBz3W3v-F9ySny3wIO0GvOU4er61lUuTBVHvwYLUuqIs0AJoAKS007oi-Eol9Htta-GTRBF4xxAzzuqQgAhgqDtjr8p6Z7Q6hg2CSB3wQNqCGWWMQXkcp8v6Lso_Le622A3nyeH7Lev3cMioXKpnxZKCMHLPVS0ExSKUiPxYmzKIWcN6Coo758Jx_tmEY5RDPLzN1a48mBPKfpqaAgI6i5xGtO4pQLyEzyTTvYn2VnmuYr49zlqcD5RuJ2VLq', linkUrl: '/latex-studio', isActive: true, sortOrder: 1 },
        { title: 'AI Peer Reviewer', subtitle: 'Get instant, scholarly feedback on clarity, argumentation, and methodology.', imageUrl: '/ai_peer_reviewer_dashboard_1777058436599.png', linkUrl: '/reviewer', isActive: true, sortOrder: 2 },
        { title: 'Create TikZ Diagrams visually', subtitle: 'Create beautiful TikZ diagrams with an intuitive visual canvas. No more coordinate wrestling.', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCOfpdp7avfxHVymJ06UtjZny3PXYwWBlHy4rpi8PV7-YGXFfygei_YZV65NdCKAQfE4DuhwJVAdCrE4-JoRKmljz10dSgkNXgv5F3blSGIPbm-6vQRe0_OrtZzV49Mxi7nwF-XXZzkzf8YjZrLYr2o4KLZflRtfrY3WY0NNTblCY-q7F0rLGOfjwoHMxC6LNP6KqqBj_jnRgs7NOX4Me-ldmMJtt38-V4YCjxpmuUxTRgfP3TncR6coVeklb0q5ABJYPH4zCIbqmoe', linkUrl: '/diagrams', isActive: true, sortOrder: 3 }
      ];
      for (const banner of defaultBanners) {
        await pb.collection('banners').create(banner);
      }
      console.log('[PB Setup] Banners seeded.');
    }
  } catch (e) {
    console.warn('[PB Setup] Failed to seed banners:', e.message);
  }

  // Seed default testimonials
  try {
    const testimonialCount = (await pb.collection('testimonials').getFullList()).length;
    if (testimonialCount === 0) {
      const defaultTestimonials = [
        { name: 'Dr. Elena Rostova', role: 'Postdoctoral Fellow, MIT', content: 'Latexify\'s template migrator saved me weeks of reformatting when my paper was transferred between journals. The UI is incredibly clean.', rating: 5, isActive: true, sortOrder: 1 },
        { name: 'James Chen', role: 'PhD Candidate, Stanford University', content: 'The AI Peer Reviewer caught several logical gaps in my methodology section before submission. An absolute game-changer for solo researchers.', rating: 5, isActive: true, sortOrder: 2 },
        { name: 'Prof. Sarah Jenkins', role: 'Principal Investigator, University of Oxford', content: 'I\'ve moved my entire lab to Latexify. Collaborative writing is finally seamless, and the Doc2Latex feature means my undergrads can contribute easily.', rating: 5, isActive: true, sortOrder: 3 }
      ];
      for (const t of defaultTestimonials) {
        await pb.collection('testimonials').create(t);
      }
      console.log('[PB Setup] Testimonials seeded.');
    }
  } catch (e) {
    console.warn('[PB Setup] Failed to seed testimonials:', e.message);
  }

  // Seed default footer links
  try {
    const footerCount = (await pb.collection('footer_links').getFullList()).length;
    if (footerCount === 0) {
      const defaultFooterLinks = [
        { groupTitle: 'Platform', label: 'Latexify', href: '/', linkKey: 'footer_platform_home', isTargetBlank: false, isActive: true, sortOrder: 1 },
        { groupTitle: 'Platform', label: 'Pricing', href: '/pricing', linkKey: 'footer_platform_pricing', isTargetBlank: false, isActive: true, sortOrder: 2 },
        { groupTitle: 'Platform', label: 'About Us', href: '/about', linkKey: 'footer_platform_about', isTargetBlank: false, isActive: true, sortOrder: 3 },
        { groupTitle: 'Platform', label: 'Contact Us', href: '/contact', linkKey: 'footer_platform_contact', isTargetBlank: false, isActive: true, sortOrder: 4 },
        { groupTitle: 'Features', label: 'Latex Studio', href: '/latex-studio', linkKey: 'footer_features_studio', isTargetBlank: false, isActive: true, sortOrder: 5 },
        { groupTitle: 'Features', label: 'Templates', href: '/templates', linkKey: 'footer_features_templates', isTargetBlank: false, isActive: true, sortOrder: 6 },
        { groupTitle: 'Features', label: 'AI Review', href: '/reviewer', linkKey: 'footer_features_ai_review', isTargetBlank: false, isActive: true, sortOrder: 7 },
        { groupTitle: 'Features', label: 'Bibliography', href: '/bibliography', linkKey: 'footer_features_bibliography', isTargetBlank: false, isActive: true, sortOrder: 8 },
        { groupTitle: 'Support', label: 'Help Center', href: '/help', linkKey: 'footer_support_help', isTargetBlank: false, isActive: true, sortOrder: 9 },
        { groupTitle: 'Support', label: 'Documentation', href: '/docs', linkKey: 'footer_support_docs', isTargetBlank: false, isActive: true, sortOrder: 10 },
        { groupTitle: 'Support', label: 'API Status', href: '/status', linkKey: 'footer_support_status', isTargetBlank: false, isActive: true, sortOrder: 11 },
        { groupTitle: 'Legal', label: 'Terms of Service', href: '/terms', linkKey: 'footer_legal_tos', isTargetBlank: false, isActive: true, sortOrder: 12 },
        { groupTitle: 'Legal', label: 'Privacy Policy', href: '/privacy', linkKey: 'footer_legal_privacy', isTargetBlank: false, isActive: true, sortOrder: 13 },
        { groupTitle: 'Legal', label: 'Refund Policy', href: '/refund', linkKey: 'footer_legal_refund', isTargetBlank: false, isActive: true, sortOrder: 14 },
      ];
      for (const link of defaultFooterLinks) {
        await pb.collection('footer_links').create(link);
      }
      console.log('[PB Setup] Footer links seeded.');
    }
  } catch (e) {
    console.warn('[PB Setup] Failed to seed footer links:', e.message);
  }

  // Seed admin_users collection — ensures the admin profile record exists in PB
  // so the profile/change-password routes can find it without relying on env vars.
  if (authenticated) {
    // Longer pause to let PB finalize the newly created collection
    await new Promise(r => setTimeout(r, 2000));
    for (const email of emailsToCreate) {
      const seedAdminUser = async () => {
        // Wait for admin_users collection to be ready (retry if not found)
        for (let w = 0; w < 5; w++) {
          try {
            const existing = await pb.collection('admin_users').getFullList({
              filter: `email = "${email}"`,
              requestKey: `admin_users_check_${email}`,
            });
            if (existing.length > 0) {
              console.log(`[PB Setup] admin_users record already exists for ${email}. Skipping.`);
              return;
            }
            const passwordHash = await bcrypt.hash(activePassword, 10);
            // Try with passwordHash first, fallback to without
            try {
              await pb.collection('admin_users').create({
                email: email,
                name: email === ADMIN_EMAIL ? 'Admin Root' : 'Owner Admin',
                role: 'superadmin',
                isActive: true,
                passwordHash: passwordHash,
              }, { requestKey: `admin_users_create_${email}` });
              console.log(`[PB Setup] admin_users profile record seeded for ${email}.`);
              return;
            } catch (createErr) {
              const detail = createErr?.data ? JSON.stringify(createErr.data) : createErr?.message || '';
              if (detail.includes('passwordHash') || detail.includes('password')) {
                // Retry without passwordHash field
                await pb.collection('admin_users').create({
                  email: email,
                  name: email === ADMIN_EMAIL ? 'Admin Root' : 'Owner Admin',
                  role: 'superadmin',
                  isActive: true,
                }, { requestKey: `admin_users_create_noph_${email}` });
                console.log(`[PB Setup] admin_users profile record seeded for ${email} (without passwordHash).`);
                return;
              }
              if (w < 4) {
                console.warn(`[PB Setup] Retry ${w + 1}/5 seeding admin_users for ${email}: ${detail}`);
                await new Promise(r => setTimeout(r, 1000));
                continue;
              }
              throw createErr;
            }
          } catch (err) {
            if (w < 4) {
              await new Promise(r => setTimeout(r, 1000));
              continue;
            }
            throw err;
          }
        }
      };
      try {
        await seedAdminUser();
      } catch (err) {
        const detail = err?.data ? JSON.stringify(err.data) : err?.message || String(err);
        console.warn(`[PB Setup] Failed to seed admin_users for ${email} (non-fatal): ${detail}`);
      }
    }
  } else {
    console.log('[PB Setup] Skipping admin_users seeding (not authenticated).');
  }

  // Ensure public read rules for homepage content collections
  if (authenticated) {
    try {
      const publicCollections = [
        'banners', 'testimonials', 'how_it_works', 'gallery_items',
        'institution_logos', 'features', 'benefits', 'product_details',
        'footer_links', 'tasar_stats', 'platform_stats', 'floating_banners'
      ];
      console.log('[PB Setup] Ensuring public read rules for homepage collections...');
      for (const name of publicCollections) {
        const col = existing.find(c => c.name === name);
        if (col) {
          if (col.listRule !== "" || col.viewRule !== "") {
            await pb.collections.update(col.id, {
              listRule: "",
              viewRule: "",
            });
            console.log(`[PB Setup] Updated ${name} rules to public read.`);
          }
        }
      }
    } catch (ruleErr) {
      console.warn('[PB Setup] Failed to update public collections rules:', ruleErr.message);
    }

    // Sync homepage content from src/assets/homepage-content.json
    try {
      const contentJsonPath = path.resolve(process.cwd(), 'src/assets/homepage-content.json');
      if (fs.existsSync(contentJsonPath)) {
        console.log('[PB Setup] Syncing homepage content from src/assets/homepage-content.json...');
        const contentData = JSON.parse(fs.readFileSync(contentJsonPath, 'utf8'));
        const deleteAllowedCollections = [
          'banners', 'testimonials', 'how_it_works', 'gallery_items',
          'institution_logos', 'features', 'benefits', 'product_details',
          'footer_links', 'tasar_stats', 'floating_banners'
        ];

        for (const [colName, items] of Object.entries(contentData)) {
          const existingColRecords = await pb.collection(colName).getFullList({ requestKey: `sync_check_${colName}` });
          const existingMap = new Map(existingColRecords.map(r => [r.id, r]));

          for (const item of items) {
            if (existingMap.has(item.id)) {
              // Update existing
              await pb.collection(colName).update(item.id, item);
            } else {
              // Create new
              await pb.collection(colName).create(item);
            }
          }

          // Delete records not in whitelisted JSON data
          if (deleteAllowedCollections.includes(colName)) {
            const incomingIds = new Set(items.map(item => item.id));
            for (const existingRec of existingColRecords) {
              if (!incomingIds.has(existingRec.id)) {
                await pb.collection(colName).delete(existingRec.id).catch(() => {});
              }
            }
          }
        }
        console.log('[PB Setup] Homepage content synced successfully.');
      }
    } catch (syncErr) {
      console.warn('[PB Setup] Homepage content sync failed:', syncErr.message);
    }
  }

  console.log('[PB Setup] Complete.');
}
