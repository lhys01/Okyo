# Onboarding

## Purpose
Document the onboarding system, user psychology, screen sequence, copy goals, handled fears, and boundaries.

## Source Files Inspected
- `apps/mobile/src/screens/WelcomeScreen.tsx`
- `apps/mobile/src/components/onboarding/OnboardingUI.tsx`
- `apps/mobile/src/state/useOkyoStore.ts`
- `apps/mobile/src/utils/notifications.ts`
- `apps/mobile/src/utils/scanDecision.ts`
- `docs/design/OKYO_ONBOARDING_PHILOSOPHY.md`
- `docs/design/ACTIVATION_STRATEGY.md`

## Current Behavior
Onboarding is implemented mostly inside `WelcomeScreen` with a local `screenKey` state machine:
- `splash`: short Kiko/wordmark intro.
- `hero`: product promise and first motivation.
- `weeklyGoal`: user picks cooking frequency.
- `reminder`: user opts into reminders or skips.
- `loading`: plan-building transition and scan-analysis state.
- `scan`: camera/photo action with error recovery.
- `firstResult`: shows the user’s first scanned recipe result.
- `paywall`: soft Okyo Plus preview; purchases are not active.

User psychology:
- Reduce blank-page anxiety by asking for one simple weekly goal.
- Make the first meaningful action a scan, not account setup.
- Show that Okyo is friendly and forgiving through Kiko, warm copy, and retries.
- Handle trust concerns by showing confidence, best-guess language, and no fake result on failure.
- Handle notification hesitation by allowing skip.
- Treat paywall as preview, not a hard block in this build.

The first onboarding scan uses the same API client and scan decision helpers as the main scan path. Successful scans write the latest scan session and route into first-result/paywall completion. Failed scans return to the scan step with friendly copy.

## Important Constraints
- Do not put the full onboarding explanation in `CLAUDE.md`; route here.
- Onboarding should not become a long survey, meal planner, calorie questionnaire, or generic lifestyle quiz.
- Keep activation focused on seeing a named dish, recipe, and savings estimate from the user’s own photo.
- Avoid showing technical AI/provider errors to normal users.

## Known Risks or Edge Cases
- Onboarding scan sends the original `image` to the API while storing a persisted preview; keep these aligned if changing image handling.
- Purchases are not active, so paywall copy must remain honest.
- Reminder scheduling is local and permission-dependent.

## Related Docs
- [SCAN_FLOW.md](./SCAN_FLOW.md)
- [MOBILE_APP.md](./MOBILE_APP.md)
- [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md)
- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)
