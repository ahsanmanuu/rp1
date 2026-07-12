import { pbAdmin } from "@/lib/pb";

// In-process idempotency guard — seed only runs once per server lifecycle
let _seedDone = false;

const NOW = new Date();

function uid(): string {
  return Math.random().toString(36).substring(2, 10);
}

export async function seedAiCapsDemoData() {
  // Already seeded in this process — skip
  if (_seedDone) return;
  try {
    const pb = await pbAdmin();

    // ── 0. Deduplicate plans: keep oldest of each name, delete the rest ──
    const rawPlans = await pb.collection("ai_cap_plans").getFullList({
      sort: "created",
      requestKey: `seed_dedup_plans_${uid()}`,
    });
    const seen = new Map<string, any>();
    for (const p of rawPlans) {
      if (!seen.has(p.name)) {
        seen.set(p.name, p);
      } else {
        try { await pb.collection("ai_cap_plans").delete(p.id, { requestKey: `seed_del_${p.id}_${uid()}` }); } catch {}
      }
    }

    // ── 1. Ensure the 3 core plans exist ──
    const planDefs = [
      { name: "free", label: "Free Tier", dailyTokenCap: 10000, description: "10K tokens/day — Enough for basic AI assistance." },
      { name: "pro", label: "Pro Plan", dailyTokenCap: 50000, description: "50K tokens/day — Ideal for power users." },
      { name: "enterprise", label: "Enterprise Plan", dailyTokenCap: 200000, description: "200K tokens/day — Maximum throughput." },
    ];

    const planMap = new Map<string, string>(); // name → id
    for (const p of planDefs) {
      const existing = seen.get(p.name);
      if (existing) {
        planMap.set(p.name, existing.id);
      } else {
        try {
          const created = await pb.collection("ai_cap_plans").create(p, { requestKey: `seed_create_${p.name}_${uid()}` });
          planMap.set(p.name, created.id);
        } catch {}
      }
    }

    if (planMap.size === 0) return;

    const freePlanId = planMap.get("free");

    // ── 2. Fetch ALL existing users ──
    const allUsers = await pb.collection("users").getFullList({
      fields: "id,email,name,aiCapPlanId",
      requestKey: `seed_all_users_${uid()}`,
    });

    if (allUsers.length === 0) return;

    // ── 3. Assign "free" plan to every user who has no plan ──
    for (const user of allUsers) {
      const needsPlan = !user.aiCapPlanId && freePlanId;

      if (needsPlan) {
        try {
          const existingAssign = await pb.collection("user_ai_caps").getList(1, 1, {
            filter: `userId = "${user.id}" && planId = "${freePlanId}"`,
            requestKey: `seed_assgn_chk_${user.id}_${uid()}`,
          });
          if (existingAssign.items.length === 0) {
            await pb.collection("user_ai_caps").create({
              userId: user.id,
              planId: freePlanId,
              customDailyCap: null,
              assignedBy: "auto-seed",
            }, { requestKey: `seed_assgn_${user.id}_${uid()}` });
          }
          await pb.collection("users").update(user.id, {
            aiCapPlanId: freePlanId,
          }, { requestKey: `seed_user_upd_${user.id}_${uid()}` });
        } catch {}
      }
    }

    // ── Seed AiCapRules (only if none exist) ──
    const existingRules = await pb.collection("ai_cap_rules").getList(1, 1, {
      requestKey: `seed_rules_count_${uid()}`,
    });
    if (existingRules.totalItems === 0) {
      const ruleDefs = [
        { name: "Free Tier Daily Cap", description: "Enforce 10K daily token cap for all free-tier users", matchType: "all_users", matchValue: "*", capType: "daily_tokens", capValue: 10000, agentFilter: "*", priority: 10, isActive: true },
        { name: "Block Known Abuse IP", description: "Block AI access from known abuse IP range", matchType: "ip_cidr", matchValue: "10.0.0.0/8", capType: "block", capValue: 2, agentFilter: "*", priority: 20, isActive: true },
        { name: "High Usage Domain Limit", description: "Limit requests from disposable email domains", matchType: "email_domain", matchValue: "tempmail.com", capType: "daily_requests", capValue: 20, agentFilter: "*", priority: 30, isActive: true },
        { name: "Geographic Restriction", description: "Restrict AI diagram generation from high-risk regions", matchType: "location_country", matchValue: "RU", capType: "block", capValue: 2, agentFilter: '["diagram"]', priority: 40, isActive: false },
      ];
      for (const r of ruleDefs) {
        try {
          await pb.collection("ai_cap_rules").create(r, { requestKey: `seed_rule_${r.name}_${uid()}` });
        } catch {}
      }
    }
    // Mark as complete — skip subsequent calls in this process lifecycle
    _seedDone = true;
  } catch (err) {
    console.warn("[SEED_AI_CAPS] Seed error (non-fatal):", err);
  }
}
