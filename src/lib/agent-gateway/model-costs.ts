import type { ProviderConfig } from './types';

/**
 * Relative cost tiers for known models (0 = free, higher = more expensive).
 * Used by getCheapestModel to route cost-sensitive passes (component-latex
 * generation, count re-verification) to the cheapest available model.
 * Unknown models default to DEFAULT_MODEL_COST so they never win cheapness.
 */
export const MODEL_COSTS: Record<string, number> = {
  // opencode zen — free
  'big-pickle': 0,
  'deepseek-v4-flash-free': 0,
  'mimo-v2.5-free': 0,
  'north-mini-code-free': 0,
  'nemotron-3-ultra-free': 0,
  // openrouter — paid, lite-first ordering
  'google/gemini-2.0-flash-lite-001': 1,
  'google/gemini-2.0-flash-001': 2,
  'google/gemini-2.5-flash-001': 3,
  'mistral/mistral-small-3.1-24b-instruct': 4,
  // gemini native — free tier / rate-limited
  'gemini-2.0-flash-lite': 1,
  'gemini-2.0-flash-exp': 2,
  'gemini-2.5-flash': 3,
};

export const DEFAULT_MODEL_COST = 5;

/** Capability tiers for model choice: 0 = any task, 1 = structured JSON,
 * 2 = long-context structured analysis. */
const MODEL_TIERS: Record<string, number> = {
  'big-pickle': 1,
  'deepseek-v4-flash-free': 2,
  'mimo-v2.5-free': 1,
  'north-mini-code-free': 1,
  'nemotron-3-ultra-free': 2,
  'google/gemini-2.0-flash-lite-001': 1,
  'google/gemini-2.0-flash-001': 2,
  'google/gemini-2.5-flash-001': 2,
  'mistral/mistral-small-3.1-24b-instruct': 1,
  'gemini-2.0-flash-lite': 1,
  'gemini-2.0-flash-exp': 2,
  'gemini-2.5-flash': 2,
};
export const DEFAULT_MODEL_TIER = 1;

/**
 * Pick the cheapest available model (lowest MODEL_COSTS tier, deterministic
 * tie-break by provider order) that meets the required capability tier.
 * `exclude` removes models that must not be selected (e.g. a paid override
 * already in use). Returns null when no provider/model is available.
 */
export function getCheapestModel(
  providers: ProviderConfig[],
  opts: { minTier?: number; exclude?: string[] } = {}
): string | null {
  const minTier = opts.minTier ?? 1;
  const exclude = new Set(opts.exclude || []);
  let best: string | null = null;
  let bestCost = Infinity;
  let bestTier = -1;

  for (const provider of providers) {
    if (!provider.apiKey) continue;
    for (const model of provider.models) {
      if (exclude.has(model)) continue;
      const cost = MODEL_COSTS[model] ?? DEFAULT_MODEL_COST;
      const tier = MODEL_TIERS[model] ?? DEFAULT_MODEL_TIER;
      if (tier < minTier) continue;
      if (cost < bestCost || (cost === bestCost && tier > bestTier)) {
        bestCost = cost;
        bestTier = tier;
        best = model;
      }
    }
  }
  return best;
}
