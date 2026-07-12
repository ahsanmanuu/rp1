<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Currency System Rule
The basic currency system of this application is INR (Indian Rupee, ₹). Any localized currency rates, pricing conversions, and checkout transactions must be mapped from base INR prices and amounts.

# AI Cap Rules System
A targeted capping system that applies AI usage limits to specific users based on email, IP, or location.

## Architecture
- `prisma/schema.prisma` — `AiCapRule` model: matchType (email_exact|email_domain|email_regex|ip_exact|ip_cidr|location_country|location_city), capType (daily_tokens|daily_requests|block), priority-based evaluation
- `src/lib/aiCapRules.ts` — Core enforcement library: `enforceAiCapRules(userId, ctx)` and `findMatchingRule(ctx)` with 10s cache
- `src/app/api/admin/ai-caps/rules/route.ts` — CRUD API (GET/POST/PUT/DELETE)
- `src/app/api/admin/ai-caps/rules/test/route.ts` — Test endpoint to preview rule matching
- `src/app/admin/ai-caps/rules/page.tsx` — Admin UI with list, create, edit, priority reorder, test panel
- `src/lib/agent-gateway/orchestrator.ts` — Rule enforcement checked BEFORE plan-based cap check in `routeToAgent()`
- `src/app/api/agent-gateway/route.ts` — Extracts email/IP/location from session+request, passes via context
- `src/app/api/user/ai-cap/status/route.ts` — Shows ruleName in user-facing cap status

## Enforcement Flow
1. User makes AI request → POST /api/agent-gateway
2. Agent gateway route extracts email (session) and IP/location/country (headers via getClientGeoInfo)
3. `routeToAgent()` calls `enforceAiCapRules()` with email/IP/location/agent
4. All active rules evaluated in priority order; first match wins
5. If matched: applies either daily_token cap, daily_request cap, or block (with duration)
6. If blocked: returns `AI_CAP_RULE_BLOCKED` error; status is checked by client-side AiCapWarning component
7. Falls through to existing plan-based daily token cap check
