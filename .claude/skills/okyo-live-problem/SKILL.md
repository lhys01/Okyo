---
name: Okyo Live Problem — Monetization
description: Use when working on monetization, RevenueCat, paywall, free-tier limits, premium entitlements, pricing, or revenue measurement. This is the company's #1 unresolved problem.
---

# Okyo Live Problem: Monetization

## The problem (founder-designated, July 2026)

Okyo has **zero revenue infrastructure**. No RevenueCat, no purchases library, no store products. `isPremium` is a local Zustand boolean anyone's build can flip; `PaywallScreen.tsx` is a static screen; `docs/wiki/MONETIZATION.md` is 25 lines of intent. The founder's decision: **wire RevenueCat immediately after the TestFlight cohort works** — cohort first, revenue second, but nothing built now may block it.

## Ground truth today

- `apps/mobile/src/screens/PaywallScreen.tsx` + `components/PricingCards.tsx` — UI only.
- `useOkyoStore`: `isPremium` (local, unguarded `setPremium`), `paywallShown` onboarding flag.
- Intended tiers (MONETIZATION.md): Free = 3 scans/week, basic Restaurant Copy, watermarked share cards, limited saves. Premium = unlimited scans, all modes, exports, no watermark.
- **Binding rule: never paywall before first scan.** The magic moment comes first.
- `weeklyScanCount` in the store **never resets** — it cannot enforce the free tier. Enforcement must be server-side anyway.
- Analytics are dead (`track()` muted, no backend) — conversion is currently unmeasurable.
- Supabase per-user daily scan caps (migration `202607120001`) already exist — this is the server-side enforcement mechanism to build on.

## Campaign plan

### Phase 0 — Measure (now, during cohort work)
Wire `track()` to a real sink (Supabase events table exists in the cohort schema). Minimum funnel: `onboarding_complete → scan_started → result_viewed → recipe_saved → paywall_viewed`.
**Gate:** funnel events visible for real cohort users. You cannot price what you cannot measure.

### Phase 1 — RevenueCat integration
- Add `react-native-purchases`; configure App Store Connect products: monthly + annual + intro trial.
- Single entitlement: `premium`. `isPremium` becomes **derived from RevenueCat customer info** — the local flag survives only as a cached mirror, never the source of truth.
- Restore purchases + anonymous→Supabase identity linking (RevenueCat appUserID = Supabase user id).
**Gate:** sandbox purchase completes; entitlement survives app reinstall; restore works; no code path sets `isPremium` except the RevenueCat listener.

### Phase 2 — Enforce the free tier server-side
- 3 scans/week enforced in the API using Supabase counters (extend the existing daily-cap pattern to weekly). Client count is display-only.
- Weekly boundary must be timezone-honest (the migration's UTC-date pattern is the precedent).
**Gate:** free user's 4th weekly scan gets a friendly limit response with an upgrade path; premium JWT passes; API restart does not reset the count.

### Phase 3 — Paywall UX
- Trial offer surfaces AFTER first scan result (onboarding already places the trial-paywall step at the end — keep it post-value).
- Kiko stays calm on the paywall — no urgency timers, no guilt, no fake discounts (PRODUCT.md anti-references; okyo-kiko-system skill).
- Honest copy: what free includes, what premium adds, real prices.
**Gate:** manual pass — fresh install completes onboarding → first scan → result with zero payment friction; paywall appears only at limit or by choice.

### Phase 4 — Learn and tune
Track trial-start rate, trial→paid conversion, D7 retention payers vs free, scans-at-limit hits. Tune limits/pricing from data, not guesses.
**Gate:** one written pricing decision memo backed by cohort numbers.

## Success criteria

- A real human pays real money for Okyo premium through the App Store.
- Zero users hit a paywall before their first scan result.
- Entitlements enforced server-side; a tampered client gets nothing free.
- Conversion funnel measurable end-to-end.

## Dead ends — do not enter

- **Client-trusted entitlements** — anything that trusts `isPremium` from the device for server spend.
- **Paywall before first scan** — breaks the binding activation rule.
- **Fake urgency** — countdown timers, fake discounts, "only 3 left" (anti-reference: casino gamification).
- **Hand-rolled purchase infra** — StoreKit direct + custom receipt validation. RevenueCat is the decision; don't relitigate.
- **Monetizing before the cohort proves scans work** — sequencing is founder-set: cohort → RevenueCat.
- **Dishonest tier gating** — silently degrading free recipe quality. Free tier limits quantity/features, never honesty.

## Files this campaign will touch

`apps/mobile/src/screens/PaywallScreen.tsx`, `components/PricingCards.tsx`, `state/useOkyoStore.ts` (isPremium derivation), `analytics/track.ts`, `apps/api` scan route + Supabase counters, `docs/wiki/MONETIZATION.md` (update as behavior lands — wiki rule).
