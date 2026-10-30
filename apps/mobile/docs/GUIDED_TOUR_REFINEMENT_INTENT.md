# Guided Tour Refinement — Intent

Baseline: branch `onboarding-improved-stage1`, HEAD `a8d5f0a`. Tour lives entirely
under `apps/mobile/src/tour/` (untracked, built earlier this session — no prior
commit to diff against). No git operations performed; all changes left
uncommitted per instruction.

## Problems in the previous iteration
- Kiko + coachmark repositioned relative to each target → visual "jump" every step.
- No true persistent shell: overlay logic mixed geometry/measurement/render in one file.
- Floating `+` button stayed bright on every step (TourOverlay's dim z-order
  didn't reliably beat React Navigation's own tab-bar layer).
- `computeCoachmarkLayout` computed a NEW position per step — spec now wants
  ZERO repositioning: one fixed "coach dock" above the tab bar for all 7 steps.
- Reset Guided Tour set `active=true` immediately; since Settings isn't a tour
  screen, the tour's own `paused` gate silently no-oped until the user
  manually switched to Home — no explicit navigate-first behavior.

## New visual system
- **CoachDock**: fixed position, bottom = tab-bar clearance (104) + 24 = 128
  from screen bottom, left/right inset 20, height 152, radius 24, cream bg.
  Never moves, never resizes, never remounts across steps.
- **Kiko**: one asset (`kiko-neutral-transparent.png`) for all 7 steps
  including completion, 112px tall, fixed position overlapping the dock's
  top-left by 34px, white sticker-contour + soft shadow. Never animates
  position; only a one-time fade-in when the tour first opens.
- **SpotlightMask**: unchanged SVG-mask technique, extracted to its own file.
  Scrim `rgba(34,32,36,0.30)`. `+` button now dims via a dedicated
  `highlightedAnchorId` flag from TourContext (not z-order), so it's dimmed on
  every step except step 4 regardless of native stacking-context quirks.
- **ProgressDots** + **Skip**: unchanged fixed top bar (already correct),
  extracted to its own file.

## Files expected to change
- `src/tour/tourSteps.ts` — drop per-step `kikoAsset`/`kikoCorner`/
  `coachmarkPlacement`/`hideKiko` (dock no longer varies); keep id/screen/
  title/body/targets/isFinish.
- `src/tour/tourGeometry.ts` — replace `computeCoachmarkLayout` (target-relative)
  with `computeFocusStage` (fixed-footer-aware viewport only); drop the now-dead
  per-step layout math.
- `src/tour/CoachDock.tsx`, `src/tour/ProgressDots.tsx`, `src/tour/SpotlightMask.tsx` — new, extracted.
- `src/tour/TourOverlay.tsx` — orchestrator only: measurement/scroll/navigation
  state machine, renders the three components above.
- `src/tour/TourContext.tsx` — add `highlightedAnchorId`, `pendingStart` +
  `confirmPendingStart` (reset-then-navigate-then-activate sequencing).
- `src/components/okyo/ScanFab.tsx` — self-dims via `highlightedAnchorId`.
- `src/screens/SettingsScreen.tsx` — Reset Guided Tour navigates to Home,
  activation waits for Home focus.
- `src/tour/*.test.ts` — updated/new regression coverage.

## Tour state behavior
`devReset()` no longer sets `active` synchronously. It resets persistence,
zeroes `stepIndex`, sets `pendingStart=true`. `TourOverlay` watches
`pendingStart && currentRoute === 'HomeScreen'` and only then calls
`confirmPendingStart()` (flips `active=true`). Settings' reset handler
navigates to Home right after calling `devReset()`. The shell therefore never
paints over Settings.

## Verification plan
`tsc`, full tour test suite, Home/Grocery/Library/Settings tests, `git diff
--check`, then one live pass in the simulator: reset → screenshot each of the
7 steps → confirm Kiko/dock pixel position identical across screenshots →
confirm `+` dim state per step → Done → relaunch confirms no reopen.
