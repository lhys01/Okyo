# Okyo Moat Stack Status And Next Steps

## 1. Executive summary

Okyo now has a real first version of the food-intelligence moat: users can save messy food ideas, check whether recipes are cookable, preview personal adaptations, build smarter grocery lists, and use cooking support from Recipe Detail. The strongest shift is that Recipe Detail is no longer just a saved recipe page; it is becoming the decision surface for "can I cook this, how should I adapt it, what do I need to buy, and how do I get through cooking?"

This is not yet a fully AI-powered import/adaptation platform. The current moat stack is intentionally mock-first or deterministic-first in the risky areas, with backend support now added for Recipe Check and Make It Mine V1. That is the right shape: prove the mobile workflow, keep scan behavior safe, and only add AI extraction/adaptation once validation and simulator QA are steadier.

## 2. What is now built

- Save Food Idea: mobile UI for saving pasted/manual/link/photo-style food ideas with local storage.
- Okyo Recipe Check: user-facing recipe quality/cookability card in mobile and deterministic backend `POST /v1/recipes/check`.
- Make It Mine: local mobile adaptation previews plus deterministic backend `POST /v1/recipes/adapt`.
- Home Command Center: home now surfaces tonight-style suggestions and useful actions instead of only generic saved content.
- Smart Grocery: grocery logic exposes buy-vs-pantry thinking and reusable summary concepts.
- Cook Coach rescue/timers: guided cooking has visible coaching/rescue/timer support.
- QA artifacts: simulator screenshots were captured for Make It Mine API-running and API-stopped fallback behavior.

## 3. What is actually user-visible

- Recipe Detail shows Smart Grocery, Cook Coach, Okyo Recipe Check, and Make It Mine.
- Make It Mine chips respond and display clean user-facing preview copy.
- With the API running, Make It Mine can show backend-enhanced plan content.
- With the API stopped, Make It Mine silently keeps the local preview.
- Recipe Check shows cookability status, score, helpful fixes, and pantry/cooking checks.
- Home surfaces a "tonight" direction and saved-recipe action paths.
- No raw "backend", "fallback", or API error wording was observed during Make It Mine QA.

## 4. Backend-supported vs local-only

Backend-supported:

- `POST /v1/recipes/check`: deterministic Recipe Quality report.
- `POST /v1/recipes/adapt`: deterministic Make It Mine adaptation plan.
- Existing scan, recipe generation, saved recipe, library, grocery, and coaching endpoints remain separate from the new adapt/check endpoints.

Local-only or mostly local:

- Save Food Idea persistence and extraction are still local/mock-first.
- Home Command Center logic is local.
- Smart Grocery summaries are mobile-local.
- Cook Coach rescue/timer UI is mobile-local, with existing coaching endpoint support separate from the new moat endpoints.
- Taste Brain/profile behavior is still lightweight and local.
- No durable user account, backend pantry sync, or real food idea database is confirmed.

## 5. Current risks / untested areas

- Expo/Metro/native simulator reliability is still uneven. QA succeeded, but navigation had simulator-state hiccups and a stale tap accidentally hit Scan during testing.
- Result Summary still needs a clean simulator QA pass after native/CocoaPods/Expo reliability is stable.
- Backend Recipe Check and Make It Mine passed typechecks and targeted smoke/QA, but broader regression QA across scan -> result -> detail -> grocery -> cook should still be repeated.
- The backend Make It Mine summaries are deterministic and safe, but not yet deeply personalized.
- Food idea import is not real extraction yet; links are metadata and screenshots/manual text remain V1/local-style behavior.
- Existing AI scan/provider files remain high-risk areas and should not be expanded casually.

## 6. What not to build next

- Do not build direct TikTok, Instagram, YouTube, or Pinterest scraping.
- Do not add AI recipe adaptation that returns full rewritten recipes until validation, malformed-output handling, and Recipe Check repair gates are designed.
- Do not add strict calories/macros or nutrition tracking.
- Do not expand `aiService.ts` for new moat work.
- Do not add social feeds, streak pressure, fake coins, or casino-style retention.
- Do not add more scope before Result Summary and simulator reliability are cleaned up.

## 7. Recommended next 3 steps

1. Fix Expo/Metro/native simulator reliability and complete Result Summary QA.
2. Run a concise mobile regression pass for Recipe Check and Make It Mine with API running/stopped across Recipe Detail, Grocery, and Cook Coach.
3. Plan backend AI enhancement or real import extraction only after the above QA is stable, starting with design and malformed-output handling rather than implementation.

## 8. Best next execution prompt outline

```md
Role: You are Codex working in the Okyo repo root.

Goal: Stabilize Okyo simulator QA and complete Result Summary regression.

Do not add features. Do not change provider/model config. Do not change package files unless a native/runtime blocker clearly requires it and you report why first.

Tasks:
- Inspect current Expo/Metro/simulator launch flow.
- Identify why simulator navigation/Result Summary QA is unreliable.
- Run Result Summary QA from scan/result and saved/generated recipe paths.
- Verify Recipe Check, Make It Mine, Smart Grocery, and Cook Coach still render after navigation.
- Capture screenshots only when the simulator is genuinely showing the target states.
- Make only tiny bug fixes if a real QA blocker is found.

Validation:
- cd apps/mobile && npx tsc --noEmit
- cd apps/api && npm run typecheck
- git diff --check

Stop after QA, validation, and a short report. Do not commit unless explicitly asked.
```
