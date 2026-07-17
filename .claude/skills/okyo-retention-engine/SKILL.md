---
name: Okyo Retention Engine
description: Use when touching XP, badges, streaks, daily check-in, challenges, notifications, activation, habit loops, or anything meant to bring users back.
---

# Okyo Retention Engine

## When to use this

Any task about rewards, progression, daily return loops, activation, or notifications.

## Founder direction (July 2026, binding)

**Honest light gamification.** Keep XP and badges — but real and quiet. Retention comes primarily from Kiko, cooking wins, saved recipes, and honest savings progress. Rules:

- Every reward is tied to a real user action. Zero fake stats, streaks, or people.
- No leaderboard until real users exist to populate it.
- Streaks, if added, must be gentle — no loss-pressure, no guilt, no countdown timers.
- Numbers support the emotion; they are not the product.

## Current implementation (verify before building on it)

All in `apps/mobile/src/state/useOkyoStore.ts` (persisted via AsyncStorage):

- `xp` + `addXP` + `awardXPOnce(eventId, points)` — idempotent awards, event log ring-buffered at 5,000.
- `claimDailyCheckIn(dateKey)` — +5 XP once per day (`lastDailyCheckInDate`). This is the only daily-return mechanic today. No streak counter exists.
- `unlockedBadges` / `recentBadgeUnlock` / `unlockBadge` — badge ids, one-shot banner.
- `completedChallenges` — Dupe Challenge results (rating, matchScore, moneySaved, xpEarned).
- `weeklyScanCount` — **known trap: never resets weekly** (docs/audits/TOP_10_RISKS.md, M2). Display-only; never use it for entitlement limits.
- Notifications: `expo-notifications` dep + `apps/mobile/src/utils/notifications.ts`; onboarding captures `notificationChoice` ('remind_me' | 'not_now').
- Analytics events exist for the whole loop (`XP_EVENT_RECORDED`, `BADGE_UNLOCKED`, `CHALLENGE_*`) but `track()` is muted (`shouldLogAnalytics = false` in `apps/mobile/src/analytics/track.ts`) and has no backend — retention is currently **unmeasurable**. Fix measurement before tuning mechanics.

## Known violation to kill

`apps/mobile/src/mocks/xp.ts` still exports `mockLeaderboardEntries` — 5 fake people including "You" at rank 3 — and `useOkyoStore` seeds and **persists** `leaderboardEntries` from it. Commit e703745 removed mock rows from UI, but the data source and store seed survived. Any retention work should remove or hard-gate this first. Grep before trusting any "removed" claim.

## Historical lessons (paid for in rework)

- Share card was de-gamified: badge/leaderboard fallbacks stripped (commit 17fac75), because fake social proof is off-brand and dishonest.
- Daily kitchen spark needed a dismiss-after-claim fix (commit ec23f50) — reward UI must acknowledge the claim immediately or users re-tap.
- Savings display is gated on `userRestaurantPrice` (user-entered) — AI estimates alone never show savings. Same honesty bar applies to any retention number.
- Fake 3-mode recipe generation was deleted entirely (single-recipe refactor, June 2026): faking breadth to look rich always gets ripped out later.

## Activation (the first loop matters most)

- Onboarding: 7-step flow (June 2026 redesign) — hero screen, Kiko reactions, trial paywall at the end. Philosophy in `docs/design/OKYO_ONBOARDING_PHILOSOPHY.md`, strategy in `docs/design/ACTIVATION_STRATEGY.md`.
- The activation moment is the **first scan → first result**. Everything in onboarding funnels there. Never paywall before first scan (docs/wiki/MONETIZATION.md).
- Store flags: `firstOnboardingScanCompleted`, `firstOnboardingResultSeen`, `paywallShown`.

## Design rules for new mechanics

1. Measure first: wire the analytics event before or with the mechanic.
2. Reward real cooking outcomes (cooked it, saved it, shopped it) over app-opening rituals.
3. Quiet by default: XP totals live in Profile/Rankings, not shouted on every screen.
4. Kiko delivers the emotion; the number is a receipt, not the headline (see okyo-kiko-system skill).
5. Warm notifications are invitations ("Kiko found tonight's dinner idea"), never guilt ("You're about to lose your streak!").
6. Anything social (leaderboards, sharing ranks) waits for real cohort data.

## Verification

- `cd apps/mobile && npx tsc --noEmit`
- Grep for `mock` in any retention surface you ship — zero fake data reaches users.
- Manual: fresh install → onboarding → first scan → result; confirm rewards fire once, persist across restart, and never fire for failed scans.
