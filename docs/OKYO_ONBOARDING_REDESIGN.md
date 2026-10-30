# Okyo onboarding redesign

## Status and scope

Implementation goal is active. This is the required **pre-implementation audit**, not a completion report. Workspace: `/Users/rober/Desktop/Okyo-1` only. No commits, pushes, branch changes, resets, or stashes. Existing worktree changes are preserved.

Source: the user’s 52-section implementation brief in attachment `2bc81c5b-cc2b-4e50-92a9-56f4bfb1d136/pasted-text-1.txt`; the 50-state `Desktop/Optimal Onboarding` storyboard and copy deck; current repository code. The board is coverage and copy intent, not a locked visual design.

## Current runtime, not just the boards

- `config/devFlags.ts`: `ONBOARDING_V4_ENABLED = false`. `onboarding-v3/OnboardingV3.tsx` currently routes to LegacyOnboardingV3 regardless of stored V4 assignment.
- Active V3: splash → seven showcase pages → mascot name → user name → goal → branch/questions and reveals → dietary/secondary goals → plan → paywall → input → confirmation → analysis → recipe → optional onboarding cooking → completion.
- Some lengthy Money/Health/Macros paths are development previews, not the universal live flow. `state/*Stage2Preview.ts` and router conditions control those paths. Their useful coaching and artwork are source material; their full route count is not a requirement to retain.
- Dormant V4: splash → promise → goal → two branch questions → conditional macro details → insight → dietary → plan → input → confirmation → analysis → recipe. `not_sure` currently still requires two questions and resolves to a canonical goal. That contradicts the requested direct neutral path.
- V4 already owns durable first-scan transaction/entitlement handling, canonical profile commits, dietary authority, pending premium actions, and resume behavior. Reuse those mechanisms rather than write another competing storage engine.
- V4 result currently renders cost/nutrition/overview/ingredients/steps/tools/actions as consecutive cards. The primary action is “Cook this,” routed through the existing premium action handler. This is not the requested food-led result/product handoff.
- `AppNavigator.tsx` currently has an independently added `AuthGate` around its main navigator. Preserve that unrelated work; investigate handoff behavior before wiring first-result completion so the recipe is not inadvertently replaced by a login or Home screen.
- The existing first-scan code must be inspected and tested before moving the completion boundary. A route rename alone does not prove correct persistence, free correction, or paid-action recovery.

## Screen-to-implementation audit

Numbering below is the 50-screen board. “Required” refers to a state type on its applicable route, not every user visiting every numbered image. Paths are under `apps/mobile/src/`. V4 paths are in `onboarding-v3/screens-v4/` unless otherwise qualified.

| # / current state | Current implementation / requiredness | Problem | Proposed action |
| --- | --- | --- | --- |
| 01 Promise | V3 `showcase/ShowcasePager` hero; V4 `PromiseScreen`; shared opening | Benefit pills and redundant words dilute food/recipe promise | **KEEP**: large editorial food, intentional Kiko overlap, one dominant action and quiet skip |
| 02 Mechanism | V3 showcase scan; board-only distinct V4-equivalent explanation | Explains input/output but repeats 03 | **MERGE** with 03 into one transformation composition |
| 03 Broader value | V3 showcase value/customize/details; no separate V4 route | Another slide and several claims before trying | **MERGE** into mechanism; make customization explicitly optional/Pro |
| 04 Goal choice | `PrimaryGoalScreen`, V3 `PersonalizedOnboardingScreen`; optional via skip | Huge bordered options; neutral choice still leads to a quiz in V4 | **KEEP** direct rows, goal-colored selected state; neutral goes straight to dietary |
| 05 Savings priority | V3 priority/friction questions; V4 Q1 currently asks takeout frequency | Current V4 collects spending before useful recipe preference | **KEEP** priority as Money Q1; connect to actual request and result |
| 06 Savings comparison | `SavingsSpendQuestionScreen` + current frequency contract; conditional | Required spending input and multiple cards; examples risk looking entered | **MAKE CONDITIONAL**: explicit optional spend/replacement context, large controls, no invented answered values |
| 07 Savings reveal | `PersonalInsightScreen`, V3 Money reveal | Standard text card; inferred home cost before a recipe exists | **KEEP** as dominant comparison transformation; home price unknown until recipe; echo real priority |
| 08 Health meaning | `BranchQuestionScreen`, `healthBranchCopy.ts`; branch | Question/option containers repeat every page | **KEEP** simple direct choices, answer-driven recipe meaning |
| 09 Health barrier | Same branch Q2 | Too much explanation, another miniature payoff card | **KEEP** concise practical barrier and inline response |
| 10 Health reveal | `PersonalInsightScreen`, V3 health reveal | Text-led, visually interchangeable with question screen | **KEEP** food-led reveal with restrained ingredient annotations |
| 11 Macro focus | `BranchQuestionScreen`; branch | Outcome goals/body data can dominate useful nutrition information | **KEEP** protein/calories/balanced/information focus |
| 12 Macro detail | `BranchQuestionScreen` Q2 | Target-path routing can impose another page | **MERGE** with 13 as progressive disclosure |
| 13 Own targets | `MacroTargetSetupScreen`; conditional | Separate full-screen form; calculator path unnecessary pre-value | **MERGE** into detail screen/sheet, user-entered targets only; preserve legacy values in migration |
| 14 Macro reveal | `PersonalInsightScreen`; branch | Generic card and no metric hierarchy | **KEEP** image-led with selected metric dominant; any sample clearly illustrative |
| 15 Just show me | V4 not_sure Q1/Q2 + board neutral page | Punishes fastest route with more teaching/questions | **REMOVE** extra route; goal tap goes to dietary; neutral result remains first-class |
| 16 Dietary default | `DietarySafetyScreen`; shared | Default/selected board exports can be mistaken for separate steps | **KEEP** one evolving form; safety authority and explicit empty confirmation retained |
| 17 Dietary selected | Same component and draft | Same screen exported twice, not a route | **MERGE** into 16; stateful chips and accessible selection announcements |
| 18 Preferences recap | `PersonalPlanScreen`, canonical commit | Repeats reveal, adds a screen solely for committing data | **REMOVE** mandatory visual recap; retain async commit/retry transaction at dietary-to-input boundary |
| 19 Input source | `FirstScanEntryScreen`; required | Three equal cards and continued wizard feel | **KEEP** camera-led action surface; upload/describe quieter; no setup progress |
| 20 Camera | `utils/imagePicker.ts` via input flow; native OS capture | Board duplicates capture controls; app must use real camera behavior | **KEEP** native capture unless existing supported branded camera can be reused; permission on intent only |
| 21 Confirm photo | `onboarding-v3/screens/PhotoConfirmScreen`; image routes | Photo can be too small; disconnected transitions | **KEEP** photo hero and concise confirmation; preserve original image URI continuity |
| 22 Describe | `FirstScanEntryScreen` description state; product `DescribeMealScreen` | Form competes with generic explanation | **KEEP** conversational input, keyboard-safe action, no extra instructional route |
| 23 Generation | `FirstScanAnalyzingScreen`, first-scan transaction phases | Generic loading view and image discontinuity | **KEEP** actual phases, working Kiko, selected image, no synthetic progress |
| 24 Money result | `FreeRecipeResultScreen`, `onboardingV4Result.ts`; alternative | Card stack, weak hero, cost units/comparison require verification | **KEEP** large food + per-serving cost insight; no recorded savings on scan |
| 25 Health result | Same result component; alternative | Nutrition card is not a concrete food-led health insight | **KEEP** selected health meaning and practical ingredient context without unsupported claims |
| 26 Macro result | Same result component; alternative | Four equal numbers ignore selected focus | **KEEP** selected protein/calories metric or balanced strip; preserve estimate disclaimer |
| 27 Neutral result | Same component currently needs canonical goal | Neutral route is not truly neutral | **KEEP** ingredients/steps/time payoff without inventing goal preferences |
| 28 Ingredients | Result sections; real `screens/RecipeDetailScreen` | Another onboarding page instead of product content | **MOVE INTO PRODUCT** clean aligned list, serving context, dietary warnings, existing grocery action |
| 29 Steps | Same recipe detail and guided cooking | Over-contained steps and wizard actions | **MOVE INTO PRODUCT** readable numbered article and normal cooking action |
| 30 Nutrition | Result section / real recipe detail | Equal statistic boxes and excessive explanatory cards | **MOVE INTO PRODUCT** per-serving hierarchy and progressive detail |
| 31 Saved | Store save action; board standalone screen | Another tutorial for an action that already happened | **MOVE INTO PRODUCT** concise confirmation and real saved recipe state |
| 32 Grocery | `screens/GroceryListScreen`, store grocery action | Re-explains feature instead of showing list | **MOVE INTO PRODUCT** actual grocery list, not onboarding clone |
| 33 Cooking mode | `OnboardingCookingScreen`; real guided cooking components | Duplicate onboarding mode can carry tutorial styling forward | **MOVE INTO PRODUCT** reuse real cooking behavior and existing completion logic |
| 34 Cooking completion | `CookingCompleteScreen`, `useOkyoStore.completeRecipe` | Celebration can confuse estimate with actual spend | **MOVE INTO PRODUCT** minimal celebration; only existing completion transaction records savings |
| 35 Home | `screens/HomeScreen`; current navigator | Automatic tour/recap can delay arrival | **MOVE INTO PRODUCT** real Home, no automatically imposed onboarding coachmarks |
| 36 Liked | `screens/LibraryScreen` | Extra explanatory mockup instead of current library | **MOVE INTO PRODUCT** real collection and navigation |
| 37 Customization intent | `V4CustomizationScreen`, result actions; conditional | Generic field/paywall can precede a specific request | **MOVE INTO PRODUCT** desired change first; only preference edits invoke premium |
| 38 Pro loading | `V4PaywallScreen`, `services/revenueCat.ts`; conditional | Repeated benefits and invented offer risk | **KEEP** genuine loading, no invented prices; preserve recipe and intent |
| 39 Pro unavailable | Same paywall/entitlement error state | Should not strand user or revoke first recipe | **KEEP** minimal retry/dismiss and recipe access |
| 40 Post-purchase resume | V4 `postPurchase`, premium action persistence | “Onboarding complete” celebration can discard request | **MOVE INTO PRODUCT** resume exact persisted action once entitlement is confirmed |
| 41 Unclear photo | First-scan rejection returning scanEntry | Generic error text lacks distinct fallback | **KEEP** calm targeted recovery, retained preferences, no fake recipe |
| 42 Non-food | First-scan rejection returning scanEntry | Must not classify uncertainty as definitely non-food | **KEEP** only for actual non-food result, clear alternate input |
| 43 Service failure | First-scan transaction failure/recoverable failure | Error may restart attempt or lose recoverable handle | **KEEP** distinct retry/resume, no first-free consumption on failure |
| 44 Camera denied | Picker permission result / input error | Must not block upload/description | **KEEP** Settings + existing photo, specific permission explanation |
| 45 Interrupted session | `ResumeFirstAttemptScreen`, scan persistence | Stub recap can resume stale image/session | **KEEP** recover genuine session; never persist raw photo without consent |
| 46 Kiko naming | V3 `NameFoxScreen`; optional after-value concept | Currently before user’s name/goal/recipe | **MOVE INTO PRODUCT** optional later relationship moment, not first-run gate |
| 47 Own-target reveal alternative | `PersonalInsightScreen` macro branch | Separate board export, not a necessary extra route | **MERGE** into macro reveal based on state; daily targets distinct from recipe values |
| 48 Free correction | Real `RecipeDetailScreen` correction flow; missing V4 result affordance | Paid customization must not swallow factual correction | **MOVE INTO PRODUCT** reuse free correction transaction and retain original on error |
| 49 Second recipe premium intent | Existing scan entitlement/product entry behavior | Not a setup screen; entitlement cannot be fabricated | **MOVE INTO PRODUCT** preserve real entitlement rules and first-recipe access |
| 50 Purchase pending | RevenueCat + premium action persistence | Must not mark entitlement early or lose intent | **KEEP** pending state; only confirmed entitlement resumes action; canceled returns gracefully |

## Additional current runtime states not represented as separate board exports

| Current state | Problem | Action |
| --- | --- | --- |
| Splash | Can add artificial delay | KEEP resource-ready launch behavior; do not add another marketing screen |
| Attribution | Helps acquisition reporting, not first value | REMOVE from required onboarding; retain any existing data |
| User name | Required before meaningful result in V3 | MAKE CONDITIONAL / later profile; preserve existing profile name |
| Secondary goals | Another pre-value quiz | MOVE INTO PRODUCT; initial single goal remains editable |
| Hold-to-reveal | Gesture ritual delays payoff and accessibility | REMOVE required gesture; normal accessible action |
| Branch insight/demo/future/plan permutations | Repeat the same benefit several times | MERGE into one meaningful personalized reveal |
| Macro calculator | Body measurements and derived targets before value | MOVE INTO PRODUCT; no automatic invented targets in the new quick flow |
| Plan saving failure | Currently tied to separate plan page | KEEP retryable transaction inline; never allow input before canonical/dietary commit succeeds |
| Native photo picker / purchase sheet | Native controls, not custom board routes | KEEP OS surfaces; verify cancellation and return |

## Implementation plan

1. Establish baseline TypeScript/tests and verify simulator/build/Metro roots. Record failures before attributing them to this change.
2. Evolve the existing V4 draft/reducer/contracts with a versioned migration: mechanism step; explicit answered/skipped context; real neutral route; Money priority + optional comparison; macro detail with own-target disclosure; merged plan commit boundary. Tests must cover forward/back, goal changes, invalidation, skipped vs missing, hydrate, and older drafts.
3. Rebuild the shared open, choices, and reveals using existing tokens and approved art. Distinct screen archetypes, not one scaffold restyled fifty ways. New small reusable primitives should express layout/interaction, not abstract away branch meaning.
4. Rebuild input/confirmation/wait/result with image continuity and phase-aware transitions. Preserve image privacy, transaction identifiers, free successful-result entitlement, and backend truth.
5. Hand off to real recipe/product surfaces. Preserve dietary conflict warnings, free correction, store completion/savings, saved/grocery behavior, and intent-driven premium. Do not replace unrelated Home/library/auth work.
6. Enable the redesigned engine only after migration and route tests pass. Existing progress must be intentionally reconciled, not silently dropped or stranded on the old paywall. Keeping the old engine hidden behind a flag is not completion of the requested active-app redesign.
7. Actual iOS simulator walkthrough of every branch, relevant variants, input/recovery, premium states, and accessibility. Capture screenshots plus significant transitions; red-team and simplify, then rerun tests and `git diff --check`.

## Visual rules to enforce

Existing Okyo font and tokens remain the foundation. Approximately 24-point optical margins; 40–48-point hero, 30–36 title, 16–18 body, readable supporting text. One major surface unless an interaction requires more. Direct rows and dividers for choices; chips only for genuine multi-select. Money uses green, nutrition blue, macros lavender, primary actions pink, canvas cream. Reveal screens reduce chrome and amplify one insight/food visual. No setup progress after input begins. Respect reduced motion and large text; no fixed layout that hides the CTA under the keyboard.

Kiko has a named role on each appearance and does not repeat essentially the same pose on adjacent screens. Food is large whenever it explains the product or delivers the result. No unverified personal metrics, home cost before a recipe, earned savings before completion, or store offers.

## Completion evidence ledger — all unverified until recorded

- [ ] Current 50-state audit complete and implementation correspondence rechecked after changes.
- [ ] Active route uses redesigned experience; old drafts migrate without data loss.
- [ ] Promise/mechanism/goal, three branches and direct neutral route implemented.
- [ ] Own-target disclosure, skip semantics, answer invalidation, and resume tested.
- [ ] Dietary authority, canonical profile precedence, safety warnings preserved.
- [ ] Actual first-scan transaction and recoverable states verified; no fake success.
- [ ] First result goal hierarchy verified for Money, Health, protein, calories, balanced, and neutral.
- [ ] Product handoff, save, groceries, cooking, Home/Liked, and optional later Kiko naming verified.
- [ ] Free factual correction and original-result recovery verified.
- [ ] Savings only recorded by existing completion logic; comparisons qualified and units correct.
- [ ] Premium loading/available/unavailable/pending/cancel/resume verified with real or clearly isolated test-store evidence.
- [ ] Motion/Reduce Motion, large text, VoiceOver, keyboard, safe area, long copy, error/selection announcements checked.
- [ ] Actual iOS screenshots and transition recordings reviewed, red-team fixes complete.
- [ ] TypeScript and focused onboarding/branch/persistence/dietary/savings/correction tests pass.
- [ ] `git diff --check` clean; no commits or pushes; all authored changes under Okyo-1.

## Initial environment evidence

An iPhone 17 Pro simulator is booted on iOS 26.5 (UDID `55788C71-3219-4A7A-AEE1-04BA60AFBC3C`). This proves availability only, not correct app/build/Metro root or a completed walkthrough. Native interaction tooling and build provenance still need validation.

## Implementation log — first pass

- Git root confirmed `/Users/rober/Desktop/Okyo-1`. Existing Metro listener PID 56999 on port 8081 has cwd `/Users/rober/Desktop/Okyo-1/apps/mobile`; no server was restarted. Native build provenance is still unverified.
- Initial TypeScript run failed on typographic quote characters in the pre-existing edited `screens/nameFoxValueScreens.test.ts`. Repaired the two quote delimiters, retaining its added cooking assertion and all other changes.
- TypeScript then revealed existing auth import/case-resolution errors (`AuthGate` versus `authGate`) and tour contract/token errors (`kikoCorner`, `fontFamilies.regular`). These are not evidence of a passing baseline and remain to resolve/revalidate.
- Baseline focused command: `rg --files src -g '*.test.ts' | rg '(onboarding|dietary|savings|correction)' | xargs node --import tsx --test`, from `apps/mobile`: **651 tests, 633 passed, 18 failed** before the visual implementation. Several failures assert old source/layout details. Reconcile them against real requirements rather than blindly loosening assertions.
- Rebuilt `screens-v4/PromiseScreen.tsx` as a shared food-led promise/mechanism composition. The same mounted photograph transitions to the recipe-input position; Kiko changes from chef to explainer. Existing tokens, large text stacking, scrolling, reduced motion, and injected restore behavior are retained. Intro skip currently advances to goal selection; direct-first-recipe skip will be wired with the neutral-route work.
- Existing `onboardingV4Screens.test.ts`: **40/40 passed** after this component change. This is only structural/regression evidence, not simulator visual validation.
- Added `onboardingOpeningStory.test.ts` for the mounted food surface, merged teaching, service isolation, and accessibility layout safeguards.
- The new component remains behind the disabled V4 route. It has **not** been delivered as the active redesigned app. Remaining branch/contracts, result/product handoff, migrations, full test suite, and actual simulator QA are still required.

## Implementation log — direct route and combined setup

- Promise's “Try my first recipe” and goal selection's “Just show me” now go directly to dietary safety, without a questionnaire or invented resolved goal. Neutral recipe results accept a null goal and lead with overview, ingredients, and steps.
- Changing goals invalidates incompatible branch answers and setup/scan state while preserving dietary choices. Re-selecting the same goal retains its answers.
- Replaced the separate recap with one setup transaction: dietary authority first, canonical profile second, advance only after success. Partial failure retains the form for retry. Duplicate presses and edits during saving are guarded; late success for a different submitted draft cannot advance the reducer.
- Historical `plan` states render the editable dietary form, and their edits route through the same safety setters. Removed the now-fictional recap-view analytics event.
- Added injected transaction tests for ordering, failures, retry, neutral identity, old-state editing, goal switching, and stale responses. The focused draft/reducer/setup/opening/screen/bridge/result set passed **166/166** before the goal-picker visual change. TypeScript passed at that checkpoint; initial baseline auth/tour errors are no longer present in the shared worktree.
- Replaced the oversized goal cards with compact accessible radio rows, supporting branch colors, one explicit Continue action, and once-per-change selection haptics. The UI/UX skill informed hierarchy and accessible controls; existing Okyo fonts and tokens are retained.
- Visual/native validation remains outstanding. The V4 activation gate is still intentionally unchanged during implementation; this is progress, not a completed rollout.
- Verification after the goal-picker change: **167/167** targeted tests passed; `npm run typecheck` passed; `git diff --check` passed. Broader onboarding/dietary/savings/correction selection: **666 tests, 648 passed, 18 failed**. Remaining failures concern legacy V3 savings/reveals/route assumptions, motion/source guards, older naming/attribution layouts, and the empty-dietary-selection contract. They must be investigated, not treated as a green suite or silently disabled.

## Implementation log — personalized reveals and Money questions

- Replaced the hidden tap-to-reveal with visible-on-arrival payoff. Money shows the actual entered eating-out amount and explicitly leaves home cost unknown until a recipe exists. Health uses a large bundled dish photo with answer-derived guidance. Macros emphasizes the chosen metric; teaching numbers are explicitly illustrative, not generated/photo-derived nutrition, and entered daily targets appear separately.
- `PersonalInsightScreen.tsx` now uses a scrolling food-led composition, reduced-motion-aware entrance, readable estimate notes, deliberate Kiko roles, and “Try it on a dish.” `onboardingRevealContent.ts` owns independently tested answer-derived content.
- `BranchQuestionScreen.tsx` now uses direct radio rows, readable hierarchy, scroll support, selected-state checks, and once-per-change haptics rather than large bordered cards.
- Money Q1 now collects cooking priority. It reaches the existing canonical `savings.cookingPriority`, `buildGoalContext`, and backend recipe-generation prompt. Money Q2 provides a two-stepper comparison with explicit confirmation or skip. Suggested numbers stay local until confirmation, and skip stores no made-up meal cost/replacement frequency.
- Draft schema 6 preserves older Money answers while validating the added priority/comparison/replacement fields. New tests cover legacy resume, skip round-trip, numeric bounds, and real downstream goal-context delivery. No completion/savings accounting was modified.
- Verification: **184/184** targeted draft/reducer/contracts/bridge/screen/reveal/Money tests pass; TypeScript passes. Broader suite: **675 total, 657 passed, the same 18 legacy failures remain**.
- Next implementation dependency: merge macro detail and own-target entry, preserving the distinction between user-provided reference targets and automatic recommendations in persistence/generation. Current canonical bridge can calculate from legacy body data but does not faithfully handle partial self-entered targets; do not merely relabel the old calculator route.
- Active rollout, real-result/product handoff, input/recovery redesign, complete legacy-test reconciliation, and native storyboard/motion QA remain required. These changes have not yet been visually validated in the simulator or activated as the production onboarding.
