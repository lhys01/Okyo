# OKYO ONBOARDING V3 — CODEX MASTER EXECUTION PLAN

> **Author:** planning pass, 2026-08-02. Read-only audit of both worktrees completed before writing.
> **Executor:** Codex.
> **Status:** ready to execute. Nothing in this plan has been implemented.

---

## SECTION 0 — READ THIS FIRST: THREE FINDINGS THAT CHANGE THE BRIEF

The brief assumed the eleven approved PNGs could be used as full-screen artwork layers with real controls placed over them. **A technical audit of the actual files shows that is not achievable.** The plan below adapts. Codex must not attempt the original full-bleed approach.

### Finding A — The art is the wrong aspect ratio for every modern iPhone

All eleven files are **941 × 1672 px**, aspect ratio **0.5628** (16:9). That is the iPhone SE / iPhone 8 shape (375 × 667 = 0.5622).

Every currently shipping iPhone is 19.5:9:

| Device | Logical points | Aspect |
|---|---|---|
| iPhone SE (3rd gen) | 375 × 667 | 0.562 ← art matches this only |
| iPhone 15 / 16 | 393 × 852 | 0.461 |
| iPhone 15 Pro Max / 16 Pro Max | 430 × 932 | 0.461 |

Rendering the art full-bleed with `contentFit="cover"` on an iPhone 15 crops **~18% off each side** — which destroys the left back-chevron, the right-hand floating cards, and the headline margins. With `contentFit="contain"` it letterboxes ~120pt of empty band top and bottom. Neither is shippable.

### Finding B — Every file has baked OS chrome and baked interactive controls

Confirmed by pixel inspection of all eleven:

- **All 11** have a baked status bar reading `9:41` with fake signal/wifi/battery glyphs. Rendering that under the real iOS status bar produces a visible double status bar.
- **onboarding1, 11** have a baked home indicator bar.
- **onboarding3, 4, 5** have baked pager dots showing a **5-dot** set — the showcase needs **9**. onboarding3 shows dot 1 active, onboarding4 dot 2, onboarding5 dot 5. Inconsistent and wrong count.
- **onboarding3–11** have a baked back chevron.
- **onboarding2, 3, 4, 5, 6, 7, 8, 9, 10, 11** have a baked dark pill CTA (`Get started` / `Next` / `Let's go` / `Skip`).
- **onboarding4** is a screenshot **inside a black device bezel** (`#1D1D1D` at all four edges) — it is a marketing mockup, not a screen.
- **onboarding11** has a **fake iOS keyboard** occupying the bottom ~38% of the canvas (`#EEEEF0` at the bottom edge).

### Finding C — Three files carry content Okyo must not ship

| File | Problem | Severity |
|---|---|---|
| **onboarding2** | Headline reads **"Cook with what you have"** — the exact ingredient-first positioning the product contract forbids. Background is a **blue/purple gradient** (`#C4E4F9`), not the Okyo cream canvas. Mascot is a different 3D-rendered fox in a glass circle, not Kiko. Contains **"I already have an account"** (no account system exists) and baked **Terms of Use / Privacy Notice** links. | **Unusable as artwork.** |
| **onboarding6** | Background is **lavender** (`#F1EEF7`), not cream. Mascot is a **purple cat**, not Kiko. Contains full-color third-party brand marks (Instagram, TikTok, YouTube, App Store) baked as raster — a trademark exposure if shipped as an image. | Composition reusable; art not. |
| **onboarding5, onboarding7** | Baked unsupported money claims: `$6.20 / $17.80 / $11.60 saved` and **"Users save an average of $84 this month with Okyo."** Okyo has no verified savings data, and the repo already established (`userRestaurantPrice` gate) that savings must not be fabricated. | Numbers must not ship. |

### The resulting approach — PER-ASSET, not a blanket rebuild

**The approved art remains authoritative wherever it can safely ship.** The correct strategy is decided **per asset**, not applied uniformly. For each of the eleven, one of three treatments is chosen and justified:

- **FULL COMPOSITION** — the entire approved raster (after crop/dechrome) is the primary visual layer, native controls overlaid on top. Used when the composition is self-contained and device-aspect-independent (e.g. a card that doesn't span the full screen).
- **HYBRID** — the large illustrated/photographic composition (art, Kiko, food photography) is preserved and extracted **as one piece**, kept exactly as approved; only the surrounding chrome (status bar, dots, back button, CTA) and any factually-wrong text overlay are native.
- **EXTRACTED ART + NATIVE LAYOUT** — individual approved elements (a mark, a character, a doodle) are cut out and placed in a native layout, used when the source composition itself can't be preserved as a block (wrong aspect ratio for a full-bleed screen, or the composition mixes chrome/controls too tightly with the art to extract as one region).

**Verified finding: no asset qualifies for pure FULL COMPOSITION at the screen level.** Every one of the eleven is 941×1672 (16:9), every one has a baked `9:41` status bar, and rendering any of them full-bleed on a 19.5:9 device (every current iPhone) either crops ~18% off each side or letterboxes ~120pt. This is a measured fact, not a design preference — see Finding A. So at the **screen** level, HYBRID or EXTRACTED+NATIVE is used everywhere; FULL COMPOSITION is used at the **sub-element** level (Section 5) for self-contained pieces like the three onboarding8 cards, which are each already a bounded composition that doesn't span the device.

**Only one asset has zero extractable art: onboarding6.** It has a lavender (non-cream) background, a purple cat that is not Kiko, and baked third-party trademarked logos (Instagram, TikTok, YouTube, App Store). None of that is safe or appropriate to extract and ship. That page is native-rebuilt from the *layout reference* only (row list + header + Skip), using the existing approved Kiko asset and system iconography instead. This is the sole full-native-rebuild case, and it's justified by the content, not by a blanket policy.

**Every other page preserves its large approved composition as one extracted piece wherever the composition is self-contained** — the food photo + Kiko together on onboarding3/4/5, the three tilted cards on onboarding8, the full hero composition on onboarding9, and **onboarding10's exact approved Kiko pose is preserved verbatim as required**. Only the chrome (status bar, dots, back, CTA) and any text that is factually wrong (fabricated kcal/macro/savings numbers) is rebuilt native. See the classification table in Section 5 for the explicit call and justification on all eleven.

This satisfies "use these exact assets wherever appropriate" and "do not generate replacement artwork" while producing a screen that works on every iPhone and does not ship a 9:41 status bar or a fake keyboard.

**Good news:** the mascot in onboarding3, 4, 5, 8, 10, 11 **is** Kiko — it is pixel-consistent with the existing repo asset `assets/kiko-static/ec041431-….png`. The repo already owns this character in many poses, and the V2 donor already has a working, quality-verified transparency pipeline for them. Very little net-new cutting is required.

---

## SECTION 1 — EXECUTIVE OUTCOME

When this plan is complete, a first-time user experiences:

App launch shows a static native splash on `#FBF1E5` with the Kiko head mark. Within ~250ms a React splash takes over, the mark fades and scales up, then performs a low-amplitude ±2° wiggle. At ~900ms the splash hands off.

The user lands in a **nine-page horizontal showcase**. Pages move with **pure native horizontal translation** — at mid-drag the outgoing page sits physically to the left, the incoming page to the right, a clean vertical seam between them, both tracking the finger 1:1. No crossfade, no scale, no blur, no parallax. Nine dots near the top widen and brighten as the active page changes. A dark pill CTA advances; a back chevron reverses. Swipe and buttons produce identical results.

Each page settles with a short, restrained internal animation — artwork drifting up 8pt into place, Kiko easing in, chips staggering 40–60ms apart. Page 2 runs a real Reanimated scan sweep on a plated dish. Page 5 is a genuinely tappable attribution list. Page 6 draws its savings comparison lines left-to-right. Page 9 introduces Kiko with the approved hero pose and food doodles. With Reduce Motion enabled every loop stops and every entrance becomes a plain fade; the pager still works.

The user names the fox on a real `TextInput` with the real iOS keyboard, defaulting to `Kiko`. That name becomes `mascotName` and is read by every user-facing mascot string in the app from then on.

Then the product itself: take a photo, choose a photo, or describe a dish. **A prepared dish** — a photo of loose ingredients is honestly rejected with "Scan a prepared dish you'd like to recreate." Okyo identifies the dish, then asks about allergies and dislikes, explaining these will shape the recipe. Those answers feed the single real recipe generation. The recipe appears — real photo, real ingredients, real steps, real time, real homemade estimate — with `Continue` and an optional `Cook step-by-step`. Cooking is never required. Then the RevenueCat paywall showing only the packages RevenueCat actually returned. A cancelled purchase returns quietly to the paywall. A failed purchase shows a recoverable Okyo dialog, never a red LogBox. Only a `CustomerInfo` with the active entitlement completes onboarding, exactly once, in exactly one place in the code.

---

## SECTION 2 — VERIFIED CURRENT STATE

All values below were read from the repository, not assumed.

### Workspace guard (verified)

```
pwd                        /Users/rober/Desktop/Okyo-1
git branch --show-current  feature/onboarding-v3-bitepal-showcase
git status --short         ?? "apps/mobile/assets/onboarding ex/"
```

Donor worktree `/Users/rober/Desktop/Okyo-onboarding-v2-20260801` is on `feature/onboarding-v2-revenuecat-liquid-glass` with ~20 uncommitted modified files. **Read-only.**

> **Note:** the approved art folder is currently **untracked**. It is one `git clean` away from deletion. Codex must never run `git clean`. Recommend the founder `git add` the folder at the first commit.

### Expo / runtime

| Item | Value |
|---|---|
| Expo SDK | `~55.0.28` |
| React Native | `0.83.6` (New Architecture only) |
| React | `19.2.0` |
| Reanimated | `4.2.1` + `react-native-worklets@0.7.4` |
| Skia | `@shopify/react-native-skia@2.4.18` (present) |
| SVG | `react-native-svg@^15.15.3` (present) |
| Gesture Handler | `~2.30.0` |
| State | `zustand@^5.0.13` + AsyncStorage `2.2.0` |
| Nav | React Navigation 7 (native-stack + bottom-tabs) |
| Image | **React Native `<Image>` only — `expo-image` is NOT installed** |
| Splash | **`expo-splash-screen` is NOT installed** |
| Pager | **`react-native-pager-view` is NOT installed** |
| Purchases | **`react-native-purchases` is NOT installed** |
| Camera | `expo-image-picker` only (no `expo-camera`) |

**SDK 55 bundled-module compatibility (verified from `node_modules/expo/bundledNativeModules.json`):**

```
react-native-pager-view    8.0.0     supported
expo-image                 ~55.0.11  supported
expo-splash-screen         ~55.0.23  supported
expo-dev-client            ~55.0.37  supported
expo-glass-effect          ~55.0.11  supported
react-native-purchases     NOT LISTED (community package — V2 proved ^10.6.0 works on this exact SDK)
react-native-purchases-ui  NOT LISTED (same)
```

### app.json (current)

```json
{ "name":"Okyo", "slug":"okyo", "orientation":"portrait",
  "userInterfaceStyle":"light",
  "ios": { "bundleIdentifier": "com.anonymous.okyo" },
  "plugins": ["expo-sharing","expo-notifications","expo-font"] }
```

No `scheme`. No `splash` config. No `newArchEnabled` key (RN 0.83 is New Arch by default).

**V2 app.json differs:** `"scheme": "okyo"` and `"bundleIdentifier": "org.name.Okyo"`. **Re-verified in Section 12: V3's own `com.anonymous.okyo` is correct and not in conflict with anything** — only `"scheme"` is worth porting from V2, the bundle ID is not touched.

### Test harness — CRITICAL CONSTRAINT

```json
"test": "node --test src/**/*.test.ts"
```

There is **no Jest, no `@testing-library/react-native`, no `react-test-renderer`**. Tests run under the Node built-in test runner via `tsx`, and match `*.test.ts` only — **`.tsx` files are not collected and React components cannot be rendered.**

All 24 existing mobile test files are pure-logic. **This dictates the V3 architecture: the onboarding controller must be a pure, framework-free reducer in a `.ts` file** so its every transition is testable. Do not propose RTL tests. Do not add a test framework — that is out of scope and would balloon the diff.

API tests: 30 `*.test.ts` files under `apps/api/src`, same runner.

### Current onboarding architecture

`AppNavigator.tsx` performs a clean two-navigator swap:

```
onboardingPersistence.readCompleted()  →  startupGate.getStartupRoute()
   null      → <StartupLoadingScreen/>
   false     → Stack(key="onboarding") with single screen WelcomeScreen
   true      → Stack(key="main") … MainTabs
```

`WelcomeScreen.tsx` (1323 lines) is the V2 onboarding controller, driven by `useState<OnboardingScreenKey>('splash')`. `OnboardingUI.tsx` (2013 lines) holds its component library.

**This swap point is excellent and must be preserved.** V3 replaces only the component mounted at `WelcomeScreen`.

Persistence today is split: `onboardingPersistence.ts` owns the standalone key `okyo:onboarding-completed:v1`, and `useOkyoStore` (zustand `persist`, key `okyo-local-state`, version 3) holds `hasCompletedOnboarding` plus 30 other partialized keys. `resetOnboarding()` already exists and is wired to a `Reset Onboarding` button in `SettingsScreen`.

### Current scan architecture

`scanController.startScan()` → `createMockScan()` → `POST /v1/scans` → writes `latestScan*` into `useOkyoStore` and commits a canonical recipe.

**`POST /v1/scans` performs vision AND recipe generation in a single request** (`createAiScan` → `analyzeFoodImage` then `generateRecipeFromDish`). This is the central constraint for Section 11.

`POST /v1/recipes/:recipeId/correct` exists for regeneration from a user correction. It does **not** accept dietary preferences.

`aiService.ts` exports `analyzeFoodImage` and `generateRecipeFromDish` separately — the two halves are already cleanly separable.

### Current recipe architecture

`state/canonicalRecipes.ts` (561 lines) is the canonical recipe layer: `CanonicalRecipe`, `commitSuccessfulScan`, `registerCanonicalRecipe`, `correctCanonicalRecipe`, `setCanonicalRecipeCompletion`, `isUsableCanonicalRecipe`.

`ResultSummaryScreen.tsx` (2295 lines) and `RecipeDetailScreen.tsx` (2198 lines) are the main-app recipe surfaces. **`RecipeStepsScreen` is exported from `RecipeDetailScreen.tsx` and registered inside `MainTabs`** — reaching it requires entering the main tab navigator, which is precisely the V2 architectural mistake. See Section 4 step 17.

Guided-cooking *logic* is already extracted and pure: `utils/guidedCookingSteps.ts`, `utils/guidedCookingPreview.ts`, `utils/guidedInstruction.ts`, `state/activeCooking.ts` — all tested.

### Current RevenueCat status

**None.** `utils/purchaseAvailability.ts` is a deliberate stub:

```ts
export function isPurchaseProviderAvailable(): boolean { return false; }
export function getConfiguredFreeTrialDays(): number | null { return null; }
```

with hardcoded display pricing `$0.96/week`, `$4.99/week`. Its own comment says it becomes "the single flip that turns the real purchase UI back on."

`.env.example` has no RevenueCat variables.

### Theme

Two competing theme files:

| File | `background` | Used by |
|---|---|---|
| `theme/okyoTheme.ts` | `#FFF4E6` | app-wide (via `components/OkyoUI.tsx` re-export) |
| `theme/recipeTheme.ts` | `#FFF8F1` | only `RecipeDetailScreen`, `ResultSummaryScreen` |

`colors.background` / `colors.cream` / `recipeColors.background` account for 61 usages. Raw-hex full-screen canvases are rare — the audit found only `ShareCardPreviewScreen` (`colors.cream`) and the two recipe screens.

**Important:** `#fffdf8` appears 24 times but is almost entirely a **foreground** color (white-ish text/icons on coral buttons). Do **not** migrate it.

### Accessibility

**No Reduce Motion handling exists in V3 at all.** No `AccessibilityInfo` usage. The V2 donor has a clean `useAccessibilityPreferences.ts` — port it.

### Assets

`assets/onboarding ex/` — 11 files, all `941×1672`, all PNG colorType 2 (RGB), **all `minAlpha = 255`, i.e. zero transparency anywhere**.

Measured edge background colors:

| File | Edge background | Family |
|---|---|---|
| onboarding1 | `#FDF3E6` | cream — ok |
| onboarding2 | `#C4E4F9` → `#FBF9F9` | **blue gradient — reject** |
| onboarding3 | `#FCF8F7` | near-white |
| onboarding4 | `#1D1D1D` | **black device bezel — crop** |
| onboarding5 | `#FBF3E8` | cream — ok |
| onboarding6 | `#F1EEF7` | **lavender — reject** |
| onboarding7 | `#FDF6EB` | cream — ok |
| onboarding8 | `#FCF3E8` | cream — ok |
| onboarding9 | `#FBF1E6` | cream — ok ← **one unit from `#FBF1E5`; the token was clearly eyedropped here** |
| onboarding10 | `#FDF7ED` | cream — ok |
| onboarding11 | `#FCF6EC` top / `#EEEEF0` bottom | cream + **keyboard gray — crop** |

Existing Kiko libraries: `assets/kiko-static/` (~40 generated-UUID PNGs, mapped by `src/assets/kikoAssets.ts` to 14 named poses), `assets/mascot/` (9 named), `assets/animations/`, `assets/food/`.

**Python tooling is unavailable** — `numpy` and `Pillow` are both absent, so the V2 Python transparency script cannot run as-is. **`pngjs` IS present** at `apps/mobile/node_modules/pngjs`. See Section 5.

---

## SECTION 3 — PRODUCT CONTRACT

This is permanent and overrides any conflicting text baked into the approved artwork.

### Okyo does

```
PREPARED DISH PHOTO  or  DISH DESCRIPTION
  → identify / interpret the dish
  → ingredients needed to recreate it
  → recipe steps
  → timing, tools, supported nutrition, homemade estimate
  → optional customization
  → optional guided cooking
  → user recreates the dish and may save money
```

### Okyo does NOT

- photograph raw ingredients and suggest meals
- photograph a fridge or pantry and suggest meals
- turn leftovers into recipe ideas
- treat available ingredients as the primary scan input

### Enforcement points

| Surface | Requirement |
|---|---|
| Onboarding copy | Every headline and body string states dish → recipe. **onboarding2's "Cook with what you have" must never be rendered.** |
| API vision prompt | `inputKind: 'prepared_dish' \| 'raw_ingredients' \| 'not_food' \| 'unclear'` classified first (port from V2). |
| Scan behavior | `inputKind === 'raw_ingredients'` → `FoodRejectionError('ingredients_only')`, **before** any recipe generation is attempted. |
| Rejection copy | `"Scan a prepared dish you'd like to recreate."` — recoverable, offers retry. |
| Loading text | "Identifying your dish…" / "Working out the ingredients…" / "Building your recipe…" |
| Paywall story | Dish recreation and savings, never pantry management. |
| Tests | Port `dishFirstProduct.test.ts`; extend `productIntegrityRegression.test.ts`. |

### Honesty rules (from existing repo precedent)

- Never present a savings figure not derived from a real user-entered restaurant price. **Strip `$84 average`, `$6.20/$17.80/$11.60`.**
- Never present AI output as exact. Confidence and editability stay.
- Never show a trial length not returned by the purchase provider.
- Never show technical AI/provider errors to normal users.

---

## SECTION 4 — FINAL SCREEN FLOW

Copy marked **REBUILT** replaces baked art text. Copy marked **KEEP** matches the comp and is product-correct.

---

### 1 · SPLASH — `onboarding1.png`

| | |
|---|---|
| **Purpose** | Cover font/store hydration; establish the mark. Not an onboarding page. |
| **Artwork** | Kiko head cutout extracted from onboarding1 → `kiko-head-mark.png`. |
| **Native UI** | `#FBF1E5` full canvas, centered mark ~132pt, nothing else. |
| **Copy** | None. |
| **Next** | Auto after `max(700ms, fontsLoaded && storeHydrated)`, capped at 1100ms → `showcase` page 0. |
| **Back** | None. |
| **Reads** | `fontsLoaded`, store hydration. |
| **Writes** | Nothing. |
| **Animation** | opacity 0→1 220ms ease-out; scale 0.94→1 300ms ease-out; then loop rotate −2°→+2° 600ms/leg `Easing.inOut(Easing.quad)`. |
| **Reduce Motion** | Static mark, no wiggle, no scale. Same timing. |
| **Responsive** | Fixed pt size, centered. Aspect-independent. |
| **A11y** | `accessible={false}` on the mark. |
| **Errors** | Font load failure → proceed anyway at the 1100ms cap. Never block launch. |

Native `expo-splash-screen` covers the pre-JS window with the same background and mark. `SplashScreen.preventAutoHideAsync()` at module scope; `hideAsync()` when the React splash mounts. No visible seam.

---

### 2 · HERO / GET STARTED — `onboarding2.png` **(HYBRID — photo preserved, rest native)**

| | |
|---|---|
| **Purpose** | First product page. Premium editorial poster. |
| **Artwork** | **Do not use onboarding2.png as a full-screen layer** — wrong background, wrong mascot, forbidden headline, fake account link (Finding C). But the plated-pasta photo in it **is real approved food photography and is extracted as-is**, unmodified. Compose on `#FBF1E5` with: the extracted pasta photo, the existing `kikoAssets.wave` transparent pose (this comp's fox is not Kiko, so the library asset is used instead), and the `12 min` chip rebuilt natively. |
| **Native UI** | Cream canvas; food photo card top; `12 min` chip; Kiko wave; headline; pill CTA. |
| **Copy — REBUILT** | H1: **"Scan a dish. Cook it at home."** · Body: **"Take a photo of any prepared dish and Okyo gives you the ingredients and the steps."** · CTA: **"Get started"** |
| **Removed** | "Cook with what you have" (forbidden), "I already have an account" (no account system exists — remove the path entirely, do not stub it), Terms/Privacy links (add later only when real URLs exist). |
| **Next** | `pager.setPage(1)`. |
| **Back** | None (page 0 — hide the chevron). |
| **Reads / Writes** | None / none. |
| **Animation** | Page-settle: artwork translateY 8→0, opacity .92→1, 250ms ease-out. Kiko translateY 6→0, scale .98→1, 280ms. |
| **Reduce Motion** | Opacity-only fade, 150ms. |
| **Responsive** | Flex column; photo card `aspectRatio: 1`, `maxHeight: 34%`. Headline size derived from `useWindowDimensions`. |
| **A11y** | CTA `accessibilityRole="button"`, label "Get started", min 44×44. Headline is real `<Text>` so Dynamic Type applies. |
| **Errors** | None (no network). |

---

### 3 · SCAN ANY PREPARED DISH — `onboarding3.png`

| | |
|---|---|
| **Purpose** | Teach the core feature. |
| **Artwork** | Extract from onboarding3: the grain-bowl photo (`o3-dish.png`). The scan-sweep line is rendered as a native gradient, not raster. Kiko: use existing `kikoAssets.scanning`. |
| **Native UI** | Cream canvas; 9 dots; back chevron; photo card with animated scan line; **rebuilt annotation chips**; headline; body; `Next`. |
| **Copy — KEEP H1** | **"Scan any dish instantly"** |
| **Copy — REBUILT body** | **"Snap or upload a photo and get the ingredients and recipe steps."** |
| **Chips — REBUILT** | Baked chips read `Sweet potato 120 kcal`, `Avocado 100 kcal`, `Eggs 80 kcal`. **Okyo does not return per-ingredient calories.** Replace with capabilities Okyo genuinely returns: **`Ingredients`**, **`Recipe steps`**, **`Cook time`**. |
| **Next / Back** | `setPage(2)` / `setPage(1)`. |
| **Animation** | Scan sweep: `scanY` 15%→82%, 1450ms linear, opacity ramp 0→1 over first 12%, 1→0 over last 15%, then 550ms pause, `withRepeat(-1)`. UI thread. Chips stagger in 50ms apart, translateY 6→0, 240ms. |
| **Reduce Motion** | Scan line rendered static at 50% at 0.5 opacity. No repeat. Chips fade only. |
| **Responsive** | Photo card `aspectRatio: 1`. Chips positioned by **percentage of the card**, never absolute px. |
| **A11y** | Scan line `accessible={false}`. Chips are `<Text>`, readable. |

---

### 4 · GET INGREDIENTS + RECIPE — `onboarding4.png` **(bezel — extract only)**

| | |
|---|---|
| **Purpose** | Show what comes *out* of a scan. |
| **Artwork** | onboarding4 is a mockup inside a black device bezel. **Crop the inner screen region, discard the bezel.** Extract the chicken-bowl photo and Kiko. |
| **Native UI** | Cream canvas; dots; back; result card; native chips; headline; body; `Next`. |
| **Copy — REBUILT H1** | **"One photo, a full recipe"** (the comp says "Customize any recipe", which belongs on page 4 not page 3 — page 3's job per the authoritative order is *ingredients + recipe*). |
| **Copy — REBUILT body** | **"Ingredients, steps, cook time, and the tools you'll need."** |
| **Chips — REBUILT** | Baked chips read `More protein +8g`, `Less calories −120 cal`, `Protein 32g`. Okyo's real correction flow does not expose a one-tap `+8g` control, and exact macro deltas would be an overclaim. Replace with **`Ingredients`**, **`Steps`**, **`Cook time`**, **`Tools`**. Show macros **only if** a nutrition value is genuinely returned. |
| **Next / Back** | `setPage(3)` / `setPage(1)`. |
| **Animation** | Main art translateY 8→0 opacity .92→1 250ms; Kiko translateY 6→0 scale .98→1 280ms; chips stagger 50ms, translateY 6→0 240ms. **Runs on page settle only, never during the swipe.** |
| **Reduce Motion** | Single 150ms fade for the whole page, no stagger. |
| **Responsive** | Result card `aspectRatio: 0.95`, `maxHeight: 46%`. |

---

### 5 · CUSTOMIZE / GUIDED COOKING / SAVE — `onboarding5.png`

| | |
|---|---|
| **Purpose** | Why Okyo beats a static recipe search. |
| **Artwork** | Extract the chicken-quinoa bowl photo and the circular Kiko badge from onboarding5. |
| **Native UI** | Cream canvas; dots; back; photo; native capability chips; headline; body; `Next`. |
| **Copy — KEEP H1** | **"Save on every plate"** |
| **Copy — REBUILT body** | **"Adjust the recipe, cook step by step, and see what making it at home would cost."** |
| **Savings card — REMOVED** | The baked card reads `Homemade $6.20 / Takeout $17.80 / Saved $11.60` and `You saved money on this meal!`. **These are fabricated.** Replace with native capability chips only: **`Edit recipe`**, **`Swap ingredient`**, **`Simpler steps`**, **`Cook step-by-step`**. Any cost comparison stays on page 6 as an explicitly illustrative example. |
| **Next / Back** | `setPage(4)` / `setPage(2)`. |
| **Animation** | Chips micro-float: translateY 0→−2→0, 2100ms, `Easing.inOut(Easing.sin)`, `withRepeat(-1, true)`, each chip offset by index × 260ms. Barely perceptible. |
| **Reduce Motion** | No float. Static. |
| **Responsive** | Chips wrap in a `flexWrap` row; never absolutely positioned. |

---

### 6 · WHERE DID YOU FIND US — `onboarding6.png` **(NATIVE REBUILD — zero extraction, the one exception)**

| | |
|---|---|
| **Purpose** | Optional attribution. Must never block. |
| **Artwork** | **Do not use onboarding6.png as a layer, and nothing in it is extractable.** This is the only asset in the set with zero salvageable art: lavender (non-cream) background, a purple cat that is not Kiko, and baked third-party trademarked logos (Instagram/TikTok/YouTube/App Store) — redistributing those as raster is a trademark exposure. Every other asset preserves its approved art; this one genuinely has none to preserve. Rebuild on `#FBF1E5` with the existing `kikoAssets.happy`, reusing only the *layout* (row list + header + Skip) from the comp as a reference. |
| **Icons** | Do **not** raster-extract the Instagram/TikTok/YouTube/App Store logos. Use monochrome/neutral glyphs from the already-installed `iconoir-react-native` (or simple tinted circles with the first letter). This avoids trademark exposure and matches the cream canvas. |
| **Native UI** | Cream canvas; back; Kiko head; H1; **six real `Pressable` rows**; `Skip` pill. |
| **Copy — KEEP** | H1: **"How did you hear about Okyo?"** · Rows: `From influencer`, `Instagram`, `TikTok`, `YouTube`, `App Store search`, `Friends / family` · CTA: `Skip` |
| **Interaction** | Tap a row → row background `withTiming(150ms)` to `colors.coralSoft`; check icon opacity 0→1 and scale .85→1 via a **gentle** spring (`damping: 18, stiffness: 220`); after 160ms auto-advance to page 5. `Skip` advances immediately with `attribution = null`. |
| **Next / Back** | auto or `Skip` → `setPage(5)` / `setPage(3)`. |
| **Writes** | `attribution: AttributionSource \| null` → persisted. **Fire-and-forget. Never awaited. A persistence failure is swallowed and logged; onboarding continues.** |
| **Animation** | Rows stagger in 40ms apart, translateY 6→0 opacity 0→1 220ms. |
| **Reduce Motion** | Rows fade only. Selection is an instant color change, no spring. |
| **Responsive** | Rows `minHeight: 64`, full width minus 24pt gutters. Scrolls if the viewport is short. |
| **A11y** | Each row `accessibilityRole="radio"` with `accessibilityState={{selected}}`; group has `accessibilityRole="radiogroup"`. `Skip` is a button. |

---

### 7 · SAVINGS GRAPH — `onboarding7.png`

| | |
|---|---|
| **Purpose** | The money story — honestly. |
| **Artwork** | Extract the graph **card background, axes, and labels** as one raster (`o7-graph-frame.png`) with the two lines **erased**; draw the two lines natively with `react-native-svg` (already installed) so they can animate. |
| **Native UI** | Cream canvas; back; H1; graph card with animated SVG lines; honest footnote; `Next`. |
| **Copy — KEEP H1** | **"Okyo helps you save more over time"** |
| **Copy — REMOVED** | **"Users save an average of $84 this month with Okyo"** — unsupported claim, must not ship. |
| **Copy — REBUILT footnote** | **"Making a dish at home usually costs less than buying it out. Okyo shows you the difference for your dish."** Plus a small caption on the card: **"Example"**. |
| **Next / Back** | `setPage(6)` / `setPage(4)`. |
| **Animation** | Both lines are SVG `<Path>` with `strokeDasharray = L`, `strokeDashoffset` animated `L → 0`. Okyo (green) 650ms ease-out; Takeout (coral dashed) 650ms, 100ms delay. Endpoint dots opacity 0→1 scale .8→1, 200ms, after the draw. Footnote translateY 6→0 opacity 0→1 after both. |
| **Reduce Motion** | Both paths render fully at `strokeDashoffset: 0`, card fades in over 150ms. |
| **Responsive** | SVG `viewBox` fixed, `width="100%"`, `preserveAspectRatio="xMidYMid meet"`. Card `aspectRatio: 1.35`. |
| **A11y** | Card `accessibilityRole="image"` with label "Example chart: cooking at home costs less than takeout over time." |
| **Note** | **Do not use Skia here.** SVG dash-offset is simpler, already available, and sufficient. |

---

### 8 · COOKING APPROACH — `onboarding8.png`

| | |
|---|---|
| **Purpose** | Explain the Okyo system as three layered cards. |
| **Artwork** | Extract the three tilted cards as three separate transparent rasters: `o8-card-scan.png` (blue), `o8-card-macros.png` (dark), `o8-card-customize.png` (coral, contains Kiko). Their baked labels are product-correct — keep them. |
| **Native UI** | Cream canvas; back; H1; three absolutely-positioned card images with rotation; `Let's go`. |
| **Copy — KEEP H1** | **"Why Okyo's smart cooking approach works"** |
| **Card labels — KEEP** | `Scan any dish` · `Get recipe, macros & time` · `Customize any recipe` |
| **Caveat** | The dark card has baked `520 kcal / 42g protein / 25 min`. These read as an illustrative example inside a card, not a claim about the user's dish — acceptable. Do **not** replicate them as live-looking native values. |
| **Next / Back** | `setPage(7)` / `setPage(5)`. |
| **Animation** | Back card translateY 10→0 + rotate toward final angle, 260ms. Front card translateY 14→0, 280ms, 40ms delay. Kiko card translateY 16→0 scale .98→1, 300ms, 80ms delay. Settle only. |
| **Reduce Motion** | All three fade in together, 150ms, at final transform. |
| **Responsive** | Cards sized as a % of container width (`width: '52%'` etc.), positioned by %, `rotate` in deg. Container `aspectRatio: 1.0`. |

---

### 9 · VALUE / USE AGAIN — `onboarding9.png`

| | |
|---|---|
| **Purpose** | Conclude the product demo. **This is the single most product-correct comp in the set — follow it closely.** |
| **Artwork** | Extract the pasta bowl, the four floating icon tiles, the scan brackets, the dotted orbit, and the sparkles. |
| **Native UI** | Cream canvas; back; hero composition; H1 (two-tone); body; info card; `Let's go`. |
| **Copy — KEEP H1** | **"Scan any dish and remake it** *with confidence*" (second line in `colors.coral`). |
| **Copy — KEEP body** | **"Take or upload a photo and Okyo gives you the ingredients, recipe steps, macros, cook time, and tools you need to recreate it."** |
| **Copy — KEEP card** | **"One scan can include ingredients, macros, recipe steps, cook time, and kitchen tools."** |
| **Removed** | The baked **"See what a scan includes"** underlined link — there is no destination for it. Remove rather than stub. |
| **Next / Back** | `setPage(8)` / `setPage(6)`. |
| **Animation** | Bowl scale .97→1 opacity 0→1 280ms. Four icon tiles stagger 60ms apart, opacity 0→1 scale .85→1 220ms. Sparkles fade in last. |
| **Reduce Motion** | Single 150ms page fade. |
| **Responsive** | Hero container `aspectRatio: 1`, tiles positioned by %. |

---

### 10 · MEET KIKO — `onboarding10.png`

| | |
|---|---|
| **Purpose** | Formally introduce the mascot before naming. |
| **Artwork** | **Use the exact approved Kiko pose from onboarding10.** Extract as `o10-kiko-hero.png`. Extract the doodles individually: carrot, mushroom, herb sprig, fish bone, apple core, sparkle, squiggle, recipe card. |
| **Native UI** | Cream canvas; back; H1; Kiko hero; body; doodles; `Next`. |
| **Copy — KEEP H1** | **"Meet Kiko, your kitchen companion"** |
| **Copy — KEEP body** | **"Kiko helps you scan dishes, customize recipes, and cook with confidence."** |
| **Note** | This page is shown **before** naming, so it correctly hardcodes `Kiko` — this is the character's given name being offered. It does **not** read `mascotName`. |
| **Next / Back** | → `nameFox` (leaves the pager) / `setPage(7)`. |
| **Animation** | Kiko opacity 0→1 scale .97→1 translateY 10→0, 280ms. Doodles stagger 40ms apart, opacity 0→1 scale .85→1, 180ms. Then Kiko idle: translateY 0→−2→0, 2000ms, `Easing.inOut(Easing.quad)`, `withRepeat(-1, true)`; optional rotate −0.4°↔+0.4°. **No bounce.** |
| **Reduce Motion** | No idle loop, no stagger. Everything fades in at final transform, 150ms. |
| **Responsive** | Kiko `width: '62%'`, `aspectRatio` from source. Doodles positioned by %, hidden below `height < 700` if they would collide with the CTA. |
| **A11y** | Kiko `accessibilityRole="image"` label "Kiko, the Okyo fox". Doodles `accessible={false}`. |

---

### 11 · NAME THE FOX — `onboarding11.png`

| | |
|---|---|
| **Purpose** | Real personalization. |
| **Artwork** | Extract the peeking Kiko from the top-right (`o11-kiko-peek.png`). **Discard the entire bottom keyboard region.** |
| **Native UI** | Cream canvas; back; peeking Kiko top-right; label; **real `TextInput`**; `Next` pill; `KeyboardAvoidingView`. |
| **Copy — KEEP** | Label: **"Name your fox"** · Default value: **`Kiko`** · CTA: **"Next"** |
| **Removed** | The baked dice/randomize button — no random-name feature is specified; do not invent one. |
| **Input rules** | `maxLength={20}`, `autoCapitalize="words"`, `autoCorrect={false}`, `returnKeyType="done"`, `onSubmitEditing` → same as `Next`. On submit: `trim()`; if empty → `'Kiko'`. |
| **Next** | `setMascotName(sanitize(value))` → persist → `input`. |
| **Back** | → `showcase` at page **8** (the final page, per the required transition table). |
| **Writes** | `mascotName: string`. |
| **Animation** | Kiko slides in from the right, translateX 16→0 opacity 0→1, 260ms. Nothing else. |
| **Reduce Motion** | Fade only. |
| **Responsive** | `KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`. Kiko is `position: absolute` top-right and is allowed to clip off-screen. Content stays centered above the keyboard. |
| **A11y** | `TextInput` gets `accessibilityLabel="Name your fox"` and a visible `<Text>` label. `Next` min 44×44. |

---

### 12 · FIRST REAL DISH SCAN — `input`

| | |
|---|---|
| **Purpose** | Hand off to the real product. |
| **Native UI** | Reuse `components/ScanEntryOptions.tsx`. Three actions: **Take a Photo**, **Choose Photo**, **Describe Dish**. |
| **Copy** | H1: **"Let's scan your first dish"** · Body: **"Pick a prepared dish you'd like to recreate — something plated and finished."** |
| **Next** | Photo → `photoConfirm`. Description → `analyzing` directly. |
| **Back** | → `nameFox`. |
| **Reads** | `mascotName` (e.g. "`${mascotName} is ready when you are`"). |
| **Errors** | Permission denied → inline recoverable message with a Settings deep link; **never blocks** — the other two actions remain available. |

---

### 13 · PHOTO CONFIRM — `photoConfirm`

| | |
|---|---|
| **Native UI** | Full-bleed chosen photo, `Use Photo` primary, `Retake` / `Back` secondary. |
| **Next** | `Use Photo` → `analyzing`. |
| **Back** | → `input`. |
| **Note** | **No identification confirmation gate. No "Does this look right?". No "Yes, looks good".** Those are the V2 patterns being deleted. |

---

### 14 · ANALYZING — `analyzing`

| | |
|---|---|
| **Purpose** | Real vision analysis (phase 1 of 2). See Section 11. |
| **Native UI** | User's photo visible; honest rotating stage text; loading overlay card. |
| **Copy** | `"Identifying your dish…"` → `"Reading the ingredients…"`. **No percentages. No fake progress. No artificial delay.** |
| **Next** | Success → `dietary`. |
| **Back** | Cancel → `input` (aborts the in-flight request via `AbortController`). |
| **Errors** | `raw_ingredients` → **"Scan a prepared dish you'd like to recreate."** + `Try another photo`. `not_food` / `unclear` → existing `scanFailureCopy` strings + `Try again`. Network/timeout → `"Okyo had trouble reading this photo. Try again in a second."` All recoverable, all return to `input`. |

---

### 15 · DIETARY — `dietary`

| | |
|---|---|
| **Purpose** | Collect hard limits and soft dislikes **before** the recipe is generated. |
| **Copy** | H1: **"Anything Okyo should work around?"** · Body: **"We'll build your `${dishName}` recipe around these."** |
| **Section 1 — hard** | **"Allergies & restrictions"** — multi-select chips: Peanuts, Tree nuts, Dairy, Eggs, Gluten, Shellfish, Fish, Soy, Sesame, Pork, Beef, Alcohol. |
| **Section 2 — soft** | **"Rather avoid"** — multi-select chips: Mushrooms, Olives, Cilantro, Spicy food, Onions, Seafood, Very sweet. |
| **Continue** | Always enabled. Empty selection is valid and proceeds. → `recipe` (fires generation). |
| **Back** | → `input`. **Explicit V3 definition** (the brief left this open): going back discards the analysis and restarts the scan. This is deterministic and avoids a resurrected-analysis edge case. |
| **Writes** | `dietaryRestrictions: string[]`, `dietaryDislikes: string[]` — persisted. |
| **Animation** | Chips stagger 30ms. Toggle: background `withTiming(150ms)`. |
| **A11y** | Chips `accessibilityRole="checkbox"` + `accessibilityState={{checked}}`. |

---

### 16 · RECIPE — `recipe`

| | |
|---|---|
| **Purpose** | Show the real canonical recipe. A **new lightweight screen**, not `ResultSummaryScreen`. |
| **Native UI** | `OnboardingRecipePreview` — real photo, dish name + `Edit`, total time, hands-on time (if valid), servings, ingredients, steps, tools, homemade estimate (if valid), nutrition (if valid). |
| **Footer (persistent)** | Primary **`Continue`** · Secondary **`Cook step-by-step`** |
| **Continue** | `recipe` → `paywall`. Nothing else gates it. |
| **Cook** | → `cooking`. |
| **Back** | → `dietary`. |
| **Reads** | canonical recipe by `recipeId`, `mascotName`. |
| **Forbidden** | Quick Check · "Does this look right?" · "Yes, looks good" · `hasAcceptedOnboardingRecipe` · any confirmation gate · any cooking requirement. |
| **Loading** | While generation is in flight: the loading overlay card (Section 6) over a skeleton. Stage text: `"Building your recipe…"`. |
| **Errors** | Generation failure → `"Okyo couldn't finish this recipe. Try again."` with `Try again` (re-POSTs the recipe phase using the cached `analysisId` — no second vision call) and `Start over` (→ `input`). |

---

### 17 · GUIDED COOKING — `cooking` (optional)

| | |
|---|---|
| **Purpose** | Optional step-by-step. |
| **Implementation** | A **V3-owned screen** that consumes the existing pure utilities `utils/guidedCookingSteps.ts`, `utils/guidedInstruction.ts`, `state/activeCooking.ts`. |
| **Why not reuse `RecipeStepsScreen`** | It is exported from `RecipeDetailScreen.tsx` and registered **inside `MainTabs`**. Navigating to it from onboarding means entering the main tab navigator mid-onboarding — the exact V2 architecture being deleted. Reuse the *logic*, not the *route*. |
| **Next** | Finish all steps → `cookingComplete`. `Exit` at any point → `paywall`. |
| **Back** | → `recipe`. |
| **Completion** | An **explicit callback** into the V3 controller: `dispatch({type:'COOKING_COMPLETED'})`. **Never infer completion from navigation state.** |

---

### 18 · COOKING COMPLETE — `cookingComplete`

| | |
|---|---|
| **Copy** | H1: **"Nice — you cooked it."** Body: honest, no fabricated savings. |
| **Continue** | → `paywall`. |
| **Back** | Disabled (cooking already finished). |

---

### 19 · PAYWALL — `paywall`

| | |
|---|---|
| **Purpose** | Real RevenueCat. See Section 12. |
| **Native UI** | Plan cards built **only** from `getRevenueCatPaywallPlans(offering)`. Restore Purchases. Close/skip only when the provider is unavailable **and** `__DEV__`. |
| **Pricing** | Rendered from `pkg.product.priceString` / `pricePerWeekString`. **Never hardcoded.** |
| **Success** | `CustomerInfo.entitlements.active[ENTITLEMENT_ID]` present → `complete`. |
| **Cancel** | Stay. Clear loading. No error. |
| **Failure** | Stay. Clear loading. Recoverable dialog (Section 19). |
| **Back** | Disabled — the paywall is terminal within onboarding. |

---

### 20 · COMPLETE → MAIN APP

`completeOnboarding()` is called **exactly once**, from **exactly one place** (`onboardingV3Controller`'s `complete` effect). It writes both `onboardingPersistence.writeCompleted()` and `useOkyoStore.completeOnboarding()`, then `AppNavigator` swaps to the `main` stack.

---

## SECTION 5 — ASSET IMPLEMENTATION MAP

All sources: `apps/mobile/assets/onboarding ex/onboardingN.png`, all **941 × 1672**, all **RGB, no alpha**.

### Per-asset classification (explicit choice, per the three-bucket taxonomy)

| Asset | Classification | Justification |
|---|---|---|
| **1** (splash) | EXTRACTED ART + NATIVE LAYOUT | 96% of the frame is empty cream space around one small centered mark. Extracting just the mark and placing it at a fixed point size is more robust than scaling a mostly-empty 16:9 raster onto every device, and avoids shipping the baked status bar/home indicator. |
| **2** (hero) | HYBRID | The plated-pasta photo is approved, real food photography and is preserved **as one extracted piece**, unmodified. Everything else on this comp (blue gradient bg, non-Kiko 3D fox, forbidden headline, fake account link) is unusable per Finding C and is native. The photo is the only reusable region; it is kept, not redrawn. |
| **3** (scan) | HYBRID | The grain-bowl photo **and** Kiko are a single continuous composition in the source (they visually overlap at the green seam) and are extracted together, as approved, unmodified. Only the baked 5-dot pager, back chevron, kcal chips (factually wrong — Okyo doesn't return per-ingredient calories), and CTA are native. |
| **4** (recipe output) | HYBRID | Same reasoning as 3: the chicken-bowl photo + Kiko is one approved composition, extracted whole. Crop away the black device bezel first (it is a marketing mockup frame, not screen content). Only the macro chips (fabricated deltas like "+8g") and chrome are native. |
| **5** (customize) | HYBRID | The quinoa-bowl photo and the circular Kiko badge are each a well-defined, geometrically separable region (the badge has a hard circular edge with a drop shadow) and are extracted **as approved, unmodified**. Only the fabricated savings card (`$6.20/$17.80/$11.60`) and chrome are native. |
| **6** (attribution) | **NATIVE REBUILD — zero extraction** | The only asset with nothing safe to reuse: non-cream lavender background, a purple cat that is not Kiko, and baked third-party trademarked logos (Instagram/TikTok/YouTube/App Store) that are a legal exposure to redistribute as raster. Layout (row list + header + Skip) is reused as a *reference*, not as pixels. Uses the existing approved Kiko asset instead of the mismatched cat. |
| **7** (savings graph) | HYBRID | The card frame — rounded container, axes, "Meal spending"/"Time" labels — is flat and approved; it is extracted as one piece with the two colored lines removed by **targeted hue-based erasure** (not perimeter background removal — see below), because the lines sit on a uniform near-white card interior that reads correctly once the line pixels are gone. The `$84` claim and the lines themselves (which must animate) are rebuilt native. |
| **8** (cooking approach) | HYBRID (three FULL COMPOSITIONS within one native page) | Each of the three tilted cards is a bounded, self-contained composition (its own rounded background + label baked in, which is product-correct and kept). Each card is extracted **whole and unmodified** — this is FULL COMPOSITION at the card level. The page around them (H1, back, CTA) is native. |
| **9** (value) | HYBRID | The richest approved composition in the set — bowl, brackets, four icon tiles, sparkles — is extracted **as one hero piece**, preserved as closely to verbatim as the crop allows. The headline/body/card copy is re-rendered as native `<Text>` in the same position and style (required for Dynamic Type accessibility, §22 acceptance criterion 45) even though the wording is identical to the comp. Chrome and the dead "See what a scan includes" link are removed. |
| **10** (meet Kiko) | HYBRID — **exact pose is mandatory** | Per the brief, `onboarding10.png`'s Kiko pose must be used exactly; it is extracted verbatim, no substitution. The eight doodles are individually extracted (each a small, separately croppable object on the same cream background). Headline/body are re-rendered as native `<Text>` for Dynamic Type, matching the comp's wording exactly. Chrome is native. |
| **11** (name fox) | EXTRACTED ART + NATIVE LAYOUT | The peeking Kiko (top-right) is extracted, approved, unmodified. The bottom ~38% of the source is a **fake keyboard image** and is discarded entirely — the input itself is inherently native (a real `TextInput` needs the real keyboard, not a raster of one). |

**Technique note on onboarding7's line removal:** this is not the same "remove background" algorithm used elsewhere. The card interior is a known, near-uniform light color. The green/coral lines are distinctly saturated hues far from that interior color. The script targets pixels within a tight color-distance of the *line's specific sampled hue* (not the perimeter background) and sets them transparent; because the interior behind the line is uniform and known, the resulting native `<View>` background underneath reads as a clean card with no line, no hole, no artifact. This is the same class of deterministic, non-generative technique as the background-perimeter removal — just aimed at a foreground color instead of a background color.

| Asset | Dim | Full-page? | Extract? | Pieces to extract | Baked text | Baked controls | Native overlays | Transparency work | Animation | Responsive strategy |
|---|---|---|---|---|---|---|---|---|---|---|
| **1** | 941×1672 | **No** — 16:9, baked status bar + home indicator | **Yes** | `kiko-head-mark.png` (fox head, ~center, ≈340×300 at 941px) | none | none | none | Corner-sample `#FDF3E6`, exterior flood, soft alpha | splash entrance + wiggle | fixed 132pt centered |
| **2** | 941×1672 | **No — REJECT** blue gradient, wrong mascot, forbidden headline, fake account link | **Partial** | `o2-pasta-bowl.png` (top-left bowl) only | "Cook with what you have", "I already have an account", Terms/Privacy | `Get started` pill | full page rebuilt | bowl is on gradient → tight elliptical mask, then feathered edge | page-settle | rebuilt natively |
| **3** | 941×1672 | **No** — baked 5-dot pager, back chevron, `Next` | **Yes** | `o3-grain-bowl.png` | H1 keep, body near-keep, kcal chips reject | back, 5 dots, `Next` | dots ×9, back, chips, H1, body, CTA | photo already rectangular — simple crop, no keying | scan sweep + chip stagger | card `aspectRatio: 1`, chips by % |
| **4** | 941×1672 | **No — device bezel** `#1D1D1D` | **Yes** | `o4-chicken-bowl.png`, `o4-kiko.png` | H1 reposition, macro chips reject | bezel, back, 5 dots, `Next` | everything | crop inner screen first, then key | settle + stagger | card `aspectRatio: .95` |
| **5** | 941×1672 | **No** — baked money figures | **Yes** | `o5-quinoa-bowl.png`, `o5-kiko-badge.png` (circular) | H1 keep, `$6.20/$17.80/$11.60` reject | back, 5 dots, `Next` | chips, H1, body, CTA | cream `#FBF3E8` key | chip micro-float | chips `flexWrap` |
| **6** | 941×1672 | **No — REJECT** lavender bg, purple cat, 3P logos | **No** | none — rebuild entirely | H1 keep, rows keep | back, 6 rows, `Skip` | all six rows + Skip native | n/a | row stagger + select | rows `minHeight: 64` |
| **7** | 941×1672 | **No** — unsupported `$84` claim | **Yes** | `o7-graph-frame.png` (card + axes + "Meal spending"/"Time" labels, **lines erased**) | H1 keep, `$84` reject | back, `Next` | SVG lines, footnote, CTA | erase both polylines + endpoint dots + "Okyo"/"Takeout" labels; keep frame | SVG dash-offset draw | SVG `viewBox`, `width:100%` |
| **8** | 941×1672 | **No** — baked back + CTA | **Yes** | `o8-card-scan.png`, `o8-card-macros.png`, `o8-card-customize.png` (each incl. its baked label) | H1 keep, card labels keep | back, `Let's go` | H1, CTA | cream `#FCF3E8` key per card; preserve card shadows | staged card entry | cards by % width + `rotate` |
| **9** | 941×1672 | **No** — baked back + CTA + dead link | **Yes** | `o9-pasta-bowl.png`, `o9-tile-leaf.png`, `o9-tile-chart.png`, `o9-tile-chef.png`, `o9-tile-clock.png`, `o9-brackets.png`, `o9-sparkles.png` | H1 keep, body keep, card keep, "See what a scan includes" reject | back, `Let's go` | H1, body, info card, CTA | cream `#FBF2E7` key | bowl + tile stagger | hero `aspectRatio: 1`, tiles by % |
| **10** | 941×1672 | **No** — baked back + CTA | **Yes** | `o10-kiko-hero.png` **(exact approved pose — mandatory)**, `o10-doodle-carrot.png`, `-mushroom`, `-herb`, `-fishbone`, `-applecore`, `-sparkle`, `-squiggle`, `-recipecard` | H1 keep, body keep | back, `Next` | H1, body, CTA | cream `#FDF7ED` key. **Preserve fur edges, pale belly, paw pads, tail gradient.** Use `OPAQUE_DISTANCE` no lower than 13 | entry + subtle idle | Kiko `width:'62%'`, doodles by %, hidden if `height<700` |
| **11** | 941×1672 | **No — fake keyboard** bottom 38% | **Yes** | `o11-kiko-peek.png` (top-right) | label keep, `Kiko` default value keep | back, dice, `Next`, **fake keyboard** | `TextInput`, `Next`, real keyboard | crop top region first, then key cream `#FCF6EC` | slide-in from right | absolute top-right, allowed to clip |

### Derived transparent asset directory

```
apps/mobile/assets/onboarding-ex-transparent/
```

Originals in `assets/onboarding ex/` are **never modified**.

### Source → derivative mapping (authoritative)

```
onboarding1.png  → kiko-head-mark.png
onboarding2.png  → o2-pasta-bowl.png
onboarding3.png  → o3-grain-bowl.png
onboarding4.png  → o4-chicken-bowl.png, o4-kiko.png
onboarding5.png  → o5-quinoa-bowl.png, o5-kiko-badge.png
onboarding6.png  → (none — screen fully rebuilt)
onboarding7.png  → o7-graph-frame.png
onboarding8.png  → o8-card-scan.png, o8-card-macros.png, o8-card-customize.png
onboarding9.png  → o9-pasta-bowl.png, o9-tile-leaf.png, o9-tile-chart.png,
                   o9-tile-chef.png, o9-tile-clock.png, o9-brackets.png, o9-sparkles.png
onboarding10.png → o10-kiko-hero.png, o10-doodle-{carrot,mushroom,herb,fishbone,
                   applecore,sparkle,squiggle,recipecard}.png
onboarding11.png → o11-kiko-peek.png
```

Codex must emit this exact mapping in its final report with real pixel crop rectangles filled in.

### Prefer existing transparent Kiko where the pose matches

Before cutting a new Kiko from a comp, check `assets/kiko-static/` (14 named poses via `src/assets/kikoAssets.ts`) and the V2 donor's already-verified `assets/kiko-static/transparent-generated/` (6 poses: wave, happy, thinking, scanning, celebrating, success). The comp mascot **is** the same character. Reuse beats re-cutting.

**Mandatory exception:** `o10-kiko-hero.png` must come from `onboarding10.png` — the brief requires that exact pose.

### Background-removal tooling — USE NODE, NOT PYTHON

**`numpy` and `Pillow` are NOT installed on this machine** (verified). The V2 `scripts/derive_kiko_transparency.py` therefore cannot run without a Python environment setup that is out of scope.

**`pngjs` IS present** at `apps/mobile/node_modules/pngjs`.

**Instruction:** port the V2 algorithm — which is already quality-verified against edge-clipping and speckle — to a Node script:

```
apps/mobile/scripts/derive-onboarding-transparency.mjs
```

Algorithm (identical to the proven V2 approach):

1. Read RGB via `pngjs`.
2. Optional crop rectangle first (needed for 4's bezel and 11's keyboard).
3. Estimate background as the **median** of an 80px border band.
4. `distance = ‖pixel − background‖₂`.
5. Build a candidate mask `distance < OPAQUE_DISTANCE`; **flood-fill from (0,0)** so only the *exterior* connected region is treated as background. This is what protects pale enclosed details — Kiko's belly, muzzle, eye whites, tail tip, white plate rims.
6. Smoothstep alpha over `[TRANSPARENT_DISTANCE, OPAQUE_DISTANCE]`: `t² (3 − 2t)`.
7. Force `alpha = 0` where `exterior && distance ≤ TRANSPARENT_DISTANCE`.
8. **Color decontamination:** `fg = clamp((src − (1−α)·bg) / max(α, 1/255))` — this is what prevents cream/white halos. Fully opaque pixels stay byte-identical.
9. Write RGBA PNG at source resolution.

Starting thresholds: `TRANSPARENT_DISTANCE = 6.0`, `OPAQUE_DISTANCE = 13.0` (V2's tuned values). Per-asset overrides allowed in a table at the top of the script. **Never tune `OPAQUE_DISTANCE` below 8** — V2 empirically demonstrated edge-clipping at 8.

The script must be **idempotent**, take a `--dry-run` flag, and print the source→derivative table it produced.

---

## SECTION 6 — MOTION SPECIFICATION

All loops run on the Reanimated UI thread. **No `setInterval`, no `setTimeout`, no JS-driven loops** for any repeating animation.

| Element | Trigger | From | To | Dur | Delay | Easing | Repeat | UI thread | Reduce Motion |
|---|---|---|---|---|---|---|---|---|---|
| Splash mark opacity | mount | 0 | 1 | 220ms | 0 | `out(quad)` | no | yes | same |
| Splash mark scale | mount | 0.94 | 1 | 300ms | 0 | `out(quad)` | no | yes | **skip — render at 1** |
| Splash wiggle | after entrance | −2° | +2° | 600ms/leg | 300ms | `inOut(quad)` | ∞ reverse | yes | **disabled** |
| **Pager page translate** | **finger / `setPage`** | — | — | **native** | — | **native** | — | **native** | **unchanged — always functional** |
| Dot width | page change | 6 | 18 | 180ms | 0 | `out(quad)` | no | yes | 100ms |
| Dot opacity | page change | 0.30 | 1 | 180ms | 0 | `out(quad)` | no | yes | 100ms |
| CTA press-in scale | `onPressIn` | 1 | 0.975 | 90ms | 0 | `out(quad)` | no | yes | same (feedback is not decoration) |
| CTA press-out scale | `onPressOut` | 0.975 | 1 | 140ms | 0 | `out(quad)` | no | yes | same |
| CTA shadowOpacity | press | 0.18 | 0.10 | 90ms | 0 | `out(quad)` | no | yes | same |
| Page artwork settle | page settled | ty 8, op .92 | ty 0, op 1 | 250ms | 0 | `out(quad)` | no | yes | opacity-only 150ms |
| Page Kiko settle | page settled | ty 6, sc .98, op .9 | ty 0, sc 1, op 1 | 280ms | 40ms | `out(quad)` | no | yes | opacity-only 150ms |
| Chip/card stagger | page settled | ty 6, op 0 | ty 0, op 1 | 240ms | `i × 50ms` | `out(quad)` | no | yes | single 150ms fade, no stagger |
| **p2 scan sweep Y** | page 1 settled | 15% | 82% | 1450ms | 0 | `linear` | ∞ + 550ms pause | yes | **static at 50%, α .5** |
| p2 scan sweep opacity | with Y | 0→1→1→0 | — | ramp 12% / 15% | 0 | `linear` | with Y | yes | static |
| p4 chip micro-float | page 3 settled | ty 0 | ty −2 | 2100ms | `i × 260ms` | `inOut(sin)` | ∞ reverse | yes | **disabled** |
| p5 row stagger | page 4 settled | ty 6, op 0 | ty 0, op 1 | 220ms | `i × 40ms` | `out(quad)` | no | yes | fade 150ms |
| p5 row select bg | tap | `card` | `coralSoft` | 160ms | 0 | `out(quad)` | no | yes | instant |
| p5 check icon | tap | op 0, sc .85 | op 1, sc 1 | spring | 0 | `damping 18 / stiffness 220` | no | yes | instant, no spring |
| **p6 graph line (Okyo)** | page 5 settled | `dashoffset L` | `0` | 650ms | 0 | `out(quad)` | no | yes | **render at 0, fade card 150ms** |
| p6 graph line (Takeout) | page 5 settled | `dashoffset L` | `0` | 650ms | 100ms | `out(quad)` | no | yes | render at 0 |
| p6 endpoint dots | after draw | op 0, sc .8 | op 1, sc 1 | 200ms | 750ms | `out(quad)` | no | yes | render final |
| p6 footnote | after draw | ty 6, op 0 | ty 0, op 1 | 240ms | 900ms | `out(quad)` | no | yes | render final |
| p7 back card | page 6 settled | ty 10, rot −2° | ty 0, rot final | 260ms | 0 | `out(quad)` | no | yes | fade 150ms |
| p7 front card | page 6 settled | ty 14 | ty 0 | 280ms | 40ms | `out(quad)` | no | yes | fade 150ms |
| p7 Kiko card | page 6 settled | ty 16, sc .98 | ty 0, sc 1 | 300ms | 80ms | `out(quad)` | no | yes | fade 150ms |
| p8 hero bowl | page 7 settled | sc .97, op 0 | sc 1, op 1 | 280ms | 0 | `out(quad)` | no | yes | fade 150ms |
| p8 icon tiles | page 7 settled | op 0, sc .85 | op 1, sc 1 | 220ms | `i × 60ms` | `out(quad)` | no | yes | fade 150ms |
| **p9 Kiko entry** | page 8 settled | op 0, sc .97, ty 10 | op 1, sc 1, ty 0 | 280ms | 0 | `out(quad)` | no | yes | fade 150ms |
| p9 doodles | page 8 settled | op 0, sc .85 | op 1, sc 1 | 180ms | `i × 40ms` | `out(quad)` | no | yes | fade 150ms |
| **p9 Kiko idle ty** | after entry | 0 | −2 | 2000ms | 400ms | `inOut(quad)` | ∞ reverse | yes | **disabled** |
| p9 Kiko idle rot | after entry | −0.4° | +0.4° | 2400ms | 400ms | `inOut(quad)` | ∞ reverse | yes | **disabled** |
| nameFox Kiko | mount | tx 16, op 0 | tx 0, op 1 | 260ms | 0 | `out(quad)` | no | yes | fade 150ms |
| Loading backdrop | async start | op 0 | op 1 | 150ms | 0 | `linear` | no | yes | same |
| Loading spinner | while loading | 0° | 360° | 800ms | 0 | `linear` | ∞ | yes | **keep** (it is a state indicator, not decoration) |
| Dietary chip toggle | tap | unselected | selected | 150ms | 0 | `out(quad)` | no | yes | instant |

### Pure-horizontal-translation proof obligation

Codex must demonstrate, in the final report:

1. The pager component contains **no** `opacity`, `scale`, `rotate`, `blur`, or `translateX` style applied to any page container.
2. Page children are plain `<View style={{flex:1}}>` inside `<PagerView>`.
3. All page-settle animations are gated on `onPageSelected` (settled), never on `onPageScroll` (mid-drag).
4. A grep proving it:
   ```bash
   grep -nE "interpolate|opacity|scale|rotate|blur" \
     apps/mobile/src/onboarding-v3/showcase/ShowcasePager.tsx
   ```
   must return **only** dot-indicator lines.

### Loading overlay spec

```
backdrop   rgba(0,0,0,0.18), fade in 150ms
card       64 × 64, borderRadius 16, backgroundColor #FFFFFF
shadow     color #5a3924, offset {0,6}, opacity 0.10, radius 14
spinner    26 × 26, rotate 360° / 800ms / linear / infinite
```

Used **only** for real async work. **Never insert an artificial delay to show it.**

---

## SECTION 7 — V3 ARCHITECTURE

### Directory tree (exact)

```
apps/mobile/src/onboarding-v3/
├── OnboardingV3.tsx                    # host; mounted at the WelcomeScreen route
├── controller/
│   ├── onboardingV3Machine.ts          # PURE reducer — no React, no RN imports
│   ├── onboardingV3Machine.test.ts     # exhaustive transition tests
│   └── useOnboardingV3Controller.ts    # React binding: useReducer + effects
├── state/
│   ├── mascotName.ts                   # sanitize + default (pure)
│   ├── mascotName.test.ts
│   ├── onboardingV3Persistence.ts      # AsyncStorage read/write/reset
│   ├── onboardingV3Persistence.test.ts # tested against an in-memory storage fake
│   ├── attribution.ts                  # AttributionSource union + guard
│   └── dietary.ts                      # option catalogs + serialization (pure)
├── showcase/
│   ├── ShowcasePager.tsx               # PagerView; owns showcasePage locally
│   ├── showcasePages.ts                # PURE: ordered page descriptors
│   ├── showcasePages.test.ts           # asserts exactly 9, correct order
│   ├── PagerDots.tsx
│   └── pages/
│       ├── HeroPage.tsx                # ← onboarding2 (rebuilt)
│       ├── ScanPage.tsx                # ← onboarding3
│       ├── RecipeOutputPage.tsx        # ← onboarding4
│       ├── CustomizePage.tsx           # ← onboarding5
│       ├── AttributionPage.tsx         # ← onboarding6 (rebuilt)
│       ├── SavingsPage.tsx             # ← onboarding7
│       ├── ApproachPage.tsx            # ← onboarding8
│       ├── ValuePage.tsx               # ← onboarding9
│       └── MeetKikoPage.tsx            # ← onboarding10
├── screens/
│   ├── SplashScreen.tsx                # ← onboarding1
│   ├── NameFoxScreen.tsx               # ← onboarding11
│   ├── ScanInputScreen.tsx
│   ├── PhotoConfirmScreen.tsx
│   ├── AnalyzingScreen.tsx
│   ├── DietaryScreen.tsx
│   ├── OnboardingRecipePreview.tsx
│   ├── OnboardingCookingScreen.tsx
│   ├── CookingCompleteScreen.tsx
│   └── OnboardingPaywallScreen.tsx
├── components/
│   ├── OnboardingCTA.tsx               # press micro-interaction
│   ├── OnboardingBackButton.tsx
│   ├── LoadingOverlay.tsx
│   ├── PageScaffold.tsx                # safe area + cream canvas + dots slot
│   └── AnimatedArtwork.tsx             # settle animation wrapper
├── motion/
│   ├── motionTokens.ts                 # every duration/easing from Section 6
│   ├── useReduceMotion.ts              # re-export of the ported hook
│   └── useSettleAnimation.ts
├── assets/
│   └── onboardingV3Assets.ts           # require() map + prefetch lists
└── utils/
    └── onboardingV3Log.ts              # dev-only structured logging
```

### The one authoritative state

```ts
// controller/onboardingV3Machine.ts

export type OnboardingV3Step =
  | 'splash'
  | 'showcase'
  | 'nameFox'
  | 'input'
  | 'photoConfirm'
  | 'analyzing'
  | 'dietary'
  | 'recipe'
  | 'cooking'
  | 'cookingComplete'
  | 'paywall'
  | 'complete';

export type OnboardingV3State = {
  step: OnboardingV3Step;
  // Data. NEVER used to infer `step`.
  mascotName: string;
  attribution: AttributionSource | null;
  dietaryRestrictions: string[];
  dietaryDislikes: string[];
  analysisId: string | null;
  dishName: string | null;
  photoUri: string | null;
  recipeId: string | null;
  scanSessionId: string | null;
  error: OnboardingV3Error | null;
};
```

**`showcasePage` is deliberately absent.** It is `useState` inside `ShowcasePager` and is never persisted, never lifted, never a top-level step.

### Rules Codex must not violate

1. `step` is the **only** thing that decides what renders. `OnboardingV3.tsx` is a single `switch (state.step)`.
2. **No boolean is ever combined to infer a screen.** No `hasSeenX && !hasDoneY`.
3. The reducer is **pure** — no `async`, no `AsyncStorage`, no `fetch`, no RN imports. Side effects live in `useOnboardingV3Controller`.
4. `completeOnboarding()` is called from **exactly one** effect, guarded by a `useRef` so it can never fire twice.
5. No screen inside `onboarding-v3/` calls `navigation.navigate()`. The controller owns all movement.
6. Nothing in `onboarding-v3/` imports from `screens/ResultSummaryScreen`, `screens/RecipeDetailScreen`, or `screens/WelcomeScreen`.

### Persistence ownership

| Key | Owner | Storage | Cleared by dev reset |
|---|---|---|---|
| `okyo:onboarding-completed:v1` | `state/onboardingPersistence.ts` (existing) | AsyncStorage | yes |
| `hasCompletedOnboarding` | `useOkyoStore` (existing) | zustand persist | yes |
| `okyo:mascot-name:v1` | `onboardingV3Persistence` | AsyncStorage | yes |
| `okyo:onboarding-attribution:v1` | `onboardingV3Persistence` | AsyncStorage | yes |
| `okyo:dietary:v1` | `onboardingV3Persistence` | AsyncStorage | yes |
| recipes / saved / grocery / XP | `useOkyoStore` | zustand persist | **no — never** |

**`step` is never persisted.** A killed app restarts onboarding at `splash`. This is deliberate — resumable step persistence is exactly what produced V2's stale-state bugs. Data already collected (name, attribution, dietary) survives and pre-fills.

### Service boundaries

```
OnboardingV3 (UI)
  → useOnboardingV3Controller  (effects, the only async owner)
      → onboardingV3Machine    (pure)
      → api/client.ts          (analyzeScan / generateRecipeFromAnalysis)
      → utils/scanController   (existing, for the fallback single-call path)
      → state/canonicalRecipes (canonical recipe identity)
      → services/revenueCat    (ported from V2)
      → state/onboardingV3Persistence
```

---

## SECTION 8 — TRANSITION TABLE

Complete and deterministic. Any `(state, event)` pair not listed is a **no-op** and must be logged as `onboarding_v3_unhandled_event`.

| Current | Event | Guard | Side effect | Next |
|---|---|---|---|---|
| `splash` | `SPLASH_FINISHED` | elapsed ≥ 700ms **and** (fonts loaded **or** elapsed ≥ 1100ms) | prefetch o2–o4 art | `showcase` |
| `showcase` | `SHOWCASE_NEXT` | `page < 8` | `pager.setPage(page+1)`; prefetch next+2 | `showcase` |
| `showcase` | `SHOWCASE_NEXT` | `page === 8` | prefetch o11 art | `nameFox` |
| `showcase` | `SHOWCASE_BACK` | `page > 0` | `pager.setPage(page−1)` | `showcase` |
| `showcase` | `SHOWCASE_BACK` | `page === 0` | none (chevron hidden) | `showcase` |
| `showcase` | `ATTRIBUTION_SELECTED(src)` | always | persist (fire-and-forget) | `showcase` |
| `showcase` | `ATTRIBUTION_SKIPPED` | always | `attribution = null` | `showcase` |
| `nameFox` | `NAME_SUBMITTED(raw)` | always | `mascotName = sanitize(raw)`; persist | `input` |
| `nameFox` | `BACK` | always | `pager.setPage(8)` | `showcase` |
| `input` | `PHOTO_SELECTED(uri)` | uri non-empty | `photoUri = uri` | `photoConfirm` |
| `input` | `DESCRIPTION_SUBMITTED(text)` | `text.trim().length > 0` | start analyze (description path) | `analyzing` |
| `input` | `BACK` | always | none | `nameFox` |
| `input` | `PERMISSION_DENIED` | always | inline message; **no step change** | `input` |
| `photoConfirm` | `PHOTO_CONFIRMED` | `photoUri !== null` | `POST /v1/scans/analyze` | `analyzing` |
| `photoConfirm` | `BACK` | always | `photoUri = null` | `input` |
| `analyzing` | `ANALYSIS_SUCCEEDED(id, dish)` | always | store `analysisId`, `dishName` | `dietary` |
| `analyzing` | `ANALYSIS_REJECTED(kind)` | always | `error = {kind}` | `input` |
| `analyzing` | `ANALYSIS_FAILED(msg)` | always | `error = {network}` | `input` |
| `analyzing` | `BACK` | always | `abortController.abort()` | `input` |
| `dietary` | `DIETARY_CONTINUE(hard, soft)` | always (empty is valid) | persist; `POST …/recipe` with prefs | `recipe` |
| `dietary` | `BACK` | always | clear `analysisId`, `dishName` | `input` |
| `recipe` | `RECIPE_READY(recipeId)` | always | register canonical recipe | `recipe` |
| `recipe` | `RECIPE_FAILED(msg)` | always | `error`; keep `analysisId` for retry | `recipe` |
| `recipe` | `RECIPE_RETRY` | `analysisId !== null` | re-POST recipe phase (**no** new vision call) | `recipe` |
| `recipe` | `RECIPE_RETRY` | `analysisId === null` | full `/v1/scans` **with** preferences | `analyzing` |
| `recipe` | `CONTINUE` | `recipeId !== null` | none | `paywall` |
| `recipe` | `COOK` | `recipeId !== null` | `createActiveCookingSession` | `cooking` |
| `recipe` | `BACK` | always | none | `dietary` |
| `cooking` | `COOKING_COMPLETED` | always | `setCanonicalRecipeCompletion('completed')` | `cookingComplete` |
| `cooking` | `COOKING_EXITED` | always | `clearActiveCookingSession` | `paywall` |
| `cooking` | `BACK` | always | `clearActiveCookingSession` | `recipe` |
| `cookingComplete` | `CONTINUE` | always | none | `paywall` |
| `cookingComplete` | `BACK` | always | none (disabled) | `cookingComplete` |
| `paywall` | `PURCHASE_SUCCEEDED(info)` | `info.entitlements.active[ENT]` truthy | none | `complete` |
| `paywall` | `PURCHASE_SUCCEEDED(info)` | entitlement **absent** | `error = {not_entitled}` | `paywall` |
| `paywall` | `PURCHASE_CANCELLED` | always | clear loading only | `paywall` |
| `paywall` | `PURCHASE_FAILED(msg)` | always | `error = {purchase}` | `paywall` |
| `paywall` | `RESTORE_SUCCEEDED(entitled)` | `entitled === true` | none | `complete` |
| `paywall` | `RESTORE_SUCCEEDED(entitled)` | `entitled === false` | `error = {nothing_to_restore}` | `paywall` |
| `paywall` | `DEV_BYPASS` | `__DEV__` **and** provider unavailable | log bypass | `complete` |
| `paywall` | `BACK` | always | none (disabled) | `paywall` |
| `complete` | *(effect, once)* | `!didComplete.current` | `writeCompleted()` + `completeOnboarding()` | — |

---

## SECTION 9 — V2 TRANSPLANT MAP

### COPY / PORT — take essentially as-is

| Donor path | Destination | Why |
|---|---|---|
| `src/hooks/useAccessibilityPreferences.ts` | same path | Clean, dependency-free, exactly the central Reduce Motion source V3 needs. V3 has **no** accessibility handling today. |
| `src/services/revenueCatConfig.ts` | same path | Fails closed across the Test-Store/production boundary. Security-correct. Already unit-tested. |
| `src/services/revenueCatConfig.test.ts` | same path | Proves the boundary. |
| `src/services/revenueCat.ts` | same path | Production-quality singleton, listener-based, `CustomerInfo`-authoritative. Do not rewrite. |
| `src/services/revenueCatLogBox.ts` | same path | Suppresses **one exact string** in dev only. Correct minimal approach. |
| `src/services/revenueCatRegression.test.ts` | same path | Regression guard. |
| `src/services/revenueCatFailureHandling.test.ts` | same path | Covers cancel vs failure. |
| `src/utils/revenueCatPaywall.ts` | same path | Pure package→plan mapping. Renders only what RevenueCat returned; ignores an obsolete monthly package rather than relabeling. |
| `src/utils/revenueCatPaywall.test.ts` | same path | |
| `apps/api/src/services/dishFirstProduct.test.ts` | same path | Encodes the product contract as tests. |
| `apps/mobile/.env.example` RevenueCat block | append to V3's | Documents required env without committing secrets. |
| `scripts/derive_kiko_transparency.py` | **algorithm only** → new Node script | numpy/Pillow unavailable. The *approach* is proven; the runtime is not available. See Section 5. |
| `assets/kiko-static/transparent-generated/*` (6 poses) | same path | Already quality-verified. Free reuse. |
| `src/assets/kikoTransparentAssets.ts` | same path | The registry for the above. |

### SELECTIVELY MERGE — reproduce specific hunks, never overwrite the V3 file

| Donor file | Port these hunks **only** | Do **not** port |
|---|---|---|
| `apps/api/src/server.ts` | `recipePriority` / `cookingFrictionFollowUp` / `dietaryRestrictions` / `dietaryDislikes` in `scanRequestSchema`; `getScanPreferencesFromBody()`; passing `preferences` into `createAiScan` / `createAiTextRecipe` | nothing else — the rest of V3's `server.ts` is current |
| `apps/api/src/services/aiService.ts` | `RecipeGenerationPreferences` type; `inputKind` on `foodImageAnalysisSchema`; `FoodRejectionType` gains `'ingredients_only'`; `FoodRejectionError` message branch; `getFoodGateRejection` raw-ingredients branch + `export`; `preferences` on `AnalyzeFoodImageInput` / `GenerateRecipeFromDishInput`; `inputKind` in `normalizeVisionOutput`; `RECIPE_PIPELINE_VERSION = 'v4-dish-first'` | — |
| `apps/api/src/services/openRouterProvider.ts` | `inputKind` in `openRouterVisionOutputSchema`; early return on `raw_ingredients`; `hasMeaningfulPreferences()`; `buildPreferencesPromptSection()`; **`skipCache` when preferences exist** (safety-critical — a cached recipe generated without allergy constraints must never be served to a request that has them); `preferences` param on `getRecipePrompt`; dish-first vision prompt rewrites; `export getVisionPrompt` | — |
| `apps/mobile/src/api/types.ts` | preference fields on `CreateScanRequest` | — |
| `apps/mobile/app.json` | `"scheme": "okyo"` (needed for RevenueCat/deep links) | **`bundleIdentifier: "org.name.Okyo"`** — Section 12 re-verified V3's `com.anonymous.okyo` is already correct; never change it |
| `apps/mobile/package.json` | `react-native-purchases`, `react-native-purchases-ui`, `expo-dev-client` | `expo-glass-effect` (V3 has `expo-blur`; no need) |

### DO NOT PORT — these are the architecture being deleted

| Donor file / pattern | Why |
|---|---|
| `src/screens/WelcomeScreen.tsx` as onboarding controller | 1323-line `useState` screen-key controller. The direct cause of dead Continue/Back buttons. |
| `src/components/onboarding/OnboardingV2Steps.tsx` | V2 step architecture. |
| `src/state/onboardingSteps.ts` + `.test.ts` | Old step-index state machine with persisted index complexity. |
| `src/utils/onboardingResultIntegration.test.ts` | Encodes the ResultSummary-as-controller coupling. |
| `src/utils/onboardingKikoAssets.test.ts` | Asserts V2 onboarding asset wiring. |
| `src/utils/dishFirstOnboardingRegression.test.ts` | Contract is good, but it asserts against V2 onboarding surfaces. **Rewrite its assertions against V3 files** rather than porting. |
| Identification confirmation gating | "Quick Check", "Does this look right?", "Yes, looks good". |
| `hasAcceptedOnboardingRecipe` gating | A boolean combined into screen inference. |
| Mandatory cooking | Cooking is optional in V3. |
| `firstOnboardingResultSeen` / `firstOnboardingScanCompleted` as gates | Multi-boolean screen inference. Keep the fields (persisted, harmless) but **V3 must never read them**. |
| Post-result / post-cooking continuation chains | Replaced by the Section 8 table. |
| V2 Back hacks | Replaced by explicit `BACK` transitions. |
| `ResultSummaryScreen` as onboarding controller | V3 has its own preview screen. |
| Paywall gating on cooking flags | Paywall is reached from `recipe`, `cooking`, or `cookingComplete` unconditionally. |
| Pantry / ingredient-first copy | Product contract violation. |
| `expo-glass-effect` + `components/glass/*` | Not needed for V3's cream-canvas editorial design; V3 already has `expo-blur` if a material is ever wanted. Skipping keeps the diff smaller and avoids a native module. |

---

## SECTION 10 — DATA MODELS

```ts
// controller/onboardingV3Machine.ts
export type OnboardingV3Step =
  | 'splash' | 'showcase' | 'nameFox' | 'input' | 'photoConfirm'
  | 'analyzing' | 'dietary' | 'recipe' | 'cooking' | 'cookingComplete'
  | 'paywall' | 'complete';

export type OnboardingV3ErrorKind =
  | 'ingredients_only' | 'not_food' | 'unclear' | 'network'
  | 'recipe_generation' | 'purchase' | 'not_entitled' | 'nothing_to_restore';

export type OnboardingV3Error = { kind: OnboardingV3ErrorKind; message: string };
```

```ts
// state/mascotName.ts
export const DEFAULT_MASCOT_NAME = 'Kiko';
export const MASCOT_NAME_MAX_LENGTH = 20;

/** Trim; fall back to Kiko when blank; hard-cap length. */
export function sanitizeMascotName(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (trimmed.length === 0) return DEFAULT_MASCOT_NAME;
  return trimmed.slice(0, MASCOT_NAME_MAX_LENGTH);
}
```

```ts
// state/attribution.ts
export const ATTRIBUTION_SOURCES = [
  'influencer', 'instagram', 'tiktok', 'youtube', 'app_store', 'friends_family',
] as const;
export type AttributionSource = typeof ATTRIBUTION_SOURCES[number];
```

```ts
// state/dietary.ts
/** Hard limits — safety-critical. Sent as dietaryRestrictions. */
export const DIETARY_RESTRICTIONS = [
  'Peanuts','Tree nuts','Dairy','Eggs','Gluten','Shellfish',
  'Fish','Soy','Sesame','Pork','Beef','Alcohol',
] as const;

/** Soft preferences. Sent as dietaryDislikes. */
export const DIETARY_DISLIKES = [
  'Mushrooms','Olives','Cilantro','Spicy food','Onions','Seafood','Very sweet',
] as const;

export type DietarySelection = {
  restrictions: string[];  // hard — model MUST NOT include
  dislikes: string[];      // soft — model SHOULD avoid
};
```

```ts
// scan / recipe context (fields on OnboardingV3State)
analysisId:     string | null;   // server handle for the stored FoodImageAnalysis
dishName:       string | null;   // shown in the dietary copy
photoUri:       string | null;   // local URI (never a dataUrl in state)
recipeId:       string | null;   // canonical recipe id
scanSessionId:  string | null;
```

```ts
// purchase state — from the ported service, NOT redefined
import type { EntitlementState, RevenueCatPurchaseResult } from '../../services/revenueCat';
```

---

## SECTION 11 — SCAN / DIETARY / RECIPE ARCHITECTURE ★ KEY DECISION (IMPLEMENTATION-GRADE)

### The problem

`POST /v1/scans` runs **vision AND recipe generation in one request**. The required UX is scan → dietary → recipe. Naively, the recipe already exists before dietary is asked.

### 1–2. Exact existing functions and the exact extraction boundary

Read directly from `apps/api/src/services/aiService.ts` (line numbers as of this audit):

| Responsibility | Function | Lines |
|---|---|---|
| Vision analysis | `analyzeFoodImage(input: AnalyzeFoodImageInput)` | 351–414 |
| Food gating | `getFoodGateRejection(analysis, uploadedImage)` (currently module-private) | 1368–1384 |
| Recipe generation | `generateRecipeFromDish(input: GenerateRecipeFromDishInput)` | 415–537 |
| Canonical assembly + orchestration | `createAiScanWithMetrics(input)` (module-private, wrapped by exported `createAiScan`) | 945–1193 |

`createAiScanWithMetrics` is the one function that does everything today. Its body has three clean regions:

- **Lines 945–1019** — setup: config resolution, `uploadedImage`/`providerVisible` checks, debug logging, the **scan-level cache short-circuit** (`scanCache`, keyed by `dataUrl + mode`).
- **Lines 1020–1067** — **phase 1**: `analyzeFoodImage(input)` (line 1022) → `getFoodGateRejection(analysis, uploadedImage)` (line 1039) → on rejection, cache the rejection (`SCAN_REJECTION_CACHE_TTL_MS = 1h`) and `throw`.
- **Lines 1069–1175** — **phase 2**: `generateRecipeFromDish(...)` (line 1075) → fail-closed checks (1085–1096) → `scanId`/`createUniqueScanSourceRecipe`/`storeGeneratedRecipe` (1098–1100) → `estimateIngredientCosts` (1102) → assemble `ScanResult`/`GroceryList`/`ShareCard` (1110–1140) → build `result` (1142–1154) → fire-and-forget analytics (1157) → cache the success (`SCAN_CACHE_TTL_MS = 24h`, line 1173) → `return result`.
- **Lines 1176–1192** — a single `catch` wrapping the whole try block: fail-closed logging, re-throw.

**The extraction boundary is exact: lines 1069–1175, cut into a new function, called from the same call site.** Nothing in that region depends on the raw image — it only reads `analysis` (already-parsed vision output), `input.mode`/`input.source`/`input.fableActive`, `uploadedImage`, `config`, and the two timing/cache variables computed in phase 1.

```ts
// NEW — pure extraction, cut-and-paste of lines 1069–1175, zero logic changed
async function buildScanResultFromAnalysis(
  analysis: FoodImageAnalysis,
  ctx: {
    config: AiConfig;
    mode: RecipeMode;
    source: ScanSource;
    fableActive?: boolean;
    preferences?: RecipeGenerationPreferences; // NEW param, threaded to generateRecipeFromDish
    uploadedImage: boolean;
    visionMs: number;
    scanStartedAt: number;
    scanCacheKey: string | null; // null when called from the new two-phase endpoint
  },
): Promise<AiScanSuccessResult> {
  // body = today's lines 1069–1175, verbatim, with `preferences` threaded into
  // the generateRecipeFromDish call and `scanCacheKey` guarded (see §14 below)
}
```

`createAiScanWithMetrics` becomes:

```ts
async function createAiScanWithMetrics(input: AnalyzeFoodImageInput): Promise<AiScanSuccessResult> {
  // lines 945–1019 UNCHANGED (setup + scan-cache short-circuit)
  const scanStartedAt = Date.now();
  try {
    const visionStartedAt = Date.now();
    const analysis = await analyzeFoodImage(input);              // unchanged
    const visionMs = Date.now() - visionStartedAt;
    // lines 1024–1037 logging UNCHANGED
    const rejection = getFoodGateRejection(analysis, uploadedImage); // unchanged
    // lines 1041–1049 logging UNCHANGED
    if (rejection) { /* lines 1050–1066 UNCHANGED */ throw rejection; }
    return await buildScanResultFromAnalysis(analysis, {
      config, mode: input.mode, source: input.source, fableActive: input.fableActive,
      preferences: input.preferences, uploadedImage, visionMs, scanStartedAt, scanCacheKey,
    });
  } catch (error) { /* lines 1176–1192 UNCHANGED */ }
}
```

**`POST /v1/scans` behavior is byte-identical** — same functions, same order, same cache keys, same logs. This is verified by requiring all 30 existing API tests to pass **with zero test file edits** (acceptance criterion, Section 22 #50).

### 3. Exact new endpoint schemas

**Endpoint 1 — analysis only**

```
POST /v1/scans/analyze

Request body (zod, extends the existing scanImageMetadataSchema/scanSourceSchema):
{
  source: ScanSource;                 // reuses scanSourceSchema
  mode?: RecipeMode;                  // default 'Normal', reuses recipeModeInputSchema
  image?: ScanImageMetadata;          // reuses scanImageMetadataSchema — same 413 size guard applies
  mealDescription?: string;           // description-source path, same superRefine rules as today
}

201 Created:
{
  ok: true,
  data: {
    analysisId: string;              // opaque handle, see §4
    dishName: string;
    confidence: number;
    inputKind: 'prepared_dish' | 'raw_ingredients' | 'not_food' | 'unclear';
    scanState: ScanState;
    expiresAt: string;                // ISO timestamp — client can show "starting over" UX proactively
  }
}

422 Unprocessable (food gate rejection):
{
  ok: false,
  error: {
    code: 'ingredients_only' | 'no_food_detected' | 'unclear_food';
    message: string;                  // the existing scanFailureCopy-compatible strings
  }
}

413 / 429  — identical existing guards (image-too-large, daily AI cap), unchanged.
```

**Endpoint 2 — recipe from a stored analysis**

```
POST /v1/scans/analyze/:analysisId/recipe

Request body:
{
  mode?: RecipeMode;
  dietaryRestrictions?: string[];     // HARD — safety-critical, max 20 items
  dietaryDislikes?: string[];         // SOFT — max 20 items
  recipeRequestId?: string;           // idempotency key, see §12
}

201 Created:  identical CreateScanResult shape /v1/scans already returns
              (status, scan, recipe, groceryList, shareCard, note, ai debug fields, scanState, uploadedImage)
              NOTE: no `image` field — see §9/§10, the client already has the photo locally.

410 Gone (analysis expired or process restarted):
{ ok: false, error: { code: 'analysis_expired', message: 'Let's scan that again.' } }

404 Not Found (unknown analysisId — typo/tampering):
{ ok: false, error: { code: 'analysis_not_found', message: 'Let's scan that again.' } }
```

### 4. Analysis-context data model

```ts
type StoredAnalysisContext = {
  analysis: FoodImageAnalysis;   // the full parsed vision output — everything phase 2 needs
  config: AiConfig;              // resolved once in phase 1, reused verbatim in phase 2
                                  // (same model/fableActive resolution both phases would see)
  mode: RecipeMode;
  source: ScanSource;
  fableActive?: boolean;
  uploadedImage: boolean;
  visionMs: number;              // preserved so [scan_timing] logs in phase 2 report the true total
  scanStartedAt: number;
  expiresAt: number;
};
```

**No image bytes, no `dataUrl`, in this record — proven, not assumed.** `GenerateRecipeFromDishInput` (aiService.ts, exported type) is `{ analysis, correction?, mode, fableActive?, storeResult? }` — it has never taken an image. `EstimateIngredientCostsInput` is `{ analysis, recipe }` — also no image. **Phase 2 does not touch the raw photo anywhere in the current pipeline.** The client already has the photo on-device (`copyToDocuments` in `scanController.ts` already persists it to `NSDocumentDirectory` before the request is even sent), so the recipe-preview screen renders from the local URI, not from anything the server returns.

### 5–7. Where it's stored, TTL, cleanup

**In-memory `Map`, matching the three precedents already in this exact file** — `scanCache` (line 86), `generatedRecipeStore` (`store.ts` line 36), and `correctionRequestResults`/`correctionRequestInFlight` (lines 90–91). This codebase has **zero persistent storage** anywhere in the API today; every piece of transient server state is an in-memory `Map` with a lazy-expiry `expiresAt` check on read, exactly like `getGeneratedRecipeEntry` does. There is no database, no Redis, nothing to add. Following the existing pattern is the smallest-diff, most-consistent choice.

```ts
const ANALYSIS_TTL_MS = 15 * 60 * 1000; // 15 min — long enough for the dietary screen dwell time
const analysisStore = new Map<string, StoredAnalysisContext>();

function storeAnalysis(ctx: Omit<StoredAnalysisContext, 'expiresAt'>): string {
  const analysisId = randomUUID();
  analysisStore.set(analysisId, { ...ctx, expiresAt: Date.now() + ANALYSIS_TTL_MS });
  return analysisId;
}

function getAnalysis(analysisId: string): StoredAnalysisContext | null {
  const entry = analysisStore.get(analysisId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) { analysisStore.delete(analysisId); return null; }
  return entry;
}
```

**Cleanup:** lazy — deleted on next read past expiry, same as `getGeneratedRecipeEntry`. No `setInterval` sweep exists anywhere in this codebase for the other three Maps either; not introducing one here keeps the diff consistent with house style. Worst case is a bounded number of small (few-KB) JSON objects living up to 15 minutes past expiry — not a real memory concern at Okyo's current scale, and identical in kind to `generatedRecipeStore`'s 24h TTL already in production.

### 8. Behavior across API process restart

**Identical to how `scanCache`, `generatedRecipeStore`, and `correctionRequestResults` already behave today: lost.** This is not a regression introduced by this design — it is the existing, accepted behavior of every piece of server state in this API. The two-phase design's failure mode (410 → client falls back to a single full `/v1/scans` call, see §17) is *strictly better* than what would happen today if, say, `generatedRecipeStore` lost an entry mid-session (a hard 404). The fallback in §17 makes analysis-loss **recoverable and invisible to the user**, not just tolerated.

### 9–10. Original image retention / privacy / memory

**Not retained, proven in §4.** No image bytes, no `dataUrl`, and no file path are ever written into `StoredAnalysisContext`. This directly satisfies `CLAUDE.md`'s "Do not store user food images unless the user saves a recipe or explicitly opts in" — the two-phase design stores *less* than a naive implementation might, not more. Memory footprint per entry is the `FoodImageAnalysis` JSON (dish name, ingredient lists, confidence, notes — comparable in size to what `scanCache` already stores per entry) plus a handful of primitives.

### 11. `scanSessionId` stability across both phases

`scanSessionId` is a **mobile-side** identifier (`createScanSessionId()` in `scanController.ts`) that never crosses to the API today — the API only knows a per-request `scanId` it mints itself (`createAiScanWithMetrics` line 1098). This is unchanged: the mobile V3 controller keeps its own `scanSessionId` for local session tracking exactly as `scanController.ts` does today, and `analysisId` is a **separate, server-minted handle** for phase 1→phase 2 continuity. They serve different purposes and neither needs to know about the other. `analysisId` is the only new identifier introduced.

### 12. Duplicate phase-2 submissions

**Reuse the exact idempotency pattern already proven in this file for `/v1/recipes/:id/correct`** (`correctionRequestResults` + `correctionRequestInFlight`, lines 613–659). The mobile client generates `recipeRequestId` once when it first calls phase 2 (same pattern as `correctionRequestId` in `server.ts`'s `/correct` handler) and retries reuse it:

```ts
export async function generateRecipeForAnalysis(input: {
  analysisId: string;
  dietaryRestrictions?: string[];
  dietaryDislikes?: string[];
  recipeRequestId?: string;
}): Promise<AiScanSuccessResult> {
  const requestId = input.recipeRequestId;
  const completed = requestId ? recipeRequestResults.get(requestId) : undefined;
  if (completed && completed.expiresAt > Date.now()) {
    if (completed.outcome.kind === 'failure') throw completed.outcome.error;
    return completed.outcome.result;
  }
  const inFlight = requestId ? recipeRequestInFlight.get(requestId) : undefined;
  if (inFlight) return inFlight;

  const stored = getAnalysis(input.analysisId);
  if (!stored) throw new AnalysisExpiredError();

  const work = buildScanResultFromAnalysis(stored.analysis, {
    config: stored.config, mode: input.mode ?? stored.mode, source: stored.source,
    fableActive: stored.fableActive, uploadedImage: stored.uploadedImage,
    visionMs: stored.visionMs, scanStartedAt: stored.scanStartedAt, scanCacheKey: null,
    preferences: { dietaryRestrictions: input.dietaryRestrictions, dietaryDislikes: input.dietaryDislikes },
  });
  if (!requestId) return work;
  recipeRequestInFlight.set(requestId, work);
  try {
    const result = await work;
    recipeRequestResults.set(requestId, { outcome: { kind: 'success', result }, expiresAt: Date.now() + RECIPE_IDEMPOTENCY_TTL_MS });
    return result;
  } catch (error) {
    recipeRequestResults.set(requestId, { outcome: { kind: 'failure', error }, expiresAt: Date.now() + RECIPE_IDEMPOTENCY_TTL_MS });
    throw error;
  } finally {
    recipeRequestInFlight.delete(requestId);
  }
}
```

A double-tap on `Continue`, or a client retry after a dropped response, hits the same in-flight promise or the same cached result — **never a second AI call, never a second recipe object.**

### 13. Caching behavior

Two independent, non-conflicting cache layers survive unchanged:
- **`scanCache`** (existing) still keys the *whole-request* `/v1/scans` path by `dataUrl + mode`. Two-phase requests never populate or read this cache (`scanCacheKey: null` when called from `buildScanResultFromAnalysis`'s phase-2 caller) — there is no `dataUrl` at phase 2 time to key on anyway.
- **`recipeCache`** (inside `openRouterProvider.ts`, keyed by analysis+mode) is the one that matters here. **Ported from V2 unchanged:** when `preferences` has any content, `skipCache = true` — a recipe generated under dietary constraints is never read from or written to this cache. This is safety-critical and is exercised by the extended `openRouterProvider.recipe.test.ts` (Section 9, already in the transplant map).
- **`recipeRequestResults`** (new, §12) is a pure idempotency cache — same `recipeRequestId` in, same result out, for `RECIPE_IDEMPOTENCY_TTL_MS = 10 * 60 * 1000` (matching `CORRECTION_IDEMPOTENCY_TTL_MS`'s existing value exactly).

### 14. Guaranteeing exactly two AI calls, never three

`buildScanResultFromAnalysis` makes **exactly one** AI call internally (`generateRecipeFromDish` → one `callOpenRouterJson` for the recipe, occasionally a repair-model call on validation failure — same behavior `/v1/scans` already has today, unchanged). `analyzeFoodImage` makes **exactly one** AI call (vision). Two-phase total = 1 (phase 1) + 1 (phase 2) = **2**, identical to today's single-request total. The only way this could become 3 is the §17 fallback path (analysis expired → full `/v1/scans` re-run), which is a **replacement** of the failed 2-call sequence, not an addition to it — a user who hits expiry pays 2 calls total either way, just via a different route.

### 15–16. Dietary hard restrictions vs soft dislikes in the prompt

Ported from the V2 donor (`openRouterProvider.ts`, verified in Section 9's transplant map) via `buildPreferencesPromptSection`:

```ts
if (preferences?.dietaryRestrictions?.length) {
  lines.push(`HARD DIETARY RESTRICTION — SAFETY CRITICAL: the recipe MUST NOT include, or be
    cooked using equipment cross-contaminated with, any of: ${restrictions.join(', ')}. This is a
    non-negotiable allergy/restriction constraint, not a preference. If the dish cannot be made
    safely, substitute ingredients rather than including a restricted one.`);
}
if (preferences?.dietaryDislikes?.length) {
  lines.push(`Soft preference — avoid if reasonably possible: ${dislikes.join(', ')}. Only
    include one of these if there is no reasonable substitute for the dish to work.`);
}
```

The language difference is deliberate and load-bearing: restrictions are framed as **non-negotiable safety**, dislikes as **best-effort preference the model may override**. This section is appended to the recipe prompt only when `hasMeaningfulPreferences()` is true, so a request with no preferences produces a **byte-identical prompt** to today (verified by acceptance criterion in Section 6 of the transplant map / Step 6 success criteria).

### 17. Phase-1 failure behavior

| Failure | Response | Client action |
|---|---|---|
| Network/timeout before response | fetch rejects/aborts | `analyzing` → error → `input`, photo retained, `Try again` re-POSTs `/analyze` |
| `raw_ingredients` | 422 `ingredients_only` | "Scan a prepared dish you'd like to recreate." → `input`. **No phase-2 call ever happens.** |
| `not_food` / `unclear` | 422 | existing `scanFailureCopy` strings → `input` |
| Image too large | 413 (unchanged existing guard) | "This photo was too large to scan." → `input` |
| Daily AI cap | 429 (unchanged existing guard) | "Okyo has reached its daily scan limit." → `input` |

### 18. Phase-2 failure behavior

| Failure | Response | Client action |
|---|---|---|
| `analysisId` unknown | 404 `analysis_not_found` | Same UX as expiry — fall to §17's fallback |
| `analysisId` expired / server restarted | 410 `analysis_expired` | **Automatic, invisible fallback**: client issues one `POST /v1/scans` **with** `dietaryRestrictions`/`dietaryDislikes` already attached — a single full analyze+recipe call that still fully honors dietary. User sees a slightly longer wait, never an error. |
| Recipe generation fails (`RECIPE_GENERATION_FAILED`/`RECIPE_MISSING`) | 502 | Stay on `recipe` screen with error; `Try again` re-POSTs **phase 2 only** (same `analysisId`, same or new `recipeRequestId`) — the vision call is never repeated. |

### 19. Retry semantics per phase

- **Phase 1 retry**: always a fresh `POST /v1/scans/analyze` — safe to repeat, no idempotency key needed (it has no side effect beyond storing a new analysis; the client discards the old `analysisId`).
- **Phase 2 retry**: **must** reuse the same `recipeRequestId` (§12) so a slow-but-eventually-successful first attempt isn't duplicated by an impatient retry. The controller's `RECIPE_RETRY` event (Section 8 transition table) reuses the same `analysisId` and `recipeRequestId` already in state.

### 20. `/v1/scans` unchanged for non-onboarding callers

Proven in §1–2: the extraction is a pure cut-and-paste with zero logic changes, called from the identical call site, with the identical cache keys. The main-app scan path (`HomeScreen` → `scanController.startScan()` → `createMockScan()` → `POST /v1/scans`) is **not touched by this plan at all** — it continues to call the single-request endpoint exactly as it does today.

### 21. Regression tests for the main-app path

`aiService.twoPhase.test.ts` (Step 7, Section 15) asserts, without touching any existing test file:
- Given identical mocked provider responses, `createAiScan(input)` (the existing exported entry point) produces an identical `AiScanSuccessResult` before and after the extraction (snapshot-style equality check).
- All 30 pre-existing `apps/api/src/**/*.test.ts` files pass **unmodified** — this is a hard gate in Section 22 acceptance criterion 50, not a suggestion.
- `raw_ingredients` at phase 1 makes **zero** calls into `generateRecipeFromDish` (spy/mock assertion) — proves the "no recipe call for rejected input" claim in §17 rather than just asserting it in prose.

### 22. Why this beats "full scan → dietary → correction/regeneration"

Restated precisely now that the extraction boundary is proven: the correction path (`createAiRecipeCorrection`, lines 613–659) takes `correctionNote: string` — free text — as its only content-shaping input. There is no `dietaryRestrictions` field anywhere in `CorrectionGenerationContext` or the correction prompt builder. Routing allergies through it would mean **string-templating an allergy list into a free-text field designed for "the dish should have more cilantro"-style notes**, with no `HARD DIETARY RESTRICTION — SAFETY CRITICAL` framing, no non-negotiable language, and no `skipCache` guard (the correction path has its own separate caching rules unrelated to preference-safety). That is a materially weaker safety guarantee than the two-phase design's dedicated preferences section, for the cost of a third AI call. Two-phase wins on both safety and cost.

### Why not a signed/stateless analysis payload instead of a server-side Map?

Considered and rejected. A signed payload (HMAC the `FoodImageAnalysis` JSON, return it to the client, have the client echo it back at phase 2) would avoid server-side state entirely — but:
1. It requires signing infrastructure (a secret, a signing/verification utility) that **does not exist anywhere in this API today**, for a codebase whose entire state-management style is "in-memory Map with lazy TTL expiry," used consistently three times already.
2. The `FoodImageAnalysis` payload includes ingredient lists, notes, and detected-components — round-tripping it through the client on every dietary submission is a larger request body for no functional benefit, since the server needs to parse and trust it anyway.
3. It does not actually solve the process-restart case any better than the Map does — a signed payload still requires the *client* to have it in hand, and if the app was killed mid-flow the client has already lost its state too (Section 8: `step` is deliberately not persisted).

**Final decision: in-memory `Map`, TTL 15 minutes, lazy expiry, `410`-then-automatic-fallback on miss.** This is Section 11's one chosen design — not left to Codex.

---

## SECTION 12 — REVENUECAT

### Packages

```bash
cd apps/mobile
npx expo install react-native-purchases react-native-purchases-ui expo-dev-client
```

`react-native-purchases` is not in Expo's bundled-modules list, but **V2 proved `^10.6.0` works on this exact SDK 55 / RN 0.83 combination.** Pin to `^10.6.0` to match the validated donor.

### Native rebuild — REQUIRED

`react-native-purchases` ships native code. Expo Go **cannot** run it. A development build is mandatory:

```bash
cd apps/mobile
npx expo prebuild --clean
npx expo run:ios
```

This is also why `expo-dev-client` is in the install list.

### Configuration

Port `revenueCatConfig.ts` verbatim. Env (append to `.env.example`; real values only in ignored `.env.local`):

```
EXPO_PUBLIC_REVENUECAT_TEST_KEY=
EXPO_PUBLIC_REVENUECAT_IOS_KEY=
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=
```

Boundary rules (already enforced by the ported code — do not weaken):
- `__DEV__` accepts **only** a `test_`-prefixed key.
- Release accepts **only** the matching platform key and **rejects** any `test_` key.
- Missing config → `{ status: 'unavailable' }`, never a silent fallback.

### Initialization

Call `initializeRevenueCat()` once from `App.tsx`, non-blocking, `.catch(() => undefined)`. Register the LogBox ignore at the same point:

```ts
LogBox.ignoreLogs(getRevenueCatDevelopmentLogBoxIgnores(__DEV__));
```

That returns `[]` in production and exactly **one** string in dev. **Do not** disable LogBox globally, suppress all RevenueCat logs, or override `console.error`.

### Package selection

Render **only** `getRevenueCatPaywallPlans(offering)` — annual and weekly, sorted annual-first, deduped, with an obsolete monthly package ignored rather than relabeled. Prices come from `pkg.product.priceString` and `pkg.product.pricePerWeekString`.

**Delete `getSubscriptionPricing()` usage from the V3 paywall.** `utils/purchaseAvailability.ts` currently hardcodes `$0.96 / week` and `$4.99 / week`; those strings must never render once RevenueCat is live. Keep the module only if something else imports it; otherwise mark it for Section 20 cleanup.

If `hasUsableRevenueCatOffering(offering) === false`: show an honest unavailable state. In `__DEV__` only, offer `Continue without subscribing` (the `DEV_BYPASS` transition). In production, no bypass exists — the button is not rendered.

### Outcomes

| Outcome | UI | State |
|---|---|---|
| `purchased` + entitlement active | — | → `complete` |
| `purchased` + entitlement **missing** | "We couldn't verify your subscription. Try Restore Purchases." | stay |
| `cancelled` | clear loading, **no dialog** | stay |
| `error` | recoverable dialog (Section 19) | stay |
| `restored` + entitled | — | → `complete` |
| `restored` + not entitled | "We couldn't find a subscription to restore." | stay |

### Bundle ID — RE-VERIFIED, PREVIOUS CLAIM WAS BACKWARDS

The prior draft asserted V3=`com.anonymous.okyo` vs V2=`org.name.Okyo` as a blocking mismatch. A direct re-audit of both worktrees' **configured** and **generated** state shows this framing was wrong, and the truth is the opposite of what it looked like at first glance:

| Source | V3 (`Okyo-1`) | V2 donor (`Okyo-onboarding-v2-20260801`) |
|---|---|---|
| `app.json` `ios.bundleIdentifier` (**configured, source of truth**) | `com.anonymous.okyo` | `org.name.Okyo` |
| `npx expo config --json` resolved `bundleIdentifier` (what a fresh `prebuild` will actually produce) | `com.anonymous.okyo` ✅ confirmed by running it | *(not re-run — V2 is read-only per the guard rules)* |
| **Stale, gitignored, on-disk `ios/Okyo.xcodeproj/project.pbxproj` `PRODUCT_BUNDLE_IDENTIFIER`** | `org.name.Okyo` ⚠️ **mismatches V3's own `app.json`** | `com.anonymous.okyo` ⚠️ **mismatches V2's own `app.json`** |

**The two worktrees' generated native `ios/` folders are swapped relative to their own `app.json` files.** Both `ios/` directories are listed in `.gitignore` (`/ios`, confirmed at `apps/mobile/.gitignore:40`) — they are untracked build artifacts, not source. `git log -p -- apps/mobile/app.json` shows V3's `bundleIdentifier` has been `com.anonymous.okyo` since the line was first added; it has never been anything else in this repo's history. The stale `ios/` folder is almost certainly a leftover from an earlier prebuild or an accidental cross-directory copy during the Aug 1 setup of the two parallel worktrees — it is not evidence of an intended identifier and **regenerates automatically and correctly** the moment `npx expo prebuild --clean` runs, because Expo's config plugins derive `PRODUCT_BUNDLE_IDENTIFIER` from `app.json`, not from whatever was there before.

**Conclusion: there is no bundle-ID conflict inside this repo.** V3's authoritative, intended, configured identifier is `com.anonymous.okyo` — matching what the founder reports as the identifier that previously loaded RevenueCat's default Test Store offering successfully. **Codex must not touch `ios.bundleIdentifier` at all.** Step 4 (Section 15) already said not to touch it for the wrong reason ("founder decision" pending reconciliation with V2); the corrected reason is: **it's already correct, and prebuild will re-derive the native project from it automatically** — touching it would be an unforced, unnecessary change to a value that was never actually in conflict.

One caveat found during the same audit: **neither worktree's real `.env` file has any `EXPO_PUBLIC_REVENUECAT_*` variable set** — V3's `.env` has only `EXPO_PUBLIC_OKYO_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; V2 has no `.env` file at all (only `.env.example`). So while the founder's account of a previously-working Test Store flow under `com.anonymous.okyo` is credible and is taken as given, **it is not verifiable from the current on-disk state of either repo** — the working configuration, if it existed, lived in an untracked `.env.local` or was tested in a different checkout. This isn't a blocker for Codex's work (Section 12's integration is built regardless of what the dashboard currently contains), but it is why the remaining item below stays a genuine external unknown rather than something this audit can close out.

### EXTERNAL BLOCKER (single, narrowed)

**Dashboard/App Store Connect product configuration for `com.anonymous.okyo`**

Target pricing is **$4.99/week** and **$49.99/year** (≈$0.96/week). These live in App Store Connect + RevenueCat, **not in code**, and this audit has no visibility into the current state of either dashboard.

- **Manual action:** in RevenueCat → Product catalog, confirm an app entry exists for `com.anonymous.okyo`, an entitlement exists (copy its exact identifier into `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`), both the weekly and annual products are attached to it, and both are in the **current** offering with package types `ANNUAL` and `WEEKLY`. Populate `EXPO_PUBLIC_REVENUECAT_TEST_KEY` (dev) / `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (release) in an untracked `.env.local`.
- **Codex can still complete:** the entire integration — Section 12's config, outcome handling, tests, and the honest-unavailable state all get built regardless. Nothing in this plan is blocked on the dashboard being correct today; only a *live purchase* is.
- **Codex must report:** the exact `okyo_revenuecat_offering` dev log output (package identifiers + localized prices, or the `unavailable`/`reason` state if no key is configured) so the founder can diff it against the intended catalog without guessing.
- **Verify after:** launch a dev build with a real `EXPO_PUBLIC_REVENUECAT_TEST_KEY` set, and confirm the paywall shows two cards whose prices match the dashboard exactly, with **no** hardcoded price string anywhere in the render path (Section 22 acceptance criterion 33).

---

## SECTION 13 — GLOBAL `#FBF1E5` MIGRATION

### Change these

| File | Token | From | To |
|---|---|---|---|
| `src/theme/okyoTheme.ts` | `colors.background` | `#FFF4E6` | **`#FBF1E5`** |
| `src/theme/okyoTheme.ts` | `colors.cream` | `#FFF4E6` | **`#FBF1E5`** |
| `src/theme/okyoTheme.ts` | `colors.stoneCream` | `#FFF4E6` | **`#FBF1E5`** |
| `src/theme/recipeTheme.ts` | `recipeColors.background` | `#FFF8F1` | **`#FBF1E5`** |
| `src/theme/recipeTheme.ts` | `recipeColors.cream` | `#FFF3E8` | **`#FBF1E5`** |

That is the whole migration. `colors.background` is already the single semantic canvas token, consumed in 61 places via `components/OkyoUI.tsx`'s re-export. `AppNavigator`, `MainTabs`, and every `ScreenContainer` already read it.

`recipeColors.background` is used in exactly 3 places (`RecipeDetailScreen:1054`, `ResultSummaryScreen:1324`, `:1328`) — all full-screen canvases, all should be cream.

### Do NOT change these

| Value | Why |
|---|---|
| `colors.card` `#FFFFFF` | Cards are intentional white material **above** the canvas. Depth depends on this contrast. |
| `recipeColors.card` `#FFFFFF` | Same. |
| **`#fffdf8` (24 occurrences)** | **Almost entirely a foreground color** — white-ish text and icon tint on coral/charcoal buttons (`color: '#fffdf8'`, `<Camera color="#fffdf8" />`). Migrating it would turn button labels cream on cream. Only two are `backgroundColor` (`AnalysisLoadingScreen:441`, `ShareCardPreviewScreen:901`) — audit those two individually; they are likely card surfaces and should stay. |
| `colors.creamDeep` `#F4E5CF`, `recipeColors.creamDeep` `#F0DFC8` | Deliberate darker cream for pressed/inset states. Needed for depth. |
| `colors.coralSoft`, `greenSoft`, `blueSoft`, `yellowSoft`, `orangeSoft` | Intentional tinted surfaces. |
| `rgba(255,255,255,0.62)` in `MainTabs:246` | Tab-bar material. |
| All `modeDisplay.ts` chip colors | Semantic mode tints. |
| All food photography | Content. |
| `android.adaptiveIcon.backgroundColor` `#E6F4FE` | Icon branding, not app canvas. |

### Verification

```bash
# should return ONLY the 5 lines changed above
grep -rnE "#FFF4E6|#FFF8F1|#FFF3E8" apps/mobile/src

# should return 0 — no raw canvas hex outside theme/
grep -rn "backgroundColor: '#FBF1E5'" apps/mobile/src | grep -v "theme/"
```

`onboarding-v3` code must reference `colors.background`, never the literal.

**Edge-blend note:** every extracted onboarding derivative sits on transparency over `#FBF1E5`, so edges blend by construction. The rejected comps (2, 6) had non-cream backgrounds precisely because they could not blend — one more reason they are rebuilt.

---

## SECTION 14 — DEPENDENCIES / NATIVE REBUILD

### Add

```bash
cd apps/mobile
npx expo install react-native-pager-view expo-image expo-splash-screen
npx expo install react-native-purchases react-native-purchases-ui expo-dev-client
```

| Package | Version | Why | Native? |
|---|---|---|---|
| `react-native-pager-view` | `8.0.0` (SDK-55 bundled) | The **only** way to get true native 1:1 finger-tracked horizontal paging. Fabric-ready. | yes |
| `expo-image` | `~55.0.11` | `prefetch()`, `cachePolicy`, better decode for eleven large PNGs. | yes |
| `expo-splash-screen` | `~55.0.23` | `preventAutoHideAsync` / `hideAsync` for a seamless native→React splash. | yes |
| `react-native-purchases` | `^10.6.0` | RevenueCat SDK. Version validated by V2 on this exact SDK. | yes |
| `react-native-purchases-ui` | `^10.6.0` | Optional templates; installed for parity with V2. | yes |
| `expo-dev-client` | `~55.0.37` | Required — the above cannot run in Expo Go. | yes |

### Already present — do not add

`react-native-reanimated@4.2.1`, `react-native-worklets@0.7.4`, `react-native-gesture-handler@~2.30.0`, `react-native-svg@^15.15.3` (graph lines), `@shopify/react-native-skia@2.4.18` (**not needed** — SVG is sufficient for the graph), `expo-blur`, `expo-image-picker`, `expo-image-manipulator`, `zustand`, `@react-native-async-storage/async-storage`, `pngjs` (transitive, used by the build-time transparency script only).

### Do NOT add

| Package | Why not |
|---|---|
| `expo-glass-effect` | V2 used it for a liquid-glass look V3's cream editorial design does not need. Adds a native module for nothing. |
| `expo-camera` | `expo-image-picker` already provides camera capture and is already wired. |
| Any test framework | Out of scope; the plan is designed around the existing `node --test` harness. |
| `lottie-react-native` | All motion in this plan is Reanimated or SVG. |
| Python / numpy / Pillow | Transparency script is Node + `pngjs`. |

### app.json changes

```jsonc
{
  "expo": {
    "scheme": "okyo",                              // ADD — deep links / RevenueCat
    "splash": {                                     // ADD
      "image": "./assets/onboarding-ex-transparent/kiko-head-mark.png",
      "resizeMode": "contain",
      "backgroundColor": "#FBF1E5"
    },
    "ios": {
      "bundleIdentifier": "com.anonymous.okyo"      // unchanged — Section 12 confirmed this is already correct
    },
    "plugins": [
      "expo-sharing", "expo-notifications", "expo-font",
      "expo-splash-screen",                         // ADD
      "expo-image-picker"                           // ADD — currently missing; permission strings
    ]
  }
}
```

> **Note:** `expo-image-picker` is used by the app but is **not** in `plugins`, so its iOS permission usage strings are not configured. Add it while prebuilding.

### Rebuild — REQUIRED

```bash
cd apps/mobile
npx expo prebuild --clean
npx expo run:ios
```

**Why:** `react-native-pager-view`, `expo-image`, `expo-splash-screen`, and `react-native-purchases` all ship native code. Metro-only reload is insufficient. Expo Go will not work after this change — development requires the dev client from here on. Tell the founder explicitly.

---

## SECTION 15 — CODEX IMPLEMENTATION ORDER

Execute strictly in order. Do not start step N+1 until step N's success criteria pass.

---

### Step 1 — Audit guard

- **Files:** none
- **Action:** verify `pwd`, `git branch --show-current`, `git status --short --branch`. If the directory is not `/Users/rober/Desktop/Okyo-1` or the branch is not `feature/onboarding-v3-bitepal-showcase`, **STOP and report**.
- **Success:** both match.
- **Tests:** none
- **Deps:** none
- **Do not touch:** anything, until this passes.

---

### Step 2 — Baseline capture

- **Action:** run and record `npm --prefix apps/mobile run typecheck`, `npm --prefix apps/mobile test`, `npm --prefix apps/api test`.
- **Success:** baseline counts recorded (expect 24 mobile test files, 30 API test files, typecheck clean).
- **Do not touch:** any source.

---

### Step 3 — Theme migration

- **Files:** `apps/mobile/src/theme/okyoTheme.ts`, `apps/mobile/src/theme/recipeTheme.ts`
- **Action:** apply exactly the 5 token changes in Section 13. Nothing else.
- **Success:** the two Section 13 greps return the expected results; typecheck clean; all tests still pass.
- **Tests:** add `src/theme/themeTokens.test.ts` asserting `colors.background === '#FBF1E5'` and `recipeColors.background === '#FBF1E5'`.
- **Deps:** step 2
- **Do not touch:** `colors.card`, any `#fffdf8`, any `*Soft` token, any `creamDeep`.

---

### Step 4 — Dependencies + native rebuild

- **Files:** `apps/mobile/package.json`, `apps/mobile/app.json`
- **Action:** install the six packages; apply the Section 14 `app.json` changes (`bundleIdentifier` stays `com.anonymous.okyo` — Section 12 confirmed it was never actually in conflict, so there is nothing to except-out); `npx expo prebuild --clean`; `npx expo run:ios`.
- **Success:** the app launches in the simulator on the dev client, unchanged behavior.
- **Tests:** existing suites still pass.
- **Deps:** step 3
- **Do not touch:** nothing further — `prebuild --clean` will correctly regenerate the previously-stale `ios/` project from `app.json`'s existing, already-correct `com.anonymous.okyo`.

---

### Step 5 — Port V2 foundation

- **Files (create):** `src/hooks/useAccessibilityPreferences.ts`, `src/services/revenueCat.ts`, `revenueCatConfig.ts`, `revenueCatLogBox.ts` + their 3 test files, `src/utils/revenueCatPaywall.ts` + test, `src/assets/kikoTransparentAssets.ts`, `assets/kiko-static/transparent-generated/*` (6 PNGs)
- **Files (modify):** `apps/mobile/.env.example` (append RevenueCat block), `apps/mobile/App.tsx` (init + LogBox ignore)
- **Action:** copy from the donor as-is. Wire `initializeRevenueCat()` and `LogBox.ignoreLogs(...)` in `App.tsx`.
- **Success:** typecheck clean; 5 new test files pass; app launches; dev log `okyo_revenuecat_initialized` or a clean `unavailable` state.
- **Tests:** the ported RevenueCat tests.
- **Deps:** step 4
- **Do not touch:** `WelcomeScreen`, `OnboardingUI`, anything under `src/screens/`.

---

### Step 6 — API: dish-first product contract

- **Files (modify):** `apps/api/src/services/aiService.ts`, `apps/api/src/services/openRouterProvider.ts`, `apps/api/src/server.ts`, `apps/mobile/src/api/types.ts`
- **Files (create):** `apps/api/src/services/dishFirstProduct.test.ts`
- **Action:** apply **only** the Section 9 "selectively merge" hunks. Never overwrite a V3 file with the V2 version.
- **Success:** all 30 existing API tests pass **unmodified**; the new dish-first test passes; a request with no preferences produces a byte-identical prompt to before.
- **Tests:** `dishFirstProduct.test.ts` + extend `openRouterProvider.recipe.test.ts` for `skipCache` when preferences exist.
- **Deps:** step 5
- **Do not touch:** correction pipeline, Epicure, cost controls, rate limiting.

---

### Step 7 — API: two-phase scan

- **Files (modify):** `apps/api/src/services/aiService.ts` (extract `buildScanResultFromAnalysis`), `apps/api/src/store.ts` (analysis map + TTL), `apps/api/src/server.ts` (2 endpoints)
- **Files (modify):** `apps/mobile/src/api/client.ts` (`analyzeScan`, `generateRecipeFromAnalysis`), `apps/mobile/src/api/types.ts`
- **Action:** implement Section 11.
- **Success:** `POST /v1/scans` behavior **unchanged** — all existing API tests pass with zero edits. New endpoints work. `410` on an expired analysis.
- **Tests:** `aiService.twoPhase.test.ts` — extraction preserves behavior; analysis TTL expiry; preferences reach the prompt; `raw_ingredients` rejected at phase 1 with **no** recipe call.
- **Deps:** step 6
- **Do not touch:** `/v1/scans` request/response shape.

---

### Step 8 — Transparency script + derivatives

- **Files (create):** `apps/mobile/scripts/derive-onboarding-transparency.mjs`, `apps/mobile/assets/onboarding-ex-transparent/*`
- **Action:** implement the Section 5 algorithm in Node + `pngjs`. Run it. **Visually inspect every output** against the Section 5 preservation list.
- **Success:** every derivative has true zero-alpha corners, no cream halo, no clipped fur, no erased pale interior. Source resolution preserved. Originals byte-identical (`git status` shows no modification under `assets/onboarding ex/`).
- **Tests:** `scripts/derive-onboarding-transparency.test.ts` — the alpha math on a synthetic image (known bg + known object → expected alpha ramp + decontaminated color).
- **Deps:** step 4
- **Do not touch:** anything in `assets/onboarding ex/`.

---

### Step 9 — V3 controller (pure)

- **Files (create):** `src/onboarding-v3/controller/onboardingV3Machine.ts` + `.test.ts`, `state/mascotName.ts` + `.test.ts`, `state/attribution.ts`, `state/dietary.ts`, `state/onboardingV3Persistence.ts` + `.test.ts`
- **Action:** implement the Section 8 table as a pure reducer. No React, no RN, no async in the reducer.
- **Success:** **every row of the Section 8 table has a passing test.** Unhandled `(state, event)` pairs are no-ops.
- **Tests:** the three new `.test.ts` files.
- **Deps:** step 3
- **Do not touch:** `WelcomeScreen`, `OnboardingUI`, `onboardingPersistence.ts`.

---

### Step 10 — Motion + shared components

- **Files (create):** `motion/motionTokens.ts`, `motion/useReduceMotion.ts`, `motion/useSettleAnimation.ts`, `components/OnboardingCTA.tsx`, `OnboardingBackButton.tsx`, `LoadingOverlay.tsx`, `PageScaffold.tsx`, `AnimatedArtwork.tsx`, `assets/onboardingV3Assets.ts`
- **Action:** encode every Section 6 duration/easing as a token. Every animated component reads `useReduceMotion()`.
- **Success:** no magic numbers in any animation; a grep for `setInterval|setTimeout` in `onboarding-v3/` returns nothing except the splash minimum-duration timer.
- **Tests:** `motionTokens.test.ts` asserting the Section 6 values.
- **Deps:** steps 5, 9

---

### Step 11 — Splash

- **Files (create):** `screens/SplashScreen.tsx`
- **Files (modify):** `App.tsx` (`preventAutoHideAsync`)
- **Success:** no white or double flash between native and React splash; total presence 700–1100ms; Reduce Motion shows a static mark.
- **Deps:** steps 8, 10

---

### Step 12 — Showcase pager

- **Files (create):** `showcase/ShowcasePager.tsx`, `showcasePages.ts` + `.test.ts`, `PagerDots.tsx`
- **Success:** exactly 9 pages in the Section 4 order; the Section 6 grep proof passes; swipe and buttons produce identical results; mid-drag is a clean seam with no crossfade.
- **Tests:** `showcasePages.test.ts` — exactly 9, correct order, correct asset per index.
- **Deps:** step 10
- **Do not touch:** the top-level machine — `showcasePage` stays local.

---

### Step 13 — Nine showcase pages

- **Files (create):** the 9 files under `showcase/pages/`
- **Action:** build each per Section 4. **Every rejected/rebuilt string from Section 4 must be honored.**
- **Success:** renders correctly on iPhone SE, 15, and 15 Pro Max; no hardcoded pixel positions; no forbidden copy anywhere.
- **Tests:** `onboardingV3Copy.test.ts` — source-scans the 9 page files and **fails** on `Cook with what you have`, `I already have an account`, `$84`, `$6.20`, `$17.80`, `$11.60`, `See what a scan includes`, `kcal` in a chip context.
- **Deps:** steps 8, 12

---

### Step 14 — Name the fox + mascotName propagation

- **Files (create):** `screens/NameFoxScreen.tsx`, `src/state/useMascotName.ts`
- **Files (modify):** the 4 user-facing string sites (Section 21)
- **Success:** default `Kiko`; trims; blank→`Kiko`; 20-char cap; real keyboard; persists across restart; custom name appears in main-app copy.
- **Tests:** `mascotName.test.ts` + `mascotNamePropagation.test.ts` (source-scan asserting the sites use the template form and that asset/component identifiers are untouched).
- **Deps:** steps 9, 12

---

### Step 15 — Real scan handoff

- **Files (create):** `screens/ScanInputScreen.tsx`, `PhotoConfirmScreen.tsx`, `AnalyzingScreen.tsx`
- **Success:** all three input paths work; permission denial is recoverable and non-blocking; `raw_ingredients` shows the honest message; cancel aborts the request.
- **Tests:** `onboardingV3ScanHandoff.test.ts` — controller-level, mocked client.
- **Deps:** steps 7, 9, 14

---

### Step 16 — Dietary

- **Files (create):** `screens/DietaryScreen.tsx`
- **Success:** `Continue` always enabled and deterministic; empty selection valid; selections reach `POST …/recipe`.
- **Tests:** `dietary.test.ts` — serialization; `Continue` with an empty selection transitions.
- **Deps:** steps 9, 15

---

### Step 17 — Recipe preview

- **Files (create):** `screens/OnboardingRecipePreview.tsx`
- **Success:** real canonical recipe rendered; `Continue` → `paywall` with no gate; **no** Quick Check / "Does this look right?" / "Yes, looks good" anywhere.
- **Tests:** `onboardingV3RecipeGate.test.ts` — source-scan failing on those three strings and on `hasAcceptedOnboardingRecipe`.
- **Deps:** steps 7, 16

---

### Step 18 — Guided cooking (optional path)

- **Files (create):** `screens/OnboardingCookingScreen.tsx`, `CookingCompleteScreen.tsx`
- **Success:** cooking is skippable; completion fires an **explicit** `COOKING_COMPLETED`; onboarding never enters `MainTabs`.
- **Tests:** `onboardingV3Cooking.test.ts` — skip → `paywall`; complete → `cookingComplete` → `paywall`.
- **Deps:** steps 9, 17
- **Do not touch:** `RecipeDetailScreen.tsx`, `MainTabs.tsx`.

---

### Step 19 — Paywall + completion

- **Files (create):** `screens/OnboardingPaywallScreen.tsx`
- **Files (modify):** `useOnboardingV3Controller.ts` (the single `complete` effect)
- **Success:** only real RevenueCat packages render; cancel is quiet; failure is recoverable; entitlement is required; `completeOnboarding()` fires exactly once from exactly one place.
- **Tests:** `onboardingV3Completion.test.ts` — completion fires once; not-entitled stays; cancel stays; dev bypass is `__DEV__`-only.
- **Deps:** steps 5, 9, 18

---

### Step 20 — Mount V3 + dev reset

- **Files (modify):** `src/navigation/AppNavigator.tsx` (mount `OnboardingV3` at the `WelcomeScreen` route), `src/screens/SettingsScreen.tsx` (extend reset)
- **Action:** swap the component only. **Leave `WelcomeScreen.tsx` on disk** — it is deleted in Section 20 cleanup after manual approval.
- **Success:** a fresh install lands on the V3 splash; `Reset Onboarding` clears completion + mascotName + attribution + dietary and **preserves** recipes/saved/grocery/XP.
- **Tests:** `onboardingV3Reset.test.ts` — asserts exactly which keys are cleared and which survive.
- **Deps:** step 19

---

### Step 21 — Full verification

- **Action:** `typecheck`, mobile tests, API tests, `git diff --check`.
- **Success:** all green; the mobile test-file count has grown by ~14; the API count by ~2.
- **Deps:** step 20

---

### Step 22 — Manual preparation

- **Action:** build for iPhone SE, iPhone 15, iPhone 15 Pro Max. Produce the Section 17 checklist with pass/fail. Capture the `okyo_revenuecat_offering` log for the founder.
- **Success:** the report is complete and honest — failures are stated, not glossed.
- **Deps:** step 21
- **Do not:** commit.

---

## SECTION 16 — AUTOMATED TEST MATRIX

Harness: `node --test src/**/*.test.ts` via `tsx`. **`.ts` only — components cannot be rendered.** Tests are therefore controller-, logic-, and source-scan-based. This is a real constraint, not a shortcut.

### Controller / transitions — `controller/onboardingV3Machine.test.ts`

Every row of Section 8, plus:

| Test | Assertion |
|---|---|
| initial state | `step === 'splash'`, `mascotName === 'Kiko'` |
| splash guard | `SPLASH_FINISHED` before 700ms is a no-op |
| showcase next ×9 | 9 `SHOWCASE_NEXT` from page 0 ends at `nameFox` |
| showcase back ×9 | back from page 8 walks to page 0 and stops |
| back at page 0 | no-op, stays `showcase` |
| nameFox back | → `showcase`, `pager.setPage(8)` requested |
| no showcase page is a step | `OnboardingV3Step` union contains no `showcase2..10` |
| dietary empty continue | transitions to `recipe` |
| recipe continue | `recipeId !== null` → `paywall`; `null` → no-op |
| **no cooking requirement** | `recipe --CONTINUE--> paywall` without ever entering `cooking` |
| cooking exit | → `paywall` |
| purchase not entitled | stays `paywall` |
| purchase cancelled | stays `paywall`, no error set |
| dev bypass | `__DEV__` only |
| unhandled events | every unlisted pair returns an identical state object |
| **exhaustiveness** | every `OnboardingV3Step` value appears as a `Next` in ≥1 row, and every non-terminal step has ≥1 outgoing transition — **no unreachable and no dead-end states** |

### Mascot name — `state/mascotName.test.ts`

| Test | Assertion |
|---|---|
| default | `sanitizeMascotName(undefined) === 'Kiko'` |
| replace | `sanitizeMascotName('Momo') === 'Momo'` |
| trim | `sanitizeMascotName('  Momo  ') === 'Momo'` |
| blank | `sanitizeMascotName('   ') === 'Kiko'` |
| empty | `sanitizeMascotName('') === 'Kiko'` |
| max length | 30 chars → 20 |
| unicode | emoji/accents survive trimming |

### Persistence — `state/onboardingV3Persistence.test.ts`

Against an in-memory storage fake: write→read round-trip for name/attribution/dietary; **persists across a simulated restart** (new instance, same fake); reset clears exactly the 5 onboarding keys and leaves `recipesById` / `savedRecipeIds` / `xp` untouched; a storage throw is swallowed and does not reject.

### Mascot propagation — `utils/mascotNamePropagation.test.ts`

Source-scan:
- The user-facing sites use `${mascotName}` / `mascotName`, not the literal `Kiko`.
- `src/assets/kikoAssets.ts`, `components/KikoMascot.tsx`, `assets/kiko-static/*`, and every analytics event id **still contain the literal `Kiko`/`kiko`** — identifiers must not be dynamic.
- `analytics/track.ts` contains no template interpolation of a mascot name.

### Showcase — `showcase/showcasePages.test.ts`

Exactly 9 entries; order is `hero, scan, recipeOutput, customize, attribution, savings, approach, value, meetKiko`; each maps to the expected derivative asset; the array is frozen; **no entry references `onboarding2.png` or `onboarding6.png` as a full-page source**.

### Copy contract — `utils/onboardingV3Copy.test.ts`

Source-scan of `src/onboarding-v3/**` failing on any of:
`Cook with what you have`, `I already have an account`, `$84`, `$6.20`, `$17.80`, `$11.60`, `See what a scan includes`, `Quick Check`, `Does this look right`, `Yes, looks good`, `hasAcceptedOnboardingRecipe`, `pantry`, `fridge`, `leftovers`, `what you have`.

### Product integrity — extend `utils/productIntegrityRegression.test.ts`

No ingredient-first phrasing anywhere in `src/`; the rejection string `Scan a prepared dish you'd like to recreate.` exists in both the API and the mobile failure copy.

### Theme — `theme/themeTokens.test.ts`

`colors.background === '#FBF1E5'`; `recipeColors.background === '#FBF1E5'`; `colors.card === '#FFFFFF'` (unchanged); a source-scan asserting no `#FFF4E6` / `#FFF8F1` remains.

### Motion — `motion/motionTokens.test.ts`

Every Section 6 duration/easing is exported and matches; a source-scan asserting no `setInterval` in `onboarding-v3/`.

### Reduce Motion — `motion/reduceMotion.test.ts`

Source-scan: every file containing `withRepeat` also imports `useReduceMotion`.

### RevenueCat — ported + extended

`revenueCatConfig.test.ts` (dev accepts only `test_`; release rejects `test_`; missing config fails closed), `revenueCatPaywall.test.ts` (annual-first ordering; monthly ignored; empty offering → `[]`; pricing from the product, never hardcoded), `revenueCatRegression.test.ts`, `revenueCatFailureHandling.test.ts`, plus new `onboardingV3Completion.test.ts`.

### Asset pipeline — `scripts/derive-onboarding-transparency.test.ts`

Synthetic image with a known background and a known object: corners reach `alpha 0`; the object core stays `alpha 255` and **byte-identical RGB**; the edge ramp is monotonic; decontamination removes the background contribution; an enclosed pale region (simulating Kiko's belly) is **not** erased.

### API — new

`aiService.twoPhase.test.ts` (extraction preserves behavior; TTL expiry → 410; preferences reach the prompt; `raw_ingredients` rejected before any recipe call), `dishFirstProduct.test.ts` (ported), extended `openRouterProvider.recipe.test.ts` (**`skipCache` when preferences exist** — safety-critical).

### Expected counts

| Suite | Before | After |
|---|---|---|
| Mobile test files | 24 | ~38 |
| API test files | 30 | ~32 |

---

## SECTION 17 — MANUAL TEST MATRIX

Devices: **iPhone SE (3rd gen)** 375×667, **iPhone 15** 393×852, **iPhone 15 Pro Max** 430×932.

| # | Scenario | Expected |
|---|---|---|
| 1 | Fresh install, cold launch | Native splash → React splash, no white flash, no double status bar; wiggle visible; hands off by ~1.1s |
| 2 | Splash → hero | Lands on showcase page 0; dots show 1 of 9 |
| 3 | Swipe forward through all 9 | Pure horizontal translation; clean seam mid-drag; **no** crossfade/scale/blur; dots track |
| 4 | Button `Next` through all 9 | Identical result to swiping |
| 5 | Back on every page | Page 8→0 one at a time; page 0 has no chevron |
| 6 | Mid-drag hold | Outgoing page visible left, incoming right, both tracking the finger 1:1 |
| 7 | Page-settle animations | Fire on settle only, **never during the drag** |
| 8 | Page 2 scan sweep | Runs continuously, smooth, no jank while swiping away |
| 9 | Page 5 attribution | All 6 rows tappable; selection animates; auto-advance; `Skip` works |
| 10 | Page 6 graph | Lines draw left→right; footnote follows; **no `$84` anywhere** |
| 11 | Page 8 Meet Kiko | Approved pose; doodles stagger; subtle idle; no bounce |
| 12 | Page 8 `Next` | → Name the fox |
| 13 | Name fox back | → showcase page **8** (not 0) |
| 14 | Name fox default | Field shows `Kiko`; real iOS keyboard; no fake keyboard image |
| 15 | Name fox blank | Clear the field, `Next` → name is `Kiko` |
| 16 | Name fox whitespace | `"  Momo  "` → `Momo` |
| 17 | Name fox long | 30 chars → capped at 20 |
| 18 | Name fox keyboard | Content lifts; `Next` reachable; `done` submits |
| 19 | Custom name in app | After onboarding, "Momo is studying your food" etc. |
| 20 | Real photo scan | Camera → confirm → analyzing → dietary → recipe |
| 21 | Choose photo | Library → confirm → same path |
| 22 | Describe dish | Text → analyzing → dietary → recipe |
| 23 | **Ingredient-only photo** | **"Scan a prepared dish you'd like to recreate."** — recoverable; **no recipe generated** |
| 24 | Non-food photo | Honest failure, recoverable |
| 25 | Scan failure (airplane mode) | Friendly message, `Try again`, returns to input |
| 26 | Cancel during analyzing | Back aborts; returns to input |
| 27 | Dietary — allergies | Selections visibly reflected in the generated recipe |
| 28 | Dietary — empty | `Continue` works; recipe generated |
| 29 | Dietary back | → input (analysis discarded) |
| 30 | Recipe content | Real photo, real name, ingredients, steps, time, servings |
| 31 | Recipe edit | Edit works and updates the canonical recipe |
| 32 | **Recipe `Continue`** | **→ paywall directly. No confirmation gate.** |
| 33 | **Skip cooking** | Never forced; `Continue` alone reaches the paywall |
| 34 | Guided cooking | Steps work; completion → cookingComplete → paywall |
| 35 | Exit cooking mid-way | → paywall |
| 36 | Paywall packages | Two cards from RevenueCat; prices match the dashboard; **no hardcoded price** |
| 37 | Cancel purchase | Returns to paywall; loading cleared; **no error, no red screen** |
| 38 | **Failed purchase (Test Store)** | Recoverable Okyo dialog with `Try Again` / `Not Now`; **no LogBox red screen** |
| 39 | Purchase success | Entitlement active → MainTabs, exactly once |
| 40 | Restore with subscription | → MainTabs |
| 41 | Restore without | "We couldn't find a subscription to restore."; stays |
| 42 | App relaunch after completion | Goes straight to MainTabs; onboarding never reappears |
| 43 | App relaunch mid-onboarding | Restarts at splash; **name/attribution/dietary are preserved** |
| 44 | **Reduce Motion ON** | No wiggle, no idle, no float, no scan loop, no stagger; **pager still fully functional** |
| 45 | Reduce Motion toggled live | Loops stop without a remount |
| 46 | iPhone SE | No clipping; CTAs reachable; text not truncated |
| 47 | iPhone 15 Pro Max | No stretched art; no letterbox bands; composition holds |
| 48 | Dynamic Type XXL | Headlines wrap; CTAs stay reachable; nothing overlaps |
| 49 | VoiceOver | Every control announced with role + label; decorative art skipped |
| 50 | Dev reset | Onboarding replays; **saved recipes, grocery list, and XP survive** |

---

## SECTION 18 — OBSERVABILITY

All logs are `__DEV__`-only via `utils/onboardingV3Log.ts`, structured, and **contain no image bytes, no base64, no API keys, no personal data**.

| Event | Payload |
|---|---|
| `onboarding_v3_transition` | `{ from, to, event }` |
| `onboarding_v3_unhandled_event` | `{ step, event }` ← should never appear in a healthy run |
| `onboarding_v3_showcase_page` | `{ page, source: 'swipe' \| 'button' }` |
| `onboarding_v3_attribution` | `{ source \| null }` |
| `onboarding_v3_mascot_named` | `{ length, isDefault }` ← **length only, never the name** |
| `onboarding_v3_analyze_request` | `{ source, hasImage, hasDescription }` ← **never the dataUrl** |
| `onboarding_v3_analyze_result` | `{ analysisId, inputKind, scanState, confidence, ms }` |
| `onboarding_v3_analyze_rejected` | `{ rejectionType, ms }` |
| `onboarding_v3_dietary_applied` | `{ restrictionCount, dislikeCount }` ← **counts only, never the values** |
| `onboarding_v3_recipe_request` | `{ analysisId, hasPreferences }` |
| `onboarding_v3_recipe_committed` | `{ recipeId, ms, usedFallbackPath }` |
| `onboarding_v3_recipe_failed` | `{ reason, ms }` |
| `onboarding_v3_cooking` | `{ action: 'started' \| 'completed' \| 'exited' }` |
| `onboarding_v3_purchase_state` | `{ status, isEntitled, packageIdentifier }` ← **never `CustomerInfo`** |
| `onboarding_v3_completed` | `{ path: 'purchase' \| 'restore' \| 'dev_bypass' }` |
| `okyo_revenuecat_offering` | ported from V2 — package identifiers + localized prices |

Analytics: reuse `analytics/track.ts`. **Analytics is never awaited and never a dependency of a transition.** A failure is swallowed. Event identifiers stay static and must never interpolate `mascotName`.

---

## SECTION 19 — FAILURE / RECOVERY DESIGN

| Failure | Detection | User sees | Recovery | Onboarding blocked? |
|---|---|---|---|---|
| Fonts fail to load | `useFonts` never resolves | Splash for the full 1100ms cap, then the hero | Proceeds with system fonts | No |
| Store hydration fails | AsyncStorage throws | Nothing | Defaults used; logged | No |
| Art derivative missing | `require` fails at build | Metro error at build time | Codex fixes before shipping | Build fails (correct) |
| Attribution persist fails | AsyncStorage throws | Nothing | Swallowed + logged; **never awaited** | No |
| Mascot name persist fails | AsyncStorage throws | Nothing | In-memory name still used this session | No |
| Camera permission denied | `expo-image-picker` result | Inline message + Settings link | Choose Photo / Describe Dish remain | No |
| Library permission denied | same | same | Take a Photo / Describe Dish remain | No |
| Image too large | 413 from API | "This photo was too large to scan. Try a smaller image." | `Try another photo` | No |
| **Raw ingredients** | `inputKind === 'raw_ingredients'` | **"Scan a prepared dish you'd like to recreate."** | `Try another photo` | No |
| Not food | `scanState === 'not_food'` | Existing `scanFailureCopy` | `Try again` | No |
| Too unclear | `scanState === 'too_unclear'` | Existing copy | `Try again` | No |
| Analyze network failure | fetch rejects / aborts | "Okyo had trouble reading this photo. Try again in a second." | `Try again` (photo retained) | No |
| Analyze timeout | `AbortController` | same | same | No |
| Daily AI cap | 429 | "Okyo has reached its daily scan limit. Try again tomorrow." | `Not now` → paywall path still reachable | No |
| Analysis expired | 410 | Nothing — invisible | Auto-fallback to a single `/v1/scans` **with** preferences | No |
| Recipe generation fails | 502/`RECIPE_GENERATION_FAILED` | "Okyo couldn't finish this recipe. Try again." | `Try again` (phase 2 only, cached `analysisId`) / `Start over` | No |
| Recipe returns unusable | `isUsableCanonicalRecipe` false | Same as above | Same | No |
| RevenueCat not configured | `status: 'unavailable'` | Honest unavailable state | `__DEV__`: `Continue without subscribing`. Production: contact support | Production: yes (correct) |
| RevenueCat init error | `status: 'error'` | "We couldn't reach the store." | `Try again` + `Restore Purchases` | Yes until resolved |
| Empty offering | `hasUsableRevenueCatOffering` false | "Subscriptions aren't available right now." | `Try again` / `Restore` | Yes (dashboard misconfig) |
| **Purchase cancelled** | `userCancelled` | **Nothing — silent** | Stays on paywall, loading cleared | No |
| **Purchase failed** | `status: 'error'` | **Dialog: "Payment didn't go through"** — declined card / connection issue / store issue / verification issue. Buttons `Try Again`, `Not Now` | Retry or stay | No |
| Purchased but not entitled | entitlement absent | "We couldn't verify your subscription. Try Restore Purchases." | `Restore` | Yes until resolved |
| Restore finds nothing | `isEntitled === false` | "We couldn't find a subscription to restore." | Stays | No |
| **Test Store simulated failure log** | exact known string | **The user-facing failure dialog — never a red LogBox** | Dev-only, single-string `LogBox.ignoreLogs` | No |
| App backgrounded mid-flow | app state change | On return: splash | Data preserved; step restarts | No |
| App killed mid-flow | cold start | Splash | Name/attribution/dietary preserved | No |

**Universal rule:** no failure in this table ever produces a red screen, a raw provider error string, a dead end, or a state the user cannot leave.

---

## SECTION 20 — CLEANUP PLAN (AFTER MANUAL APPROVAL ONLY)

**Codex must not delete any of this during the initial implementation.** V2 stays on disk as a fallback until the founder has manually validated V3 on a device.

### Phase 1 — after V3 passes the Section 17 matrix

| Path | Action | Precondition |
|---|---|---|
| `src/screens/WelcomeScreen.tsx` (1323 lines) | delete | `AppNavigator` no longer imports it; `WelcomeScreen` removed from `RootStackParamList` |
| `src/components/onboarding/OnboardingUI.tsx` (2013 lines) | delete | no importers outside itself |
| `src/utils/onboardingScanGuards.ts` + `.test.ts` | delete | V3 does not use them |
| `src/utils/onboardingScanLoadingWiring.test.ts` | delete | asserts V2 wiring |
| `src/utils/onboardingEmojiRegression.test.ts` | delete | asserts V2 copy |
| `src/utils/scanScreenNavigationGuard.test.ts` | **review** — may still guard the main-app scan path | |

### Phase 2 — after two weeks of stable use

| Path | Action |
|---|---|
| `src/utils/purchaseAvailability.ts` + `.test.ts` | delete once RevenueCat is the only purchase source and nothing imports it |
| `useOkyoStore`: `firstOnboardingScanCompleted`, `firstOnboardingResultSeen`, `paywallShown`, `hasSeenOnboarding` | remove from the interface **and** `partialize`, with a `version: 4` migration dropping them |
| `assets/onboarding ex/` originals | **keep** — they are the design source of truth; never delete |

### Never delete

`assets/onboarding ex/*` · `assets/kiko-static/*` · `state/canonicalRecipes.ts` · `utils/scanController.ts` · `utils/guidedCooking*.ts` · `state/activeCooking.ts` · `screens/ResultSummaryScreen.tsx` · `screens/RecipeDetailScreen.tsx` (both are live main-app surfaces).

---

## SECTION 21 — FILE-BY-FILE EXECUTION MANIFEST

Paths relative to `/Users/rober/Desktop/Okyo-1`.

### CREATE — mobile, onboarding-v3 (34 files)

```
apps/mobile/src/onboarding-v3/OnboardingV3.tsx
apps/mobile/src/onboarding-v3/controller/onboardingV3Machine.ts
apps/mobile/src/onboarding-v3/controller/onboardingV3Machine.test.ts
apps/mobile/src/onboarding-v3/controller/useOnboardingV3Controller.ts
apps/mobile/src/onboarding-v3/state/mascotName.ts
apps/mobile/src/onboarding-v3/state/mascotName.test.ts
apps/mobile/src/onboarding-v3/state/onboardingV3Persistence.ts
apps/mobile/src/onboarding-v3/state/onboardingV3Persistence.test.ts
apps/mobile/src/onboarding-v3/state/attribution.ts
apps/mobile/src/onboarding-v3/state/dietary.ts
apps/mobile/src/onboarding-v3/state/dietary.test.ts
apps/mobile/src/onboarding-v3/showcase/ShowcasePager.tsx
apps/mobile/src/onboarding-v3/showcase/showcasePages.ts
apps/mobile/src/onboarding-v3/showcase/showcasePages.test.ts
apps/mobile/src/onboarding-v3/showcase/PagerDots.tsx
apps/mobile/src/onboarding-v3/showcase/pages/HeroPage.tsx
apps/mobile/src/onboarding-v3/showcase/pages/ScanPage.tsx
apps/mobile/src/onboarding-v3/showcase/pages/RecipeOutputPage.tsx
apps/mobile/src/onboarding-v3/showcase/pages/CustomizePage.tsx
apps/mobile/src/onboarding-v3/showcase/pages/AttributionPage.tsx
apps/mobile/src/onboarding-v3/showcase/pages/SavingsPage.tsx
apps/mobile/src/onboarding-v3/showcase/pages/ApproachPage.tsx
apps/mobile/src/onboarding-v3/showcase/pages/ValuePage.tsx
apps/mobile/src/onboarding-v3/showcase/pages/MeetKikoPage.tsx
apps/mobile/src/onboarding-v3/screens/SplashScreen.tsx
apps/mobile/src/onboarding-v3/screens/NameFoxScreen.tsx
apps/mobile/src/onboarding-v3/screens/ScanInputScreen.tsx
apps/mobile/src/onboarding-v3/screens/PhotoConfirmScreen.tsx
apps/mobile/src/onboarding-v3/screens/AnalyzingScreen.tsx
apps/mobile/src/onboarding-v3/screens/DietaryScreen.tsx
apps/mobile/src/onboarding-v3/screens/OnboardingRecipePreview.tsx
apps/mobile/src/onboarding-v3/screens/OnboardingCookingScreen.tsx
apps/mobile/src/onboarding-v3/screens/CookingCompleteScreen.tsx
apps/mobile/src/onboarding-v3/screens/OnboardingPaywallScreen.tsx
```

### CREATE — mobile, shared (13 files)

```
apps/mobile/src/onboarding-v3/components/OnboardingCTA.tsx
apps/mobile/src/onboarding-v3/components/OnboardingBackButton.tsx
apps/mobile/src/onboarding-v3/components/LoadingOverlay.tsx
apps/mobile/src/onboarding-v3/components/PageScaffold.tsx
apps/mobile/src/onboarding-v3/components/AnimatedArtwork.tsx
apps/mobile/src/onboarding-v3/motion/motionTokens.ts
apps/mobile/src/onboarding-v3/motion/motionTokens.test.ts
apps/mobile/src/onboarding-v3/motion/useReduceMotion.ts
apps/mobile/src/onboarding-v3/motion/useSettleAnimation.ts
apps/mobile/src/onboarding-v3/motion/reduceMotion.test.ts
apps/mobile/src/onboarding-v3/assets/onboardingV3Assets.ts
apps/mobile/src/onboarding-v3/utils/onboardingV3Log.ts
apps/mobile/src/state/useMascotName.ts
```

### CREATE — tests + scripts (10 files)

```
apps/mobile/src/theme/themeTokens.test.ts
apps/mobile/src/utils/onboardingV3Copy.test.ts
apps/mobile/src/utils/mascotNamePropagation.test.ts
apps/mobile/src/utils/onboardingV3ScanHandoff.test.ts
apps/mobile/src/utils/onboardingV3RecipeGate.test.ts
apps/mobile/src/utils/onboardingV3Cooking.test.ts
apps/mobile/src/utils/onboardingV3Completion.test.ts
apps/mobile/src/utils/onboardingV3Reset.test.ts
apps/mobile/scripts/derive-onboarding-transparency.mjs
apps/mobile/scripts/derive-onboarding-transparency.test.ts
```

### COPY FROM V2 — read-only donor (12 entries)

```
apps/mobile/src/hooks/useAccessibilityPreferences.ts
apps/mobile/src/services/revenueCat.ts
apps/mobile/src/services/revenueCatConfig.ts
apps/mobile/src/services/revenueCatConfig.test.ts
apps/mobile/src/services/revenueCatLogBox.ts
apps/mobile/src/services/revenueCatRegression.test.ts
apps/mobile/src/services/revenueCatFailureHandling.test.ts
apps/mobile/src/utils/revenueCatPaywall.ts
apps/mobile/src/utils/revenueCatPaywall.test.ts
apps/mobile/src/assets/kikoTransparentAssets.ts
apps/mobile/assets/kiko-static/transparent-generated/   (6 PNGs + README)
apps/api/src/services/dishFirstProduct.test.ts
```

### MODIFY — mobile (10 files)

```
apps/mobile/App.tsx                            splash guard, RevenueCat init, LogBox ignore
apps/mobile/app.json                           scheme, splash, +2 plugins  (NOT bundleIdentifier)
apps/mobile/package.json                       +6 dependencies
apps/mobile/.env.example                       +4 RevenueCat vars
apps/mobile/src/theme/okyoTheme.ts             3 tokens → #FBF1E5
apps/mobile/src/theme/recipeTheme.ts           2 tokens → #FBF1E5
apps/mobile/src/navigation/AppNavigator.tsx    mount OnboardingV3 at the WelcomeScreen route
apps/mobile/src/screens/SettingsScreen.tsx     extend dev reset
apps/mobile/src/api/client.ts                  +analyzeScan, +generateRecipeFromAnalysis
apps/mobile/src/api/types.ts                   +preference fields, +2 phase types
```

### MODIFY — mascotName sites (4 files, string-only edits)

```
apps/mobile/src/utils/recipeCorrection.ts:12            "Tell Kiko what's different first."
apps/mobile/src/utils/scanFailureCopy.ts:66             "Kiko couldn't build/read that one"
apps/mobile/src/screens/AnalysisLoadingScreen.tsx:375   "Kiko is building/studying…"
apps/mobile/src/screens/KitchenLetterScreen.tsx:57      "Weekly meal ideas from Kiko"
```

> `src/components/onboarding/OnboardingUI.tsx:57` also contains a `Kiko` string but that file is deleted in cleanup — skip it.
>
> `src/assets/kikoAssets.ts`, `components/KikoMascot.tsx`, `assets/kiko-static/*`, and every analytics identifier keep the literal `Kiko`/`kiko`. **Internal identity never becomes dynamic.**

### MODIFY — API (4 files)

```
apps/api/src/server.ts                        preference schema + getScanPreferencesFromBody + 2 new endpoints
apps/api/src/services/aiService.ts            inputKind, preferences, ingredients_only gate,
                                              extract buildScanResultFromAnalysis, pipeline v4
apps/api/src/services/openRouterProvider.ts   inputKind, dish-first prompts, preferences section, skipCache
apps/api/src/store.ts                         analysis map + 15-min TTL
```

### CREATE — API tests (1 file)

```
apps/api/src/services/aiService.twoPhase.test.ts
```

### GENERATE DERIVATIVE (≈27 files)

```
apps/mobile/assets/onboarding-ex-transparent/
  kiko-head-mark.png
  o2-pasta-bowl.png
  o3-grain-bowl.png
  o4-chicken-bowl.png   o4-kiko.png
  o5-quinoa-bowl.png    o5-kiko-badge.png
  o7-graph-frame.png
  o8-card-scan.png      o8-card-macros.png      o8-card-customize.png
  o9-pasta-bowl.png     o9-tile-leaf.png        o9-tile-chart.png
  o9-tile-chef.png      o9-tile-clock.png       o9-brackets.png     o9-sparkles.png
  o10-kiko-hero.png     o10-doodle-carrot.png   o10-doodle-mushroom.png
  o10-doodle-herb.png   o10-doodle-fishbone.png o10-doodle-applecore.png
  o10-doodle-sparkle.png o10-doodle-squiggle.png o10-doodle-recipecard.png
  o11-kiko-peek.png
```

### DELETE LATER — after manual approval (Section 20)

```
apps/mobile/src/screens/WelcomeScreen.tsx
apps/mobile/src/components/onboarding/OnboardingUI.tsx
apps/mobile/src/utils/onboardingScanGuards.ts (+ test)
apps/mobile/src/utils/onboardingScanLoadingWiring.test.ts
apps/mobile/src/utils/onboardingEmojiRegression.test.ts
apps/mobile/src/utils/purchaseAvailability.ts (+ test)     [phase 2]
```

---

## SECTION 22 — ACCEPTANCE CRITERIA

Objective and individually verifiable. Codex reports pass/fail per line with evidence.

### Architecture

1. `OnboardingV3Step` has exactly 12 members; **no member represents a showcase page**.
2. `OnboardingV3.tsx` is a single `switch (state.step)`; no boolean combination decides what renders.
3. `onboardingV3Machine.ts` imports nothing from `react`, `react-native`, or `@react-navigation/*`.
4. **Every** row of the Section 8 table has a passing test.
5. Every `OnboardingV3Step` is reachable, and every non-terminal step has ≥1 outgoing transition. **No unreachable states, no dead ends.**
6. `completeOnboarding()` appears in **exactly one** file in `onboarding-v3/`, guarded by a ref.
7. No file in `onboarding-v3/` calls `navigation.navigate()`.
8. No file in `onboarding-v3/` imports `ResultSummaryScreen`, `RecipeDetailScreen`, or `WelcomeScreen`.

### Showcase & motion

9. `showcasePages.ts` exports exactly 9 entries in the Section 4 order.
10. `grep -nE "interpolate|opacity|scale|rotate|blur" ShowcasePager.tsx` returns **only** dot-indicator lines.
11. Page-settle animations are triggered by `onPageSelected`, never `onPageScroll`.
12. `grep -rn "setInterval" src/onboarding-v3/` returns **zero** results.
13. Every file using `withRepeat` also imports `useReduceMotion`.
14. With Reduce Motion on: no wiggle, no idle, no float, no scan loop, no stagger — and **the pager still works**.

### Product contract

15. `onboardingV3Copy.test.ts` passes — none of the 14 forbidden strings exist in `onboarding-v3/`.
16. An ingredient-only photo produces "Scan a prepared dish you'd like to recreate." and **generates no recipe** (verified by the absence of a recipe-phase call in the log).
17. No `$84`, `$6.20`, `$17.80`, or `$11.60` appears anywhere in `src/`.
18. No unsupported savings statistic renders on any onboarding screen.

### Naming

19. Default mascot name is `Kiko`.
20. Whitespace trimmed; blank falls back to `Kiko`; capped at 20 chars.
21. The custom name persists across an app restart.
22. ≥3 user-facing main-app strings render the custom name.
23. `src/assets/kikoAssets.ts`, `components/KikoMascot.tsx`, all asset filenames, and all analytics identifiers **still contain the literal `Kiko`/`kiko`**.

### Theme

24. `colors.background === '#FBF1E5'` and `recipeColors.background === '#FBF1E5'`.
25. `grep -rnE "#FFF4E6|#FFF8F1|#FFF3E8" apps/mobile/src` returns **zero** results.
26. `colors.card` remains `#FFFFFF`; every `*Soft` and `creamDeep` token is unchanged.

### Flow

27. Recipe `Continue` reaches the paywall with **no** confirmation gate.
28. Guided cooking is skippable end-to-end.
29. No "Quick Check", "Does this look right?", "Yes, looks good", or `hasAcceptedOnboardingRecipe` anywhere in `src/`.
30. Every visible Back button changes state; no rendered Back or Continue is a no-op.
31. Every step in the Section 8 table is reachable by manual navigation on-device.

### Payments

32. The paywall renders **only** packages returned by `getOfferings()`.
33. `grep -rn '\$4\.99\|\$49\.99\|\$0\.96' src/onboarding-v3/` returns **zero** results.
34. Cancelling a purchase produces no error UI and no red screen.
35. A failed purchase produces a recoverable dialog with `Try Again` / `Not Now`, and **no LogBox red screen**.
36. Onboarding completes **only** with an active entitlement (or the `__DEV__`-only bypass).
37. `LogBox.ignoreLogs` receives `[]` when `__DEV__` is false.

### Assets

38. Every derivative has `alpha === 0` at all four corners.
39. No derivative shows a cream or white halo at 3× zoom.
40. `o10-kiko-hero.png` is derived from `onboarding10.png` and preserves fur edges, pale belly, paw pads, and the tail gradient.
41. `git status` shows **no modification** to any file under `assets/onboarding ex/`.
42. Source resolution is preserved in every derivative.

### Responsive & accessibility

43. Onboarding renders correctly on 375×667, 393×852, and 430×932 with no clipping and no letterboxing.
44. No absolute pixel position copied from a 941×1672 screenshot exists in any layout.
45. Every interactive control has `accessibilityRole`, `accessibilityLabel`, and a ≥44×44 touch target.
46. Decorative art is marked `accessible={false}`.
47. No baked `9:41` status bar, home indicator, or fake keyboard is visible anywhere.

### Verification

48. `npm --prefix apps/mobile run typecheck` — clean.
49. `npm --prefix apps/mobile test` — all pass, ~38 test files.
50. `npm --prefix apps/api test` — all pass, ~32 test files, **zero existing API tests modified**.
51. `git diff --check` — clean.
52. No commit has been made.

---

## SECTION 23 — CODEX FINAL REPORT TEMPLATE

Return exactly this structure. **State failures plainly. Do not report a step as complete if it is not.**

```markdown
# OKYO ONBOARDING V3 — CODEX EXECUTION REPORT

## 0. Guard
pwd:            <output>
branch:         <output>
status:         <output>
Commits made:   NONE

## 1. Asset directory
Path:  apps/mobile/assets/onboarding ex/
Files: <11 filenames>
Originals modified: NO   (git status proof: <paste>)

## 2. Asset dimensions & alpha
| File | W×H | colorType | minAlpha | edge bg |
(11 rows)

## 3. Full-page layers
<list, or "NONE — all 11 rebuilt natively; see plan Section 0">

## 4. Decomposed assets
<per source: pieces extracted + crop rectangles>

## 5. Transparent derivatives created
<full list with byte sizes>

## 6. Source → derivative mapping
onboardingN.png → <derivative(s)>   (11 rows)

## 7. Global background token
File / token / before → after   (5 rows)
grep proof: <paste>

## 8. Canvas confirmation
Surfaces now #FBF1E5:  <list>
Deliberately unchanged: <list + reason>

## 9. Splash implementation
Native: <config>   React: <file>   Handoff: <mechanism>

## 10. Splash animation timings
<actual implemented values vs plan Section 6>

## 11. Pager implementation
Library + version:  <…>
File:               <…>
Fallback used?      <yes/no + why>

## 12. Pure-horizontal-translation proof
grep output: <paste>
Confirmation: no opacity/scale/blur/parallax on page containers — <yes/no>
Settle trigger: onPageSelected — <yes/no>

## 13. Dot behavior
<implementation + inactive/active specs>

## 14. Per-page secondary animation
| Page | Elements | Timings | Reduce Motion |  (9 rows)

## 15. Scan-line animation      <file, values, UI-thread proof>
## 16. Graph animation          <technique, values, Skia used? y/n>
## 17. Kiko entry/idle motion   <values>
## 18. Button microinteraction  <values>
## 19. Attribution selection    <values>
## 20. Loading overlay          <spec + where used + "no artificial delay" confirmation>
## 21. Reduce Motion handling   <central hook + per-element table>
## 22. Asset prefetch strategy  <what, when, cachePolicy>

## 23. Naming screen implementation
Input / keyboard handling / validation / a11y

## 24. Mascot-name persistence
Storage key / default / sanitize / restart proof

## 25. Strings converted to mascotName
| File:line | Before | After |
Identifiers deliberately NOT changed: <list>

## 26. First real scan handoff      <files, services reused>
## 27. Dietary-after-scan handoff   <architecture chosen + AI call count>
## 28. Recipe handoff               <file + canonical recipe proof>
## 29. Paywall handoff              <file + package source proof>

## 30. Controller transition tests
Rows in Section 8: <n>   Tests: <n>   Passing: <n>
Unreachable states: <none / list>
Dead-end states:    <none / list>

## 31. Mobile tests
Before: 24 files   After: <n> files
Command + full output: <paste>

## 32. API tests
Before: 30 files   After: <n> files
Existing tests modified: <n>  (must be 0)
Command + full output: <paste>

## 33. Typecheck
Command + output: <paste>

## 34. git diff --check
<paste — must be empty>

## 35. Requires manual simulator validation
| # | Scenario | Why Codex could not verify |

## 36. EXTERNAL BLOCKERS
| Blocker | Manual action | Completed without it | How to verify after |

## 37. Deviations from the plan
| Section | Planned | Actual | Why |
(If none: "NONE")

## 38. Known issues / incomplete work
<honest list, or "NONE">
```

---

## APPENDIX — GIT SAFETY RULES FOR CODEX

**Work only in** `/Users/rober/Desktop/Okyo-1` **on** `feature/onboarding-v3-bitepal-showcase`.

`/Users/rober/Desktop/Okyo-onboarding-v2-20260801` is **READ-ONLY**. Read files from it. Never write to it, never `cd` into it for a mutating command, never check out its branch.

**Forbidden commands:**

```
git add .          git add -A         git commit
git push           git merge          git rebase
git reset --hard   git restore .      git checkout <branch>
git switch         git clean          git stash / git stash pop
```

**Additional:**

- The approved art folder `apps/mobile/assets/onboarding ex/` is **untracked**. `git clean` would destroy it permanently. Never run it.
- Do not commit until the founder has completed manual validation.
- If any guard check fails, **STOP and report** — do not attempt to correct the git state.
- If a step's success criteria cannot be met, **stop at that step and report**. Do not proceed and do not paper over it.
