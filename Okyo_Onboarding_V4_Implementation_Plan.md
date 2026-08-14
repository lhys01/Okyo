# Okyo Onboarding V4 — Implementation Plan

Self-contained, execution-ready plan for `/ecc:plan-orchestrate`. Sources: `/Users/rober/Downloads/Okyo_Onboarding_Operating_System_2026.md` (research/blueprint), the verified Phase 1 (Step 01) session report, and the real onboarding-v3 architecture inspected during that session.

**Authoritative decisions below override any conflicting recommendation in the research doc.** The research doc's paywall-timing-decision-tree (§9.2) and its "paywall-first" pattern (§5.2) are explicitly **not used** — this plan puts one full free scan + recipe reveal before any paywall exposure. Do not reintroduce "paywall before scan" language when executing any step.

---

## Authoritative decisions (override research doc where they conflict)

1. One complete real scan and usable recipe reveal happens **before** the paywall.
2. The first successfully rendered recipe is the primary activation/aha moment.
3. Failed or cancelled analyses do not consume the free recipe (retry is free until a recipe actually renders).
4. Do not automatically cover the recipe result with a paywall — no auto-triggered paywall on result mount.
5. The paywall opens at a clear **user-initiated** premium action after the free result (e.g. tapping Cook Mode, a second scan, saving to library, editing macros).
6. Purchase or restore success must resume the exact interrupted action (not dump the user on Home).
7. Existing subscribers skip the paywall entirely (checked via RevenueCat entitlement before ever rendering it).
8. Primary goals: `save_money`, `eat_healthier`, `hit_macros`, `not_sure` (four, not three).
9. Show a personalized insight after **no more than two** meaningful branch questions.
10. The macro estimate route may use **one additional grouped form** (age/height/weight/sex/activity in one screen) beyond its two questions — still reaches insight promptly.
11. The real first scan **replaces** any long simulated product demo — no fake interactive mockup.
12. Every collected answer must affect a later calculation, plan, recipe, result, safety constraint, or paywall message — no write-only questions.
13. Remove mascot naming from the eventual critical path.
14. Move user-name collection after activation or into Profile.
15. Separate allergies, restrictions, and dislikes as distinct concepts (not one flat list).
16. Dietary data must affect: the API request, recipe generation, result warnings, and pre-Cook warnings.
17. Camera permission is requested only after the user taps "Take a photo" (never earlier, never priming a system dialog cold).
18. Notification permission is requested only after a real later value event (a save, a completed cook, a scheduled meal) — never during the pre-paywall flow.
19. RevenueCat remains the sole subscription source of truth — no parallel entitlement system.
20. Never hard-code prices, products, trial lengths, or entitlement state — always read from RevenueCat/StoreKit.
21. Users under 18 must never receive adult calorie-deficit or weight-loss targets.
22. Existing stored onboarding users must migrate without crashing or losing valid information.

---

## Canonical flow (target)

```
Splash → Promise → Primary Goal → Branch Question 1 → Branch Question 2 → Personal Insight
  → Dietary Safety → Compact Personal Plan → First Scan → Photo Confirmation → Analysis
  → Full Free Recipe Reveal → User Selects Premium Action → Paywall → Purchase/Restore
  → Resume Interrupted Action
```

No step in this plan may insert a paywall, entitlement check, or purchase gate before "Full Free Recipe Reveal." No step may reintroduce mascot naming, the 6-page showcase carousel, secondary goals, or `personalizedFuture` into the reachable critical path — those are removed in Step 11, not before.

---

## How to use this plan

Each step below is one self-contained `/ecc:plan-orchestrate --scope=step:NN` unit. Steps are ordered by dependency — do not skip ahead. Each step's "Required completion report" must be produced and reviewed before starting the next step. Stop after each step; do not chain steps in one session unless explicitly told to.

---

## Step 01 — Migration-safe foundation — COMPLETED

**Status**: Completed and verified in this session. Recorded here for continuity; do not re-run.

**What shipped**:
- Versioned persistence envelope: `PERSONALIZED_PROFILE_SCHEMA_VERSION = 1` in `apps/mobile/src/onboarding-v3/state/onboardingV3Persistence.ts`. New writes store `{schemaVersion, profile}`.
- Backward-compatible profile reads: every pre-existing unwrapped install's stored profile still reads correctly via `unwrapPersistedPersonalizedProfile`.
- Shared envelope unwrapping: `state/primaryGoalBridge.ts` (read by `useOkyoStore` for Home's metric ordering) was found parsing the same storage key directly, bypassing the persistence module's reader — fixed to use the same shared unwrap helper, preventing a silent Home-screen regression once writes became versioned.
- Future `not_sure` typing without reachability: `FUTURE_PRIMARY_GOALS`/`FuturePrimaryGoal`/`isFuturePrimaryGoal` added to `personalizedOnboarding.ts`, deliberately excluded from `PRIMARY_GOALS` (the array the goal-selection screen actually iterates) so it is not selectable yet.
- Legacy resume mapping foundation: `mapLegacyResumeStep`/`LEGACY_RESUME_STEP_MAP` in `onboardingV3Machine.ts`. `personalizedFuture` (already dead — no render case) unconditionally redirects to `planReady`. `nameFox`/`branchIntro`/`secondaryGoals` pass through unchanged today (still live screens); the mapping activates automatically once Step 11 removes them.
- Activation-phase helper: `getOnboardingActivationPhase`/`OnboardingActivationPhase` — categorizes steps into `questions | first_scan | recipe_revealed | paywall | entitled | complete`. Purely descriptive today; Step 02 is the first consumer.
- Tests added: `onboarding-v3/controller/onboardingV3Machine.test.ts` (+9), `onboarding-v3/state/onboardingV3Persistence.test.ts` (+5), `state/primaryGoalBridge.test.ts` (new file, 5 tests, including a restored pre-existing regression test for retired `cook_more` goal values that a first draft nearly deleted).
- `tsc --noEmit`: clean.
- Full suite (using explicit file discovery — `npm test`'s own script silently only globs one directory level under `/bin/sh`, a pre-existing tooling gap, not fixed in this step): **426 tests discovered, 412 passing, 14 failing** — verified via `git stash` to be the exact same 14 pre-existing failures as an unmodified baseline. Zero new failures introduced.
- No visual flow, RevenueCat behavior, or permission behavior changed.

**Known remaining gaps** (not blockers, carried forward):
- `npm test`'s script glob under-covers the suite by one directory level; not fixed, flagged for a future maintenance step.
- Scan-retry state (`selectedImageRef`, in-flight `analysisId`) lives only in controller refs/reducer state, not `AsyncStorage` — does not survive an app kill mid-scan. Step 08 must address this.

---

## Step 02 — Canonical route contract, experiment gate, and analytics foundation

**Intent**: Before touching any screen, define the V4 step contract as a parallel, inert type alongside the existing `OnboardingV3Step` union, plus the event taxonomy and experiment-gate scaffolding every later step depends on. Nothing becomes reachable yet.

**Exact work allowed**:
- Add a new exported type `OnboardingV4Step` in a new file `apps/mobile/src/onboarding-v3/state/onboardingV4Route.ts` enumerating exactly the canonical flow: `splash | promise | primaryGoal | branchQ1 | branchQ2 | macroDetails | personalInsight | dietarySafety | plan | scanEntry | photoConfirm | analyzing | recipe | paywall | postPurchase | complete`. (`macroDetails` is the one-additional-grouped-form step for the macros branch per decision #10, unused by other branches; `personalInsight` names the flow diagram's "Personal Insight" node exactly — do not shorten it to `insight`.) The recipe reveal must precede the paywall in step order (decisions #2/#4/#5) — do not create a second reducer/state machine; the live `onboardingV3Reducer` stays untouched.
- Add `getOnboardingActivationPhase`-equivalent mapping for this new step set (reuse the same `OnboardingActivationPhase` type from Step 01, do not redefine it).
- Extend (not duplicate) the existing `analytics/track.ts` wrapper: add the 22 V4 event names below to its `analyticsEvents` map, then add a thin `apps/mobile/src/analytics/onboardingV4Events.ts` module that funnels through the real `track()` (a call-time dynamic import is acceptable since `track.ts` statically imports `react-native`, which the plain `node:test` runner can't transform — do not leave a second, parallel console-based analytics implementation). Event names: `onboarding_started`, `onboarding_screen_viewed`, `onboarding_answer_submitted`, `primary_goal_selected`, `personal_insight_viewed`, `dietary_preferences_saved`, `personal_plan_viewed`, `first_scan_input_selected`, `camera_permission_prompted`, `camera_permission_result`, `photo_confirmed`, `analysis_started`, `analysis_succeeded`, `analysis_failed`, `first_recipe_revealed`, `meaningful_action_selected`, `paywall_viewed`, `purchase_started`, `purchase_succeeded`, `purchase_failed`, `purchase_restored`, `onboarding_completed`. Event properties must use a closed, typed allow-list (screen/step/branch/source/actionType/permissionResult/errorKind/durationMs/isMinor) — never an unrestricted `Record<string, ...>` — and must reject names, allergy/dietary text, body measurements, photos, and free-text dish descriptions at runtime, not just at the type level.
- Add a simple boolean rollout kill-switch constant (`ONBOARDING_V4_ENABLED` in `apps/mobile/src/config/devFlags.ts`, following the exact pattern already used by `DEV_BYPASS_PAYWALL`) defaulting to `false`. Separately, add the smallest AsyncStorage-backed, injectable-storage, typed sticky experiment-assignment module (`onboarding-v3/state/onboardingV4Experiment.ts`) that persists a `'v3' | 'v4'` assignment across restart, never silently reassigns an already-assigned install, defaults safely to `'v3'`, supports a deterministic override for tests, and treats missing/malformed/unknown stored values as "assign the default and persist it" — not wired into any live routing decision yet.
- Fix the repo's `npm test` script so it recursively discovers nested test files (the prior `src/**/*.test.ts` form only expands one directory level under `/bin/sh`) without breaking any existing CI command.
- Write unit tests for the new type/phase mapping (including the recipe-before-paywall order and the `personalInsight` step), the event module's uniqueness/exact-22 contract and property-sanitization behavior, the experiment assignment's persistence/override/fallback behavior, the `ONBOARDING_V4_ENABLED` default, and recursive test discovery itself.

**Exact work prohibited**:
- Do not wire `OnboardingV4Step` into `OnboardingV3.tsx`'s render switch.
- Do not change `ONBOARDING_V3_STEPS`, `onboardingV3Reducer`, or any existing screen.
- Do not call the new analytics events from any real screen yet — this step only defines them.
- Do not wire the experiment assignment into any visible production routing yet.
- Do not touch RevenueCat, permissions, or persistence beyond what's listed above.

**Relevant files**: new `onboarding-v3/state/onboardingV4Route.ts`, new `onboarding-v3/state/onboardingV4Experiment.ts`, new `analytics/onboardingV4Events.ts`, `analytics/track.ts` (extend the event map only, reuse `track()`), `config/devFlags.ts` (append only), `package.json` (`test` script only).

**Required tests**: type-level exhaustiveness test (every `OnboardingV4Step` maps to exactly one phase) plus a recipe-precedes-paywall order test; event-name uniqueness and exact-22-name contract tests; typed-property and sensitive-property-rejection tests; experiment-assignment persistence/restart, deterministic-override, and missing/malformed/unknown-fallback tests; `ONBOARDING_V4_ENABLED` defaults to `false` test; recursive-test-discovery regression test.

**Acceptance criteria**:
- `tsc --noEmit` clean.
- Existing full test suite (426+ tests, discovered recursively) still passes with the same pre-existing failure count as Step 01's report (14).
- `OnboardingV3.tsx` render output is byte-identical to before this step (nothing wired in yet).
- `ONBOARDING_V4_ENABLED` is `false` and unreferenced by any live screen; the experiment assignment module is unreferenced by any live routing.

**Required completion report**: list every file created, the full `OnboardingV4Step` union, the 22-event taxonomy list, the experiment-assignment contract, test counts before/after, `tsc` result, confirmation the visible app is unchanged.

**Stop after this step.** Do not begin Step 03 without review.

---

## Step 03 — Promise screen, primary goal, and reachable `not_sure`

**Intent**: Build the first two real V4 screens behind the `ONBOARDING_V4_ENABLED` gate: a single mechanism-led Promise screen (replacing the 6-page showcase carousel's *purpose*, not yet removing the carousel itself — that's Step 11) and a Primary Goal screen that makes `not_sure` genuinely selectable for the first time.

**Exact work allowed**:
- New screen `apps/mobile/src/onboarding-v3/screens-v4/PromiseScreen.tsx`: headline stating the transformation outcome, one static or short looping visual (reuse `KikoOnboardingArtwork`/existing assets — do not commission new art in this step), one primary CTA, one "Already subscribed? Restore" secondary link that calls the existing `restore()` path from `useOnboardingV3Controller` (read that hook first — do not re-implement restore logic).
- New screen `apps/mobile/src/onboarding-v3/screens-v4/PrimaryGoalScreen.tsx`: renders one `GoalCard` per entry in `FUTURE_PRIMARY_GOALS` (not `PRIMARY_GOALS` — this is the one place in the whole codebase that should iterate the future set, making `not_sure` reachable exactly here and nowhere else).
- Extend the reducer-equivalent for `OnboardingV4Step` (new, separate from `onboardingV3Reducer` — do not modify the V3 reducer) to handle `splash → promise → primaryGoal → branchQ1` transitions, gated entirely behind `ONBOARDING_V4_ENABLED`.
- Wire these two screens into `OnboardingV3.tsx` **only** behind the `ONBOARDING_V4_ENABLED` flag (`if (ONBOARDING_V4_ENABLED) return <OnboardingV4 .../>` at the very top, falling through to existing behavior otherwise).
- Reuse `OnboardingCTA`, `OnboardingBackButton`, `onboardingLayout.ts` from the existing component set — do not create parallel styling primitives.

**Exact work prohibited**:
- Do not remove or alter `ShowcasePager`, `NameFoxScreen`, or any existing V3 screen.
- Do not build branch question screens yet (Step 05).
- Do not flip `ONBOARDING_V4_ENABLED` to `true` — it stays `false` at the end of this step; verification happens by temporarily flipping it locally in a dev build only, never committed as `true`.
- Do not touch dietary, scan, or paywall code.

**Relevant files**: new `onboarding-v3/screens-v4/` directory, `onboarding-v3/state/onboardingV4Route.ts` (extend from Step 02), `OnboardingV3.tsx` (gate insertion point only), `onboarding-v3/state/personalizedOnboarding.ts` (read-only — `FUTURE_PRIMARY_GOALS` already exists from Step 01).

**Required tests**: reducer transition tests for `splash→promise→primaryGoal`; a test that selecting `not_sure` sets `profile.primaryGoal` to a value that satisfies `isFuturePrimaryGoal` but not `isPrimaryGoal` (confirming Step 04 must handle it specially, not treat it as a normal goal); a render-time test that `PrimaryGoalScreen` renders exactly 4 cards.

**Acceptance criteria**: `tsc --noEmit` clean; with `ONBOARDING_V4_ENABLED=false` the running app is pixel-identical to pre-Step-03 behavior; with the flag manually flipped true in a local dev run, Promise → Primary Goal → (goal selected) transitions work and `not_sure` is selectable.

**Required completion report**: screenshots or a description of both screens at both flag states, the reducer diff, confirmation no V3 screen was touched.

**Stop after this step.**

---

## Step 04 — Branch data contracts, calculations, and downstream-use map

**Intent**: Define the exact question set, calculations, and every downstream consumer for all four branches before building any question UI. This is the "no write-only questions" contract (decision #12) made concrete and checkable.

### Savings branch (`save_money`)
- **Q1** `takeoutFrequency` — "How often do you order takeout or eat out in a typical week?" — single-select: `0 | 1 | 2–3 | 4–5 | 6+`.
- **Q2** `spendPerMeal` — "About how much does one order usually cost?" — editable slider/range, "A rough estimate is perfect" helper.
- **Insight**: annual spend range (reuse `annualTakeoutSpend`/`conservativeAnnualProjection` from `personalizedOnboarding.ts`, already implemented and correct — do not reimplement), shown as a labeled range, not a false-precision point number.
- **Downstream uses**: Compact Personal Plan savings card; recipe-result restaurant-vs-home cost comparison; paywall savings-led headline/benefits; future weekly-savings lifecycle messaging (not built this phase, but the field must exist for it).

### Health branch (`eat_healthier`)
- **Q1** `healthierDefinition` — "What does 'healthier' mean to you?" — single-select: `More balanced | More vegetables | Lower calories | Lower sodium | Less processed | Something else`.
- **Q2** `healthBarrier` — "What gets in the way most?" — single-select: `Time | Cravings | Boring recipes | Confusion about what's healthy | Giving up favorites`.
- **Insight**: "Your plan starts with [selected focus] — without banning the food you like," with one concrete example line.
- **Downstream uses**: recipe transformation rule applied at generation time (goal-specific adjustment, e.g. more vegetables / lower sodium); result nutrition-field hierarchy; paywall health-led copy. No weight-loss or clinical claims anywhere downstream.

### Macros branch (`hit_macros`)
- **Q1** `macroFocus` — "What are you optimizing for?" — single-select: `Protein | Calories | Balanced macros | Performance/fueling | Something else`.
- **Q2** `targetPath` — "Do you already know your daily targets?" — single-select: `I know my targets | Help me estimate | Not sure yet`.
- **Grouped form** (`macroDetails`, only shown if `targetPath = 'Help me estimate'`): one screen collecting `ageYears`, `heightCm`, `weightKg`, `biologicalSex`, `activityLevel`, `trainingDaysPerWeek` — reuse the existing field-level validation from `state/nutritionTargets.ts` (`asNumber` ranges etc. already correct, do not change). Include a one-line rationale ("We use this only for a starting estimate — you can change it anytime") before the form, per decision #10's "one additional grouped form" allowance.
- If `targetPath = 'I know my targets'`: skip the grouped form, collect calories/protein/carbs/fat directly (editable, partial allowed).
- **Under-18 safety gate**: if collected/known `ageYears < 18`, the calculation layer (`calculateNutritionTargets` in `nutritionTargets.ts`) must never return an adult calorie-deficit or weight-loss target. Add a new field `nutritionProfile.isMinor: boolean` set whenever `ageYears < 18`. When `isMinor` is true: (a) if the user already knows targets, use them as-is (no deficit is calculated by Okyo); (b) if estimating, route to general balanced-eating guidance with no deficit math — `macroGoal` values `lose_fat` and equivalent deficit-implying goals must be disabled/hidden for minors. This flag must be checked again at recipe-generation time and at the result screen (decision #21) — not just at collection time.
- **Insight**: starting calorie/protein **range**, not a point estimate; editable immediately.
- **Downstream uses**: `nutritionTargets` feeds recipe macro adjustments (existing `buildGoalContext` already forwards `nutritionTargets` — verify, do not duplicate); result macro-field hierarchy; paywall macro-led copy; `isMinor` gate re-checked at every one of those consumption points.

### Not Sure branch (`not_sure`)
- **Q1** `universalNeed` — "What sounds most useful right now?" — single-select: `Recreate food I see | Decide what to cook | Understand nutrition | Spend less | Just explore`.
- **No Q2.** Per decision #11 (real scan replaces simulated demo), the second "question" for this branch is deferred to the real recipe result: after the first free recipe renders, show one extra row of 3 transformation chips (`Cheaper` / `More balanced` / `More protein`) directly on the result. Whichever chip the user taps **retroactively sets** `profile.primaryGoal` to `save_money`/`eat_healthier`/`hit_macros` respectively.
- **Downstream uses**: the retroactively-set `primaryGoal` feeds paywall copy and all future lifecycle messaging exactly as if the user had picked that goal at Step 03. Must be implemented so `not_sure` is never a terminal state — Step 09 owns wiring the chip-tap-to-goal-set logic; this step only defines the contract.

**Exact work allowed**:
- Add typed data contracts (`BranchQuestionSpec`, downstream-use documentation as inline comments referencing exactly where each field is read, per the DRY/no-write-only-fields rule) in a new file `onboarding-v3/state/branchContracts.ts`.
- Add `nutritionProfile.isMinor` field to `NutritionProfile` type in `nutritionTargets.ts` and thread it through `calculateNutritionTargets`.
- Add pure calculation tests for the under-18 gate.
- Write a downstream-use verification test per field (grep-style: assert each field id is referenced by at least one of plan/recipe/result/paywall — can be a simple static list-comparison test, not a full integration test).

**Exact work prohibited**:
- Do not build the actual question-rendering screens (Step 05).
- Do not change `PRIMARY_GOALS` or make `not_sure` a true `PrimaryGoal` — it remains a retroactively-assigned real goal, never its own branch content set.
- Do not touch the API layer or recipe generation code yet — only define the contract this step.

**Relevant files**: new `onboarding-v3/state/branchContracts.ts`, `onboarding-v3/state/nutritionTargets.ts` (extend), `onboarding-v3/state/personalizedOnboarding.ts` (read-only reference), `onboarding-v3/state/goalContext.ts` (read-only reference for what already forwards correctly).

**Required tests**: under-18 gate unit tests (age 17 never returns a deficit target regardless of `macroGoal`; age 18+ behaves as before); downstream-use coverage test for every field listed above; `not_sure` retroactive-assignment contract test (pure function, no UI).

**Acceptance criteria**: `tsc --noEmit` clean; every field defined above has a documented, verifiable downstream consumer; under-18 gate cannot be bypassed by any combination of inputs.

**Required completion report**: the finalized branch contract tables (as above, confirmed against actual code), the `isMinor` implementation, test results.

**Stop after this step.**

---

## Step 05 — Branch questions and early personal insights

**Intent**: Build the actual question and insight screens for all four branches per Step 04's contract, wired into the V4 reducer, still behind `ONBOARDING_V4_ENABLED`.

**Exact work allowed**:
- Screens: `BranchQuestionScreen.tsx` (generic, data-driven from `branchContracts.ts` — one component for all branches' Q1/Q2, not four bespoke screens), `MacroDetailsFormScreen.tsx` (the one grouped form), `InsightScreen.tsx` (data-driven per branch, reads the calculated range from Step 04's functions).
- Extend the V4 reducer: `primaryGoal → branchQ1 → branchQ2 → [macroDetails if applicable] → insight → dietarySafety`.
- Wire `ANSWER_SET`-equivalent event, reusing `setPersonalizedAnswer`/`setPersonalizedAnswer`-style helpers from `personalizedOnboarding.ts` where the field mapping already exists (savings/health fields) — extend that switch for the new `not_sure`/macro fields only where missing.
- Enforce the under-18 gate in the UI: hide/disable deficit-implying `macroFocus`/goal options when `isMinor` is true, matching Step 04's calculation-layer gate (defense in depth, not a replacement for it).

**Exact work prohibited**:
- Do not build dietary safety, plan, or scan screens (Steps 06–08).
- Do not flip `ONBOARDING_V4_ENABLED` to `true`.
- Do not modify any V3 question screen (`PersonalizedOnboardingScreen.tsx` stays untouched — it keeps serving V3 until Step 11).

**Relevant files**: new screens under `onboarding-v3/screens-v4/`, `onboarding-v3/state/branchContracts.ts` (consume), `onboarding-v3/state/personalizedOnboarding.ts` (extend `setPersonalizedAnswer` only for genuinely new fields), `onboarding-v3/state/nutritionTargets.ts` (consume `isMinor`).

**Required tests**: per-branch reducer flow test (goal → Q1 → Q2 → [macroDetails] → insight, asserting exactly the step count from decision #9/#10); insight content test per branch (matches Step 04's calculation output); under-18 UI-gate test (deficit options absent/disabled when `isMinor`).

**Acceptance criteria**: every branch reaches insight in ≤2 question screens (macros: ≤2 + 1 grouped form); insight values are calculated, not hardcoded; `tsc --noEmit` clean; flag stays `false` in the default build.

**Required completion report**: per-branch screen count and screenshots/description, insight copy examples with real calculated numbers, test results.

**Stop after this step.**

---

## Step 06 — Dietary safety and global preference consumption

**Intent**: Build one restructured dietary screen (allergies / restrictions / dislikes as separate groups, decision #15) and make sure the collected data actually reaches the API, recipe generation, result warnings, and pre-Cook warnings (decision #16) — auditing and fixing each consumption point, not just adding the screen.

**Exact work allowed**:
- New screen `DietarySafetyScreen.tsx`: three labeled groups (Allergies, Restrictions, Dislikes) each multi-select from `state/foodPreferences.ts`'s existing categories (read that file first — reuse its types, do not invent new ones), plus a "None of these" option per group, plus safety copy: "Okyo can flag and adapt recipes, but AI and ingredient labels can be wrong. Always verify ingredients for serious allergies."
- Audit and, where missing, wire `dietaryPreferences` through: (a) the recipe-generation API request (`toApiFoodPreferences` in `foodPreferences.ts` — verify it's actually called in the V4 scan flow being built in Step 08, not just present in V3's `useOnboardingV3Controller.generateRecipe`), (b) a result-screen allergy/restriction warning banner (new, if one doesn't already exist on `OnboardingRecipePreview.tsx` — inspect it first), (c) a pre-Cook warning shown before `OnboardingCookingScreen.tsx` starts if the recipe's ingredients conflict with stated allergies (new, if missing).
- Persist dietary data via the existing `foodPreferencesPersistence` module (already used by V3 — reuse, do not duplicate).

**Exact work prohibited**:
- Do not change the `FoodPreferences` type shape unless Step 04/foodPreferences.ts genuinely lacks the allergies/restrictions/dislikes split (verify first — it may already exist per the earlier codebase audit; if so, this step only builds the UI and wires missing consumers).
- Do not touch scan or paywall screens.
- Do not remove the existing V3 `dietaryPreferences` step — it stays live until Step 11.

**Relevant files**: new `DietarySafetyScreen.tsx`, `state/foodPreferences.ts` (read/extend only if genuinely missing fields), `onboarding-v3/screens/OnboardingRecipePreview.tsx` (audit + extend for warnings), `onboarding-v3/screens/OnboardingCookingScreen.tsx` (audit + extend for pre-Cook warning), `onboarding-v3/controller/onboardingV3Requests.ts` / API client (audit only).

**Required tests**: dietary screen selection/grouping tests; a test confirming an allergy selected in onboarding actually appears in the outgoing recipe-generation API request payload; a test confirming a result screen renders a warning banner when the recipe contains a flagged allergen; a pre-Cook warning test.

**Acceptance criteria**: allergies/restrictions/dislikes are three distinct, separately-stored concepts; every one of the four required consumption points (API, generation, result, pre-Cook) is verified with a passing test, not just asserted; `tsc --noEmit` clean.

**Required completion report**: which of the four consumption points already existed vs. were newly wired, with file:line citations; test results.

**Stop after this step.**

---

## Step 07 — Compact personal plan and first-scan entry

**Intent**: Build the Compact Personal Plan screen (3 cards: what you told us / what Okyo prioritizes / your first action) and the First Scan entry screen that follows it — the last screen before real product usage begins.

**Exact work allowed**:
- `CompactPlanScreen.tsx`: reads the branch's collected answers + insight + dietary summary, renders exactly 3 cards per decision-doc §14.4 pattern (adapt copy, do not copy the research doc's literal placeholder text verbatim into production).
- `ScanEntryScreen.tsx` (V4 version): three input choices — Take Photo, Upload Photo, Describe a Dish — reusing `ScanEntryOptions` component and `preparePickedImage`/`ImagePicker` calls from the existing `ScanInputScreen.tsx` (decision #17: camera permission requested only after "Take a photo" is tapped — verify the existing `ImagePicker.requestCameraPermissionsAsync()` call in `ScanInputScreen.tsx:44` already satisfies this just-in-time pattern; reuse it as-is rather than rebuilding).
- Wire `plan → scanEntry` transition in the V4 reducer.

**Exact work prohibited**:
- Do not touch `photoConfirm`/`analyzing`/`recipe` logic (Step 08).
- Do not request any permission earlier than the existing just-in-time point already implemented in `ScanInputScreen.tsx`.
- Do not add a paywall or entitlement check anywhere in this step — this screen is reached by every user, entitled or not.

**Relevant files**: new `CompactPlanScreen.tsx`, `ScanEntryScreen.tsx` (V4), `components/ScanEntryOptions.tsx` (reuse), `onboarding-v3/screens/ScanInputScreen.tsx` (reference for the correct just-in-time permission pattern).

**Required tests**: plan-screen content test (3 cards, populated from real profile data, not placeholders); scan-entry reducer transition test; a test asserting no permission API is called until a specific input method is chosen.

**Acceptance criteria**: plan content is derived, not hardcoded; camera/photo permission timing matches decision #17 exactly; `tsc --noEmit` clean.

**Required completion report**: plan card content example, confirmation of permission-timing test result.

**Stop after this step.**

---

## Step 08 — First free scan, durable analysis state, and recovery

**Intent**: Wire the actual scan → analysis → recipe pipeline into V4, before any paywall, and close Step 01's flagged gap: make in-flight scan state durable enough to survive an app kill/backgrounding without losing the user's free attempt.

**Exact work allowed**:
- Reuse `runOnboardingAnalysis`/`runOnboardingRecipeGeneration` from `onboarding-v3/controller/onboardingV3Requests.ts` as-is (do not fork the request logic).
- Add durable persistence for in-flight scan state: extend `onboardingV3Persistence.ts` (or a new sibling module) with `writeInFlightScan`/`readInFlightScan`/`clearInFlightScan` storing `{scanSessionId, source, imageUri | mealDescription, startedAt}` — written when analysis begins, cleared on success or terminal failure, read on hydrate to offer "Resume your scan?" if the app was killed mid-analysis.
- Implement decision #3 (failed/cancelled analyses do not consume the free recipe): track a `freeRecipeConsumed: boolean` flag, set `true` only on `ANALYSIS_SUCCEEDED → RECIPE_READY`, never on rejection/failure/cancel. Persist this flag (it's what Step 10's paywall-eligibility check reads).
- Photo confirmation and honest analysis-stage copy (identifying dish / finding ingredients / building recipe / estimating nutrition / applying dietary preferences) — reuse `PhotoConfirmScreen.tsx`/`AnalyzingScreen.tsx` patterns from V3, adapt copy to be accurate to real backend steps (do not fabricate stages the backend doesn't perform — verify against the actual API response shape first).

**Exact work prohibited**:
- Do not change the API contract or backend.
- Do not add any entitlement/paywall check to this pipeline — it must work identically for a not-yet-purchased user.
- Do not touch the result/paywall screens (Steps 09–10).

**Relevant files**: `onboarding-v3/controller/onboardingV3Requests.ts` (reuse), `onboarding-v3/state/onboardingV3Persistence.ts` (extend), new in-flight-scan persistence, `onboarding-v3/screens/PhotoConfirmScreen.tsx`/`AnalyzingScreen.tsx` (reference/adapt).

**Required tests**: in-flight scan persistence round-trip test; `freeRecipeConsumed` stays `false` across rejection/failure/cancel and becomes `true` only on real success; resume-after-kill simulation test (write in-flight state, simulate fresh hydrate, confirm recoverable).

**Acceptance criteria**: an app kill mid-analysis does not silently lose the user's photo/description; a rejected or failed scan can be retried without any paywall gate appearing; `tsc --noEmit` clean.

**Required completion report**: the new persistence schema, test results, explicit confirmation that `freeRecipeConsumed` logic is correct across all failure paths.

**Stop after this step.**

---

## Step 09 — Goal-prioritized free result and meaningful next action

**Intent**: Build the full free recipe reveal — decision #2's activation moment — with content prioritized by branch, and the not_sure retroactive-goal-assignment chips from Step 04.

**Exact work allowed**:
- `FreeRecipeResultScreen.tsx`: full recipe content (dish name/photo, time, servings, ingredients, steps, nutrition, tools, grocery action, save/share, natural-language customization entry point) reusing `OnboardingRecipePreview.tsx`'s structure/components, reordered so the top-priority fields match the branch (savings: cost comparison first; health: nutrition/focus first; macros: macro breakdown first).
- Implement the `not_sure` chips (`Cheaper` / `More balanced` / `More protein`) per Step 04's contract — tapping one sets `profile.primaryGoal` and re-renders the field priority accordingly (no new recipe generation call needed unless the chip is meant to actually transform the recipe — if so, reuse the existing recipe-correction endpoint pattern from V3's "Choose your style" feature, do not build a new one).
- Add one clear "premium action" affordance per decision #5 (e.g. "Cook this" / "Scan another dish" / "Save to library") — each of which is the trigger Step 10 gates.
- Do **not** render any paywall/upsell UI on this screen itself.

**Exact work prohibited**:
- Do not auto-navigate to a paywall on screen mount (decision #4).
- Do not gate any part of this screen's content behind entitlement — it is fully visible to a free user.
- Do not implement the paywall itself (Step 10).

**Relevant files**: new `FreeRecipeResultScreen.tsx`, `onboarding-v3/screens/OnboardingRecipePreview.tsx` (reference/reuse structure), the existing recipe-correction/style-switch endpoint (reuse if the not_sure chip transforms the recipe).

**Required tests**: field-order test per branch (savings-first vs health-first vs macros-first); not_sure chip sets `primaryGoal` correctly and does not consume a second free recipe; a test that no paywall component is ever mounted alongside this screen.

**Acceptance criteria**: recipe reveal is the actual activation moment with zero paywall coupling; branch-specific hierarchy is verified, not just described; `tsc --noEmit` clean.

**Required completion report**: field-order examples per branch, not_sure chip behavior confirmation, test results.

**Stop after this step.**

---

## Step 10 — Post-value RevenueCat paywall and action resumption

**Intent**: Wire the paywall to trigger only on a genuine user-initiated premium action (decision #5), skip entirely for existing subscribers (decision #7), and resume the exact interrupted action after purchase/restore (decision #6) — all through RevenueCat as sole source of truth (decisions #19–20).

**Exact work allowed**:
- Before rendering the paywall for any premium action, check entitlement via the existing `useEntitlement()`/`purchasePackage`/`restorePurchases` from `services/revenueCat.ts` (reuse exactly — do not add a second entitlement path). If already entitled, skip straight to performing the requested action.
- Track "interrupted action" as a small typed value (e.g. `{type: 'cook' | 'second_scan' | 'save', recipeId?: string}`) set the moment a premium action is tapped, read again after `PURCHASE_SUCCEEDED`/`RESTORE_SUCCEEDED` to actually perform that exact action (not a generic "go to Home").
- Reuse `OnboardingPaywallScreen.tsx`'s existing plan-fetching/purchase/restore logic (`getRevenueCatPaywallPlans`, `purchasePackage`, `restorePurchases`) as-is — this step wires *when* it appears, not how purchasing works.
- Apply the branch-specific paywall headline (`personalizedGoalContent[goal].paywallHeadline`, already implemented and correct — reuse, do not rewrite) including for a `not_sure` user whose goal was retroactively set in Step 09.

**Exact work prohibited**:
- Do not modify RevenueCat SDK initialization, product IDs, or pricing — those remain entirely external configuration (decision #20).
- Do not auto-trigger the paywall on any screen mount, timer, or non-user-initiated event.
- Do not build a fallback/mock entitlement system for offline or provider-unavailable states beyond what `OnboardingPaywallScreen.tsx` already handles (`providerUnavailable` state already exists — reuse it).

**Relevant files**: `onboarding-v3/screens/OnboardingPaywallScreen.tsx` (reuse core logic), `services/revenueCat.ts` (reuse, do not modify), `onboarding-v3/state/personalizedOnboarding.ts` (`personalizedGoalContent` — read-only).

**Required tests**: entitled-user-skips-paywall test; interrupted-action resumption test for each action type; branch-specific paywall headline test including the `not_sure`-retroactive-goal case; a test confirming no hard-coded price/product string exists anywhere in new code (grep-based).

**Acceptance criteria**: paywall never appears before a real user-initiated premium action; an already-entitled user never sees it; purchase/restore success resumes the exact action that triggered the paywall; `tsc --noEmit` clean.

**Required completion report**: which premium actions were wired as paywall triggers, resumption test results, confirmation RevenueCat product/pricing config was not touched.

**Stop after this step.**

---

## Step 11 — Remove legacy critical-path screens and activate migrations

**Intent**: Flip `ONBOARDING_V4_ENABLED` to the default path, remove the now-superseded V3 critical-path screens (mascot naming, showcase carousel, secondary goals, `personalizedFuture`), and confirm Step 01's dormant legacy-resume mappings now do real work.

**Exact work allowed**:
- Flip `ONBOARDING_V4_ENABLED` default to `true` (still overridable for a staged rollout if the team wants one — see Step 12).
- Remove `NameFoxScreen.tsx`, `ShowcasePager.tsx`/`showcase/` directory, the `secondaryGoals` step and its screen content, and the dead `personalizedFuture` reducer case from the V3 machine — **only after** confirming nothing else imports them (grep first, per the existing codebase convention of checking importers before removing).
- Confirm `mapLegacyResumeStep` (Step 01) now actually redirects `nameFox`/`branchIntro`/`secondaryGoals` for any user resuming with a persisted step pointing at a just-removed screen — add a live (not just unit-level) regression test for this exact scenario.
- Move user-name collection into a Profile-screen field (reuse `ProfileScreen.tsx`'s existing name input — it already exists per the earlier codebase audit) rather than an onboarding step.
- Update `PRIMARY_GOALS`... **do not** move `not_sure` into `PRIMARY_GOALS` even here — it stays a `FuturePrimaryGoal`/retroactive-assignment concept per Step 04's design; only the *screen* offering it changes (it's now offered directly, per Step 03, not merely typed).

**Exact work prohibited**:
- Do not remove any file that another still-live surface imports (verify with grep before every deletion, matching the fact-forcing discipline used throughout Step 01).
- Do not delete `onboardingV3Machine.ts`, `onboardingV3Persistence.ts`, or any other still-load-bearing module — only the specific dead screens/steps listed above.
- Do not skip the live migration regression test — this is the step where Step 01's dormant mappings are proven, not assumed.

**Relevant files**: `onboarding-v3/screens/NameFoxScreen.tsx` (remove), `onboarding-v3/showcase/*` (remove), `onboarding-v3/controller/onboardingV3Machine.ts` (remove dead cases/steps), `screens/ProfileScreen.tsx` (extend for name), `config/devFlags.ts` (`ONBOARDING_V4_ENABLED` flip).

**Required tests**: the live legacy-resume-mapping regression test described above (must actually exercise a user hydrating with `resumeStep: 'nameFox'` post-removal and landing on `name`/its V4 equivalent, not just the pure-function unit test from Step 01); full-suite regression run confirming no new failures beyond the same pre-existing 14; a test confirming no file removed here is imported anywhere else (can be a static grep-based test).

**Acceptance criteria**: `ONBOARDING_V4_ENABLED` defaults `true`; no dead code remains reachable; no import errors; full suite shows the same or fewer pre-existing failures; `tsc --noEmit` clean.

**Required completion report**: exact list of removed files with pre-removal grep-for-importers evidence, live migration test result, full before/after test counts.

**Stop after this step.**

---

## Step 12 — End-to-end QA, accessibility, rollout, and final handoff

**Intent**: Final verification pass across the whole rebuilt flow — device testing, accessibility, staged rollout plan, and documentation handoff. No new product logic.

**Exact work allowed**:
- Manual/E2E pass through the full canonical flow on at least one iOS simulator device, confirming: fresh install, resume from each phase, existing-subscriber skip, under-18 macro gate, dietary warning surfacing, permission timing, paywall resumption.
- Accessibility pass: VoiceOver labels on every new screen, Reduce Motion compliance on any animated insight/loading screens (reuse the existing `Reduce Motion` handling pattern already present elsewhere in onboarding-v3 — the earlier full-suite run showed pre-existing failures in this exact area, e.g. `repeating decorative motion always consults Reduce Motion` — investigate whether those are relevant to new V4 screens or purely legacy, and fix only if V4 code is implicated; do not silently adopt a broken pattern).
- Write a rollout note (percentage/staged flag plan if desired, using the existing `ONBOARDING_V4_ENABLED`-style flag pattern — no new infra).
- Update this plan file's status header to "V4 SHIPPED" and produce a final handoff summary document.

**Exact work prohibited**:
- Do not introduce new screens, questions, or product behavior — this step verifies, it does not build.
- Do not change RevenueCat, permissions, or persistence schemas.

**Relevant files**: whole `onboarding-v3/` tree (verification only), this plan file (status update only).

**Required tests**: full suite run with final pass/fail counts; accessibility checklist per screen; device-matrix confirmation.

**Acceptance criteria**: full canonical flow works end-to-end with no paywall-before-scan regressions, no permission-timing regressions, no under-18 safety bypass, no dietary-warning gaps; `tsc --noEmit` clean; final test count documented against Step 01's original 426/412/14 baseline.

**Required completion report**: full QA checklist results, final test counts, rollout recommendation, this plan file marked complete.

**Stop after this step — plan complete.**

---

## Recommended sequential execution order

Step 01 (done) → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12. No step may run out of order — each depends on contracts or scaffolding from the one before it. Steps 05/06 may be developed in parallel branches by different engineers once Step 04's contract is merged, but should still land sequentially.

## Next command

```
/ecc:plan-orchestrate /Users/rober/Desktop/Okyo-1/Okyo_Onboarding_V4_Implementation_Plan.md --scope=step:02
```
