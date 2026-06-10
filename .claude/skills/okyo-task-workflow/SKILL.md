---
name: Okyo Task Workflow
description: Use when implementing code changes, fixing bugs, reviewing behavior, or planning work in the Okyo repo.
---

# Okyo Task Workflow

Use this workflow for engineering tasks in Okyo.

## Before Editing

1. Restate the goal in simple terms.
2. Inspect the relevant files first.
3. Make a reasonable assumption if the prompt is vague.
4. Ask only if the task is impossible or dangerous without user input.
5. Explain the planned changes briefly.

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
- How to test it
- Any issues or next steps
