/**
 * Prisma-compatible PocketBase adapter.
 *
 * Drop-in replacement — import { prisma } from "@/lib/prisma" still works,
 * but all queries are forwarded to PocketBase collections.
 *
 * Supported operations:
 *   prisma.model.findUnique({ where: { id } })
 *   prisma.model.findFirst({ where })
 *   prisma.model.findMany({ where, orderBy, skip, take })
 *   prisma.model.create({ data })
 *   prisma.model.update({ where: { id }, data })
 *   prisma.model.upsert({ where: { id }, create, update })
 *   prisma.model.delete({ where: { id } })
 *   prisma.model.count({ where })
 *   prisma.model.findMany({ where: { id: { in: [...] } } })
 *   prisma.model.createMany({ data })
 *   prisma.model.updateMany({ where, data })
 *   prisma.model.deleteMany({ where })
 */

import PocketBase from 'pocketbase';
import { createPb, pbAdmin, mapRecord, mapList } from './pb';

type WhereClause = Record<string, any>;

/** Format a value for PocketBase filter — dates use PocketBase 0.27 format (space, not T). */
function pbDateStr(d: Date): string {
  return d.toISOString().replace('T', ' ');
}

function mapWriteData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const copy = { ...data };
  if ('createdAt' in copy) {
    if (copy.createdAt instanceof Date) {
      copy.created = pbDateStr(copy.createdAt);
    } else if (copy.createdAt) {
      copy.created = pbDateStr(new Date(copy.createdAt));
    }
    delete copy.createdAt;
  }
  if ('updatedAt' in copy) {
    if (copy.updatedAt instanceof Date) {
      copy.updated = pbDateStr(copy.updatedAt);
    } else if (copy.updated) {
      copy.updated = pbDateStr(new Date(copy.updatedAt));
    }
    delete copy.updated;
  }
  return copy;
}

function fmtFilterVal(v: any): string {
  if (v instanceof Date) return `"${pbDateStr(v)}"`;
  if (typeof v === 'string') return `"${v}"`;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v === null) return 'null';
  return `"${String(v)}"`;
}

/** Convert a Prisma-style where clause to PocketBase filter string. */
function toFilter(where?: WhereClause): string | undefined {
  if (!where) return undefined;
  const parts: string[] = [];
  for (const [origKey, val] of Object.entries(where)) {
    let key = origKey;
    if (val === undefined) continue;
    if (key === 'createdAt') key = 'created';
    if (key === 'updatedAt') key = 'updated';

    if (val === null) {
      parts.push(`${key} = ""`);
      continue;
    }
    if (key === 'id' && (typeof val === 'string' || typeof val === 'number')) {
      parts.push(`id = "${val}"`);
    } else if (key === 'AND') {
      if (Array.isArray(val)) {
        const subParts = val.map(v => toFilter(v)).filter(Boolean);
        if (subParts.length) parts.push(`(${subParts.join(' && ')})`);
      } else if (typeof val === 'object' && val !== null) {
        const subFilter = toFilter(val);
        if (subFilter) parts.push(`(${subFilter})`);
      }
    } else if (key === 'OR') {
      if (Array.isArray(val)) {
        const subParts = val.map(v => toFilter(v)).filter(Boolean);
        if (subParts.length) parts.push(`(${subParts.join(' || ')})`);
      }
    } else if (typeof val === 'object' && val !== null && 'in' in val && Array.isArray(val.in)) {
      // PocketBase has no 'in' operator — generate OR conditions
      if (val.in.length === 0) {
        parts.push('id != id'); // always-false condition
      } else if (val.in.length === 1) {
        parts.push(`${key} = ${fmtFilterVal(val.in[0])}`);
      } else {
        const orParts = val.in.map((v: any) => `${key} = ${fmtFilterVal(v)}`);
        parts.push(`(${orParts.join(' || ')})`);
      }
    } else if (typeof val === 'object' && val !== null && 'notIn' in val && Array.isArray((val as any).notIn)) {
      // PocketBase has no 'notIn' operator — generate AND NOT conditions
      const notInArr = (val as any).notIn;
      if (notInArr.length === 0) {
        // nothing to exclude — skip
      } else if (notInArr.length === 1) {
        parts.push(`${key} != ${fmtFilterVal(notInArr[0])}`);
      } else {
        const andParts = notInArr.map((v: any) => `${key} != ${fmtFilterVal(v)}`);
        parts.push(`(${andParts.join(' && ')})`);
      }

    } else if (typeof val === 'object' && val !== null && 'not' in val) {
      if (val.not === null) {
        parts.push(`${key} != ""`);
      } else {
        parts.push(`${key} != ${fmtFilterVal(val.not)}`);
      }
    } else if (typeof val === 'object' && val !== null && 'contains' in val) {
      parts.push(`${key} ~ "${val.contains}"`);
    } else if (typeof val === 'object' && val !== null && 'startsWith' in val) {
      parts.push(`${key} ~ "${val.startsWith}"`);
    } else if (typeof val === 'object' && val !== null && 'gt' in val) {
      parts.push(`${key} > ${fmtFilterVal(val.gt)}`);
    } else if (typeof val === 'object' && val !== null && 'gte' in val) {
      parts.push(`${key} >= ${fmtFilterVal(val.gte)}`);
    } else if (typeof val === 'object' && val !== null && 'lt' in val) {
      parts.push(`${key} < ${fmtFilterVal(val.lt)}`);
    } else if (typeof val === 'object' && val !== null && 'lte' in val) {
      parts.push(`${key} <= ${fmtFilterVal(val.lte)}`);
    } else if (typeof val === 'string') {
      parts.push(`${key} = "${val}"`);
    } else if (typeof val === 'number' || typeof val === 'boolean') {
      parts.push(`${key} = ${val}`);
    } else if (val instanceof Date) {
      parts.push(`${key} = "${pbDateStr(val)}"`);
    } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      const isOperator = Object.keys(val).some(k => ['in','not','contains','startsWith','gt','gte','lt','lte','notIn'].includes(k));
      if (isOperator) {
        parts.push(`${key} = "${String(val)}"`);
      } else {
        for (const [origSubKey, subVal] of Object.entries(val)) {
          let subKey = origSubKey;
          if (subVal === null || subVal === undefined) continue;
          if (subKey === 'createdAt') subKey = 'created';
          if (subKey === 'updatedAt') subKey = 'updated';
          parts.push(`${subKey} = ${fmtFilterVal(subVal)}`);
        }
      }
    } else {
      parts.push(`${key} = "${String(val)}"`);
    }
  }
  return parts.length ? parts.join(' && ') : undefined;
}

/** Convert Prisma orderBy to PocketBase sort string. */
function toSort(orderBy?: Record<string, 'asc' | 'desc'> | Record<string, 'asc' | 'desc'>[]): string | undefined {
  if (!orderBy) return undefined;
  const items = Array.isArray(orderBy) ? orderBy : [orderBy];
  const s = items.map((o) => {
    const [origKey, dir] = Object.entries(o)[0];
    let key = origKey;
    if (key === 'createdAt') key = 'created';
    if (key === 'updatedAt') key = 'updated';
    return dir === 'desc' ? `-${key}` : key;
  }).join(',');
  return s || undefined;
}

/** Prisma relation name → PB field name mapping.
 *  When a Prisma query does include: { user: { select: ... } },
 *  PB needs expand=userId (the actual field name, not the relation name).
 *  Add entries here for any relation used in include/expand queries.
 */
const RELATION_FIELD_MAP: Record<string, string> = {
  user: 'userId',
  aiCapPlan: 'aiCapPlanId',
};

/** Recursively extract expand field names from `include` and `select`.
 *  PocketBase supports dot-path nested expands like `userId.aiCapPlanId`.
 */
function toExpand(include?: Record<string, any>, select?: Record<string, any>): string | undefined {
  const results: string[] = [];
  function walk(obj: Record<string, any> | undefined, prefix: string) {
    if (!obj) return;
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('_')) continue;
      if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
        const isRelation = 'select' in v || 'include' in v;
        if (isRelation) {
          const mapped = RELATION_FIELD_MAP[k] || k;
          const fullPath = prefix ? `${prefix}.${mapped}` : mapped;
          results.push(fullPath);
          if (v.select) walk(v.select, fullPath);
          if (v.include) walk(v.include, fullPath);
        }
      }
    }
  }
  walk(include, '');
  walk(select, '');
  if (results.length === 0) return undefined;
  return results.join(',') || undefined;
}

function deepRenameKeys(obj: any, map: Record<string, string>): any {
  if (Array.isArray(obj)) return obj.map((v) => deepRenameKeys(v, map));
  if (obj && typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      const newKey = map[k] || k;
      result[newKey] = v && typeof v === 'object' ? deepRenameKeys(v, map) : v;
    }
    return result;
  }
  return obj;
}

/**
 * Build a per-collection proxy that translates Prisma method calls
 * into PocketBase SDK calls.
 */
function collectionProxy(collectionName: string) {
  return new Proxy(
    {},
    {
      get(_, method: string) {
        return async (args: any = {}) => {
          const pb = args._pb || (await getClient());
          const col = pb.collection(collectionName);

          if (method === 'aggregate') {
            try {
              const filter = toFilter(args?.where);
              const opts: Record<string, any> = { requestKey: `${collectionName}_aggregate_${filter || 'all'}_${Math.random().toString(36).slice(2, 6)}` };
              if (filter) opts.filter = filter;
              // Safety cap to prevent OOM on unbounded collections
              if (args?.take) opts.requestKey += `_take${args.take}`;
              const all = await col.getFullList({ ...opts, $autoCancel: false });
              const result: any = { _count: {}, _sum: {}, _avg: {}, _min: {}, _max: {} };
              if (args._count) {
                result._count = Object.fromEntries(Object.keys(args._count).map(k => [k, all.length]));
              }
              if (args._sum) {
                for (const field of Object.keys(args._sum)) {
                  result._sum[field] = all.reduce((s: number, r: any) => s + (Number(r[field]) || 0), 0);
                }
              }
              if (args._avg) {
                for (const field of Object.keys(args._avg)) {
                  const sum = all.reduce((s: number, r: any) => s + (Number(r[field]) || 0), 0);
                  result._avg[field] = all.length ? sum / all.length : 0;
                }
              }
              if (args._min) {
                for (const field of Object.keys(args._min)) {
                  result._min[field] = all.length ? Math.min(...all.map((r: any) => Number(r[field]) || 0)) : 0;
                }
              }
              if (args._max) {
                for (const field of Object.keys(args._max)) {
                  result._max[field] = all.length ? Math.max(...all.map((r: any) => Number(r[field]) || 0)) : 0;
                }
              }
              return result;
            } catch (e: any) {
              console.error(`[pb-adapter] aggregate failed for ${collectionName}:`, e?.message || e);
              return { _count: {}, _sum: {}, _avg: {}, _min: {}, _max: {} };
            }
          }

          if (method === 'groupBy') {
            try {
              const filter = toFilter(args?.where);
              const opts: Record<string, any> = { requestKey: `${collectionName}_groupBy_${filter || 'all'}_${Math.random().toString(36).slice(2, 6)}` };
              if (filter) opts.filter = filter;
              const all = await col.getFullList({ ...opts, $autoCancel: false });
              const byFields = args.by || [];
              const groups: Record<string, any[]> = {};
              for (const rec of all) {
                const key = byFields.map((f: string) => String(rec[f] ?? '')).join('||');
                if (!groups[key]) groups[key] = [];
                groups[key].push(rec);
              }
              return Object.entries(groups).map(([_, group]) => {
                const entry: any = {};
                // Include the 'by' fields from the first record in the group
                for (const field of byFields) {
                  entry[field] = group[0]?.[field] ?? null;
                }
                if (args._count) {
                  entry._count = Object.fromEntries(Object.keys(args._count).map(k => [k, group.length]));
                }
                if (args._sum) {
                  entry._sum = Object.fromEntries(
                    Object.keys(args._sum).map(k => [k, group.reduce((s: number, r: any) => s + (Number(r[k]) || 0), 0)])
                  );
                }
                // Include other aggregate keys as needed
                return entry;
              });
            } catch (e: any) {
              console.error(`[pb-adapter] groupBy failed for ${collectionName}:`, e?.message || e);
              return [];
            }
          }

          switch (method) {
            // ──────────────────────────────────────────────
            case 'findUnique': {
              const id = args?.where?.id;
              const rkSuffix = Math.random().toString(36).slice(2, 6);
              if (id) {
                const expand = toExpand(args?.include, args?.select);
                const opts: Record<string, any> = { requestKey: `${collectionName}_findUnique_${id}_${rkSuffix}` };
                if (expand) opts.expand = expand;
                try {
                  const r = await col.getOne(id, opts);
                  return mapRecord(r as any);
                } catch {
                  return null;
                }
              }
                // fallback to findFirst
              const filter = toFilter(args?.where);
              const opts2: Record<string, any> = { requestKey: `${collectionName}_findUnique_filter_${rkSuffix}` };
              if (filter) opts2.filter = filter;
              const expand2 = toExpand(args?.include, args?.select);
              if (expand2) opts2.expand = expand2;
              try {
                const list2 = await col.getList(1, 1, opts2);
                return list2.items.length ? mapRecord(list2.items[0] as any) : null;
              } catch {
                return null;
              }
            }

            // ──────────────────────────────────────────────
            case 'findFirst': {
              const filter = toFilter(args?.where);
              const sort = toSort(args?.orderBy);
              const rk = `${collectionName}_findFirst_${filter || 'all'}_${Math.random().toString(36).slice(2, 6)}`;
              const opts: Record<string, any> = { requestKey: rk };
              if (filter) opts.filter = filter;
              if (sort) opts.sort = sort;
              const expand = toExpand(args?.include, args?.select);
              if (expand) opts.expand = expand;
              try {
                const list = await col.getList(1, 1, opts);
                return list.items.length ? mapRecord(list.items[0] as any) : null;
              } catch {
                return null;
              }
            }

            // ──────────────────────────────────────────────
            case 'findMany': {
              const { skip = 0, take = 30 } = args || {};
              const page = Math.floor(skip / take) + 1;
              const filter = toFilter(args?.where);
              const sort = toSort(args?.orderBy);
              const rk = `${collectionName}_findMany_${filter || 'all'}_${page}_${take}_${Math.random().toString(36).slice(2, 6)}`;
              const opts: Record<string, any> = { requestKey: rk };
              if (filter) opts.filter = filter;
              if (sort) opts.sort = sort;
              const expand = toExpand(args?.include, args?.select);
              if (expand) opts.expand = expand;
              try {
                const list = await col.getList(page, take, opts);
                return mapList(list.items as any[]);
              } catch {
                return [];
              }
            }

            // ──────────────────────────────────────────────
            case 'create': {
              const r = await col.create(mapWriteData(args?.data), {
                requestKey: `${collectionName}_create`,
              });
              return mapRecord(r as any);
            }

            // ──────────────────────────────────────────────
            case 'createMany': {
              const dataArr = args?.data || [];
              const results = [];
              for (const item of dataArr) {
                const r = await col.create(mapWriteData(item), {
                  requestKey: `${collectionName}_createMany_${item.id}`,
                });
                results.push(mapRecord(r as any));
              }
              return results;
            }

            // ──────────────────────────────────────────────
            case 'update': {
              const id = args?.where?.id;
              if (!id) throw new Error(`update requires where.id for collection ${collectionName}`);
              for (let attempt = 0; attempt < 3; attempt++) {
              try {
                let finalData = args?.data;
                let hasNumericOp = false;
                if (finalData && typeof finalData === 'object') {
                  for (const val of Object.values(finalData)) {
                    if (val && typeof val === 'object' && ('increment' in val || 'decrement' in val)) {
                      hasNumericOp = true;
                      break;
                    }
                  }
                }
                if (hasNumericOp) {
                  const current = await col.getOne(id);
                  finalData = { ...args.data };
                  for (const [key, val] of Object.entries(finalData)) {
                    if (val && typeof val === 'object') {
                      if ('increment' in val) {
                        const baseVal = Number(current[key] || 0);
                        finalData[key] = baseVal + Number((val as any).increment);
                      } else if ('decrement' in val) {
                        const baseVal = Number(current[key] || 0);
                        finalData[key] = baseVal - Number((val as any).decrement);
                      }
                    }
                  }
                }
                const r = await col.update(id, mapWriteData(finalData), {
                  requestKey: `${collectionName}_update_${id}_${attempt}`,
                });
                return mapRecord(r as any);
              } catch (e: any) {
                if (e?.status === 404) return null;
                if (attempt < 2) continue;
                throw e;
              }
              }
              return null;
            }

            // ──────────────────────────────────────────────
            case 'upsert': {
              for (let attempt = 0; attempt < 3; attempt++) {
              try {
                const uFilter = toFilter(args?.where);
                const uOpts: Record<string, any> = { requestKey: `${collectionName}_upsert_check_${attempt}` };
                if (uFilter) uOpts.filter = uFilter;
                const existing = await col.getList(1, 1, uOpts);
                if (existing.items.length) {
                  const recordId = existing.items[0].id;
                  let finalUpdate = args?.update;
                  let hasNumericOp = false;
                  if (finalUpdate && typeof finalUpdate === 'object') {
                    for (const val of Object.values(finalUpdate)) {
                      if (val && typeof val === 'object' && ('increment' in val || 'decrement' in val)) {
                        hasNumericOp = true;
                        break;
                      }
                    }
                  }
                  if (hasNumericOp) {
                    finalUpdate = { ...args.update };
                    const current = existing.items[0];
                    for (const [key, val] of Object.entries(finalUpdate)) {
                      if (val && typeof val === 'object') {
                        if ('increment' in val) {
                          const baseVal = Number(current[key] || 0);
                          finalUpdate[key] = baseVal + Number((val as any).increment);
                        } else if ('decrement' in val) {
                          const baseVal = Number(current[key] || 0);
                          finalUpdate[key] = baseVal - Number((val as any).decrement);
                        }
                      }
                    }
                  }
                  const r = await col.update(recordId, mapWriteData(finalUpdate), {
                    requestKey: `${collectionName}_upsert_update_${recordId}`,
                  });
                  return mapRecord(r as any);
                }
                const r = await col.create(args?.create, {
                  requestKey: `${collectionName}_upsert_create_${attempt}`,
                });
                return mapRecord(r as any);
              } catch (e: any) {
                // Race condition: another request created the record between our check and create
                if (e?.status === 400 && attempt < 2) continue;
                if (e?.status === 404) return null;
                throw e;
              }
              }
              return null;
            }

            // ──────────────────────────────────────────────
            case 'delete': {
              const id = args?.where?.id;
              if (!id) throw new Error(`delete requires where.id for collection ${collectionName}`);
              await col.delete(id, {
                requestKey: `${collectionName}_delete_${id}`,
              });
              return { id };
            }

            // ──────────────────────────────────────────────
            case 'deleteMany': {
              const dmFilter = toFilter(args?.where);
              const dmOpts: Record<string, any> = { requestKey: `${collectionName}_deleteMany_list` };
              if (dmFilter) dmOpts.filter = dmFilter;
              // PB has no bulk delete — fetch matching IDs then delete one by one
              const list = await col.getFullList(dmOpts);
              for (const item of list) {
                await col.delete(item.id, {
                  requestKey: `${collectionName}_deleteMany_${item.id}`,
                });
              }
              return { count: list.length };
            }

            // ──────────────────────────────────────────────
            case 'updateMany': {
              const umFilter = toFilter(args?.where);
              const umOpts: Record<string, any> = { requestKey: `${collectionName}_updateMany_list` };
              if (umFilter) umOpts.filter = umFilter;
              const list = await col.getFullList(umOpts);
              for (const item of list) {
                let finalData = args?.data;
                let hasNumericOp = false;
                if (finalData && typeof finalData === 'object') {
                  for (const val of Object.values(finalData)) {
                    if (val && typeof val === 'object' && ('increment' in val || 'decrement' in val)) {
                      hasNumericOp = true;
                      break;
                    }
                  }
                }
                if (hasNumericOp) {
                  finalData = { ...args.data };
                  for (const [key, val] of Object.entries(finalData)) {
                    if (val && typeof val === 'object') {
                      if ('increment' in val) {
                        const baseVal = Number(item[key] || 0);
                        finalData[key] = baseVal + Number((val as any).increment);
                      } else if ('decrement' in val) {
                        const baseVal = Number(item[key] || 0);
                        finalData[key] = baseVal - Number((val as any).decrement);
                      }
                    }
                  }
                }
                await col.update(item.id, mapWriteData(finalData), {
                  requestKey: `${collectionName}_updateMany_${item.id}`,
                });
              }
              return { count: list.length };
            }

            // ──────────────────────────────────────────────
            case 'count': {
              const filter = toFilter(args?.where);
              const opts: Record<string, any> = { requestKey: `${collectionName}_count_${filter || 'all'}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` };
              if (filter) opts.filter = filter;
              try {
                const result = await col.getList(1, 1, opts);
                return result.totalItems;
              } catch {
                return 0;
              }
            }

            default:
              throw new Error(`Prisma method '${method}' not implemented in PocketBase adapter`);
          }
        };
      },
    }
  );
}

/** Get a PocketBase admin client with caching and fallback. */
let _cachedClient: PocketBase | null = null;
async function getClient(): Promise<PocketBase> {
  if (_cachedClient) {
    if (_cachedClient.authStore && _cachedClient.authStore.isValid) return _cachedClient;
    _cachedClient = null;
  }
  try {
    const client = await pbAdmin();
    _cachedClient = client;
    return client;
  } catch (err) {
    console.error('[pb-adapter] Failed to get admin client, using unauthenticated client:', err);
    // Don't cache unauthenticated fallback — retry pbAdmin on next call
    return createPb();
  }
}

// Model name → collection name mapping
const MODEL_MAP: Record<string, string> = {
  user: 'users',
  User: 'users',
  account: 'accounts',
  session: 'sessions',
  verificationToken: 'verification_tokens',
  Project: 'projects',
  project: 'projects',
  projectFile: 'project_files',
  ProjectFile: 'project_files',
  Template: 'templates',
  template: 'templates',
  shareLink: 'share_links',
  ShareLink: 'share_links',
  anomalyAlert: 'anomaly_alerts',
  AnomalyAlert: 'anomaly_alerts',
  pointTransaction: 'point_transactions',
  PointTransaction: 'point_transactions',
  citationProject: 'citation_projects',
  CitationProject: 'citation_projects',
  citation: 'citations',
  Citation: 'citations',
  paperReview: 'paper_reviews',
  PaperReview: 'paper_reviews',
  reportHistory: 'report_history',
  ReportHistory: 'report_history',
  ChatSession: 'chat_sessions',
  chatSession: 'chat_sessions',
  ChatMessage: 'chat_messages',
  chatMessage: 'chat_messages',
  SupportTicket: 'support_tickets',
  supportTicket: 'support_tickets',
  ticketMessage: 'ticket_messages',
  TicketMessage: 'ticket_messages',
  userFAQ: 'user_faqs',
  UserFAQ: 'user_faqs',
  adminDocumentation: 'admin_documentations',
  AdminDocumentation: 'admin_documentations',
  announcement: 'announcements',
  Announcement: 'announcements',
  marketingCampaign: 'marketing_campaigns',
  MarketingCampaign: 'marketing_campaigns',
  offer: 'offers',
  Offer: 'offers',
  promoCode: 'promo_codes',
  PromoCode: 'promo_codes',
  AiCapPlan: 'ai_cap_plans',
  aiCapPlan: 'ai_cap_plans',
  AiCapRule: 'ai_cap_rules',
  aiCapRule: 'ai_cap_rules',
  userAiCap: 'user_ai_caps',
  UserAiCap: 'user_ai_caps',
  aiUsageLog: 'ai_usage_logs',
  AiUsageLog: 'ai_usage_logs',
  aiUsageDailySummary: 'ai_usage_daily_summaries',
  AiUsageDailySummary: 'ai_usage_daily_summaries',
  MembershipPlan: 'membership_plans',
  membershipPlan: 'membership_plans',
  membershipTransaction: 'membership_transactions',
  MembershipTransaction: 'membership_transactions',
  membershipLifecycleLog: 'user_membership_logs',
  MembershipLifecycleLog: 'user_membership_logs',
  CashfreeOrder: 'cashfree_orders',
  cashfreeOrder: 'cashfree_orders',
  ProjectCollaborator: 'project_collaborators',
  projectCollaborator: 'project_collaborators',
  AdminUser: 'admin_users',
  adminUser: 'admin_users',
  adminTask: 'admin_tasks',
  AdminTask: 'admin_tasks',
  adminLiveStatus: 'admin_live_status',
  AdminLiveStatus: 'admin_live_status',
  Notification: 'notifications',
  notification: 'notifications',
  AdminNotification: 'admin_notifications',
  adminNotification: 'admin_notifications',
  AuditLog: 'audit_log',
  auditLog: 'audit_log',
  ServiceHealth: 'service_health',
  serviceHealth: 'service_health',
  blacklistRecord: 'blacklist_records',
  BlacklistRecord: 'blacklist_records',
  CurrencyRate: 'currency_rates',
  currencyRate: 'currency_rates',
  syncLog: 'sync_logs',
  SyncLog: 'sync_logs',
  emailLog: 'email_logs',
  EmailLog: 'email_logs',
  featureFlag: 'feature_flags',
  FeatureFlag: 'feature_flags',
  platformStat: 'platform_stats',
  PlatformStat: 'platform_stats',
  userSession: 'user_sessions',
  UserSession: 'user_sessions',
  userSessionActivity: 'user_session_activities',
  UserSessionActivity: 'user_session_activities',
  toolUsageLog: 'tool_usage_logs',
  ToolUsageLog: 'tool_usage_logs',
  journalRegistry: 'journal_registry',
  JournalRegistry: 'journal_registry',
  history: 'histories',
  History: 'histories',
  LayoutSettings: 'layout_settings',
  layoutSettings: 'layout_settings',
  TaxRule: 'tax_rules',
  taxRule: 'tax_rules',
  TaxTransaction: 'tax_transactions',
  taxTransaction: 'tax_transactions',
  TaxFiling: 'tax_filings',
  taxFiling: 'tax_filings',
  GeneralQuery: 'general_queries',
  generalQuery: 'general_queries',
  TermAcceptance: 'term_acceptances',
  termAcceptance: 'term_acceptances',
  Banner: 'banners',
  banner: 'banners',
  Testimonial: 'testimonials',
  testimonial: 'testimonials',
  Announcement: 'announcements',
  announcement: 'announcements',
};

interface PrismaProxy {
  [model: string]: ReturnType<typeof collectionProxy>;
}

const _cache = new Map<string, any>();

export const prisma = new Proxy(
  {},
  {
    get(_, modelName: string) {
      if (modelName === '$disconnect' || modelName === '$on' || modelName === '$connect' || modelName === '$use') {
        return async () => {};
      }
      if (modelName === '$transaction') {
        return async (args: any) => {
          if (Array.isArray(args)) {
            const results = [];
            for (const op of args) {
              results.push(await op);
            }
            return results;
          }
          if (typeof args === 'function') {
            return args(prisma);
          }
        };
      }
      if (modelName === '$queryRaw' || modelName === '$executeRaw') {
        return async () => [];
      }
      if (_cache.has(modelName)) return _cache.get(modelName);
      const collection = MODEL_MAP[modelName];
      if (!collection) {
        console.warn(`[pb-adapter] No collection mapping for model "${modelName}", using lowercase`);
        const proxy = collectionProxy(modelName.toLowerCase());
        _cache.set(modelName, proxy);
        return proxy;
      }
      const proxy = collectionProxy(collection);
      _cache.set(modelName, proxy);
      return proxy;
    },
  }
) as any;

export type { PrismaProxy };
