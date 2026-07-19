/**
 * Master list of ALL PocketBase collections for backup/restore.
 * Each entry: { name, fileFields?, urlFields? }
 *   fileFields — PB file-type fields (downloaded via pb.files.getUrl())
 *   urlFields  — text/url fields holding full URLs to downloadable files
 */

export interface CollectionDef {
  name: string;
  fileFields?: string[];
  urlFields?: string[];
}

export const BACKUP_COLLECTIONS: CollectionDef[] = [
  // ── Auth & Users ──
  { name: 'users' },
  { name: '_superusers' },
  { name: 'accounts' },
  { name: 'sessions' },
  { name: 'verification_tokens' },
  { name: 'profiles' },

  // ── User Sessions ──
  { name: 'user_sessions' },
  { name: 'user_session_activities' },
  { name: 'term_acceptances' },

  // ── Projects & Documents ──
  { name: 'projects' },
  { name: 'project_files', fileFields: ['file'] },
  { name: 'project_collaborators' },
  { name: 'share_links' },
  { name: 'templates', fileFields: ['file'] },

  // ── Billing & Membership ──
  { name: 'membership_plans' },
  { name: 'membership_transactions' },
  { name: 'user_membership_logs' },
  { name: 'point_transactions' },
  { name: 'cashfree_orders' },
  { name: 'currency_rates' },

  // ── Offers & Promotions ──
  { name: 'offers' },
  { name: 'promo_codes' },
  { name: 'marketing_campaigns' },

  // ── AI Usage & Caps ──
  { name: 'ai_cap_plans' },
  { name: 'ai_cap_rules' },
  { name: 'user_ai_caps' },
  { name: 'ai_usage_logs' },
  { name: 'ai_usage_daily_summaries' },
  { name: 'ai_context_configs' },

  // ── Citation & Review ──
  { name: 'citation_projects' },
  { name: 'citations' },
  { name: 'paper_reviews' },

  // ── Support & Tickets ──
  { name: 'support_tickets' },
  { name: 'ticket_messages' },
  { name: 'chat_sessions' },
  { name: 'chat_messages', fileFields: ['attachment'] },
  { name: 'general_queries' },

  // ── Admin & Operations ──
  { name: 'admin_users', fileFields: ['avatar'] },
  { name: 'admin_tasks' },
  { name: 'admin_live_status' },
  { name: 'admin_notifications' },
  { name: 'admin_documentations' },
  { name: 'audit_log' },
  { name: 'service_health' },
  { name: 'report_history' },

  // ── Notifications & Communication ──
  { name: 'announcements', fileFields: ['image'] },
  { name: 'notifications' },
  { name: 'email_logs' },
  { name: 'user_faqs' },

  // ── Security ──
  { name: 'anomaly_alerts' },
  { name: 'blacklist_records' },
  { name: 'feature_flags' },

  // ── Tax & Finance ──
  { name: 'tax_rules' },
  { name: 'tax_transactions' },
  { name: 'tax_filings' },

  // ── Journal & Tracking ──
  { name: 'journal_registry' },
  { name: 'tool_usage_logs' },
  { name: 'histories' },

  // ── Sync & Logging ──
  { name: 'sync_logs' },

  // ── Layout & Settings ──
  { name: 'layout_settings' },

  // ── CMS / Homepage Content ──
  { name: 'home_content' },
  { name: 'how_it_works', urlFields: ['imageUrl'] },
  { name: 'gallery_items', urlFields: ['imageUrl'] },
  { name: 'institution_logos', urlFields: ['logoUrl'] },
  { name: 'features' },
  { name: 'benefits' },
  { name: 'product_details' },
  { name: 'footer_links' },
  { name: 'tasar_stats' },
  { name: 'platform_stats' },
  { name: 'site_settings', fileFields: ['logo'] },
  { name: 'uploads', fileFields: ['file'] },
  { name: 'floating_banners', urlFields: ['imageUrl'] },
  { name: 'videos', urlFields: ['videoUrl', 'posterUrl'] },
  { name: 'banners', urlFields: ['imageUrl'] },
  { name: 'testimonials', urlFields: ['avatarUrl'] },

  // ── Backup Schedules (self-referential) ──
  { name: 'backup_schedules' },
];

/** All unique collection names as a flat array. */
export const ALL_COLLECTION_NAMES = BACKUP_COLLECTIONS.map(c => c.name);

/** Get file fields for a collection (returns empty array if none). */
export function getFileFields(collectionName: string): string[] {
  const def = BACKUP_COLLECTIONS.find(c => c.name === collectionName);
  return def?.fileFields ?? [];
}

/** Get URL fields for a collection (returns empty array if none). */
export function getUrlFields(collectionName: string): string[] {
  const def = BACKUP_COLLECTIONS.find(c => c.name === collectionName);
  return def?.urlFields ?? [];
}

/** Collections known to have file attachments (for progress tracking). */
export const FILE_COLLECTIONS = BACKUP_COLLECTIONS.filter(c => (c.fileFields && c.fileFields.length > 0) || (c.urlFields && c.urlFields.length > 0));
