import { pbAdmin } from "@/lib/pb";

let _aiPlanEnsureDone = false;

// Idempotent runtime migration: adds priceINR to ai_cap_plans and creates
// ai_plan_transactions collection if missing. Safe to call from any route.
export async function ensureAiPlanCollections(): Promise<void> {
  if (_aiPlanEnsureDone) return;
  try {
    const admPb = await pbAdmin();

    // ── 1. Ensure ai_cap_plans has priceINR ──
    const plansCol = await admPb.collections.getOne("ai_cap_plans").catch(() => null);
    if (plansCol) {
      const existing = new Set(
        ((plansCol as any).fields || (plansCol as any).schema || []).map((f: any) => f.name)
      );
      if (!existing.has("priceINR")) {
        const newFields = [...((plansCol as any).fields || (plansCol as any).schema || [])];
        newFields.push({ name: "priceINR", type: "number", required: false, unique: false });
        await admPb.collections.update(plansCol.id, { fields: newFields });
        console.log("[PB_AI_PLANS] Added priceINR to ai_cap_plans");
      }
    }

    // ── 2. Ensure ai_plan_transactions collection exists ──
    const txCol = await admPb.collections.getOne("ai_plan_transactions").catch(() => null);
    if (!txCol) {
      const plansColId = (plansCol as any)?.id || "ai_cap_plans";
      await admPb.collections.create({
        name: "ai_plan_transactions",
        type: "base",
        fields: [
          { name: "userId", type: "relation", required: true, collectionId: "_pb_users_auth_", cascadeDelete: true, maxSelect: 0, minSelect: 0 },
          { name: "orderId", type: "text", required: true, unique: true },
          { name: "planId", type: "relation", required: true, collectionId: plansColId, cascadeDelete: true, maxSelect: 0, minSelect: 0 },
          { name: "planName", type: "text", required: true },
          { name: "amount", type: "number", required: true },
          { name: "currency", type: "text" },
          { name: "durationMonths", type: "number", required: true },
          { name: "paymentStatus", type: "select", required: true, values: ["pending", "paid", "failed"], maxSelect: 0 },
          { name: "startsAt", type: "date" },
          { name: "expiresAt", type: "date" },
        ],
        indexes: ["CREATE INDEX idx_aipt_user ON ai_plan_transactions (userId);"],
      });
      console.log("[PB_AI_PLANS] Created ai_plan_transactions collection");
    }

    _aiPlanEnsureDone = true;
  } catch (err: any) {
    console.warn("[PB_AI_PLANS] Ensure failed (non-fatal):", err?.message);
  }
}
