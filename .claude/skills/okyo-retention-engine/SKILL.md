---
name: okyo-retention-engine
description: Design or change Okyo XP, daily check-in, completion rewards, badges, challenges, notifications, streaks, activation, or other return behavior.
---

# Okyo retention engine

Keep retention quiet, honest, and tied to food outcomes.

## Current state

- `useOkyoStore.ts` persists XP, idempotent award event IDs, and one daily check-in date.
- Real actions award XP once for result view, save, grocery export, cooking completion, and scan-result sharing.
- There is no active streak, badge, challenge, leaderboard, notification, or subscription system.

Verify current callers before changing the store. Preserve the 5,000-event bound and stable event IDs so repeated taps, remounts, and restarts cannot farm rewards.

## Product rules

- Reward real cooking progress more than app opening.
- Let Kiko carry emotion; make the number a receipt, not the headline.
- Avoid guilt, countdowns, lost streaks, fake people, and fabricated rankings.
- Add social/ranking surfaces only with real cohort data.
- Add notifications only with explicit permission, a real scheduling path, and settings that actually work.
- Gate unfinished mechanics off by default and define measurement before launch.

Run mobile tests and manually repeat the triggering action before and after restart. State whether analytics are actually connected; event constants alone are not measurement.
