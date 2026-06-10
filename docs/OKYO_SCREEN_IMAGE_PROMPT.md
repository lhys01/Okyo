<<<<<<< ours
# Okyo Screen Image Generation Prompt

Use this document as the reusable image-generation brief for Okyo app screen concepts. Generate polished product screens only. Do not generate code, diagrams, collages, or marketing posters.

## Product Direction

Okyo is a cute, clean, premium food app where users scan restaurant food and get homemade restaurant-style recipes, grocery lists, savings estimates, saved swaps, viral share cards, cooking challenges, and progress.

The app should feel warm, premium, simple, food-focused, playful but not childish, useful rather than decorative, and mascot-led without feeling mascot-cluttered.

## Global Generation Rules

- Generate one separate 9:16 image per screen.
- Each image must be a single mobile app screen, not a collage.
- Do not place the screen inside a phone mockup frame, device shell, hand, desk scene, browser window, or presentation board.
- Use a flat direct screenshot-style composition that fills the full 9:16 canvas.
- Use realistic app proportions, safe areas, readable text, tappable controls, and believable mobile spacing.
- Make the screen feel buildable as a real app screen in React Native.
- Do not show debug overlays, redlines, measurements, grid labels, cursor artifacts, watermarks, or generator UI.
- Do not create image files until explicitly asked.

## Visual Style

- Background: warm cream or ivory, such as `#FEFBF7`, `#FAF8F3`, or `#FFF7ED`.
- Primary action: warm orange, such as `#F97316` or `#FF6B35`.
- Savings and progress: soft fresh green, such as `#86EFAC`, `#22C55E`, or muted sage.
- Text: dark charcoal, such as `#1F2937` or `#2B2D31`.
- Secondary text: warm gray, such as `#78716F`.
- Cards: white or very pale cream with soft beige borders.
- Corners: friendly rounded cards, usually 14-18px visual radius.
- Shadows: soft and minimal; avoid heavy floating-card effects.
- Typography: clean rounded sans-serif, premium and readable, not childish bubble lettering.
- Food imagery: appetizing, natural, restaurant-quality, and specific to the dish. Avoid generic bowls, vague salads, plastic-looking food, and impossible ingredient combinations.
- Icons: simple rounded line or filled icons in charcoal, gray, orange, or green.

## Navigation Rules

For screens that use bottom navigation, use exactly these labels:

1. Home
2. Discover
3. Scan
4. Plan
5. Profile

The Scan tab is the largest orange center action. Other tabs are gray when inactive. The active non-Scan tab may use orange text or icon treatment. Keep the tab bar clean, centered, and stable across screens.

## Kiko Mascot Rules

Kiko is Okyo's warm helper mascot. Kiko should feel consistent across every screen where used.

- Kiko is a small friendly food-guide character with a soft cream body, subtle orange accents, simple expressive eyes, and tiny rounded features.
- Kiko should look like the same character each time: same proportions, same face style, same color family.
- Kiko may appear as a small guide, badge, empty-state helper, loading companion, or celebratory sticker.
- Kiko must not dominate utility screens.
- Use Kiko at most once per screen unless the screen is explicitly about stickers, onboarding, or celebration.
- Kiko expressions should be helpful, curious, proud, or gently excited.
- Do not change Kiko into a robot, animal, chef celebrity, emoji, blue gear, or random object.
- Do not use Kiko to replace food photography or primary product UI.
- Kiko callouts must be short, useful, and readable.

## Banned Words And Content

Do not show these words or concepts as visible app copy:

- "copycat"
- "AI fallback"
- "OpenRouter"
- provider names
- debug labels
- placeholder copy

Also avoid:

- blue gear icons or blue gear mascots
- duplicate headers
- fake status labels
- lorem ipsum
- "TODO"
- "Mock"
- unstyled raw JSON
- technical confidence/debug strings
- repeated or garbled text
- tiny unreadable legal text

## Negative Prompt

No collage, no multi-screen board, no phone mockup, no iPhone frame, no device bezel, no laptop, no desk, no hand holding phone, no wireframe, no blueprint, no debug UI, no browser chrome, no watermark, no placeholder text, no lorem ipsum, no duplicate title bars, no blue gear, no developer labels, no provider names, no backend terminology, no raw JSON, no tiny unreadable text, no distorted food, no generic stock-food mush, no extra mascot variants, no childish toy-like interface, no neon cyber style, no cold blue SaaS theme, no cluttered dashboard, no overflowing text, no clipped buttons.

## Dynamic Data Rules

Use realistic data that looks production-ready. Dynamic values should be plausible and internally consistent.

- Restaurant item examples may include creamy tomato pasta, spicy chicken sandwich, steak rice bowl, ramen, birria tacos, truffle fries, chopped salad, dumplings, pizza slice, or breakfast plate.
- Recipe titles should be short and specific, such as "Creamy Tomato Rigatoni" or "Crispy Hot Honey Chicken Sandwich".
- Savings should make sense: restaurant price, homemade estimate, and savings should add up.
- Grocery lists should contain believable ingredients for the shown dish.
- Progress, XP, badges, streaks, and challenge data should look real but not overstuffed.
- Use concise app copy. Every visible phrase should feel intentional.
- Never use placeholder names, fake debug IDs, test emails, or obvious sample filler.
- Do not include provider names or model names.

## Product-Design QA Rules

Before accepting any generated screen, check:

- It is one individual 9:16 image.
- It reads as a direct app screen, not a poster, collage, or phone mockup.
- It uses warm cream, orange, and green Okyo styling.
- It is food-first: the food imagery is believable and relevant to the screen.
- Text is readable at mobile/story size.
- Buttons, cards, and controls look tappable.
- Kiko is consistent where used and absent where it would add clutter.
- Bottom navigation, when present, uses Home, Discover, Scan, Plan, Profile with Scan as the large orange center action.
- There are no banned words, debug labels, provider names, placeholders, duplicate headers, or blue gear elements.
- The screen could plausibly be implemented in the real Okyo mobile app.

## Screen Flow Groups

Generate screens in these product flow groups when batching:

- Entry and onboarding: 01-05
- Scan and recipe creation: 06-10
- Grocery, savings, and planning: 11-13
- Sharing and saved content: 14-17
- Challenges and progress: 18-22
- Account and monetization: 23-26

## 26 Screen Briefs

### 01 Splash Screen

Full-screen warm cream background with centered Okyo wordmark and a small consistent Kiko mark. Premium, minimal, calm. Optional tiny tagline: "Restaurant-style meals at home." No bottom navigation.

### 02 Onboarding Welcome

Welcoming first-run screen with food photography and Kiko as a small guide. Headline: "Turn restaurant meals into homemade recipes." Supporting copy about scanning a dish, getting a recipe, and seeing savings. Primary orange CTA: "Get started." No clutter.

### 03 Onboarding How It Works

Three simple steps: scan a dish, get a homemade recipe, shop and cook. Use clean illustrated cards, small food thumbnails, and one subtle Kiko helper. Primary CTA: "Continue." Keep all copy short.

### 04 Onboarding Taste Goals

Preference setup screen with selectable chips for budget-friendly, high-protein, quick dinners, family meals, vegetarian, spicy, comfort food, and lighter swaps. Use warm chips and a simple orange CTA. No bottom nav.

### 05 Onboarding Savings Goal

Setup screen asking how much the user wants to save on eating out this month. Show a friendly slider or three choice cards, such as "$50", "$100", "$200+". Kiko can point to the savings estimate. CTA: "Start scanning."

### 06 Scan Home Screen

Main scan entry screen. Hero headline: "What are we making at home?" Large food scan card with camera affordance. Secondary actions: "Upload photo" and "Try demo." Bottom nav visible with Scan as the largest orange center action. No duplicate top header.

### 07 Camera Capture Screen

Camera-style app screen for framing a restaurant dish. Use a full-bleed believable food view with subtle scan guide corners, top close control, flash/gallery controls, and a large orange capture button. No phone frame. No debug overlays.

### 08 Scan Loading Screen

Warm loading screen after scan. Show a soft food preview card, progress steps like "Reading the dish", "Finding ingredients", and "Estimating savings." Kiko may appear in a small thinking pose. No provider names or technical labels.

### 09 Scan Result Screen

Result summary screen for one scanned dish. Show dish photo, identified dish title, restaurant price, homemade estimate, savings, confidence phrased naturally, and primary CTA to make recipe. Use green savings treatment and orange primary action.

### 10 Recipe Overview Screen

Recipe detail screen with appetizing dish image, title, short description, time, servings, difficulty, estimated cost, savings, ingredient preview, and "Start cooking" CTA. It should feel like a real recipe app, not a generated poster.

### 11 Grocery List Screen

Organized grocery list grouped by produce, pantry, dairy, protein, and spices. Include checked states, estimated total, and action to export or add to plan. Use clean rows, small icons, and readable quantities.

### 12 Savings Dashboard Screen

Monthly savings dashboard showing total saved, scans used, top saved recipes, and a simple progress chart. Use green for savings and orange for primary actions. Keep it friendly and not finance-heavy.

### 13 Weekly Meal Plan Screen

Plan tab screen with a week view, saved restaurant-style recipes assigned to days, and a grocery summary. Include an orange add button and bottom nav with Plan active. Make it useful and dense enough to be real.

### 14 Viral Share Card Export

Share-card export screen showing a single vertical share card preview, not a collage. The card should include dish image, restaurant price, homemade estimate, savings, match score, and "Made with Okyo." Include export/share controls outside the preview.

### 15 Saved Recipes Library

Library-style saved swaps screen with searchable saved recipes, filter chips, food thumbnails, savings badges, and recent activity. Bottom nav may show Discover or Profile active depending on composition, but keep navigation consistent.

### 16 Recipe Detail Saved State

Saved recipe screen showing a completed saved state, notes, match rating, grocery items, and cook-again CTA. Include a small saved badge and realistic food image. Avoid duplicating the recipe overview screen exactly.

### 17 Discover Restaurant Packs

Discover screen with curated restaurant-style packs, such as "Weeknight Pasta", "Chicken Sandwich Night", and "Better Takeout Bowls." Use warm cards with food images, clear savings hooks, and Discover active in bottom nav.

### 18 Cooking Challenge Start

Challenge screen inviting the user to cook a scanned dish at home. Show recipe thumbnail, target match score, expected savings, and start CTA. Kiko can be a small coach. The tone should be playful but useful.

### 19 Cooking Challenge Progress

Step-by-step cooking progress screen with current step, timer, ingredient checklist, and progress indicator. Keep it clean, readable in a kitchen context, and free of decorative clutter.

### 20 Challenge Result Rating

Post-cook rating screen where the user rates taste match, cost, and effort. Show food comparison thumbnails, sliders or segmented controls, and a celebratory but controlled Kiko. CTA: "Save result."

### 21 XP And Badges Screen

Progress screen with XP, streak, earned badges, and next milestone. Use warm badge visuals, green/orange progress, and Profile active in bottom nav. Avoid game clutter; it should still feel premium.

### 22 Weekly Ranking Screen

Leaderboard-style screen for weekly savings or challenge wins. Show the user's rank, a few friendly rows, savings totals, and a share action. Keep social elements lightweight; no full social feed.

### 23 Profile Home Screen

Profile screen with user summary, saved total, scans remaining, badges, preferences, and settings links. Use Profile active in bottom nav. No blue gear icon; use simple charcoal settings treatment if needed.

### 24 Settings And Preferences

Settings screen with dietary preferences, budget goal, notifications, privacy, support, and account controls. Clean grouped rows, no duplicate header, no technical backend copy, no provider names.

### 25 Scan Limit Screen

Friendly limit state after free scans are used. Show value recap: savings this month, saved recipes, and what premium unlocks. Kiko may appear supportive. Primary CTA should lead to upgrade; secondary CTA can return home.

### 26 Paywall Screen

Premium paywall screen focused on saving money every time the user eats out. Include benefits: more scans, unlimited saved recipes, grocery exports, share cards, and progress insights. Use warm cream, orange CTA, green savings proof, and premium but simple layout.

## Export Checklist

For each generated image:

- File is a standalone PNG or JPG.
- Aspect ratio is 9:16.
- Recommended size is 1080x1920.
- Filename uses the screen number and lowercase slug, such as `01-splash-screen.png`.
- Image contains exactly one screen.
- No collage or phone mockup frame.
- No banned words or debug/provider text.
- Text is readable at story size.
- Food imagery is believable and screen-specific.
- Kiko is consistent if present.
- Screen passes the product-design QA rules above.
=======
# Okyo Full-App Screen Image Generation Brief

Use this brief to generate high-quality **individual 9:16 mobile screen images** for Okyo. The goal is one consistent, App Store-quality product vision across every user-reachable screen, not a collage, not a generic AI-app concept, and not disconnected visual experiments.

## Core Direction

You are an expert mobile app UI/UX designer, product designer, and visual systems designer.

Design **Okyo**, a warm, premium, simple, food-focused mobile app where users scan restaurant food and turn it into homemade restaurant-style recipes, grocery lists, savings estimates, saved swaps, share cards, and cooking progress.

Okyo should feel:

- Warm and premium
- Cute, but not childish
- Simple and genuinely useful
- Food-first, not tech-first
- Playful, but clean and restrained
- Friendly and mascot-led, without visual clutter
- Like a polished consumer cooking app, not a generic AI tool

Generate **one separate 9:16 mobile image for each listed screen**. Every screen should look like it belongs to the same real app and the same design system.

## Required Output Format

Every generated asset must follow this format:

```text
Aspect ratio: 9:16
Mobile app screen
iPhone-sized layout
One screen per image
No phone mockup frame unless explicitly requested
No desktop layout
No tablet layout
No collage
No multi-screen board
No cut-off content
No horizontal overflow
No unreadable microcopy
```

Label each generated image clearly with its screen number and name:

```text
01 Splash Screen
02 Onboarding Welcome
03 Onboarding Value
...
26 Paywall / Okyo Pro
```

## Negative Prompt: Do Not Generate

Avoid anything that makes Okyo look like a generic AI mockup, corporate dashboard, crypto app, finance app, health tracker, or random template.

Do **not** generate:

- Collages, contact sheets, mood boards, or multiple screens in one image
- Phone frames, device bezels, desktop browser chrome, or tablet layouts
- Futuristic neon gradients, glassmorphism, cyber/AI or robot styling
- Generic sparkle-brain AI icons, magic wands, neural networks, chat bubbles, or provider logos
- Blue gear icons, random triangles, broken bottom tabs, duplicate headers, or clipped buttons
- Debug labels, placeholder text, lorem ipsum, wireframe labels, redlines, or annotation callouts
- AI provider names, model names, “OpenRouter,” “AI fallback,” “AI result,” or technical error text
- The word “copycat” anywhere in the UI
- Creepy, realistic, over-detailed, babyish, or inconsistent mascot art
- Heavy drop shadows, harsh black borders, saturated rainbow palettes, or cluttered layouts
- Stock-photo-heavy screens that feel unrelated to cooking or restaurant-style food

## Product Design QA Rules

Design each screen as something a product team could actually build. Favor a clear MVP screen over a beautiful but unusable concept.

- Show only the most important content above the fold.
- Use 1 primary action per screen, plus at most 2-3 secondary actions.
- If a screen contains long lists, ingredients, instructions, settings, or cards, show the top portion and imply vertical scrolling instead of shrinking text.
- Avoid fake inactive buttons, decorative tabs, or UI controls that do not have a clear purpose.
- Avoid repeating the exact same card composition on every screen; keep the brand consistent while varying layouts by task.
- Do not force all content onto one screen. Use scrollable sections for recipe details, grocery groups, saved recipes, discovery rows, settings rows, and dashboards.
- Keep all text large enough to read in a mobile screenshot. Prefer fewer visible items over tiny labels.

## Okyo Design System

Use this visual system consistently across all 26 screens.

### Brand Feel

Okyo is mascot-led, warm, simple, useful, savings-focused, and food-focused. It should feel like a modern “Duolingo of eating smarter,” but with its own restaurant-scan and homemade-meal identity. Kiko is a helpful guide, not random decoration.

### Colors

Use only this palette unless a food photo naturally contains other colors:

```text
Background: #FFF8F1
Primary orange: #FF6A1A
Pressed orange: #D94E00
Green: #46B35E
Deep green: #2F7D3E
Charcoal: #1A1A1A
Muted gray: #777777
Soft border: #E6DED4
White cards: #FFFFFF
Reward gold: #FFC742
```

Color usage:

- Warm cream background on every app screen
- White cards for main content areas
- Orange for primary buttons and the raised Scan tab
- Green for savings, success, completed items, and positive progress
- Charcoal for primary text
- Muted gray for secondary text and inactive nav labels
- Beige borders and dividers, never harsh black outlines
- Gold only for rewards, rarity, streaks, or achievement accents

### Typography

Use one rounded, friendly sans-serif family across the product.

```text
Headlines: heavy bold, charcoal, large and readable
Body: medium weight, charcoal or muted gray
Labels/chips: semibold, compact, readable
Savings/progress numbers: large, bold, green or charcoal
Buttons: semibold or bold, high contrast
```

Avoid tiny text, overly condensed fonts, corporate dashboard typography, or decorative scripts.

### Layout and Spacing

- Mobile-first iPhone layout with safe-area padding
- 16-24px page padding
- 16-24px gaps between major sections
- 24-32px card radius
- Soft beige card borders
- Light, warm shadows only when useful
- Generous touch targets
- Clear visual hierarchy: headline, short supporting copy, one obvious primary action
- Keep screens calm and breathable; do not fill every empty space

### Cards, Buttons, and Chips

```text
Cards: #FFFFFF fill, #E6DED4 border, 24-32px radius, generous padding
Primary button: #FF6A1A fill, white text, rounded pill/card shape
Secondary button: white fill, beige border, charcoal text
Selected chip: soft orange or soft green fill with readable text
Unselected chip: white or cream fill, beige border, muted text
Checkboxes: rounded squares, orange or green when checked
```

## Copy and Language Rules

The UI should sound friendly, direct, and non-technical. It should focus on food, saving money, and cooking confidence.

Never use:

- “copycat”
- “AI fallback”
- “OpenRouter”
- AI provider names
- model names
- debug labels
- placeholder copy
- “lorem ipsum”
- “official restaurant recipe”

Prefer these words and phrases:

- “Restaurant Style”
- “Homemade version”
- “Inspired-by”
- “Smart swap”
- “Remade at home”
- “Scan again”
- “View recipe”
- “Save recipe”
- “Grocery list”
- “Savings estimate”
- “Kiko is checking your meal”

## Dynamic Data Rules

Use generic dynamic placeholders where the real app would insert user-specific or scan-specific data. Do not hardcode one repeated food across the full image set.

- Never hardcode burger, pizza, pasta, or any single food as the default across all screens.
- Use readable placeholder-style labels only when helpful, such as `{dishName}`, `{scanImage}`, `{homemadeImage}`, `{savingsAmount}`, `{totalSavings}`, `{cookTime}`, `{difficulty}`, `{cuisineType}`, `{rarity}`, `{streak}`, and `{servings}`.
- If showing example data instead of placeholder tokens, vary the dish types across screens and make sure the food photo matches the dish name.
- Food images must match the dish type, cuisine style, and mode being shown. Do not pair a noodle dish name with a burger image or a salad image with a pasta recipe.
- Missing or uncertain data should be hidden gracefully or shown as a simple friendly state; never show `null`, `undefined`, blank tokens, fake debug values, or placeholder text.
- Savings, nutrition, confidence, time, and difficulty should look like estimates, not exact guarantees.
- Social and share cards should use large readable text, a small number of stats, and no tiny app-style labels.

## Screen Flow Groups

Use these flow groups to decide whether a screen should feel like a tab screen, a focused task screen, or a modal/success state.

- **Onboarding flow:** 01 Splash, 02 Onboarding Welcome, 03 Onboarding Value, 04 Goal Question, 05 Cooking Confidence. No bottom navigation.
- **Scan flow:** 06 Scan Home, 07 Scanning / Loading, 08 Scan Error, 09 Scan Result. Scan Home can show bottom navigation; loading, error, and result should feel focused and avoid unnecessary nav chrome.
- **Recipe flow:** 10 Recipe Overview, 11 Recipe Instructions, 12 Grocery List. Treat as focused cooking task screens with a clear top bar/back action; avoid bottom navigation unless explicitly designing an in-tab variant.
- **Sharing flow:** 13 Share Preview, 14 Viral Share Card Export, 15 Save Confirmation. Keep focused; the export card has no app chrome.
- **Saved/progress flow:** 16 Library / Saved Recipes, 17 Empty Library, 18 Savings Dashboard, 19 Discover, 20 Packs, 21 Remake Challenge, 22 Rate Match, 23 Progress / Kitchen. Main browse/progress screens can use bottom navigation; challenge rating should feel focused.
- **Account/settings flow:** 24 Profile, 25 Settings, 26 Paywall / Okyo Pro. Profile can use bottom navigation; Settings and Paywall should usually avoid it.

## Bottom Navigation Rules

Use a polished bottom navigation only on main logged-in app tabs and screens that would normally sit inside the tab shell. Do not show bottom navigation on splash, onboarding, loading, error, modal confirmation, full-screen share export, or paywall unless the screen specifically needs app chrome.

When bottom navigation appears, it must be consistent everywhere:

```text
Home
Discover
Scan
Plan
Profile
```

Bottom nav styling:

- White or very warm off-white bar
- Subtle beige top border
- Rounded, modern icon style
- Gray inactive icons and labels
- Orange active state
- Center **Scan** tab is the largest action, orange, circular or rounded, slightly raised
- No triangles, broken icons, duplicate labels, debug icons, or blue gear icon
- Account for iPhone safe area and home indicator

## Kiko Mascot Rules

Kiko must stay consistent with the provided design sheet. If a design sheet/reference is supplied, follow it exactly before using any other mascot interpretation.

Kiko should be:

- A simple orange fox mascot
- Cream muzzle and cream belly
- Big black friendly eyes
- Small rounded ears
- Soft rounded shapes
- Minimal shading
- Consistent proportions across screens
- Expressive but restrained
- Used as a guide only when helpful

Kiko can appear on onboarding, scan, loading, error, empty states, save confirmation, progress, and selected friendly coaching moments.

Kiko should not appear on every utility screen. Keep Kiko small on dense screens such as grocery lists, settings, recipe details, and dashboards unless the screen is an empty or success state.

Do **not** make Kiko:

- Realistic, furry, complex, or 3D-rendered
- Creepy, uncanny, babyish, or hyper-cute
- Different colors or species across screens
- Huge on utility screens
- Wearing random accessories
- A generic fox emoji, anime character, or stock mascot
- More visually important than the user task

## Food Image Rules

Food imagery should look appetizing, warm, and restaurant-inspired without becoming glossy stock-photo clutter.

- Use one clear hero food image where relevant
- Prefer overhead or 3/4 angle food photography
- Use rounded image corners matching cards
- Keep food realistic and warm-toned
- Avoid messy plates, weird hands, distorted utensils, or impossible food anatomy
- Do not use food images on screens where they distract from the task

## Screens to Generate

Each screen below must be generated as **one individual 9:16 mobile image** with the exact label shown. Keep the same Okyo visual system, colors, typography, card style, and spacing across all screens.

### 01 Splash Screen

Output: one individual 9:16 mobile image labeled **01 Splash Screen**.

Create a simple Okyo launch screen. Use a warm cream background, centered Okyo logo, and a subtle Kiko face, soft aura, or cloud detail only if tasteful. The screen should feel premium, calm, warm, and uncluttered.

Do not show bottom navigation, buttons, debug text, or phone chrome.

### 02 Onboarding Welcome

Output: one individual 9:16 mobile image labeled **02 Onboarding Welcome**.

Kiko introduces Okyo in a friendly, premium onboarding layout.

Copy:

```text
Hey, I’m Kiko.
I’ll help you turn restaurant food into homemade meals.
```

CTA:

```text
Continue
```

Use Kiko as a consistent guide illustration. Keep the layout simple with a warm hero area, one short text block, and one primary orange CTA. Do not show bottom navigation.

### 03 Onboarding Value

Output: one individual 9:16 mobile image labeled **03 Onboarding Value**.

Show the app promise using simple stacked value statements and small food/scan/savings visual cues.

Copy:

```text
Scan a meal.
Get the homemade version.
Save money cooking it.
```

Use one orange primary CTA if a button is shown. Keep the screen warm, calm, and focused. Do not show bottom navigation.

### 04 Goal Question

Output: one individual 9:16 mobile image labeled **04 Goal Question**.

Ask:

```text
What do you want help with most?
```

Options:

```text
Save money
Cook more
Eat better
Find easy dinners
```

Use large rounded option cards or chips with one selected state. Keep the screen minimal and onboarding-focused. Do not show bottom navigation.

### 05 Cooking Confidence

Output: one individual 9:16 mobile image labeled **05 Cooking Confidence**.

Ask:

```text
How comfortable are you cooking?
```

Options:

```text
Beginner
Pretty okay
Confident
I cook a lot
```

Use friendly rounded option cards and a clear orange continue action if needed. This should feel encouraging, not like a test. Do not show bottom navigation.

### 06 Scan Home

Output: one individual 9:16 mobile image labeled **06 Scan Home**.

Create the main scan screen inside the app shell. Include bottom navigation with **Scan** as the raised orange center action.

Hero:

```text
What are we remaking today?
```

Card:

```text
Take a photo or upload a restaurant meal.
Okyo will turn it into a homemade version.
```

Buttons:

```text
Take Photo
Upload from Photos
Try Demo Scan
```

Use a large soft scan card, camera/scan visual, and a small Kiko pointing at the scan area. Keep Kiko consistent and helpful, not oversized.

### 07 Scanning / Loading

Output: one individual 9:16 mobile image labeled **07 Scanning / Loading**.

Create a focused loading state after the user uploads a photo.

Copy:

```text
Kiko is reading your meal...
```

Subcopy:

```text
Building your homemade version.
```

Show a soft progress animation style, a warm card, and Kiko thinking. Keep it non-technical. Do not show AI provider names, debug states, fallback language, or bottom navigation.

### 08 Scan Error

Output: one individual 9:16 mobile image labeled **08 Scan Error**.

Create a friendly bad-photo or non-food state.

Copy:

```text
Hmm, I can’t read this meal yet.
```

Subcopy:

```text
Try a clearer photo with the food centered.
```

Buttons:

```text
Try Again
Back to Scan
```

Kiko should look reassuring, not sad. This screen can represent unclear food, poor lighting, bad framing, permission friction, or a retryable scan issue, but keep the visible copy simple. Do not expose technical errors, provider names, or AI failure language. Do not show bottom navigation.

### 09 Scan Result

Output: one individual 9:16 mobile image labeled **09 Scan Result**.

Create the post-scan result as a focused scan-flow screen. Use a clean top bar with a back or close action. Do not show bottom navigation unless intentionally designing an alternate in-tab variant.

Include:

- Clean top bar
- Dynamic `{dishName}`
- Rounded `{scanImage}` or dish image that matches `{dishName}`
- Green savings card using `{savingsAmount}` as an estimate
- Confidence, `{difficulty}`, and `{cookTime}` stats
- Mode tabs: `Restaurant Style`, `Budget`, `Lighter`
- Selected mode card
- Primary CTA: `View Recipe`
- Secondary actions: `Share`, `Save Recipe`, `Groceries`

Do not use “copycat,” AI labels, provider names, debug text, or placeholder dish names. If using example data, use one realistic dish and matching food image; otherwise use readable dynamic tokens.

### 10 Recipe Overview

Output: one individual 9:16 mobile image labeled **10 Recipe Overview**.

Create a generated recipe overview as a focused recipe-flow screen with a top back action and no bottom navigation. Use the same warm cards and food-focused hierarchy.

Include:

- Savings summary card
- What you’re making, using `{dishName}`
- `{cookTime}`
- `{servings}`
- `{difficulty}`
- Equipment
- Ingredients grouped by category
- Primary CTA: `Start Cooking`

Show only the first few ingredient groups above the fold and imply vertical scrolling for the rest. Keep the content readable and not overcrowded. Do not show bottom navigation.

### 11 Recipe Instructions

Output: one individual 9:16 mobile image labeled **11 Recipe Instructions**.

Create a focused step-by-step cooking screen with a clear timeline style, top progress indicator, and no bottom navigation.

Each visible step should include:

- Step number
- Action
- Time
- Beginner cue
- Optional tip only when useful

Avoid repeated “optional boost” cards. Show 2-3 readable steps and imply vertical scrolling or next-step progression for the rest. Do not clutter the screen with too many steps at once.

### 12 Grocery List

Output: one individual 9:16 mobile image labeled **12 Grocery List**.

Create a practical, clean shopping list screen in the recipe flow. Use a top back action and do not show bottom navigation.

Header:

```text
Grocery List
```

Subcopy:

```text
Everything you need for this homemade version.
```

Buttons:

```text
Copy List
Share List
```

List groups:

```text
Produce
Protein
Dairy
Pantry
Sauces
```

Use rounded checkboxes, grouped cards, and green checked states. Show only enough items to be readable and imply vertical scrolling for longer grocery lists.

### 13 Share Preview

Output: one individual 9:16 mobile image labeled **13 Share Preview**.

Create a focused social share preview screen inside the app with no bottom navigation. It should feel viral and postable while staying premium and uncluttered. Include a scaled 9:16 share card preview inside the screen, but keep the preview text large enough to read.

Share card concept:

```text
{dishName} remade at home
```

Before/after food image label:

```text
Restaurant → Homemade
```

Stats:

```text
Cuisine style
Cooking time
Recipe steps
Difficulty
Cooking streak
Rarity
```

Footer:

```text
Made with Okyo
```

Buttons:

```text
Share
Copy Caption
Save Image
```

Keep the share card aligned to Okyo colors and typography. Do not make it look like a generic social template.

### 14 Viral Share Card Export

Output: one individual 9:16 image labeled **14 Viral Share Card Export**.

This is the actual exported share card, not an app screen. It should have no app UI chrome, no bottom navigation, no phone frame, and no device border. It should look like a polished TikTok or Instagram Story asset in Okyo’s brand system.

Use:

```text
{dishName} remade at home
Restaurant → Homemade
Cuisine Style: {cuisineType}
Cooking Time: {cookTime}
Recipe Steps: {stepCount}
Difficulty: {difficulty}
Cooking Streak: {streak}
Rarity: {rarity}
Made with Okyo
```

Keep it elegant, minimal, warm, food-focused, and limited to Okyo colors. Use rounded food imagery and strong readable stats.

### 15 Save Confirmation

Output: one individual 9:16 mobile image labeled **15 Save Confirmation**.

Create a warm success state after saving a recipe.

Copy:

```text
Saved to your swaps.
```

Subcopy:

```text
You can remake it anytime.
```

CTA:

```text
View Library
```

Use a green success accent and a small happy Kiko if helpful. Keep this as a focused confirmation state and do not show bottom navigation unless intentionally designing an in-tab success variant.

### 16 Library / Saved Recipes

Output: one individual 9:16 mobile image labeled **16 Library / Saved Recipes**.

Create the saved recipe library inside the app shell. Include bottom navigation with the standard five tabs and raised orange Scan tab.

Header:

```text
Saved Swaps
```

Hero:

```text
Recipes worth remaking
```

Include:

- Search
- Filter chips: `Recent`, `Restaurant Style`, `Budget`, `Lighter`
- Saved recipe cards with food thumbnail, `{dishName}`, mode, `{savingsAmount}`, `{difficulty}`, and `{cookTime}`

Show 2-3 saved cards and imply vertical scrolling for more. Use warm cards, consistent food thumbnails, and green savings tags. Avoid clutter and tiny text.

### 17 Empty Library

Output: one individual 9:16 mobile image labeled **17 Empty Library**.

Create the empty state for saved recipes inside the app shell. Include bottom navigation with the standard five tabs and raised orange Scan tab.

Kiko should hold a recipe card and stay consistent with the design sheet.

Copy:

```text
No saved swaps yet.
```

Subcopy:

```text
Scan a meal and save your favorite homemade versions here.
```

CTA:

```text
Scan a Meal
```

Keep the empty state supportive and useful, not sad or overly cute.

### 18 Savings Dashboard

Output: one individual 9:16 mobile image labeled **18 Savings Dashboard**.

Create the savings dashboard inside the app shell. Include bottom navigation with the standard five tabs and raised orange Scan tab.

Header:

```text
Savings
```

Hero:

```text
You’ve kept {totalSavings} in your kitchen.
```

Cards:

```text
This week
This month
Saved swaps
Challenges completed
Average per swap
Biggest single win
```

Use green highlights and large readable savings numbers. Show the hero plus 3-4 metric cards above the fold and imply scrolling for additional stats. Keep it food/savings-focused, not like a bank or finance dashboard.

### 19 Discover

Output: one individual 9:16 mobile image labeled **19 Discover**.

Create a discovery page for recipe packs and inspiration inside the app shell. Include bottom navigation with the standard five tabs and raised orange Scan tab.

Header:

```text
Discover
```

Sections:

```text
Trending swaps
Easy weeknight remakes
Budget favorites
Restaurant-inspired packs
```

Use warm food cards, rounded thumbnails, and short friendly labels. Show a few horizontal rows or stacked cards with scroll implied. Avoid generic feed clutter.

### 20 Packs

Output: one individual 9:16 mobile image labeled **20 Packs**.

Create a restaurant-inspired packs screen inside the app shell. Include bottom navigation with the standard five tabs and raised orange Scan tab.

Header:

```text
Restaurant-inspired packs
```

Card examples:

```text
Pasta Night Pack
Cafe Drinks Pack
Burger Night Pack
Takeout Bowls Pack
```

Cards should feel curated and premium, with food-focused thumbnails and warm Okyo styling. Show 3-4 cards above the fold and imply scrolling for more. Do not use “copycat.”

### 21 Remake Challenge

Output: one individual 9:16 mobile image labeled **21 Remake Challenge**.

Create a cooking challenge entry screen. This can appear from the progress area, but keep it focused with a clear top bar and no bottom navigation if it feels like a task flow.

Header:

```text
Remake Challenge
```

Copy:

```text
Cook your Okyo recipe, compare it, then rate how close you got.
```

Steps:

```text
Cook your recipe
Compare taste, texture, and look
Rate your result
```

CTA:

```text
Start Challenge
```

Make it motivating, warm, and simple. Avoid competitive social-feed styling.

### 22 Rate Match

Output: one individual 9:16 mobile image labeled **22 Rate Match**.

Create the focused post-cooking rating screen with a top back action and no bottom navigation.

Ask:

```text
How close did you get?
```

Controls:

```text
Taste
Texture
Look
Overall
```

CTA:

```text
Save Result
```

Use friendly sliders, segmented controls, or rounded rating chips with large labels. Keep it encouraging and honest, and avoid tiny control text.

### 23 Progress / Kitchen

Output: one individual 9:16 mobile image labeled **23 Progress / Kitchen**.

Create a gamified progress page inside the app shell. Include bottom navigation with the standard five tabs and raised orange Scan tab. Keep the page useful first and gamified second.

Header:

```text
Kiko’s Kitchen
```

Show:

- Weekly goal
- Cooking streak
- Kitchen unlocks
- Saved money
- Recipes cooked

Kiko can appear as a small proud guide. Use reward gold carefully for achievements and green for savings/progress. Keep it premium, not childish.

### 24 Profile

Output: one individual 9:16 mobile image labeled **24 Profile**.

Create the user profile screen inside the app shell. Include bottom navigation with the standard five tabs and raised orange Scan tab.

Header:

```text
Profile
```

Include:

- User name
- Cooking streak
- Total saved
- Recipes remade
- Settings row

Keep it simple, warm, and non-corporate. Avoid unnecessary analytics charts or social profile clutter.

### 25 Settings

Output: one individual 9:16 mobile image labeled **25 Settings**.

Create a clean, non-developer settings screen. Do not show debug controls or technical provider settings.

Sections:

```text
Account
Preferences
Notifications
Appearance
Support
Privacy
```

Buttons:

```text
Reset Onboarding
Delete Saved Data
```

Use tidy rows, beige dividers, and calm spacing. Show only the first several settings rows and imply scrolling for the rest. Do not show bottom navigation unless intentionally designing a nested tab-shell variant.

### 26 Paywall / Okyo Pro

Output: one individual 9:16 mobile image labeled **26 Paywall / Okyo Pro**.

Create a premium Okyo Pro screen. Keep it warm, friendly, simple, and focused on cooking smarter.

Headline:

```text
Cook smarter with Okyo Pro
```

Benefits:

```text
Unlimited scans
Personalized swaps
Weekly meal plans
Savings tracker
Kiko’s Kitchen rewards
```

CTA:

```text
Start Free Trial
```

Secondary:

```text
Maybe later
```

Use orange for the primary CTA, green/gold accents for value, and a restrained Kiko or food visual only if it improves clarity. Keep benefit copy short and readable. Do not show bottom navigation unless intentionally presenting it as an in-app upsell.

## Export Checklist

Before considering the image set complete, verify every item below:

- [ ] There are exactly 26 separate generated images.
- [ ] Every image is 9:16 and iPhone-sized.
- [ ] Each image is labeled with the correct screen number and screen name.
- [ ] No image is a collage, contact sheet, mood board, desktop layout, tablet layout, or phone mockup frame.
- [ ] The warm cream background, white cards, beige borders, orange CTAs, green savings accents, charcoal text, and rounded typography are consistent across the full set.
- [ ] Bottom navigation appears only where appropriate and always uses `Home`, `Discover`, `Scan`, `Plan`, `Profile` with the raised orange center Scan tab.
- [ ] Kiko matches the same design sheet and proportions wherever Kiko appears.
- [ ] Kiko is only used where helpful and does not overwhelm utility screens.
- [ ] No screen uses “copycat,” provider names, debug labels, placeholder copy, “AI fallback,” “OpenRouter,” or technical AI language.
- [ ] No buttons, cards, bottom nav items, or important text are clipped.
- [ ] Text is readable at mobile size and there is no horizontal overflow.
- [ ] Food imagery is appetizing, rounded, warm, relevant, and matches the dish/type shown.
- [ ] Dynamic fields are either shown with readable tokens or realistic matching example data; no missing data appears as placeholder garbage.
- [ ] Scrollable screens show readable top content and imply scrolling instead of shrinking everything to fit.
- [ ] The set feels like one premium, simple, food-focused Okyo product rather than 26 unrelated concepts.
>>>>>>> theirs
