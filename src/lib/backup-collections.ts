/**
 * Master list of ALL PocketBase collections for backup/restore.
 * Each entry: { name, fileFields? } where fileFields lists PB file columns.
 */

export interface CollectionDef {
  name: string;
  fileFields?: string[];
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
  { name: 'project_files', fileFields: ['fileContent'] },
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
  { name: 'chat_messages' },
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
  { name: 'how_it_works', fileFields: ['image'] },
  { name: 'gallery_items', fileFields: ['image'] },
  { name: 'institution_logos', fileFields: ['image'] },
  { name: 'features', fileFields: ['icon'] },
  { name: 'benefits', fileFields: ['icon'] },
  { name: 'product_details', fileFields: ['image'] },
  { name: 'footer_links' },
  { name: 'tasar_stats' },
  { name: 'platform_stats' },
  { name: 'site_settings', fileFields: ['logo', 'favicon'] },
  { name: 'uploads', fileFields: ['file'] },
  { name: 'floating_banners', fileFields: ['image'] },
  { name: 'videos' },
  { name: 'banners', fileFields: ['image'] },
  { name: 'testimonials', fileFields: ['image'] },

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

/** Collections known to have file attachments (for progress tracking). */
export const FILE_COLLECTIONS = BACKUP_COLLECTIONS.filter(c => c.fileFields && c.fileFields.length > 0);
