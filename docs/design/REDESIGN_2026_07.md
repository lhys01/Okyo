# Okyo Redesign — July 2026

Complete visual/UX redesign of the mobile app against the approved brand references
(Kiko character sheets, brand guidelines, pastel concept screens). This doc records
intent and binding decisions; `okyoTheme.ts` remains the only token source.

## Product truth (overrides concept screens)

- Tabs: **Home · Grocery · Saved · Settings**. No Scan tab, no Kitchen, no Savings
  dashboard, no Discover tab. Scanning starts on Home.
- Scan flow: Home → native camera / photo picker / written idea → AnalysisLoading →
  ResultSummary. Cancellation returns to Home. Session dedupe + image pipeline in
  `useScanLauncher` (extracted from old ScanScreen) is behavior-preserving.
- Honesty rules unchanged: savings gate on `userRestaurantPrice`; no fake stats,
  streaks, XP walls, leaderboards, or confidence percentages. Legacy XP/badge/
  challenge/leaderboard surfaces are removed from the UI.

## Visual direction

- **Foundation:** warm ivory canvas (`colors.background`), soft white cards, coral
  CTA. Unchanged from the July honesty pass — these are the approved brand files.
- **Atmosphere:** the reference pastel rainbow lives in `ambientColors` and appears
  only as: ambient gradient blobs (existing `AnimatedGradientBackground`), Kiko,
  celebration moments, glow-node analysis stages, selected-state tints. Never as
  full-screen rainbow washes, never on every component.
- **Motifs (system, not decoration):**
  - *Wandering dotted path* (`DottedPath`) — connects guidance/progress moments:
    onboarding, analysis stages, completion. One per screen max.
  - *Glow node* (`GlowNode`) — small soft-glow label chip; used for analysis
    stages (Detecting ingredients → Understanding the dish → Shaping the recipe).
  - *Sparkles* — discovery/celebration only.
- **Kiko:** single source `KikoMascot` + eight approved pastel bitmap crops. Pose
  aliases resolve into that controlled library instead of mixing character styles. Max one
  Kiko per screen. Used for greeting (Home), thinking (analysis), celebration
  (completion), empty states, gentle errors. Never decoration-only.
- **Typography:** Sora across display and body roles, matching the approved brand
  reference. Hierarchy lives in `typography.*`; utility screens keep compact titles
  while Home, onboarding, and success moments carry the editorial scale.

## Interaction principles

- Every tap acknowledged: `PressableScale` + haptics (`expo-haptics` via
  `src/utils/haptics.ts` — light taps, medium confirms, success on completion,
  warning only when useful). Haptics helper no-ops safely.
- Reduce Motion honored everywhere (existing `useReducedMotion` pattern); every
  animated moment has a calm static equivalent.
- Loading is staged and honest: no fake percentages, no endless spinner, no
  progress bar that fills before the backend answers. Analysis preserves the
  source photo, presents qualitative stages, introduces a long-wait explanation,
  and reaches a retry/keep-waiting timeout state at 70 seconds.
- One coral primary per screen; secondary = outline/ghost.

## Screen decisions

- **Home:** scan-first. Three real input methods (Take photo / Upload photo /
  Describe idea) are visible immediately. A recent recipe resumes when one
  exists; the clean first-use state keeps the same strong scan action.
- **Analysis:** Kiko thinking + user's photo + glow-node stage path. Honest copy;
  cancel returns Home and clears session.
- **Result:** image-forward editorial reward. Dish photo + canonical name dominate;
  chips quiet; savings only with user price; single coral "Start cooking"/"View
  recipe" primary.
- **Recipe detail / guided cooking:** calm large-type steps, one dominant action,
  acknowledged step completion (motion + light haptic), timers where supported.
- **Completion:** Kiko celebration + the finished dish; save and share are both
  visible in the first viewport. Reduce Motion uses the static equivalent.
- **Grocery:** one deduplicated list across saved recipes, quantities and source
  context retained, To buy/Pantry check views, mark-all and clear controls,
  copy/share, source deletion confirmation, completion and actionable empty states.
- **Saved:** image-led collection with search, category filters, explicit sorting,
  recipe removal, grocery shortcuts, missing-image handling, and scan CTA when empty.
- **Settings:** real settings only. Daily reminders persist and schedule through
  `expo-notifications`; Reduce Motion reflects the OS setting. Privacy/provider
  disclosure, legal/support links, version, and confirmed destructive actions are
  separated. This replaces the former Profile tab.
- **Share:** selectable Remake, Savings, and Recipe image templates. Cards only
  include recipe data or user-supplied pricing; demo prices are labeled as examples.
  Native image sharing falls back to a caption when capture/sharing is unavailable.
- **Onboarding:** brief Kiko-led interactive intro (tail-first entrance), skippable,
  Reduce Motion complete, lands on first scan/idea.

## Removed surfaces

RestaurantPacks/Discover, RestaurantPackDetail, DupeChallenge, ChallengeComplete,
SavingsDashboard, KitchenLetter, Rankings, RecommendationCategory, Goal screen,
Profile wrapper, mock leaderboard data. Store state fields are kept for persistence
compatibility; UI never reads fake data.

## Verification bar

Completed in this pass:

- Mobile TypeScript, auth tests, Kiko art tests, and Expo SDK dependency check.
- API TypeScript and all 121 API tests.
- Production iOS Expo export.
- iPhone 17 Pro Max simulator inspection with Reduce Motion enabled across
  onboarding, Home, analysis/timeout, result/failure, recipe, guided cooking,
  completion, Grocery populated/empty, Saved populated/empty, Settings, and all
  three share templates.
- Simulator video plus extracted frames for the timed analysis copy changes.

Environment limits: no Android SDK/emulator was installed, so Android was covered
by React Native layout/type validation but not a device run. Expo Go also warns that
local notifications need a development build for complete runtime verification.

## Asset provenance

- Kiko poses and the app icon are crops from the user-supplied approved character
  sheet. No alternate mascot generator or flat legacy pose is referenced by UI code.
- Food media comes from the existing bundled recipe photography; empty or failed
  image paths retain an honest fallback rather than substituting a fake scan result.
