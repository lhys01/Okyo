---
name: Okyo Audit Loop
description: Use when running a hostile audit, verification pass, regression check, break-testing, or validating that a previous fix actually landed in the Okyo repo.
---

# Okyo Audit Loop

## When to use this

The user asks to audit, verify, break, stress, or validate a system or a prior session's claimed fix.

## Goal

Produce evidence-backed reports following the repo's established audit ritual, without re-diagnosing already-solved bugs and without mixing auditing with fixing.

## Okyo product context

Okyo is an AI food companion, not a calorie tracker, not a generic recipe app, and not a meal planner. Honest AI is a core value — audits exist to guarantee failures are real, savings are honest, and nothing is faked. The audit ritual protects that.

## Files to inspect first

- `docs/audits/` — 30 prior reports. ALWAYS scan filenames first; a past report may already cover the bug (e.g. `STATE_CONTAMINATION_REPORT.md`, `COLD_RESTART_AUDIT.md`, `IMAGE_PERSISTENCE_AUDIT.md`, `SCALE_FAILURE_REPORT.md`, `TOP_10_RISKS.md`).
- `docs/design/` — design-side audits (`HOSTILE_AUDIT_REPORT.md`, `SCREEN_BY_SCREEN_AUDIT.md`, `TEXT_RENDERING_AUDIT.md`, `ROOT_CAUSE_REPORT.md`).
- `docs/wiki/KNOWN_RISKS.md` and `docs/wiki/KNOWN_ISSUES.md`.
- The system under audit (read-only during audit phase).

## Safe commands

- `git log --oneline -20` — what recently changed
- `git diff main...HEAD --stat` — scope of branch under audit
- `cd apps/api && npm run typecheck` and `cd apps/mobile && npx tsc --noEmit`
- `cd apps/api && npx tsx --test src/services/aiService.scan.test.ts` (node:test; inferred invocation, no npm script)
- Grep for claimed changes rather than trusting session summaries

## Exact workflow

The confirmed repo ritual is a named-report sequence. Follow it:

1. **Break/audit phase (read-only):** hunt for failures. Output `docs/audits/<TOPIC>_BREAK_REPORT.md` or `<TOPIC>_AUDIT.md`. Every finding needs file:line evidence and a severity: CRITICAL (data loss/security/dishonest AI) / HIGH (user-visible bug) / MEDIUM (maintainability) / LOW (style).
2. **Fix phase (separate step, only when user approves):** output `<TOPIC>_FIX_REPORT.md` listing exact diffs.
3. **Regression phase:** re-verify the fixes didn't break neighbors. Output `<TOPIC>_REGRESSION_REPORT.md`.
4. **Final validation:** `<TOPIC>_FINAL_VALIDATION.md` — pass/fail per original finding.
5. Update `docs/wiki/KNOWN_RISKS.md` if new standing risks were found.

Verification rule (learned the hard way in this repo): never trust a prior session's claim that something was implemented — grep the working tree for the actual code before reporting it as done.

## Quality bar

- Every finding reproducible from evidence in the report alone (file paths, line numbers, exact quotes).
- No finding repeated from an existing `docs/audits/` report without saying so.
- Severity honest — no CRITICAL inflation, no burying real breaks as LOW.
- Audit phase changed zero source files.

## Bad patterns to avoid

- Fixing while auditing (mixes evidence with mutation; ritual separates them).
- Vibes-based findings without file:line proof.
- Re-diagnosing solved bugs already documented in `docs/audits/`.
- Trusting session summaries or commit messages over working-tree grep.
- Dumping raw logs instead of the shortest decisive line.

## Example final output

> Break pass on scan image ownership complete: `docs/audits/IMAGE_BREAK_REPORT.md`. 2 CRITICAL (recipe.imageUri overwritten on new scan before save — `useOkyoStore.ts:214`; cache URI used after NSDocumentDirectory move — `ScanScreen.tsx:88`), 1 MEDIUM. 1 candidate finding dropped — already fixed per `IMAGE_PERSISTENCE_AUDIT.md`. No source files changed. Awaiting approval for fix phase.

## Done checklist

- [ ] Prior `docs/audits/` + `docs/design/` reports checked first
- [ ] Report written to `docs/audits/` with severities + file:line evidence
- [ ] Zero app-code edits during audit phase
- [ ] Explicit pass/fail or finding count in final message
