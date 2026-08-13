# OKYO DESIGN SYSTEM V2

Planning document. No code was changed to produce it. Codex executes this; it should not need to invent design decisions.

Audited on branch `feature/onboarding-v3-bitepal-showcase`, 2026-08-05.

---

## 0. WHAT THE AUDIT ACTUALLY FOUND

Facts that drive every decision below. Verified in source, not assumed.

**0.1 The shared onboarding is mostly artwork, not composed UI.**
`src/onboarding-v3/showcase/pages/*` render approved PNG/transparent compositions from `assets/onboarding ex/` and `assets/onboarding-ex-transparent/`, registered in `src/onboarding-v3/assets/onboardingV3Assets.ts`. `HeroPage.tsx` is a full-bleed image with invisible `Pressable` hit rects mapped through `onboarding2Layout.ts`. This is *why* the shared onboarding looks better than everything else: it is illustration, not a component system. The rest of the app cannot be made to look like it by copying its code — there is little code to copy. The design language must be **extracted from the artwork into tokens**, which is what PASS 1 does.

**0.2 The personalized branches use three different canvases.**
`PersonalizedOnboardingScreen.tsx:227`:
```ts
function branchColor(goal) { return goal === 'save_money' ? '#EAF8E8' : goal === 'eat_healthier' ? '#FFF2E9' : '#F0F1F7'; }
```
Mint green / peach / cold blue-grey. Plus `MacroDashboard` paints a near-black `#17181D` panel. This single function is the largest cause of "three different apps." It is a one-line fix with large downstream consequences.

**0.3 There are two typographic universes, and a third inside one of them.**
- App screens: `fontFamilies` = **Sora** (`okyoTheme.ts:56`).
- Shared onboarding: `onboardingFontFamilies` = **Inter** (900 Black display), 30px, sentence case (`pageStyles.ts`).
- Personalized onboarding: `personalizedDisplay` = **BarlowCondensed_900Black**, 48px, and every headline is written ALL CAPS in the source strings (`TAKEOUT ADDS UP FAST.`, `WHAT SHOULD OKYO HELP WITH?`).

Three families, three cases, three scales, one product.

**0.4 Home is not a dashboard.**
`HomeScreen.tsx` = greeting + a white "scan section" card + optional Active Cooking card + Recent Recipes list + Today's Ideas grid + a Discover prompt. There is **no metric surface at all**. The Home in `Dashboard.md` does not exist yet; this is net-new construction, not a restyle.

**0.5 `primaryGoal` is not reachable from Home.**
It lives only in the onboarding-v3 AsyncStorage profile (`PERSONALIZED_PROFILE_STORAGE_KEY` in `onboardingV3Persistence.ts`) and in the onboarding state machine. `useOkyoStore` has a legacy `onboardingGoal` field, which is a *different* enum. **Home cannot order the metric carousel until a bridge exists.** This is a hard prerequisite for PASS 2 and is scheduled inside PASS 1.

The onboarding profile is and remains the **single source of truth** for this value. The fix is a **read path**, not a second store: Home reads the same profile through one stable selector, it does not get its own copy of the goal that could drift out of sync. If the user later changes their preference (e.g. in Settings), that write goes back to the same onboarding profile record — there is exactly one place this value lives, `useOkyoStore` merely exposes a read-through to it.

**0.6 Available honest data (what the metric carousel may show).**
From `useOkyoStore`: `recipesById` (each `CanonicalRecipe` carries `nutritionEstimate`, timing, cost fields), `recentRecipeIds`, `savedRecipeIds`, `completedChallenges` (carries `moneySaved`), `totalMoneySaved`, `weeklyScanCount`, `activeCookingSession`. Dietary preferences live in `okyo:dietary:v1`.
There is **no daily food-intake log**. Therefore "protein left today" / "calories remaining" are unbuildable and are forbidden by `Dashboard.md` anyway. Macros must be phrased as **per-Okyo-meal averages**.

**0.7 Colour is not tokenised in practice.**
Hardcoded hexes outside the theme: `SavingsDashboardScreen` (9), `ShareCardPreviewScreen` (8), `RecipeDetailScreen` (7), `LibraryScreen` (4), `ScanInputScreen` (4), `HomeScreen` (1), plus the three branch canvases. A token pass has real work to do.

**0.8 Navigation is already close to right.**
`MainTabs.tsx` renders a floating glass pill (`BlurView` intensity 34, `rgba(255,255,255,0.62)`, radius 34, inset 14) with four tabs: Home / Grocery / Liked / Settings. This is the single best existing product-surface component and becomes the reference for Liquid Glass in V2. It is missing a primary scan action.

---

## 1. BRAND PRINCIPLES

1. **Cream is the app.** Every full screen starts on `#FBF1E5`. No screen invents its own canvas. Accents live *inside* content, never behind it.
2. **Food is the hero, and the biggest thing on screen when it is the subject.** Kiko, cards, and text never out-scale the dish.
3. **Heavy type, short words.** One big statement per screen, then get out of the way. Never three sentences where one image works.
4. **Cards mean objects.** A card is a recipe, a metric, a plan, an ingredient group. A card is not a background.
5. **Glass floats, cream sits.** Glass only for things that hover over content.
6. **Kiko earns his place.** He appears where the onboarding Kiko registry says he appears, or where he carries emotion (empty states, success, failure). Never as filler.
7. **Honest numbers or no numbers.** Every displayed metric traces to real user activity or is explicitly labelled an estimate. No invented health scores.
8. **Personalization changes emphasis, never identity.**

---

## 2. CANVAS / BACKGROUND

| Token | Value | Use |
|---|---|---|
| `canvas` | `#FBF1E5` | Every screen root. Non-negotiable. |
| `canvasSunk` | `#F4E5CF` | Recessed strips: sticky footers over scroll, segmented-control troughs, image placeholder fills. |
| `surface` | `#FFFFFF` | Cards, sheets, inputs. |
| `surfaceMuted` | `#FFFCF8` | Grouped inner rows inside a card (max one level deep). |

**Deletions:** `branchColor()` is deleted. `#F7FBFE` (HeroPage), `#FFF0DE` (ValuePage), `#FEFCFA` (SavingsPage), `#fffdf8`, `#fff1df`, `#fff8e8`, `#f5eee4` etc. are all replaced by the four values above.

**Rule:** goal accent tinting on a full-screen background is banned. Maximum accent surface area on any screen ≈ 25% (one card, one graph, a few chips).

---

## 3. COLOR TOKENS

Structural (unchanged, already correct in `okyoTheme.ts`):

| Token | Value |
|---|---|
| `ink` | `#2B2B30` — headlines, primary buttons, selected states |
| `body` | `#57545E` |
| `muted` | `#89858F` |
| `border` | `#EEE4D6` |
| `danger` | `#C94A5E` |

Brand:

| Token | Value | Use |
|---|---|---|
| `coral` | `#FF8BAE` | Okyo's signature accent: icons, active cooking, likes, primary highlight |
| `coralDark` | `#E86F91` | Coral text on light (contrast-safe) |
| `coralSoft` | `#FFF0F4` | Coral-tinted card fill |
| `sunny` | `#FFD64A` | Celebration, badges, streak marks only |

### 4. Savings accent
| | |
|---|---|
| `savings` | `#2F8F5B` (text-safe green; replaces `#39A94C` / `#45BA58` / `#67C978`) |
| `savingsSoft` | `#E8F6EE` |
| Use | Money values, savings graph fill, savings metric card ring |
| Never | Full-screen green wash, green buttons |

### 5. Health accent
| | |
|---|---|
| `health` | `#E1746C` (warm terracotta-coral, sits inside the Okyo family) |
| `healthSoft` | `#FDEDE9` |
| Secondary | `mint` `#8FE3C6` for "improved / lighter" deltas only |
| Never | Cool clinical blue-grey; medical-app iconography |

### 6. Macros accent
| | |
|---|---|
| `macros` | `#6B5BD2` (lavender-violet, warm-leaning) |
| `macrosSoft` | `#F0EDFC` |
| Macro sub-colors | protein `#E1746C`, carbs `#E9A23B`, fat `#6B9ED2` — used only inside macro bars/rings, matching the approved onboarding4 artwork chips |
| Never | Dark fitness-app panel (`#17181D` is deleted) |

**Accent usage contract:** an accent may colour (a) one numeric value, (b) one data-viz fill, (c) icon glyphs, (d) a ≤ 44px chip/pill. It may not colour a screen background, a primary CTA, or a card body larger than a metric tile.

---

## 7–10. TYPOGRAPHY

**Decision (revised): two families, each with a defined job. Barlow Condensed Black/900 is a permanent, intentional part of the Okyo identity for major expressive headlines — it is NOT retired. Inter carries everything else: body copy, questions, controls, supporting text, navigation, labels. Sora is retired from product screens. Numeric hero values may use either Barlow Condensed Black or Inter Black depending on the composition (rule below).**

Rationale: the approved onboarding artwork's heaviest, most "Okyo" moments already lean on this exact heavy/ultra-condensed voice — that is the identity, not an accident to be normalized away. The problem the audit found was never Barlow itself; it was Barlow used indiscriminately (48px, ALL CAPS, on every single onboarding step including ones that are really just questions) versus Inter used everywhere else with no shared rule for when each applies. §8 below is that rule.

### 7. Hierarchy

| Role | Family | Size / LH | Tracking | Case |
|---|---|---|---|---|
| `displayExpressive` | BarlowCondensed_900Black | 44 / 46 | −1% | Sentence case |
| `display` | Inter_900Black | 34 / 38 | −2% | Sentence case |
| `title` | Inter_800ExtraBold | 26 / 32 | −1.5% | Sentence case |
| `section` | Inter_700Bold | 19 / 25 | −1% | Sentence case |
| `body` | Inter_500Medium | 16 / 24 | −1% | Sentence case |
| `bodySmall` | Inter_500Medium | 14 / 20 | −0.5% | Sentence case |
| `label` | Inter_600SemiBold | 12 / 16 | +2% | UPPERCASE (labels only, ≤ 3 words) |
| `caption` | Inter_500Medium | 12 / 16 | 0 | Sentence case |
| `button` | Inter_700Bold | 17 / 22 | −1% | Sentence case |

### 8. Display typography rules — exactly when Barlow (`displayExpressive`) is allowed

Barlow Condensed is a **moment**, not a default. It is permitted only on:
- Splash / hero / "why Okyo" beats in the shared showcase (already Barlow-adjacent in spirit in the approved artwork).
- The **reveal** moment of a personalized branch (e.g. "Takeout adds up fast.", "Your food can hit targets.") — the one headline per step where the app is making an emotional statement, not asking a question or listing options.
- Plan-ready / paywall headline.
- Empty/error/success full-screen moments where one short line carries the whole screen.

Barlow is **not** permitted on:
- Question screens ("What should Okyo help with?", dietary/blocker questions) — these are Inter `display`, because the user is being asked something, not told something.
- Any screen with more than one short headline-weight line.
- Body copy, captions, labels, buttons, list/section headers.
- Any string that would need to wrap past 2 lines at `displayExpressive` size (44px condensed reads poorly wrapped).

**ALL-CAPS is removed as a styling default regardless of family.** Every uppercase string literal in `PersonalizedOnboardingScreen.tsx` becomes sentence case. Uppercase survives only in the ≤12px `label` role (section eyebrows, stat labels). Barlow at sentence case, not shouting, is the corrected voice — heavy weight and condensed width already carry the intensity; caps were doing the same job twice.

Both display roles cap at **two lines**. If it doesn't fit, cut words, don't shrink type.

### 9. Body typography
- Max **two lines** of supporting copy under any headline. If a third is needed, the screen is over-explaining — delete it.
- Never use `muted` for a full paragraph; `body` minimum.
- Body, questions, controls, and navigation are always Inter — never Barlow, regardless of size.

### 10. Numeric typography

Numeric hero values may render in **either** family — pick per composition, not by a fixed global rule:

| Role | Family | Size | Use |
|---|---|---|---|
| `numericHero` (Barlow) | BarlowCondensed_900Black | 76 | Emotional/expressive reveal numbers standing alone as the composition's focal point (annual spend reveal, protein target stepper, money-per-meal stepper) — condensed width lets a big number dominate without dominating the layout. |
| `numericHeroAlt` (Inter) | Inter_900Black, tabular | 56 | Numbers that sit inside a structured layout next to labels/rings (metric card primary value, paywall price) — Inter's wider counters align better against Inter labels and tabular figures. |
| `numericLarge` | Inter_800ExtraBold, `fontVariant: ['tabular-nums']` | 34 | Metric card supporting values |
| `numericStat` | Inter_700Bold, tabular | 20 | Stat tiles, macro grams |

Rule of thumb: if the number is the *entire emotional payload* of the screen (a reveal moment), use Barlow `numericHero`. If the number lives inside a card, grid, or carousel alongside other data, use Inter tabular so it aligns and doesn't jitter. Anything showing a changing number **must** be tabular so it doesn't jitter on update. Currency always rounded to whole dollars in metrics; cents only in cost breakdowns.

---

## 11. SPACING

4pt base. Named steps: `xs 4, sm 8, md 12, lg 16, xl 24, xxl 32, section 40`.

- Screen horizontal gutter: **20** (currently a mix of 20 and 24; standardise to 20 so cards get more width for food).
- Vertical gap between sections: **32**.
- Card internal padding: **16** (compact) / **20** (standard).
- Sticky footer: `paddingTop 12`, `paddingBottom max(insets.bottom, 12)`.
- Scroll content bottom padding must clear the floating tab bar: **`96 + insets.bottom`** (Home currently hardcodes 150, Recipe Result 220 — both become the token).

**Density rule (the "no dead space" rule):** a screen may not contain a vertical gap > 56px that isn't occupied by an image, a graph, or deliberate hero breathing room. `PersonalizedOnboardingScreen`'s `numberStage { minHeight: 440 }` and `dashboardHero { minHeight: 360 }` are the current violations — those become content-sized with the CTA pinned to a real sticky footer.

---

## 12. BORDER RADII

| Token | Value | Use |
|---|---|---|
| `hero` | 32 | Full-width food images, hero panels |
| `card` | 24 | Standard cards, metric tiles |
| `panel` | 20 | Inner grouped rows, inputs |
| `chip` | 999 | Chips, pills, buttons |
| `glass` | 34 | Floating glass surfaces (matches existing tab pill) |

Retire the one-off 36 / 30 / 28 / 26 / 22 / 18 / 14 values scattered across screens.

---

## 13. CARDS / SURFACES

Exactly three card treatments. Anything else is a bug.

1. **Content card** — `surface`, radius `card`, border `1px border`, `shadow.card` (`0 6 14 rgba(43,43,48,0.06)`). Recipes, metrics, plans, groups.
2. **Media card** — no fill, radius `hero`, image `cover`, no border, no shadow. Food only. Never put a border on food.
3. **Quiet group** — `surfaceMuted`, radius `panel`, **no shadow**, no border. Only for rows *inside* a content card.

**Nesting rule:** maximum depth 2 (content card → quiet group). A media card never lives inside a content card — it sits directly on canvas. This kills the current card-in-card-in-card pattern in Recipe Result and the personalized story steps.

**Shadows:** two only.
- `shadow.card`: `y 6, blur 14, 6%`
- `shadow.float`: `y 12, blur 24, 12%` (glass + FAB only)

The `#5A3924` / `#72513C` / `#193E20` custom shadow colours are replaced by `rgba(43,43,48,·)`.

---

## 14. LIQUID GLASS

Reference implementation already exists: `MainTabs.tsx` `tabBarPill`. Formalise it as `<GlassSurface>`.

```
BlurView intensity 34, tint "light"
backgroundColor rgba(255,255,255,0.62)
borderWidth StyleSheet.hairlineWidth
borderColor rgba(255,255,255,0.76)
borderRadius radius.glass
shadow.float
```

The rule is restraint by **category**, not a fixed count — new floating chrome that genuinely needs to hover over content may use glass; anything that isn't hovering over content may not.

**Permitted component categories:**
1. **Bottom navigation** — the tab bar pill.
2. **Floating primary actions** — the scan FAB, and occasional other floating primary actions when a screen genuinely needs one hovering over scroll content (not a default — most screens use a sticky opaque/`canvasSunk` footer instead, see §15).
3. **Overlays and sheets** — bottom sheets, modal headers/toolbars presented over food photography or scrolling content.
4. **Sticky CTA footers over scrolling content** — where the footer visually floats above content rather than sitting flush on canvas.
5. **Selected/active segmented or interactive controls** — the active segment of a segmented control, an active filter chip in a floating context.

**Forbidden:** metric cards, recipe cards, list rows, full screens, static content that sits flush on canvas with nothing scrolling behind it (glass over flat cream with no occlusion is a wasted GPU pass and looks like dirty white). If a component doesn't visually hover over other content, it isn't a glass candidate.

Android: `BlurView` degrades to a translucent fill. Accept it; the existing comment in `MainTabs.tsx` already documents this. Do not build a native fallback.

---

## 15. PRIMARY BUTTONS

Standardise on the existing `OnboardingCTA` geometry — it is already the best button in the app — and promote it to `src/components/okyo/PrimaryButton.tsx` for use everywhere.

```
bg ink #2B2B30 · label #FFFFFF Inter_700Bold 17
minHeight 60 · radius 999 · width 100% of gutter (max 400)
shadow: y6 blur14 rgba(43,43,48,0.18), animating to 0.08 on press
press: scale 0.97, 90ms out-quad (existing motionTokens.cta)
optional trailing chevron
```

Retire: `ResultPrimaryButton`, `activeCookingPrimary` (radius 14, 13px text), `confirmPrimary`, `dialogPrimary`, `PrimaryButton` in `OkyoUI`. One component.

Coral is **not** a primary button colour. Coral is Okyo's accent, and a coral CTA on cream reads weaker than ink. Coral stays on the scan FAB and icons. (The existing coral "Take photo" button in `ScanEntryOptions` is the one sanctioned exception, because it is a camera affordance, not a page CTA.)

**Status: PROVISIONAL.** The ink-primary / coral-FAB pairing is the design-system's working hypothesis, not a locked decision. It is validated visually during PASS 2 (Home) — the first pass where both the primary CTA and the FAB actually ship together on a real screen. If it doesn't read right against the approved onboarding artwork at that checkpoint, it is revised there, before PASS 3 propagates it anywhere else. Nothing beyond PASS 2 depends on it being final.

## 16. SECONDARY BUTTONS

```
bg surface · border 1px border · label ink Inter_700Bold 16
minHeight 52 · radius 999
```

Tertiary = text-only, ink, 16 semibold, min tap target 44.

## 17. SELECTION CONTROLS

- **Option row** (goals, blockers, dietary): `surface`, radius `panel`, minHeight 64, 16px label; selected = `ink` fill, white label, white check on the right. This is exactly the Cal AI pattern in `onboarding ex/health/file.png` and it already exists as `OptionCard` — keep it, retire the `optionMacro` radius-14 variant so all three branches match.
- **Chip** (dietary): radius 999, minHeight 48, `surface` → `ink` when selected.
- **Stepper / slider**: `ink` 56px round buttons, `ink` fill track, value rendered in `numericHero`.
- **Segmented control**: `canvasSunk` trough, selected segment = `GlassSurface` or `surface` + `shadow.card`.

Every selection control: 44pt minimum tap target, `accessibilityRole` + `accessibilityState.checked`, and a selection haptic.

## 18. FOOD PHOTOGRAPHY

- Always **media card**: radius `hero`, `resizeMode: cover`, no border, no shadow.
- Hero food (Recipe Result, branch demo): full gutter width, aspect **4:3**, ≥ 300pt tall.
- Metric-adjacent food (Home recent dishes): full width, aspect **16:9**, 160pt.
- List thumbnails: 64×64, radius `panel`.
- Loading = `canvasSunk` fill + a subtle shimmer; **never** a spinner on top of a placeholder card.
- Missing image = `canvasSunk` fill + small coral cutlery glyph + dish name. Not a paragraph of apology (Recipe Result currently prints "Okyo can still show the scan result from the recipe data" — delete).
- Food is never overlapped by more than one floating element, and text never sits directly on a photo without a scrim.

## 19. KIKO

`src/onboarding-v3/assets/kikoOnboardingRegistry.ts` remains **authoritative for personalized onboarding**. Do not add, remove, or reassign onboarding artwork.

Outside onboarding, Kiko appears in exactly these places:
- Empty states (no saved recipes, empty grocery list) — 120pt
- Success moments (cooking complete, first save) — 160pt
- Failure/uncertainty states (scan failed, unclear photo) — 100pt
- Home header — **only** at ≤ 44pt, as a small mark beside the greeting, or not at all

Kiko sizes: `small 44 / medium 100 / large 160 / hero 210`. He is **never** larger than the dish on the same screen. He is never added purely to fill vertical space. The current `HomeScreen` `KikoMascot pose="scanning" size={52}` inside the scan card is acceptable and moves to the header at 44.

## 20. GRAPHS / DATA VISUALIZATION

Building blocks, in priority order:

1. **Progress ring** — 8pt stroke, `border` track, accent fill, rounded cap. Metric cards. (Reference: `graph3.webp` calories ring.)
2. **Stacked macro bar** — 10pt tall, radius 999, segments protein/carbs/fat, 2pt gaps. (Reference: approved `onboarding8.png` dark card.)
3. **Growth bars** — 6 bars, radius 8, accent fill with 0.42→1.0 opacity ramp. Already exists as `SavingsGraph`; keep the shape, restyle to tokens, remove the `rotate: -1deg` tilt.
4. **Two-line comparison chart** — Okyo line (accent, solid) vs takeout line (muted, dashed). Already exists in `SavingsPage`; it is good; reuse it for the savings metric detail.

Rules: no gridlines, no axis labels beyond one word, no legends when direct labelling works, no pie charts, no gauge dials. Every estimated chart carries one `caption` line of disclosure ("Estimate from your answers.") — this already exists and must be preserved for AI-honesty compliance.

## 21. NAVIGATION

- Keep the floating glass tab pill exactly as built. Four tabs: **Home · Grocery · Liked · Settings**.
- **Add a scan FAB**: 64pt circle, `coral` fill, white `+`, `shadow.float`, anchored bottom-right, 16 above the tab pill. Tapping opens an action sheet with **Take Photo / Upload Photo / Describe a Dish** — reusing `ScanEntryOptions` semantics unchanged. (Structural parallel to `graph3.webp`'s dark FAB; Okyo's is coral.)
- Back affordance: `OnboardingBackButton` geometry (44pt round, `surface`) becomes the standard back control on every stacked screen. Recipe Result's text "‹ Scan again" button is replaced by it.
- Screen headers: no navigation-bar chrome. Title lives in content as `display`/`title`.
- Progress indicators: a single continuous 6pt track (already in `PersonalizedOnboardingScreen`), never the "1 of 13" string. Note the current implementation parses the count out of a display string (`Number(progress.split(' ')[0])`) — replace with numeric props.

## 22. MOTION

Extend the existing `src/onboarding-v3/motion/motionTokens.ts` and promote it to `src/theme/motion.ts`.

| Token | Duration | Easing |
|---|---|---|
| `press` | 90ms in / 140ms out | out-quad |
| `enter` | 260ms | out-cubic |
| `exit` | 180ms | in-quad |
| `carousel` | spring, damping 22, stiffness 220 | — |
| `countUp` | 700ms | out-cubic |
| `graphDraw` | 900ms | out-quad |

- Metric numbers count up on first appearance only, never on re-render.
- Screen entry: content fades + rises 8pt, staggered 40ms per block, max 3 blocks staggered.
- Carousel: paged `ScrollView`/`FlatList`, snap to card, dots below.
- `useReduceMotion` already exists and is respected in onboarding — every new animation must call it and fall back to opacity-only.

## 23. HAPTICS

`expo-haptics`. Selection = `Selection`. Primary CTA = `ImpactFeedbackStyle.Light`. Carousel page change = `Selection`. Recipe saved / cooking complete = `NotificationFeedbackType.Success`. Scan failure = `NotificationFeedbackType.Warning`. Nothing else. No haptics on scroll or on every step advance.

## 24. EMPTY / LOADING / ERROR STATES

One component shape, three tones.

```
Kiko (100–120pt, pose per tone)
title      display 26, sentence case, ≤ 5 words
body       bodySmall, ≤ 12 words, one line
action     PrimaryButton (empty/error) or nothing (loading)
```

- **Empty:** Kiko happy. "Nothing saved yet." + "Scan a dish to start." + `Start a scan`.
- **Loading:** skeletons in `canvasSunk` matching the final layout — never a bare spinner on a full screen. The existing `AnalysisLoadingScreen` narrative sequence is good and stays.
- **Error:** Kiko thinking. Honest, non-technical, actionable — the existing `getScanFailureCopy` / `getFailureGuidance` logic in `ResultSummaryScreen` is compliant with the AI-safety rules and must be **preserved verbatim in behaviour**, only restyled.

## 25. RESPONSIVE BEHAVIOUR

Three width bands, driven by `useWindowDimensions`:

| Band | Width | Behaviour |
|---|---|---|
| Compact | < 380 (iPhone SE/13 mini) | display 34→30, hero food 4:3→3:2, metric card 300→270, stat tiles 4→2×2 grid |
| Standard | 380–430 | Base spec |
| Large | > 430 (Pro Max) | Gutter 20→24, hero food max height 380, type unchanged |

Height: below 700pt, section gaps 32→24 and hero food caps at 260. Metric carousel card width is always `screenWidth − 40`, peek of next card 12pt, so swipeability is visible without a hint label.

## 26. ACCESSIBILITY

- Contrast: `ink` on `canvas` = 12.9:1 ✓. `body` on `canvas` = 6.8:1 ✓. `muted` on `canvas` = 3.9:1 — **caption/label only, never body copy**. `coral #FF8BAE` on cream fails for text → text uses `coralDark`. `savings #2F8F5B` on cream = 4.7:1 ✓ (this is why `#39A94C` is being replaced — it fails at 3.1:1).
- Dynamic Type: `maxFontSizeMultiplier` 1.2 on display/numerics, 1.5 on body, unrestricted on captions. Never `allowFontScaling={false}` except decorative glyphs (the existing chevron does this correctly).
- Every metric card is one accessible element with a composed label: `"Savings. 84 dollars saved this month. Estimated."`
- Carousel exposes `accessibilityRole="adjustable"` with increment/decrement so VoiceOver can page it without swipe gestures.
- Tap targets ≥ 44pt everywhere. The current 10.5px tab labels are fine (icon+label block is 56pt).
- The existing `onboardingV3Accessibility.test.ts` must keep passing.

---

# SCREEN REDESIGN PLAN

---

## SCREEN 1 — SHARED ONBOARDING (Splash → Showcase pager → Name Kiko)

**CURRENT STATE.** `SplashScreen` (cream + Kiko mark) → `ShowcasePager` (7 pages: hero, scan, recipeOutput, customize, attribution, approach, meetKiko) → `NameFoxScreen`. Pages are approved artwork with native text and CTA on top; `HeroPage` is a full-bleed image with mapped hit rects. `PageScaffold` provides cream + header/dots/content/footer.

**CURRENT PROBLEMS.** Minor, and this section is deliberately conservative. (a) `HeroPage` uses `#F7FBFE` and `SavingsPage`/`ValuePage` use `#FEFCFA`/`#FFF0DE` instead of canvas — small but visible seams during page transitions. (b) `ShowcasePageShell` hardcodes `count={7}` while `showcasePages` has its own length. (c) Titles are 30px Inter while personalized branches are 48px Barlow — the seam the founder feels happens at *exactly* the moment the user leaves this section.

**REFERENCE SOURCES.** `assets/onboarding ex/onboarding1–11.png` (authoritative), `onboarding-ex-transparent/*`.

**KEEP.** All approved artwork. Page order. Hit-rect approach on `HeroPage`. Motion tokens and the `SavingsPage` line-draw animation. `PagerDots`. Attribution page.

**REMOVE.** The three off-canvas backgrounds. The hardcoded dots count.

**NEW VISUAL HIERARCHY.** Unchanged — artwork, headline, one body line, CTA. This screen *is* the target.

**LAYOUT / TYPOGRAPHY / COLORS.** Title moves 30 → `display` 34/38 sentence case (already sentence case here). Body stays 15→16 `body`. Canvas normalised to `#FBF1E5` on all seven pages.

**CARDS.** None added.
**PHOTOGRAPHY.** Baked into artwork. Untouched.
**KIKO.** Registry-driven, untouched.
**METRICS.** None.
**CTA.** `PrimaryButton` (same geometry as today).
**MOTION.** Unchanged.
**RESPONSIVE.** `getCoverImageFrame` already handles cover-fitting; leave it.
**FILES.** `showcase/pages/HeroPage.tsx`, `SavingsPage.tsx`, `ValuePage.tsx`, `pageStyles.ts`, `ShowcasePageShell.tsx`.
**RISK.** **Low.** But this is the brand anchor — any regression here is a brand regression. Screenshot-diff before/after on all seven pages.

---

## SCREEN 2 — PERSONALIZED ONBOARDING (all three branches, 13 steps)

**CURRENT STATE.** One file, `PersonalizedOnboardingScreen.tsx` (234 lines, heavily condensed one-line components). Steps: name → primaryGoal → branchIntro → q1/q2/q3 → holdReveal → branchReveal → branchDemo → secondaryGoals → dietary → personalizedFuture → planReady. Branch-specific story components (`SavingsStory`, `HealthStory`, `MacroStory`) and visuals (`SavingsIntroVisual`, `SavingsGraph`, `MacroDashboard`, `TargetRows`, `NutritionPanel`).

**CURRENT PROBLEMS.**
1. `branchColor()` gives three different app canvases.
2. `MacroDashboard` is a near-black `#17181D` fitness panel — a fourth visual universe inside the third.
3. Every headline is ALL CAPS Barlow Condensed at 48px, versus sentence-case Inter 30px one screen earlier.
4. Dead space: `numberStage minHeight 440`, `dashboardHero minHeight 360`, `moneyResultTall minHeight 300` — content floats in the middle with large unexplained gaps.
5. Decorative rotations (`graphCard rotate -1deg`, receipt `7deg`, coin `-10deg`) that appear nowhere else in Okyo.
6. Nested white cards inside tinted canvases inside more cards.
7. Progress state is a display string that gets parsed for the bar width.
8. Screen-label copy leaks (the founder's list of banned labels).

**REFERENCE SOURCES.** `onboarding ex/savings/*` (Cleo slider, Acorns projection, Cal AI blockers, BitePal/Yazio comparison graphs), `health/*` (Cal AI blockers, Withings nutrition, BitePal macro card), `macros/*` (Alma custom values, Cal AI goal rings). Interpreted through the Okyo system — layouts adopted, visual languages discarded.

**KEEP.** All 13 steps and branch logic. All copy content and estimate disclosures. `HoldToReveal`. Kiko registry assignments. `OptionCard` / `OptionChip` / stepper interactions. The savings line-comparison and bar-growth ideas. The `personalizedGoalContent` data model.

**REMOVE.** `branchColor()`. The dark `MacroDashboard` panel. All-caps headline strings. All decorative rotations. `optionMacro` variant. `minHeight` dead-space padding. Any remaining designer-label copy.

**NEW VISUAL HIERARCHY (every step, one template).**
```
[header]        back button · progress track
[content]       headline (display, ≤2 lines, sentence case)
                hero element (food | graph | control | Kiko)
                supporting element (comparison strip | metric row)
                disclosure caption
[sticky footer] PrimaryButton
```

**LAYOUT.** All steps use one `PersonalizedStepScaffold` built on the same `PageScaffold` as the shared onboarding. Content is top-aligned with a 24pt gap under the header — **not** vertically centred — which removes the dead-space problem structurally. CTA in a real sticky footer over `canvasSunk`, not floating in flow.

**TYPOGRAPHY.** `display` 34/38 Inter_900Black sentence case for all headlines. `numericHero` (Barlow Condensed 76) survives for the three genuinely-giant numbers: the money stepper value, the protein target, the annual spend reveal. Nothing else uses Barlow.

**COLORS.** Canvas `#FBF1E5` on all three branches. Accent applied only to: the hero numeric, the graph fill, the ring strokes, and one soft-tinted card (`savingsSoft` / `healthSoft` / `macrosSoft`). Savings green corrected to `#2F8F5B` for contrast.

**CARDS/SURFACES.** Content card + quiet group only, depth ≤ 2. `MacroDashboard` becomes a white content card with four rings using the macro sub-colours — the same component that will ship on Home, built once here.

**PHOTOGRAPHY.** `FoodHero` stays but becomes a media card (radius `hero`, no white fill, no border), 4:3, full gutter width. Currently it is a white card with a 330pt image inside — the white frame is what makes food look small.

**KIKO.** Exactly as the registry assigns. `foodKiko` overlay (Kiko at 0.62 scale tucked into the food frame corner) is kept — it is charming and it is registry-sanctioned.

**METRICS.** Unchanged data, unchanged estimates, unchanged disclosures. Reformat only.

**CTA.** Sticky footer `PrimaryButton`, label unchanged per step.

**MOTION.** Content stagger on entry (3 blocks, 40ms). Number count-up on reveal steps. Graph draw reuses `motionTokens.graph`. `HoldToReveal` untouched.

**RESPONSIVE.** Compact: display 34→30, food 4:3→3:2, stepper buttons 56→48. Long option lists scroll; the footer never scrolls away.

**FILES.** `onboarding-v3/screens/PersonalizedOnboardingScreen.tsx` (split into `screens/personalized/` — `PersonalizedStepScaffold.tsx`, `steps/*.tsx`, `visuals/*.tsx`; the current single file holds ~30 components in 234 dense lines), `state/personalizedOnboarding.ts` (copy only), `okyoTheme.ts`.

**RISK.** **High.** Largest visual delta; 6 test files reference this area (`personalizedOnboarding.test.ts`, `onboardingV3Typography.test.ts`, `onboardingV3Copy.test.ts`, `onboardingV3VisualRevision.test.ts`, `onboardingV3Accessibility.test.ts`, `kikoOnboardingRegistry.test.ts`). Copy tests will assert on the old ALL-CAPS strings and **must be updated deliberately, not deleted**.

---

## SCREEN 3 — HOME DASHBOARD

**CURRENT STATE.** Greeting kicker + "What are we making today?" title → white scan card (Kiko 52 + `ScanEntryOptions`) → optional Active Cooking card → Recent Recipes list (3 rows, thumbnail 58pt) → Today's Ideas 2×2 grid → Discover prompt row. `paddingBottom: 150`.

**CURRENT PROBLEMS.** It is a launcher, not a dashboard. No metrics of any kind. Food appears at 58pt thumbnail scale — the smallest food in the app is on the most-visited screen. Two competing "go somewhere else" affordances (Today's Ideas + Discover prompt). Scan is buried inside a card rather than being an always-available action. Sora type, so it reads as a different product than onboarding.

**REFERENCE SOURCES.** `assets/onboarding ex/dashboard/Dashboard.md` (**product requirements — authoritative**), `graph3.webp` (**structure only**), shared onboarding artwork (visual identity).

**KEEP.** Active Cooking card (behaviour and data — restyle only). Recent recipes data source (`resolveRecentRecipes`). Scan entry semantics (`startScan`, camera/photos/describe, `HOME_UPLOAD_TARGET_SCREEN`). Discover route.

**REMOVE.** The white scan wrapper card. The Discover prompt row (redundant with Today's Ideas). The "Take or upload a photo, or describe a meal." explainer line. Numbered timeline markers on recent recipes. `Today's Ideas` moves below Recent Dishes and loses the second CTA.

**NEW VISUAL HIERARCHY.**
1. Compact header (greeting + name, Kiko ≤ 44)
2. Week strip
3. Metric carousel ← the screen's centre of gravity
4. Recent dishes (large food)
5. Today's ideas
6. Floating: tab bar + scan FAB

**LAYOUT (top to bottom, exact).**

```
Header            56pt.  "Good morning, Megan" — title 26, one line.
                  Kiko mark 44pt right-aligned, optional.
Week strip        64pt.  7 columns. Day letter (label 12 uppercase) over
                  date (numericStat 20). Today = ink filled 36pt circle.
                  Days with Okyo activity = 4pt coral dot under the date.
                  No activity anywhere = strip still renders, dots absent.
Metric carousel   300pt. Paged horizontal scroll, card width = W − 40,
                  peek 12, gap 12. Dots below (8pt, ink active).
                  Order from primaryGoal (see below).
Recent dishes     section header "Recent dishes" (section 19) + up to 3
                  media cards, 16:9, 160pt tall, radius hero.
                  Overlaid bottom-left on a 40% bottom scrim:
                  dish name (title 20 white, 1 line) and one meta row
                  (time · protein or savings — max 2 chips).
Today's ideas     existing 2×2 RecommendationCard grid, restyled.
Bottom pad        96 + insets.bottom
```

**METRIC CAROUSEL — the three cards.** One component, three data configs. Same geometry, same type, same card treatment; only the accent and the content change.

```
┌─ content card, radius 24, padding 20, 300pt ─────────┐
│ label (12 uppercase, muted)     e.g. SAVINGS         │
│ numericLarge 34                 $84                  │
│ caption                         this month · estimated│
│                                        ┌─ ring 96pt ─┐│
│ three stat tiles in a quiet group      │  accent     ││
│ (value numericStat 20 / label 12)      └─────────────┘│
└───────────────────────────────────────────────────────┘
```

| Card | Primary | Supporting (3) | Accent | Source |
|---|---|---|---|---|
| Savings | Est. saved this month | meals made · avg saved/meal · total saved | `savings` | `completedChallenges[].moneySaved`, `totalMoneySaved`, recipe cost fields |
| Macros | Avg protein per Okyo meal | avg calories · avg carbs · avg fat | `macros` | mean of `recipesById[*].nutritionEstimate` over meals Okyo knows |
| Health | Goal-friendly meals | healthier edits · matches preferences · dietary matches | `health` | recipes vs `okyo:dietary:v1` + goal flags |

**Honesty constraints (hard).** No "remaining today" anywhere. Every card carries the word *estimated* or *average* in its caption. Zero-state per card shows the label, an em-dash value, and one line: "Cook your first dish to see this." — not a fabricated number. `$84` from `Dashboard.md` is a design example and must never be hardcoded.

**Ordering.** `save_money → [savings, macros, health]`, `hit_macros → [macros, savings, health]`, `eat_healthier → [health, savings, macros]`. Default (no goal) = savings first. All three always present and swipeable.

**TYPOGRAPHY.** Inter throughout. Greeting `title` 26. Section headers `section` 19. Metric primary `numericLarge` 34 tabular. Barlow Condensed does **not** appear on Home — metric numbers change and must be tabular.

**COLORS.** Canvas cream. Each metric card is white with one accent element (ring + primary number). No accent backgrounds.

**CARDS/SURFACES.** Metric card = content card. Stat row = quiet group. Recent dish = media card directly on canvas. Depth never exceeds 2.

**PHOTOGRAPHY.** This is where Home earns its warmth: recent dishes go from 58pt thumbnails to 160pt full-width media cards. Missing image → `canvasSunk` + coral cutlery glyph, same card size (never collapse the row).

**KIKO.** Header mark only, ≤ 44pt, or omitted. Kiko appears at 120pt only in the fully-empty Home state (no recipes, no metrics).

**CTA.** Coral scan FAB, 64pt, bottom-right, 16 above the tab pill, `shadow.float`. Opens the Take Photo / Upload / Describe sheet. There is no other primary CTA on Home.

**MOTION.** Metric numbers count up once on mount. Carousel spring-snaps with a selection haptic per page. Cards fade+rise 8pt on first render, 40ms stagger.

**RESPONSIVE.** Compact: carousel 300→270, stat tiles wrap 3→2+1, recent dish 160→140. Large: gutter 24.

**FILES.** `screens/HomeScreen.tsx` (rewrite), new `components/home/WeekStrip.tsx`, `MetricCarousel.tsx`, `MetricCard.tsx`, `RecentDishCard.tsx`, new `components/okyo/ScanFab.tsx`, `navigation/MainTabs.tsx` (FAB mounting), new `state/homeMetrics.ts` (pure selectors), and the `primaryGoal` read-through selector from PASS 1 (reads the existing onboarding profile — no new store).

**RISK.** **High** — net-new surface with new state selectors. Mitigated by keeping every existing navigation call site intact and by putting all metric math in pure, unit-tested functions.

---

## SCREEN 4 — RECIPE RESULT (`ResultSummaryScreen`)

**CURRENT STATE.** 2,297 lines. Top bar ("‹ Scan again" text button + settings gear) → `FoodImageCard` → title (auto-shrinking, 2 lines) → 4 `StatBlock`s with dividers (Total / Hands-on / Waiting / Servings) → dish confirmation card *or* edit card *or* "Edit recipe" link → `RecipeNutritionCards` → ingredients + equipment lists → "Homemade Estimate" card → Start Cooking + like + add-to-grocery.

**CURRENT PROBLEMS.** Three time metrics compete with servings before the user has even confirmed the dish. The confirmation card is a large white block wedged between the title and the nutrition, breaking the cookbook reading order. Cost/savings is a lonely card at the very bottom, far from where it means something. Everything is a white card, so nothing has hierarchy. The custom "‹ Scan again" text control is the only one of its kind in the app. Sora type. `paddingBottom: 220`.

**REFERENCE SOURCES.** `onboarding ex/health/file-2.webp` (Withings — clean nutrition → ingredients → directions rhythm), `health/file-3.webp` (BitePal — hero dish + macro card), approved `onboarding4.png` (Okyo's own customize composition).

**KEEP.** Every behaviour. Dish confirmation + correction flow (`correctScanRecipe`), edit-recipe path, `RecipeNutritionCards`, ingredient/equipment data, homemade estimate + its honesty caption, like, add-to-grocery, Start Cooking, all failure/uncertain/loading states and their copy (`getScanFailureCopy`, `getFailureGuidance`, `getPublicBestGuessNote`).

**REMOVE.** The 4-across stat row (reduce to 2: total time, servings — hands-on/waiting move into the cooking screen where they matter). The settings gear (Recipe Result is not a settings entry point). The "‹ Scan again" text button → standard round back. The "Food photo unavailable / Okyo can still show…" explanatory paragraph → glyph + short line. Nested white-on-white card stacking.

**NEW VISUAL HIERARCHY.**
1. Dish photo (hero)
2. Recipe name
3. Time · servings
4. Confirmation (only when unconfirmed)
5. Nutrition
6. Cost & savings
7. Ingredients
8. Steps preview
9. Customize
10. Start Cooking (sticky)

**LAYOUT.**
```
back button (round, 44) floating over the photo, top-left, 12/12 inset
media card, 4:3, full-bleed to gutter, radius hero            ← hero
title display 34, ≤2 lines, sentence case
meta row: "35 min · Serves 2"  (bodySmall, muted, single line, no tiles)
[confirmation strip — only when !hasConfirmedIdentification]
   quiet group, one line: "Is this <dish>?"  [Yes] [Fix it]
   collapses to nothing after confirm; correction opens the existing input
nutrition       content card — kcal + stacked macro bar + 3 values
cost & savings  content card — homemade estimate, and the takeout
                comparison when userRestaurantPrice exists
ingredients     section header + plain rows on canvas (no card)
steps           section header + numbered rows on canvas, first 3 + "See all"
customize       chip row (More protein / Less calories / Swap) — existing route
sticky footer   glass · Start Cooking (primary) + like + cart icon buttons
```

**TYPOGRAPHY.** Title `display` 34 (`adjustsFontSizeToFit` retained). Section headers `section` 19. Ingredient rows `body` 16. Numbers `numericStat` tabular.

**COLORS.** Cream canvas. Coral for the like state and cooking glyphs. `savings` green for the savings delta only. Macro sub-colours only inside the macro bar.

**CARDS/SURFACES.** Exactly two content cards (nutrition, cost). Ingredients and steps are **lists on canvas** — this is the single biggest hierarchy win and is what makes it read as a cookbook page rather than a dashboard.

**PHOTOGRAPHY.** Hero media card, 4:3, ≥ 300pt, no border, no white frame. It is the first and largest thing.

**KIKO.** Not on the success path. Kiko appears only in failure/uncertain states (100pt), which already exist.

**METRICS.** Nutrition and cost keep their current estimate semantics and disclosures. Do not add confidence scores, provider metadata, or match percentages — explicitly out of scope per the founder brief and the AI-safety rules.

**CTA.** Sticky glass footer: Start Cooking primary + two 48pt icon buttons (like, add to grocery).

**MOTION.** Photo scales 1.02 → 1.0 on entry. Sections stagger 40ms. Confirmation strip collapses with a 180ms height animation.

**RESPONSIVE.** Compact: hero 4:3 → 3:2, display 34 → 30, steps preview 3 → 2 rows.

**FILES.** `screens/ResultSummaryScreen.tsx` (extract presentational pieces into `components/recipe/`; state logic stays put), `components/RecipeNutritionCards.tsx`, `theme/recipeTheme.ts` (fold into `okyoTheme`).

**RISK.** **High.** This file carries the scan-correction and failure-state logic that the AI-honesty rules depend on. **Rule for Codex: touch presentation only. Do not modify any function between `getResultDecisionRoute` and `getStoredRecipeForMode`.**

---

## SCREEN 5 — GUIDED COOKING (`RecipeStepsScreen` + `OnboardingCookingScreen`)

**CURRENT STATE.** Inside `RecipeDetailScreen.tsx` (2,198 lines). Step-by-step with timing classification (hands-on / waiting / mixed), progress, completion screen. Tab bar hides during cooking (`shouldHideMainTabBar`).

**CURRENT PROBLEMS.** Sora type and legacy card treatment, so it reads as a different app from the result screen the user just left. Timing information is presented as small grey text when it is the most useful thing on screen. Hardcoded hexes (`#fff4df`, `#f8efd8`, `#f7e7df`, `#f5eee4`, `#f1e4cf`, `#eee7dc`, `#d9efd9`).

**KEEP.** Step model, timing classification, reorder safety net, progress persistence, tab-bar hiding, completion flow.

**REMOVE.** Hardcoded hexes. Small-grey timing text.

**NEW VISUAL HIERARCHY.** step number → step text (large) → timing → controls.

**LAYOUT.** Full-bleed cream. Thin ink progress bar pinned at top. `label` "Step 3 of 8". Step text at `display` 30, generously leaded, max ~40 words. Timing as an accent pill under the text ("12 min · hands-on"). Ingredients used in this step as a quiet group. Sticky glass footer: `Back` secondary + `Next` primary. Keep-awake behaviour: verify current behaviour before changing; parity only.

**TYPOGRAPHY / COLORS.** Inter. Coral for hands-on, `macros` lavender for waiting, ink for the progress bar.
**CARDS.** One quiet group max. Step text is not in a card.
**PHOTOGRAPHY.** Small 64pt dish thumbnail in the header for context only.
**KIKO.** Completion only, 160pt, celebrating.
**CTA.** Sticky glass footer.
**MOTION.** Horizontal slide between steps (260ms out-cubic), progress bar animates width. Success haptic on completion.
**RESPONSIVE.** Compact: step text 30 → 26.
**FILES.** `screens/RecipeDetailScreen.tsx` (`RecipeStepsScreen` section), `onboarding-v3/screens/OnboardingCookingScreen.tsx` — these two must land in the same pass so onboarding cooking and product cooking match.
**RISK.** **Medium.** Timing logic is well-tested (`guidedCookingSteps.test.ts`, `recipeIntegrity.test.ts`); don't touch it.

---

## SCREEN 6 — SAVED / LIKED (`LibraryScreen`)

**CURRENT STATE.** 795 lines. Search field, three filters (Recent / Healthier / Fast meals), recipe rows with mode chips, image validation logging. Hardcoded `#fff1df` (×3), `#fff2e8`.

**PROBLEMS.** List rows are text-dominant; food is thumbnail-sized. Mode chips carry visual weight the user doesn't need here.

**KEEP.** Search, filters, data model, image-status handling, the dev-only image logging.

**REMOVE.** Hardcoded hexes. Mode chips on cards (mode belongs on the recipe screen).

**NEW HIERARCHY.** search → filters → food grid.

**LAYOUT.** Search field (`surface`, radius `panel`, 52pt). Filter chips (radius 999, ink when active). **Two-column grid** of media cards, 1:1 image with the name and one meta line below — replacing the current list rows. This is the "food should dominate" rule applied to the screen that is entirely about food.

**TYPOGRAPHY.** Card title `bodySmall` 14 bold, meta `caption`.
**COLORS.** Cream, coral heart on the card corner.
**CARDS.** Media cards on canvas. No white wrappers.
**KIKO.** Empty state, 120pt.
**CTA.** None; the scan FAB covers it.
**MOTION.** Grid items fade+rise on filter change, 30ms stagger.
**RESPONSIVE.** 2 columns always; compact reduces gutter to 16.
**FILES.** `screens/LibraryScreen.tsx`, `components/FoodImage.tsx`.
**RISK.** **Medium.**

---

## SCREEN 7 — GROCERY (`GroceryListScreen`)

**CURRENT STATE.** 1,257 lines. Per-recipe grocery lists, aisle/category grouping, check-off state.

**PROBLEMS.** Dense, card-heavy, Sora type. Checkboxes are small.

**KEEP.** All list logic, grouping, persistence, per-recipe scoping, the tab-navigation param reset in `MainTabs`.

**REMOVE.** Card-per-item treatment.

**NEW HIERARCHY.** title → recipe source chips → grouped checklist → clear action.

**LAYOUT.** `title` "Grocery list" + count caption. Horizontal chips for source recipes. Sections by aisle: `label` uppercase header, then rows directly on canvas — 56pt tall, 28pt round checkbox left, item `body` 16, quantity `caption` right. Checked = 40% opacity + strikethrough, animated, and **not** re-sorted (re-sorting under a user's finger is disorienting). Sticky glass footer only when there is a bulk action.

**COLORS.** Ink checkboxes; coral only on the check glyph.
**CARDS.** None. This is a list.
**KIKO.** Empty state 120pt.
**MOTION.** 180ms check animation with a selection haptic.
**FILES.** `screens/GroceryListScreen.tsx`.
**RISK.** **Medium** (large file, but self-contained).

---

## SCREEN 8 — SETTINGS

**CURRENT STATE.** 202 lines, plain rows, `OkyoUI` shared styles, reset/clear destructive actions with confirmations.

**PROBLEMS.** Only that it uses the old type and shared styles. It is otherwise fine and deliberately boring.

**KEEP.** Everything functional, including both confirmation dialogs and the onboarding-v3 reset path.

**LAYOUT.** `title` "Settings" + version caption. Grouped rows: `label` uppercase section header, rows on `surface` in a single rounded group (radius `card`), 56pt each, hairline dividers. Destructive actions in `danger` text, in their own group at the bottom.
**KIKO.** None.
**FILES.** `screens/SettingsScreen.tsx`, `components/OkyoUI.tsx`.
**RISK.** **Low.**

---

## SCREEN 9 — PAYWALL (`OnboardingPaywallScreen` + `PaywallScreen`)

**CURRENT STATE.** Onboarding paywall: eyebrow "Okyo Pro" + goal-specific headline + Kiko + body + 3 benefits + RevenueCat plan cards (coral border when selected) + CTA + restore + purchase-error modal. Already the most token-clean screen in the app.

**PROBLEMS.** Little visual payoff for the biggest moment in the funnel. Plans are plain bordered rectangles. Two paywall implementations exist (`screens/PaywallScreen.tsx` and the onboarding one).

**KEEP.** All RevenueCat logic, entitlement handling, `providerUnavailable` state, restore, error modal, goal-specific headline, benefit list. **Do not touch entitlement gating.**

**REMOVE.** Nothing functional. Consolidate the two paywalls to one presentational component with two mount points if — and only if — behaviour is provably identical; otherwise leave both and restyle both.

**NEW HIERARCHY.** headline → proof → plans → CTA.

**LAYOUT.** Kiko 100pt top-right. `display` 34 goal headline. Benefits as three rows with `savings`-green checks (existing). Plan cards: content cards, selected = 2px ink border + ink check badge (not coral — coral reads as decorative here); "Best value" badge in `sunny`. Sticky glass footer with `PrimaryButton` + restore below. Legal/restore in `caption`.

**COLORS.** Cream. Ink selection. Green checks. Sunny badge.
**KIKO.** 100pt, one instance, registry-assigned.
**MOTION.** Plan selection: 120ms border/scale, selection haptic. No countdowns, no fake urgency.
**FILES.** `onboarding-v3/screens/OnboardingPaywallScreen.tsx`, `screens/PaywallScreen.tsx`.
**RISK.** **Medium-high** — revenue path. Purchase, restore, entitlement-already-active, and provider-unavailable must all be manually verified after restyling.

---

## SCREEN 10 — SCAN / INPUT (`ScanInputScreen`, `DescribeMealScreen`, `PhotoConfirmScreen`, FAB sheet)

**CURRENT STATE.** `ScanInputScreen` (182 lines) with photo + description entry; `ScanEntryOptions` shared component (coral primary "Take photo", cream secondaries); `PhotoConfirmScreen`; `DescribeMealScreen`. Hardcoded `#FFF5F2`, `#F7E8DC`, `#EDF7E8`.

**PROBLEMS.** Three different entry surfaces (Home card, onboarding screen, FAB sheet-to-be) with three different treatments. Hardcoded tints.

**KEEP.** All scan semantics: prepared-dish only, camera/library/describe, permission handling and its friendly alerts, `startScan`, session ids, the no-real-scan-before-paywall gate.

**REMOVE.** Hardcoded tints. Divergent layouts.

**NEW HIERARCHY.** One `ScanSheet` component used by the FAB, Home, and onboarding. Bottom sheet on cream, 32pt top radius, grabber, `title` "Add a dish", three 72pt rows: Take photo (coral icon tile) / Upload photo / Describe a dish, each with a one-line caption. `PhotoConfirmScreen`: full-bleed photo, glass footer with Use photo / Retake.

**KIKO.** Only on `AnalysisLoadingScreen` (existing narrative — keep, restyle) and failure states.
**MOTION.** Sheet spring-in 280ms. Analysis loading keeps its existing sequence.
**FILES.** `components/ScanEntryOptions.tsx` → `components/scan/ScanSheet.tsx`, `onboarding-v3/screens/ScanInputScreen.tsx`, `screens/DescribeMealScreen.tsx`, `onboarding-v3/screens/PhotoConfirmScreen.tsx`.
**RISK.** **Medium-high** — scan is the product. Permission-denied, cancel, and upload-in-flight guards must be preserved exactly.

---

## SCREEN 11 — SAVINGS INFORMATION (`SavingsDashboardScreen`)

**CURRENT STATE.** 862 lines, 9 hardcoded hexes including `#1f5f29` and `#6b9359` — the most off-brand screen in the app.

**DECISION.** The Home savings metric card becomes the entry point; this screen becomes its **detail view**, not a parallel dashboard. Same tokens, same card language, plus: the two-line comparison chart (reused from `SavingsPage`), a month breakdown, and a per-meal list. All estimate disclosures preserved verbatim.

**REMOVE.** All 9 hardcoded colours. Any gamified framing that survived the July UX-honesty pass (verify against `docs/` before changing copy).

**FILES.** `screens/SavingsDashboardScreen.tsx`.
**RISK.** **Medium.** Savings copy is governed by prior honesty invariants — restyle, don't rewrite.

---

## SCREEN 12 — EMPTY / LOADING / ERROR STATES (cross-cutting)

`AnalysisLoadingScreen` (560 lines, narrative sequence — **keep the narrative, restyle the chrome**), scan failure states in `ResultSummaryScreen`, empty Library, empty Grocery, empty Home, `MainTabs` hydration state (`ActivityIndicator` + "Loading your recipes…" — replace with skeletons).

One `<StateScreen tone="empty|loading|error">` component per §24. All existing failure copy preserved — it is AI-safety-governed. Risk **low**, value high: these are the screens most likely to be seen by a frustrated first-time user.

---

# CODEX EXECUTION SEQUENCE

Five passes. Each pass ends green and shippable. **Nothing in a later pass may start before the prior pass's stop condition is met.**

---

## PASS 1 — DESIGN SYSTEM FOUNDATIONS

**Scope.** Tokens and shared primitives only. Zero screen redesigns.

**Do.**
1. Extend `src/theme/okyoTheme.ts`: canvas set, accent triads (savings/health/macros + soft + macro sub-colours), the two shadows, the radius set, the spacing scale.
2. Unify typography: one `typography` export built on Inter; `numericHero` on BarlowCondensed; keep `onboardingFontFamilies` as an alias so this pass doesn't require a 40-file rename.
3. Promote `src/onboarding-v3/motion/motionTokens.ts` → `src/theme/motion.ts`, re-export from the old path.
4. Create `src/components/okyo/`: `PrimaryButton`, `SecondaryButton`, `GlassSurface`, `Card`, `OptionRow`, `Chip`, `StateScreen`, `SectionHeader`, `BackButton`.
5. **Build one stable read path for `primaryGoal`** — the onboarding profile (`okyo:personalized-onboarding-profile:v1`) stays the single source of truth; add a read-through selector, `useOkyoStore(s => s.primaryGoal)`, that hydrates from that same record rather than a second copy. No new store, no independent Home goal state. If/when the user changes the preference later, the write still targets the one profile record. Blocks PASS 2.
6. Add `src/state/homeMetrics.ts` — pure selectors for savings/macros/health aggregates + their zero-states. Pure functions only, no UI.

**Do NOT touch.** Any screen file. Any API/service/store logic beyond adding the goal field. Any asset. Any onboarding artwork.

**Visual acceptance.** The app looks **identical** to today. This pass is invisible.

**Tests.** `themeTokens.test.ts` extended (asserts canvas, accents, contrast ratios of `savings`/`body`/`muted` on cream). New `homeMetrics.test.ts` (zero-state, single-recipe, many-recipes, missing-nutrition). New `primaryGoalBridge.test.ts`. Existing suite green.

**Stop condition.** `npm test` green, `tsc --noEmit` clean, app boots and is visually unchanged, `homeMetrics` selectors return correct values against fixture stores.

---

## PASS 2 — HOME DASHBOARD

**Scope.** `HomeScreen` rewrite, new home components, scan FAB, tab-bar FAB mounting.

**Files.** `screens/HomeScreen.tsx`, `components/home/{WeekStrip,MetricCarousel,MetricCard,RecentDishCard}.tsx`, `components/okyo/ScanFab.tsx`, `navigation/MainTabs.tsx` (FAB only).

**Do NOT touch.** `startScan` / `scanController` / `scanControllerUtils`. Recipe screens. Onboarding. The tab pill's existing geometry.

**Visual acceptance.**
- Cream canvas, Inter type, no Sora anywhere on Home.
- Week strip renders and marks today; activity dots appear only for real activity.
- Three metric cards, swipeable, ordered by `primaryGoal`, identical geometry across all three, accent-only differentiation.
- No fabricated numbers: a fresh install shows em-dash zero-states with "Cook your first dish to see this."
- Recent dishes are ≥ 160pt tall food, not thumbnails.
- Coral FAB floats above the tab pill and opens the three scan options.
- No vertical gap > 56pt anywhere on the screen.

**Tests.** `homeMetrics.test.ts` extended for ordering. New `homeDashboard.test.tsx` — renders with empty store (no NaN, no `$0` claims), with a populated store, and asserts carousel order per goal. Existing navigation tests green.

**Stop condition.** Founder reviews Home on device against `graph3.webp` and the approved onboarding art and confirms it reads as the same product — **including a specific check that the provisional ink-primary / coral-FAB CTA pairing (§15) reads correctly here**, since this is the checkpoint that decision was deferred to. Revise the CTA treatment here if needed, before it propagates further. **Do not start PASS 3 before that sign-off** — Home is the design test that validates the whole system.

---

## PASS 3 — RECIPE RESULT

**Scope.** `ResultSummaryScreen` presentation + extraction of presentational components.

**Files.** `screens/ResultSummaryScreen.tsx`, new `components/recipe/{HeroDish,NutritionCard,CostCard,IngredientList,StepPreview,ConfirmationStrip}.tsx`, `components/RecipeNutritionCards.tsx`, fold `theme/recipeTheme.ts` into `okyoTheme`.

**Do NOT touch.** Anything between `getResultDecisionRoute` and `getStoredRecipeForMode`. `recipeCorrection.ts`. Scan-failure copy functions. `RecipeDetailScreen` (that's PASS 5).

**Visual acceptance.**
- Dish photo is the first and largest element (≥ 300pt, 4:3, no white frame).
- Reading order matches the target hierarchy exactly.
- Ingredients and steps are lists on canvas, not cards.
- Exactly two content cards on the screen.
- Confirmation strip appears only when unconfirmed and collapses after.
- Sticky glass footer with Start Cooking.
- No scan-confidence, provider, or match-score UI appears anywhere.

**Tests.** Existing `productIntegrityRegression.test.ts`, `recipeCorrection.test.ts`, `recipeIntegrity.test.ts`, `nutrition.test.ts` all green **unmodified**. Manual: photo scan, description scan, uncertain scan, failed scan, correction submit, correction error, demo scan.

**Stop condition.** All four scan outcome states verified on device; no test file was edited to make this pass.

---

## PASS 4 — PERSONALIZED ONBOARDING UNIFICATION

**Scope.** All 13 personalized steps across three branches, plus canvas normalisation on the seven shared showcase pages.

**Files.** `onboarding-v3/screens/PersonalizedOnboardingScreen.tsx` → split into `screens/personalized/`; `showcase/pages/{HeroPage,SavingsPage,ValuePage}.tsx` + `pageStyles.ts`; copy strings in `state/personalizedOnboarding.ts`.

**Do NOT touch.** `controller/onboardingV3Machine.ts` (step order and transitions are frozen). `assets/kikoOnboardingRegistry.ts`. Any approved artwork. `onboardingV3Persistence.ts`. Paywall gating.

**Visual acceptance.**
- One canvas (`#FBF1E5`) from splash through paywall. `branchColor()` no longer exists.
- No ALL-CAPS headlines; all sentence case, all Inter, max 40px.
- Barlow Condensed appears only on the three giant numerics.
- No dark panels. `MacroDashboard` is a white card with accent rings.
- No decorative rotations.
- Every step's CTA is in a sticky footer; no step has a >56pt unexplained gap.
- Screenshots of step N in each branch differ only in content and one accent colour.
- No banned designer labels in any visible string.

**Tests.** `onboardingV3Copy.test.ts` and `onboardingV3Typography.test.ts` updated **intentionally and reviewed** (they assert the old caps/Barlow rules). `personalizedOnboarding.test.ts`, `onboardingV3Machine.test.ts`, `kikoOnboardingRegistry.test.ts`, `onboardingV3Accessibility.test.ts` green **unmodified** — if the machine or registry tests break, the pass has overstepped.

**Stop condition.** Walk all three branches end-to-end on device; place the three screenshot sets side by side and confirm they read as one app.

---

## PASS 5 — PROPAGATION

Sequenced by risk, lowest first. Each is independently shippable; stop at any point.

| Step | Screens | Risk | Stop condition |
|---|---|---|---|
| 5a | Settings, empty/loading/error states, `MainTabs` hydration | Low | Reset + clear-data dialogs still work |
| 5b | Saved/Liked grid | Medium | Search + all three filters work; images resolve |
| 5c | Grocery | Medium | Check-off, grouping, per-recipe scoping intact |
| 5d | Guided Cooking (both product and onboarding) | Medium | Step timing, progress persistence, completion intact |
| 5e | Savings detail | Medium | All estimate disclosures present and unaltered |
| 5f | Paywall (both) | Med-high | Purchase, restore, already-entitled, provider-unavailable all verified |
| 5g | Scan sheet unification | Med-high | Camera, library, describe, permission-denied, cancel all verified |
| 5h | Share card, Discover, Rankings, Dupe Challenge, Profile | Low | Visual only |

**Global stop condition for PASS 5.** Zero hardcoded hexes remain outside `okyoTheme.ts` (`grep -rn "backgroundColor: '#" src` returns nothing but the theme file), and no file imports Sora.

---

## RULES THAT APPLY TO EVERY PASS

1. **Presentation only.** No API, store-logic, provider, scan-semantics, entitlement, or persistence changes beyond the PASS 1 goal bridge.
2. **Never delete a test to make a pass go green.** Tests may be updated only when the pass intentionally changes the asserted rule, and that change must be called out in the summary.
3. **Never invent a number.** Zero-state means em-dash and an invitation, not `$0` or a placeholder.
4. **Never remove an estimate disclosure.**
5. **Never add scan-confidence, provider, or model metadata to user-facing UI.**
6. **Do not modify approved artwork or the Kiko registry.**
7. Each pass reports: what changed, files edited, how to test, what was intentionally left.
