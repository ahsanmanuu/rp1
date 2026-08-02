# Doc2LaTeX Pipeline — Exception Matrix

Every known fragile path in the doc2latex pipeline, its failure mode, the
defense in place, and how to observe it. Anything marked **LIVE** is shipped;
**PLAN** entries are deferred hardening.

## 1. PocketBase record caps (content trimming / loss)

| # | Path | Failure mode | Defense | Status |
|---|------|--------------|---------|--------|
| 1.1 | `upload/route.ts` structuredContent build (~1302) | Pathological docs exceed PB field limit → record rejected or content trimmed | Raise field limits via `ensureContentSizeLimits()`, then trim XML → HTML → budgeted HTML; stats stay intact | LIVE |
| 1.2 | `upload/route.ts` latexContent guard (~1371) | Assembled main.tex exceeds cap → trimmed, editor still works via modular files | Trim with `% [CONTENT TRIMMED BY LIMIT]` marker; modular components + disk copy remain full | LIVE |
| 1.3 | PB record loss / DB wipe | Whole project content gone → editor + compile + report empty | Phase 2 local-first harvest: `persistProjectToLocalFs` writes main.tex, images, modular components, ai-verdict.json to `public/uploads/projects/<id>/`; GET `/api/projects/[id]` self-heals structuredContent (aiLatex/verdict) and latexContent from disk; client keeps `ai_verdict_<id>` in localStorage | LIVE |

## 2. AI structure passes

| # | Path | Failure mode | Defense | Status |
|---|------|--------------|---------|--------|
| 2.1 | Pass A/B timeout | Slow provider → whole upload stuck | `FRONTMATTER_PASS_TIMEOUT_MS=90000`, `STRUCTURE_PASS_TIMEOUT_MS=120000` races; null → heuristic parse kept | LIVE |
| 2.2 | `_failSafe` / `_partial` AI JSON | Malformed AI output applied blindly | All raw responses rejected if `_failSafe`/`_partial`; `normalizeVerdict` + `reconcileVerdict` containment-verify against real text; stats clamped against real assets | LIVE |
| 2.3 | Count inflation (equations/pseudocode) | AI reports more than parser found → wrong stats/latex | Scoped recount re-verification (≤40s) when diff > 1; refined answer replaces AI count | LIVE |
| 2.4 | AI component fragments invalid | `\begin` mismatch, forbidden commands, invented image names → broken compile | `LatexFragmentValidator` (balanced envs, command whitelist, image targets must exist); invalid fragments dropped → deterministic assembler output | LIVE |
| 2.5 | No paid keys | Override null → weak default models | `AI_CHEAP_FALLBACK_MODEL` via `getCheapestModel` (free providers first) for cost-sensitive passes; callLLM chain still falls back across providers | LIVE |

## 3. Assembly

| # | Path | Failure mode | Defense | Status |
|---|------|--------------|---------|--------|
| 3.1 | `\includegraphics`/`\zimg` target missing | Compile error or blank figure — silent | `auditLatexImageReferences` in upload + apply-template logs every unresolved reference (`[IMAGE-AUDIT]`) | LIVE |
| 3.2 | Figure order drift | AI fragments mis-ordered vs document | Fragments keyed by index in document order; index must match; dedupe/sort in validator | LIVE |
| 3.3 | BibTeX mismatch | `\cite{refN}` without matching `\bibitem` → compile failure | Assembler emits keys `ref1..refN` matching escape path; real parsed authors; `scratch/verify-bibtex.cjs` regression | LIVE |
| 3.4 | main.tex missing on disk before first compile | apply-template/PUT write it later — gap if user compiles early | Upload-time local harvest writes main.tex immediately; GET heals from disk | LIVE |

## 4. Compilation

| # | Path | Failure mode | Defense | Status |
|---|------|--------------|---------|--------|
| 4.1 | Local tectonic binary missing | Silent fallback to remote | Warning returned (`bin/tectonic(.exe) missing`) + client toast | LIVE |
| 4.2 | Missing package/class/file | Compile error; auto-healer stubs it but output degraded | Stub generation tracked (`generatedStubs`), returned as `warning` + `degraded: true`; client surfaces it | LIVE |
| 4.3 | Non-zero exit with readable PDF | Partial PDF presented as success | `warning` + `degraded: true`; client shows warning toast + console | LIVE |
| 4.4 | Ghost inking failure | PDF without embedded figures, logged silently | `[PIPELINE]` warn + `warnings[]` in response; client surfaces | LIVE |
| 4.5 | Cloud autosave PUT failure before compile | Changes lost, logged silently | PUT awaited; failure flags `autoSyncFailed` → warning toast | LIVE |
| 4.6 | Render starter 300s request cap | Upload path worst case ≈ extraction + 120s; compile can exceed 300s | Timeout ladder 30s→300s; compile is a separate request; client XHR 300s + retries | LIVE (watch: huge theses) |

## 5. Reporting

| # | Path | Failure mode | Defense | Status |
|---|------|--------------|---------|--------|
| 5.1 | Raw LaTeX reaching report surfaces | Stats page renders tex source | Reports are stats-only by construction; `sanitizeAlgoContent` strips tex blocks; `scratch/test-report-no-latex.cjs` tripwire (11 checks) | LIVE |
| 5.2 | Share page exposes full source | By design (share token) | Out of scope; token-gated | LIVE |

## 6. Observability markers

- `[AI-Structure]` — pass lifecycle, validations, recount verdicts
- `[IMAGE-AUDIT]` — unresolved includegraphics/zimg targets
- `[API_PROJECT_HEAL]` — disk/DB self-heal events
- `[TELEMETRY] Local-first harvest` — artifacts written at upload
- `[TECTONIC] Auto-Healer` / `[PIPELINE]` — compile degradation events
- `[ModelSync]` — provider/model availability changes

## PLAN (deferred)

- 4.7 Compile-time `includegraphics` audit inside the compile temp dir before invoking tectonic.
- 4.8 Recompile retry with auto-removed offending image references (only when audit shows >80% resolved).
- 2.6 Golden-doc regression suite (Phase 8) replaying representative documents end-to-end.
