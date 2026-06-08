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
