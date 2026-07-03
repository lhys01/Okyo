# Onboarding

## Purpose
Full documentation of the onboarding system: sequence, psychology, copy goals, and boundaries. This detail intentionally lives here, not in `CLAUDE.md`.

## Source Files Inspected
`apps/mobile/src/screens/WelcomeScreen.tsx` (the whole flow is a state machine in this one screen), `apps/mobile/src/components/onboarding/OnboardingUI.tsx` (OnboardingHeroScreen, OnboardingScanCard, OnboardingLoadingScreen, OnboardingFirstResultScreen, OnboardingPaywallScreen, KikoSpeechBubble, OnboardingStatefulButton, onboardingColors), `apps/mobile/src/components/KikoMascot.tsx`, `apps/mobile/src/state/useOkyoStore.ts` (onboarding flags), `apps/mobile/src/utils/notifications.ts`, `apps/mobile/src/navigation/AppNavigator.tsx`.

## Current Behavior

### Screen sequence
`AppNavigator` shows an onboarding-only stack while `hasCompletedOnboarding` is false. WelcomeScreen runs a local state machine over `OnboardingScreenKey`:

| # | Key | What the user sees | Fear it handles |
|---|-----|--------------------|-----------------|
| 0 | `splash` | Animated logo fade (not in progress bar) | — |
| 1 | `hero` | Value promise + Kiko | "What is this app?" |
| 2 | `weeklyGoal` | Casual/Regular/Serious/All-in (1/3/5/7 meals per week) | "Will this demand too much of me?" |
| 3 | `reminder` | Notification choice `remind_me` / `not_now` (schedules daily reminder) | "Will it spam me?" — opting out is a first-class button |
| 4 | `loading` | "Building Your Plan", auto-advances after 2.5 s | Makes the choices feel consequential |
| 5 | `scan` | First real scan (camera or Photos) — the actual product | "Is the AI real?" — proof, not promises |
| 6 | `firstResult` | The user's own scanned dish + recipe | Payoff; "aha" moment |
| 7 | `paywall` | Trial paywall (`markPaywallShown`) | Monetization after value is proven |

Progress bar covers steps 1-7. Back navigation skips the `loading` step. Scan errors during onboarding show a friendly retry state (`LatestScanFailure`), never a fake result.

### Psychology & copy goals
- Reach a real scan result as fast as possible — the first session promise is "open app, scan meal, see result".
- Every step collects at most one decision; copy is short, warm, curiosity-driven, with Kiko reactions (speech bubbles) instead of corporate copy.
- The paywall comes **after** the first result so it sells a proven experience.

### State written
`completeOnboarding`, `setWeeklyGoal`, `setNotificationChoice`, `markFirstOnboardingScanCompleted`, `markFirstOnboardingResultSeen`, `markPaywallShown` — all persisted via zustand/AsyncStorage. Settings offers "Reset Onboarding" for QA.

## Important Constraints
- Onboarding scan uses the same API pipeline as the main scan flow ([SCAN_FLOW.md](./SCAN_FLOW.md)) — no special mock path for real images.
- Analytics: `ONBOARDING_START` and step events via `analytics/track.ts`.

## What Onboarding Must Not Become
- No long questionnaire (diet quizzes, allergy forms, calorie goals).
- No login/account wall — there are no accounts yet.
- No dark-pattern notification or paywall coercion; "Not now" stays a first-class path.
- No feature tour slides — the product demo IS the scan.

## Known Risks / Edge Cases
- The whole flow lives in one 1100-line file; extracting steps would ease review but is not urgent.
- If the scan fails during onboarding (offline, API down), user must be able to retry or continue — test this path when editing.

## Related Docs
[SCAN_FLOW.md](./SCAN_FLOW.md) · [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) · [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) · legacy [USER_FLOWS.md](./USER_FLOWS.md), [UX_COPY.md](./UX_COPY.md)
