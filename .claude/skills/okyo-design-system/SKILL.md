---
name: Okyo Design System
description: Use when polishing UI, redesigning screens, fixing ugly or data-heavy layouts, adding new visual components, or making Okyo feel more premium, warm, and iOS-native.
---

# Okyo Design System

## When to use this

Any task that changes how a screen or component looks: polish passes, redesigns, new cards, fixing "hackathon UI", spacing/typography work.

## Goal

Ship UI that reads as warm-premium Apple quality using ONLY existing tokens, so every screen shares one card language, one button hierarchy, one glass vocabulary.

## Okyo product context

Okyo is an AI food companion, not a calorie tracker, not a generic recipe app, and not a meal planner. It should feel helpful, premium, magical, emotionally rewarding, and easy. Kiko the fox mascot carries the emotion; delight comes from mascot, motion, and copy — not noisy gamification.

## Files to inspect first

- `apps/mobile/src/theme/okyoTheme.ts` — the ONLY source of design tokens (colors, spacing, radius, typography, shadows, surfaces, layout). Read the header comment; it is binding.
- `apps/mobile/src/components/OkyoUI.tsx` — shared components. Must NOT re-export theme tokens (past crash came from dual-source pattern).
- `apps/mobile/src/components/ScreenScaffold.tsx` — screen wrapper.
- `PRODUCT.md` — design principles + anti-references (binding).
- `apps/mobile/src/theme/recipeTheme.ts` — recipe-specific theming.
- The target screen(s) in `apps/mobile/src/screens/` (21 screens).
- `docs/wiki/DESIGN_SYSTEM.md` and `docs/OKYO_UI_REDESIGN_V2.md` for background.

## Safe commands

- Typecheck mobile: `cd apps/mobile && npx tsc --noEmit`
- Run app: `cd apps/mobile && npm run sim` (Expo, port 8082, clears cache)
- Diff check: `git diff --stat apps/mobile/src`

## Exact workflow

0. For redesigns of existing screens, check `docs/design/` prior audits first (`SCREEN_BY_SCREEN_AUDIT.md`, `DESIGN_VIOLATIONS.md`, `CARD_INVENTORY.md`) — the screen may already have documented violations and an agreed direction.
1. Read `PRODUCT.md` anti-references and `okyoTheme.ts` in full.
2. Read the target screen. List every hardcoded hex, number padding, or ad-hoc shadow you find.
3. Replace ad-hoc values with tokens: `colors.*`, `spacing.*`, `radius.*`, `typography.*` (spread presets: `{ ...typography.title }`), `shadows.*`, `surfaces.card`/`panel`/`tint`, `layout.scrollClearance` (140, keeps content clear of floating tab bar), `layout.screenGutter`.
4. Respect the three-layer material language: **canvas** (warm ivory bg) → **card** (soft white + hairline border + soft shadow) → **glass** (translucent + blur, floating chrome ONLY: tab bar, floating headers, sheets). Scrolling content never blurs.
5. Fonts: display = Baloo2_800ExtraBold, body = Nunito. No new fonts.
6. Numbers shown to users are estimates — present warmly, never as spreadsheet cells or false precision. Savings display must be gated on `userRestaurantPrice` (user-entered, in `useOkyoStore.ts`).
7. Typecheck. Report per screen what changed.

## Quality bar

- Zero new inline hex values or magic paddings; everything traces to `okyoTheme.ts`.
- Hierarchy from weight and color, not uppercase tracking (old eyebrow style was removed deliberately).
- WCAG AA: body text ≥4.5:1 (use `colors.muted` for readable captions, `mutedSoft` only decorative), touch targets ≥44pt, Reduce Motion respected for celebration animation.
- Screen looks like the other polished screens (HomeScreen, ResultSummaryScreen are good references).

## Okyo Design Algorithm

This is the visual decision process for **every** Okyo screen. Run it before writing any UI. Answer the ten questions in order — earlier answers constrain later ones. This exists so a cheaper model can reproduce senior design judgment instead of guessing.

Note on legacy docs: `docs/OKYO_UI_REDESIGN_V2.md` (May 2026) is directional background, **not** current truth. It predates the July 2026 honesty pass and still shows mode tabs, XP/leaderboards/streaks/badges, "casino" gamification, and old orange `#F97316`. The binding sources are `okyoTheme.ts` (coral `#e9552f`), `PRODUCT.md` anti-references, and the honesty rules below. When the two conflict, the token file and PRODUCT.md win. Part of the judgment being encoded here is knowing which parts of old specs to keep (scan-is-hero, warm cards, honest savings) and which to reject (fake leaderboards, XP walls, mode tabs, gamified pressure).

**Decision order:** Delete → Trust → Dominate → Quiet → Surface → Token. Subtract before you add; establish what must be honest before you style it; pick one thing to dominate before you decorate.

### The ten questions

**1. What is this screen's emotional job?**
Name the single feeling in one phrase (curiosity, relief, pride, calm focus, anticipation). Okyo screens are emotional, not informational — if the honest answer is "display data," you have already drifted toward calorie-tracker territory. Every layout choice serves that feeling. Example jobs: Home = *"let's make something"* anticipation; Result = *"wow, I can actually make this — and it's cheaper"* delight + relief; Guided Cooking = *calm, unhurried confidence*.

**2. What is the one primary action?**
Exactly one per screen. It gets the coral CTA (`colors.coral`, text on `colors.onCoral`, `radius.button`, `shadows.cta`). Everything else is secondary (outline/ghost) or a quiet text link. If two things are fighting to be primary, the screen is doing two jobs — split it or demote one. The primary action almost always moves the user deeper into the loop: scan → result → recipe → cook → save/share → scan again.

**3. What should be deleted before adding anything?**
Subtract first. Delete: dev/debug labels, model/provider names, confidence numbers, duplicate headers, redundant titles, filler cards, decorative stat rows, anything a MyFitnessPal grid would show. Ask "does removing this lose real user value?" If no, it's gone. A screen is done when there is nothing left to remove, not nothing left to add.

**4. What information must be trusted / honest?**
Identify every number and claim, then verify it is real and earned:
- **Savings** show **only** when the user entered a restaurant price (`userRestaurantPrice` in `useOkyoStore.ts`). No price → no savings, no "$0", no placeholder.
- Numbers are **estimates** — present warm and legible, never false precision (no "$13.42", prefer clean rounded values), never spreadsheet cells.
- **Never** fabricate stats, streaks, XP, ranks, other people, or social proof. If a value is inferred, the copy says so.
- Real scan failures get a friendly honest error + Kiko, never a mock result.
This question outranks aesthetics: a beautiful screen showing a fake number is a failed screen.

**5. What should be visually dominant?**
One hero element, sized far larger than everything else. Pick per emotional job: Home → the scan affordance; Result → the dish image + dish name (and savings hero *if* price entered); Recipe Detail → the dish + "what you're making"; Share Card → the food photo. Dominance comes from **scale, weight, and warm imagery** (`typography.display`/`hero`, `shadows.hero`, `radius.hero`), never from a colored metric box. If your dominant element is a number in a card, you built a dashboard.

**6. What should be quiet?**
Metadata, secondary stats, timestamps, counts, helper text — demote to `typography.caption`/`label` in `colors.muted`, or a small `surfaces.tint` chip. Difficulty/time/servings are quiet supporting chips, never a three-column stat wall. Quiet does not mean invisible; it means clearly subordinate. Contrast still meets AA (`colors.muted`, not `mutedSoft`, for anything readable).

**7. What surface type should this use?**
Pick deliberately from the material language (see table below). Default to **canvas + cards**. Reach for **glass only for floating chrome**. Never blur scrolling content.

| Surface | Token | Use for | Never for |
|---|---|---|---|
| **Canvas** | `colors.background` | The screen base, warm ivory | Cards, chrome |
| **Card** | `surfaces.card` (radius 24, `shadows.card`) | Hero content, recipe/result blocks | Dense rows (too heavy) |
| **Panel** | `surfaces.panel` (radius 20, `shadows.soft`) | Dense lists: grocery rows, settings rows, menu rows | Hero moments |
| **Tint** | `surfaces.tint` (cream fill, no shadow) | Soft accent blocks, Kiko tip, "what you're making" | Anything needing lift/tap depth |
| **Glass / floating chrome** | `colors.glassFill` + `glassStroke` + blur | Tab bar, floating headers, sheets — *floating only* | Scrolling content, wallpaper, cards |
| **Sheet / modal** | glass + `colors.scrim` | Confirmations, pickers, share sheet | Primary content flow |
| **Chip / pill** | `radius.chip`/`pill`, `surfaces.tint` or soft color | Mode label, savings chip, difficulty/time, filters | Faking stat dashboards |

**8. What tokens from `okyoTheme.ts` should be used?**
Everything traces to the token file — zero new hex, zero magic padding. Cheat-sheet:
- **Backgrounds:** canvas `colors.background`; cards `colors.card`/`cardWarm`; accent `colors.cream`.
- **Primary/CTA:** `colors.coral` (fill), `colors.onCoral` (text), `shadows.cta`, `radius.button`. Pressed → `colors.coralDark`.
- **Savings/success:** text `colors.green`, chip bg `colors.greenSoft`. **Only when price entered.**
- **Text:** `colors.charcoal` (primary), `colors.body` (body), `colors.muted` (readable captions), `mutedSoft` (decorative only), `colors.danger` (destructive).
- **Type:** spread presets — `{ ...typography.display }` (biggest hero numerals/moments), `hero`, `title`, `heading` (section), `body`, `label` (sentence-case supporting), `caption`. Display font = Baloo2, body = Nunito. No new fonts, no uppercase eyebrows.
- **Spacing:** `spacing.xs/sm/md/lg/xl`, `spacing.screen` gutter, `spacing.section` between blocks, `spacing.card` inside cards.
- **Radius/shadow:** `radius.hero/card/panel/chip/button`; `shadows.card/soft/hero/cta`.
- **Layout:** `layout.scrollClearance` (140, keeps last row clear of the floating tab bar), `layout.screenGutter`.

**9. What would make this screen feel like a calorie tracker or SaaS app? (the anti-tells — avoid)**
- Rows or grids of numbers with tiny gray labels (macro-grid energy).
- A hero metric in a colored box as the dominant element (crypto/SaaS dashboard).
- Gradient stat walls, "AI magic" sparkle-purple, glass used as wallpaper.
- Uppercase tracked eyebrows, dense tables, developer labels, raw text dumps.
- Fake gamification: XP, streak bars, leaderboards of invented people, countdowns, spin-wheels, coin rain, rarity/strength meters.
- Mode **tabs** as radio switches (removed July 2026 — modes are view projections, not a tab bar).
- Cold precision: `$13.42`, `87.3% match`, clinical/corporate copy.

**10. What would make this screen feel like Okyo? (the tells — aim for)**
- Warm ivory canvas, one soft-white card language, generous breathing room.
- One dominant warm element (food photo or big friendly headline) carrying the emotion.
- Honest, rounded, warmly-presented numbers — savings only when earned.
- Kiko as the emotional layer (empty states, encouragement, one tip), never as decoration and never more than one per screen.
- Coral CTA that obviously advances the scan→cook→save loop, with a warm glow.
- Delight from imagery, motion, and casual copy ("Nailed it") — not from badges.
- Liquid-glass chrome that floats above content; cookbook warmth in the content itself.

## Screen Quality Bars

Checkable criteria per screen — verify against these, not against vague adjectives. Files are in `apps/mobile/src/screens/`. Modes are **view projections**, never tabs. Savings **always** gate on `userRestaurantPrice`.

### Home (`HomeScreen.tsx`)
- **Emotional job:** anticipation — "let's make something today."
- **Primary action:** start a scan.
- **Hierarchy rule:** the scan affordance dominates; recent/saved preview is quiet and hidden when empty.
- **Visual style rule:** canvas + one hero scan card (`surfaces.card`, `shadows.hero`), coral CTA, warm friendly headline in `typography.hero`/`display`.
- **Avoid:** stat dashboard, streak/XP badges, multiple competing CTAs, Kiko dominating.
- **Acceptance:**
  - [ ] Exactly one coral primary (scan); secondary actions are outline/ghost.
  - [ ] No fabricated stats, streaks, or counts anywhere.
  - [ ] Recent section absent when there's no data (no empty placeholder).
  - [ ] Headline is warm/curiosity-driven, not "Welcome" or corporate.
  - [ ] Kiko (if present) ≤ one, corner-scale, not center stage.

### Scan (`ScanScreen.tsx`)
- **Emotional job:** frictionless capture — "point and it just works."
- **Primary action:** take / choose the photo.
- **Hierarchy rule:** the camera/photo target is the whole screen; controls are minimal chrome.
- **Visual style rule:** clean canvas or camera surface; capture control is the single obvious tap; guidance is one quiet line.
- **Avoid:** dev/debug overlays, model names, busy instructional walls, more than one primary control.
- **Acceptance:**
  - [ ] One obvious capture action; upload/demo are clearly secondary.
  - [ ] Permission-denied and camera-error states are friendly and honest (no raw errors).
  - [ ] No provider/model/confidence text visible.
  - [ ] Safe-area respected; nothing under the floating chrome is clipped.

### Loading (`AnalysisLoadingScreen.tsx`)
- **Emotional job:** magical anticipation — the wait *builds* the payoff, doesn't feel like a spinner.
- **Primary action:** none (waiting) — do not offer distractions that leave the flow.
- **Hierarchy rule:** motion + one warm reassuring line dominate; no data.
- **Visual style rule:** gentle Kiko/thinking motion, warm copy, respect Reduce Motion; canvas surface.
- **Avoid:** technical progress logs, percentages, "calling AI…", provider names, cold spinners.
- **Acceptance:**
  - [ ] Copy is warm and human, never technical ("Reading your dish…" not "Requesting model").
  - [ ] Reduce Motion honored — a calm static/faded state exists.
  - [ ] No numbers, no debug, no model identity.
  - [ ] Transitions to Result or to an honest error — never to a mock result.

### Result (`ResultSummaryScreen.tsx`)
- **Emotional job:** delight + relief — "I can make this, and it's cheaper."
- **Primary action:** View / open the recipe.
- **Hierarchy rule:** dish photo + canonical dish name dominate; savings hero is prominent **only if** price entered; difficulty/time/match are quiet chips.
- **Visual style rule:** hero image card (`shadows.hero`), `typography.display`/`hero` for name & savings number, `colors.green`/`greenSoft` savings, coral CTA.
- **Avoid:** three-column stat wall, mode tabs, savings shown without a user price, confidence %, provider labels, "$X.XX" false precision.
- **Acceptance:**
  - [ ] Savings block hidden entirely until `userRestaurantPrice` is set; no "$0"/placeholder.
  - [ ] One canonical dish title (no competing names).
  - [ ] Modes render as view projections/chips, not a tab switcher.
  - [ ] Difficulty/time/servings are quiet chips, not a dashboard row.
  - [ ] Single coral primary = "View Recipe"; share/save are secondary.
  - [ ] No AI/model/confidence/debug text.

### Recipe Detail (`RecipeDetailScreen.tsx`)
- **Emotional job:** confident "I've got everything I need."
- **Primary action:** Start Cooking.
- **Hierarchy rule:** "what you're making" + dish dominate; ingredients grouped by component in calm cards; savings/cost quiet.
- **Visual style rule:** `surfaces.tint` for the "what you're making" block, `surfaces.card` per component, `typography.heading` section headers, generous line-height on ingredient lines.
- **Avoid:** wall-of-text ingredients, "optional boost" cards after every item, generic Kiko tips, savings without price, mode tabs.
- **Acceptance:**
  - [ ] Ingredients grouped by component (Sauce/Dough/etc.), each a calm card.
  - [ ] `recipe.ingredients` is the single source (no drift between lists/steps).
  - [ ] ≤ one Kiko tip, only if genuinely useful.
  - [ ] Cost/savings quiet and gated on price.
  - [ ] One coral primary = "Start Cooking."

### Guided Cooking (cooking-steps flow)
- **Emotional job:** calm, unhurried focus — one step at a time, cook-friendly.
- **Primary action:** Next step.
- **Hierarchy rule:** the current step card dominates fully; everything else is minimal.
- **Visual style rule:** large readable step card (`surfaces.card`, ≥16px body), quiet progress indicator, `Previous`/`Next` as clear paired controls (Previous demoted on step 1).
- **Avoid:** repeated identical "boost" cards, generic tips on every step, cramped text, "Serve" appearing before cooking steps (ordering safety net exists — respect it).
- **Acceptance:**
  - [ ] One step visible at a time; text is large and legible at arm's length.
  - [ ] Boosts/notes appear only when unique and contextual, never every step.
  - [ ] Step order is coherent (no serve-before-cook).
  - [ ] Next/Previous are obvious; last step reads "Finish"/"Done."
  - [ ] No debug/model text.

### Grocery (`GroceryListScreen.tsx`)
- **Emotional job:** effortless readiness — "I can shop this in one pass."
- **Primary action:** check off / use the list (add-to or share optional secondary).
- **Hierarchy rule:** the list dominates; section headers organize; totals quiet.
- **Visual style rule:** rows as `surfaces.panel` + `shadows.soft`, `typography.heading` sections, `layout.scrollClearance` so the tab bar never covers the last row.
- **Avoid:** heavy `surfaces.card` per row (too weighty), inline hex, dense data-grid feel, blur on the list.
- **Acceptance:**
  - [ ] Rows read as soft panels, scannable, comfortable tap targets (≥44pt).
  - [ ] Grouped logically; ingredients trace to `recipe.ingredients`.
  - [ ] Last row clears the floating tab bar (`scrollClearance`).
  - [ ] No blur on scrolling content; no inline colors/paddings.

### Saved / Library (`LibraryScreen.tsx`)
- **Emotional job:** quiet pride — "look at the collection I'm building."
- **Primary action:** open a saved recipe (empty state: scan a meal).
- **Hierarchy rule:** the recipe cards dominate; any total is a warm, honest summary, not a metric wall.
- **Visual style rule:** `surfaces.panel`/`card` recipe cards with thumb + title + quiet mode/difficulty/savings chips; empty state = Kiko + warm copy + coral CTA.
- **Avoid:** leaderboard/XP framing, fake "worth $X" if not derived from real user prices, filter chrome overload, cold list.
- **Acceptance:**
  - [ ] Any savings total is real (sums only price-entered recipes); otherwise omitted.
  - [ ] Empty state: Kiko + warm headline + single coral "Scan a meal."
  - [ ] Cards scannable; savings chips only where price was entered.
  - [ ] No XP/rank/streak framing.

### Profile (`ProfileScreen.tsx` / `SettingsScreen.tsx`)
- **Emotional job:** calm control — simple, trustworthy, no clutter.
- **Primary action:** none dominant; grouped settings rows.
- **Hierarchy rule:** account block first, then grouped preference/support rows; destructive actions clearly separated.
- **Visual style rule:** `surfaces.panel` rows grouped under `typography.heading` sections; toggles use `colors.green` when on; destructive in `colors.danger`; dev section hidden/flagged and visually distinct.
- **Avoid:** fake tiers/stats, placeholder toggles, debug metadata for normal users, scary destructive styling.
- **Acceptance:**
  - [ ] Real account data only; no fabricated tier/stat.
  - [ ] Destructive actions use `colors.danger` and confirm before acting.
  - [ ] Dev/debug section hidden behind a flag and visually separated.
  - [ ] No placeholder copy; version string is real.

### Share Card (`ShareCardPreviewScreen.tsx`)
- **Emotional job:** shareable pride — a screenshot worth posting.
- **Primary action:** Share.
- **Hierarchy rule:** the food photo dominates the card; dish name + honest savings support; footer quiet.
- **Visual style rule:** portrait card, warm cream/card background, `typography.hero`/`display` dish name, `colors.green` savings chip **only if** price entered, "Made with Okyo" quiet footer.
- **Avoid:** rarity/strength/streak bars (deleted July 2026 — do not reintroduce), fake match/savings, mock/placeholder text, decorative gamification.
- **Acceptance:**
  - [ ] No fake or ungated numbers on the card; savings shown only with a real price.
  - [ ] No rarity/streak/strength meters or invented social proof.
  - [ ] Food photo is the dominant layer; card reads clean at screenshot size.
  - [ ] Single coral primary = Share; copy/save are secondary.

### Onboarding (flow — see `docs/wiki/ONBOARDING.md`)
- **Emotional job:** fast excitement — "this is for me, let's scan," in the fewest steps.
- **Primary action:** advance one step, ending at first scan / trial.
- **Hierarchy rule:** one idea per step, one big friendly headline + Kiko reaction; single Continue.
- **Visual style rule:** full-bleed warm screens, `typography.hero`/`display`, Kiko carrying emotion, one coral Continue per step; assets in `apps/mobile/assets/BitePal iOS Onboarding/`.
- **Avoid:** multi-CTA steps, dense value-prop walls, fake social proof / testimonials / user counts, calorie-tracker setup vibes.
- **Acceptance:**
  - [ ] One clear idea + one coral Continue per step.
  - [ ] Flow stays tight (7-step redesign) and lands on scan/trial.
  - [ ] Kiko present as emotional layer; no fake stats or testimonials.
  - [ ] Copy is casual/hook-first; every step advances toward the first scan.

## Bad patterns to avoid

- New hex values, one-off shadows, or padding constants outside the theme.
- Re-exporting tokens from `OkyoUI.tsx` (caused a runtime crash before; single-source rule is in the theme header).
- Anti-references from PRODUCT.md: MyFitnessPal data grids, crypto/SaaS hero-metric dashboards, gradient stat walls, casino gamification (spin wheels, coin rain, countdowns), sparkle-purple "AI magic" clichés, raw text dumps / developer labels.
- Fake metrics or decorative progress bars (rarity, streak strength bars were deliberately deleted from Share Card July 2026 — do not reintroduce).
- Blur/glass on scrolling content.
- Big rewrites of screens that only needed token substitution.

## Example final output

> Polished `GroceryListScreen.tsx`. Replaced 6 inline hex values with `colors.cream`/`colors.border`, converted row cards to `surfaces.panel` + `shadows.soft`, switched section headers to `typography.heading`, bottom padding now `layout.scrollClearance`. No layout restructure. Mobile typecheck clean. Test: open Saved → grocery list, verify rows read as soft panels and tab bar never covers last row.

## Done checklist

- [ ] No new hardcoded colors/spacing/shadows
- [ ] Three-layer material language respected (no blur on content)
- [ ] No PRODUCT.md anti-reference introduced
- [ ] `npx tsc --noEmit` clean in `apps/mobile`
- [ ] Reported files changed + what to look at in simulator
