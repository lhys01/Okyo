---
name: okyo-live-problem
description: Plan or implement Okyo subscriptions, RevenueCat, entitlements, free-tier limits, paywall timing, purchase restoration, pricing, or conversion measurement.
---

# Okyo monetization

Start from the current truth: Okyo has no active purchase provider, entitlement source, or production paywall. Do not restore static pricing UI as if purchases work.

## Sequence the work

1. Prove the first-scan cohort and measure `onboarding_complete → scan_started → result_viewed → recipe_saved` with a real privacy-reviewed sink.
2. Add RevenueCat with one server-recognizable `premium` entitlement and Supabase user identity mapping.
3. Add sandbox purchase, restore, reinstall, and entitlement-transition tests.
4. Enforce paid provider limits server-side; treat client counters as display only.
5. Show a real paywall only after the first result, at a limit, or by explicit user choice.

## Guardrails

- Never trust a local `isPremium` boolean for spend or data access.
- Never paywall before the first result.
- Never invent prices, discounts, trials, urgency, or purchase success.
- Keep free and paid recipes equally honest; gate quantity or convenience, not truthfulness.
- Keep Kiko calm and non-coercive.

Document real product IDs, entitlement ownership, failure states, and rollback only when implementation exists. Report sandbox versus production verification explicitly.
