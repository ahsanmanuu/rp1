-- ============================================================
-- AI Usage Capping System — Supabase Migration
-- Run this in Supabase SQL Editor or via CLI
-- ============================================================

-- 1. AI Cap Plans table
CREATE TABLE IF NOT EXISTS ai_cap_plans (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  daily_token_cap INTEGER NOT NULL DEFAULT 10000,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. User AI Caps (assignment of plans to users)
CREATE TABLE IF NOT EXISTS user_ai_caps (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES ai_cap_plans(id) ON DELETE CASCADE,
  custom_daily_cap INTEGER,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by TEXT,
  UNIQUE(user_id, plan_id)
);

-- 3. AI Usage Daily Summaries
CREATE TABLE IF NOT EXISTS ai_usage_daily_summaries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  request_count INTEGER NOT NULL DEFAULT 0,
  agent_breakdown JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- 4. Add columns to profiles table (Supabase user metadata)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_cap_plan_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_daily_cap_override INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_agent_reactivates_at TIMESTAMPTZ;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_user_ai_caps_user_id ON user_ai_caps(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ai_caps_plan_id ON user_ai_caps(plan_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_user_date ON ai_usage_daily_summaries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_date ON ai_usage_daily_summaries(date);

-- 6. Row Level Security (RLS)
ALTER TABLE ai_cap_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ai_caps ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_daily_summaries ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admin full access on ai_cap_plans"
  ON ai_cap_plans FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin full access on user_ai_caps"
  ON user_ai_caps FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin full access on ai_usage_daily_summaries"
  ON ai_usage_daily_summaries FOR ALL
  USING (true)
  WITH CHECK (true);

-- Users can read their own caps and usage
CREATE POLICY "Users read own ai caps"
  ON user_ai_caps FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users read own ai usage"
  ON ai_usage_daily_summaries FOR SELECT
  USING (auth.uid()::text = user_id);

-- 7. Seed default cap plans
INSERT INTO ai_cap_plans (name, label, daily_token_cap, description) VALUES
  ('free', 'Free Tier', 10000, 'Default cap for free users. 10,000 tokens per day across all AI agents.'),
  ('pro', 'Pro Plan', 50000, 'Enhanced cap for premium subscribers. 50,000 tokens per day.'),
  ('enterprise', 'Enterprise', 200000, 'High-volume cap for enterprise accounts. 200,000 tokens per day.')
ON CONFLICT (name) DO NOTHING;

-- 8. Function: Check if user has exceeded daily AI cap
CREATE OR REPLACE FUNCTION check_user_ai_cap(p_user_id TEXT)
RETURNS TABLE(
  is_capped BOOLEAN,
  daily_cap INTEGER,
  used_today INTEGER,
  remaining INTEGER,
  reactivates_at TIMESTAMPTZ,
  plan_name TEXT
) AS $$
DECLARE
  v_cap INTEGER;
  v_used INTEGER;
  v_override INTEGER;
  v_reactivates TIMESTAMPTZ;
  v_plan_name TEXT;
  v_today TEXT := to_char(now(), 'YYYY-MM-DD');
BEGIN
  -- Get user's cap override or plan cap
  SELECT p.ai_daily_cap_override, p.ai_agent_reactivates_at
  INTO v_override, v_reactivates
  FROM profiles p
  WHERE p.id = p_user_id::uuid;

  -- Get plan cap
  SELECT acp.daily_token_cap, acp.name
  INTO v_cap, v_plan_name
  FROM user_ai_caps uac
  JOIN ai_cap_plans acp ON acp.id = uac.plan_id
  WHERE uac.user_id = p_user_id
  AND acp.is_active = true
  LIMIT 1;

  -- Use override if set, otherwise use plan cap, otherwise default 10000
  v_cap := COALESCE(v_override, v_cap, 10000);

  -- Get today's usage
  SELECT COALESCE(total_tokens, 0) INTO v_used
  FROM ai_usage_daily_summaries
  WHERE user_id = p_user_id AND date = v_today;

  v_used := COALESCE(v_used, 0);

  RETURN QUERY SELECT
    (v_used >= v_cap) AS is_capped,
    v_cap AS daily_cap,
    v_used AS used_today,
    GREATEST(v_cap - v_used, 0) AS remaining,
    v_reactivates AS reactivates_at,
    COALESCE(v_plan_name, 'free') AS plan_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Function: Increment daily usage (called after each AI request)
CREATE OR REPLACE FUNCTION increment_ai_usage(
  p_user_id TEXT,
  p_agent TEXT,
  p_prompt_tokens INTEGER,
  p_completion_tokens INTEGER
) RETURNS VOID AS $$
DECLARE
  v_today TEXT := to_char(now(), 'YYYY-MM-DD');
  v_total INTEGER := p_prompt_tokens + p_completion_tokens;
BEGIN
  INSERT INTO ai_usage_daily_summaries (user_id, date, total_tokens, prompt_tokens, completion_tokens, request_count, agent_breakdown)
  VALUES (
    p_user_id,
    v_today,
    v_total,
    p_prompt_tokens,
    p_completion_tokens,
    1,
    jsonb_build_object(p_agent, v_total)
  )
  ON CONFLICT (user_id, date) DO UPDATE SET
    total_tokens = ai_usage_daily_summaries.total_tokens + v_total,
    prompt_tokens = ai_usage_daily_summaries.prompt_tokens + p_prompt_tokens,
    completion_tokens = ai_usage_daily_summaries.completion_tokens + p_completion_tokens,
    request_count = ai_usage_daily_summaries.request_count + 1,
    agent_breakdown = ai_usage_daily_summaries.agent_breakdown || jsonb_build_object(p_agent, COALESCE((ai_usage_daily_summaries.agent_breakdown->>p_agent)::integer, 0) + v_total),
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
