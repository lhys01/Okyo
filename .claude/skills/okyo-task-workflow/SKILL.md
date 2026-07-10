---
name: Okyo Task Workflow
description: Use when implementing code changes, fixing bugs, reviewing behavior, or planning work in the Okyo repo.
---

# Okyo Task Workflow

Use this workflow for engineering tasks in Okyo.

## Before Editing

1. Restate the goal in simple terms.
2. Inspect the relevant files first.
3. For recurring bug areas (scan, images, state, recipes), check `docs/audits/` and `docs/wiki/KNOWN_ISSUES.md` before re-diagnosing — 30 prior reports exist.
4. Make a reasonable assumption if the prompt is vague.
5. Ask only if the task is impossible or dangerous without user input.
6. Explain the planned changes briefly.

## Paths And Worktrees

- Resolve the repo root with `git rev-parse --show-toplevel`; the checkout moves between machines/worktrees.
- Never trust hardcoded absolute paths in local scripts.
- Never claim prior work landed without grepping the working tree for it.

## Code Rules

- Keep changes small, clean, and easy to review.
- Do not rewrite unrelated code.
- Reuse existing components, styles, folders, and patterns.
- Do not delete features unless specifically asked.
- Do not change app structure unless clearly needed.
- Use simple, readable TypeScript.
- Prefer modular services over giant files.
- Avoid unnecessary dependencies.
- Add comments only when they make code easier to understand.
- Keep code readable for a beginner founder/developer.

## Feature Work

- Ship the V1 MVP path before adding advanced behavior.
- Include loading, empty, and error states when relevant.
- Keep UI mobile-friendly.
- Match the existing design style.
- Avoid complex social feeds, comments, DMs, or maps unless requested.

## Bug Fixes

- Identify the likely cause before editing.
- Fix the root problem, not just the symptom.
- Check nearby code for related bugs.
- Explain what caused the issue and what changed.
- Keep fallbacks honest and user-friendly.

## Verification

Use the narrowest useful check for the files touched.

Common checks:

- Mobile TypeScript: `cd apps/mobile && npx tsc --noEmit`
- API TypeScript: `cd apps/api && npm run typecheck`
- Whitespace check: `git diff --check`

If a check cannot be run, say why and explain what was reasoned through instead.

## Reporting Back

End with:

- What changed
- Files edited
- Commands run (typecheck/tests) and their results
- Risks
- How to test it manually
- Any issues or next steps

## Example Final Output

> Fixed grocery-list duplicate rows. Cause: `GroceryListScreen.tsx` merged saved-recipe ingredients without deduping by normalized name. Fix: dedupe on lowercase trimmed name before render; quantities summed. Files: `apps/mobile/src/screens/GroceryListScreen.tsx`. Commands: `npx tsc --noEmit` clean. Risk: quantity summing assumes same unit — mixed units still show as separate rows (intentional). Test: save two recipes sharing "garlic", open grocery list, one garlic row.

## Done Checklist

- [ ] Relevant files inspected before editing; prior `docs/audits/` findings checked for recurring bug areas
- [ ] Change focused; no unrelated rewrites; Okyo identity preserved (food companion, not calorie tracker)
- [ ] No fake data, stats, prices, or savings introduced
- [ ] Narrowest useful verification run and reported
- [ ] Report includes files changed, commands run, risks, manual test steps
