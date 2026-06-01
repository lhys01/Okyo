# OKYO UI REDESIGN — 9 Core Screens

**Version:** 2.0 Premium Redesign  
**Date:** May 2026  
**Brand:** Cute, clean, premium, warm, friendly food app  
**Goal:** App Store-quality experience with polished design system

---

## DESIGN SYSTEM FOUNDATIONS

### Color Palette
- **Background:** Warm cream `#FEFBF7` or `#FAF8F3`
- **Primary Action:** Warm orange-red `#F97316` or `#FF6B35`
- **Savings/Success:** Soft green `#86EFAC` (button/chip) with `#166534` (text)
- **Text Primary:** Dark charcoal `#1F2937` or `#2B2D31`
- **Text Secondary:** Warm gray `#78716F` or `#A1A1A1`
- **Card Background:** Pure white `#FFFFFF`
- **Border/Divider:** Soft beige `#E8E3DB` or `#E5DDD5`
- **Accent Chips:** Soft green, soft orange, soft blue, soft yellow (all muted)

### Typography
- **Headlines (XL):** 28-32px, bold/700, dark charcoal, leading 1.2
- **Headlines (L):** 22-24px, bold/700, dark charcoal, leading 1.2
- **Body (Regular):** 16px, 500, dark charcoal, leading 1.5
- **Body (Small):** 14px, 400, warm gray, leading 1.4
- **Labels/Chips:** 13-14px, 600, dark charcoal, leading 1.2
- **Buttons:** 16px, 600, white or dark, leading 1

### Spacing & Layout
- **Page padding:** 16px left/right on mobile
- **Card padding:** 16-20px
- **Gap between cards:** 12-16px
- **Gap within card sections:** 8-12px
- **Bottom safe area padding:** 20px + tab bar height

### Cards & Corners
- **Border radius:** 16px standard, 12px for smaller cards
- **Card shadows:** Subtle `0 2px 8px rgba(0,0,0,0.06)` or no shadow, just soft border
- **Border:** 1px soft beige when used instead of shadow

### Button Styling
- **Primary Button (Large):** 
  - Background: orange `#F97316`
  - Text: white, 16px bold
  - Padding: 16px top/bottom, full width
  - Border radius: 12px
  - Height: 56px
  - Tap state: slightly darker orange or reduced opacity

- **Secondary Button:**
  - Background: white or light cream
  - Border: 1px soft beige
  - Text: dark charcoal, 16px bold
  - Padding: 14px top/bottom
  - Border radius: 12px

- **Small Action Button:**
  - Background: white
  - Border: 1px soft beige
  - Text: 14px, 600
  - Padding: 10px horizontal, 8px vertical
  - Border radius: 8px

### Navigation Bar
- **Style:** Modern, polished, not placeholder triangles
- **Background:** White or very slightly warm
- **Border top:** 1px soft beige
- **Icons:** 24px, solid, charcoal
- **Active icon:** Orange
- **Label:** 12px, 600, centered below icon
- **Safe area:** Account for notch/home indicator

### Empty States & Error States
- **Empty state:** Kiko illustration (small, 80-120px) + headline + supportive copy + CTA
- **Error state:** Friendly copy, no technical jargon, Kiko reaction if appropriate
- **Loading state:** Subtle spinner, loading message, possible Kiko thinking state

---

## SCREEN 1 — HOME / MAIN SCAN SCREEN

**Purpose:** First experience in the app. Hook user on simplicity and magic. Make scanning feel fast and exciting.

### Layout (Top to Bottom)

#### 1. Safe Area Padding
- 12px top padding

#### 2. Header Bar
- No header text needed, or simple "Okyo" logo if brand icon is available
- Subtle settings icon (24px) top right, if needed
- Otherwise blank for clean look

#### 3. Hero Headline
- Text: "What are we remaking today?"
- Style: 28px bold, dark charcoal, leading 1.2
- Padding: 20px top, 16px left/right
- Subtext: Optional small gray text "Scan a restaurant dish to start"

#### 4. Spacing
- 20px gap

#### 5. Primary Scan Card (Large)
- Background: Warm gradient or pure white with soft border
- Content: Icon (camera or scan icon, 48px orange) + text overlay
- Text: "Take a photo"
- Aspect ratio: ~1:1 square or 16:10 rectangular
- Padding: 32px all around
- Border radius: 16px
- Tap action: Open camera
- Tap visual: Slight scale/shadow feedback

#### 6. Action Buttons Row
- Two buttons side-by-side, equal width
- Button 1: "Upload photo" — Secondary white button
- Button 2: "Try demo" — Secondary white button
- Gap: 12px between
- Height: 48px each

#### 7. Spacing
- 24px gap

#### 8. Recent/Quick Access Section (Optional)
- Small headline: "Recent" (if there are recent scans)
- Horizontal scroll of 2-3 recent recipe cards OR
- Single featured saved recipe preview card
- If empty: Hidden

#### 9. Kiko Placement (Optional)
- Small Kiko (60-80px) in corner suggesting "Let's cook something cool" or similar
- Only if it feels natural
- Never dominates the screen

#### 10. Bottom Safe Area
- 20px padding for navigation

### Main Cards/Components

**Primary Scan Card:**
- Icon: Large camera or scan icon (48px, orange)
- Text overlay: "Take a photo"
- Border radius: 16px
- Background: White or very light cream
- On press: Opens camera picker

**Recent Recipe Preview (if shown):**
- Small card, horizontal layout
- Thumbnail (if available), title, mode chip, savings
- Tap: Navigate to library or recipe detail

### Exact Recommended Copy

- **Hero headline:** "What are we remaking today?"
- **Subtext:** "Scan a restaurant dish to start"
- **Button 1:** "Upload photo"
- **Button 2:** "Try demo"
- **Section header (if needed):** "Recent"
- **Kiko tip (if used):** "Tap to scan a dish and I'll find you the recipe!"

### Button Labels and Order

1. **Primary interaction:** Large scan card (camera)
2. **Secondary actions:** "Upload photo" | "Try demo" (side by side)
3. **Tertiary:** Settings icon (top right, subtle)

### What Dynamic Data Should Appear

- Recent scan history (if any)
- Last saved recipe preview (optional)
- Week streak or XP badge (optional, subtle)

### Empty/Error State

- **First time user:** Full screen with hero headline, large scan card, explanation copy
- **Network error:** Friendly message, retry button, demo mode still available
- **Camera permission denied:** Message explaining why, settings link

### Kiko Usage

- Small Kiko in corner being helpful and encouraging
- Not center-stage
- Expression: Happy, friendly, eager
- One short callout line max

### Fixes from Current Screenshots

- ✅ Remove placeholder "Mock story card"
- ✅ Remove blue gear
- ✅ No debug metadata visible
- ✅ Clean, simple top bar (no duplicate headers)
- ✅ Primary scan card is clear and tappable
- ✅ Secondary actions (upload, demo) are obvious
- ✅ No horizontal overflow
- ✅ Everything fits in mobile viewport

### Visual Style Notes

- **Spacing:** Generous but not wasted (20-24px gaps between sections)
- **Colors:** Warm cream background, white card, orange accent for CTA
- **Typography:** Large friendly headline (28px), small supporting text in gray
- **Depth:** Subtle shadow or soft border on main card
- **Motion:** Smooth tap feedback, no jarring transitions

### Developer Checklist

- [ ] Header bar is minimal (logo/settings only)
- [ ] Hero headline is large, bold, friendly
- [ ] Primary scan card is square or rectangular, obvious tap target
- [ ] "Upload photo" and "Try demo" buttons are side-by-side, equal width
- [ ] Button height is 48px minimum
- [ ] Recent section only shows if there's data
- [ ] Kiko (if shown) is 60-80px, positioned corner
- [ ] Bottom padding accounts for safe area
- [ ] Camera/scan icon is orange 48px
- [ ] No developer debug info visible
- [ ] Colors match design system exactly
- [ ] Font sizes and weights match spec

---

## SCREEN 2 — RESULT SUMMARY SCREEN

**Purpose:** Show scan result, dish identified, savings calculated, mode options. User chooses recipe variant and decides next action.

### Layout (Top to Bottom)

#### 1. Header Bar
- **Left:** "Scan again" button (text or icon, 24px)
- **Center:** "Result" text (small, 14px, optional)
- **Right:** Subtle settings or help icon (24px)
- Minimal, no blue gear

#### 2. Dynamic Dish Title
- Text: Detected dish name (e.g., "Margherita Pasta")
- Style: 28px bold, dark charcoal, centered
- Example: "Margherita Pasta"

#### 3. Subtitle
- Text: "Homemade restaurant-style swap" or "Restaurant-style recipe"
- Style: 14px, 500, warm gray, centered
- Padding: 4px bottom

#### 4. Spacing
- 16px gap

#### 5. Scanned Food Image Card
- Aspect ratio: 1:1 square or 16:9 (decide based on image dimensions)
- Image: User's scanned photo
- Border radius: 16px
- Shadow: Subtle
- Padding: 16px left/right
- Width: Full width minus padding

#### 6. Spacing
- 16px gap

#### 7. Savings Summary Card
- Background: Soft green `#ECFDF5` or cream
- Border: 1px soft beige or green
- Padding: 16px
- Border radius: 12px
- Content layout:
  - **Top row:** "You save"
  - **Big amount:** "$X.XX" (green text `#166534`, 32px bold)
  - **Below:** Small row showing "Restaurant $X.XX" → arrow → "Home $X.XX"
- Example: "$24.60 saved" | "Restaurant $38.00" → "Home $13.40"

#### 8. Spacing
- 12px gap

#### 9. Stats Row (Three columns)
- Card background: White with soft border
- Padding: 12px
- Three equal-width sections:
  1. **Confidence / Match Score**
     - Icon: Checkmark or lightbulb (16px, orange)
     - Label: "Match" (12px, gray)
     - Value: "87%" (16px bold, charcoal)
  2. **Difficulty**
     - Icon: Fork/spoon (16px, orange)
     - Label: "Difficulty" (12px, gray)
     - Value: "Medium" or "Easy" (16px bold, charcoal)
  3. **Time**
     - Icon: Clock (16px, orange)
     - Label: "Time" (12px, gray)
     - Value: "30 min" (16px bold, charcoal)
- Centered text, dividers between columns (soft border)

#### 10. Spacing
- 16px gap

#### 11. Mode Selection Tabs
- Three tabs: "Restaurant Style" | "Budget" | "Lighter"
- Background: White with soft border, each tab bordered
- Active tab: Orange background, white text
- Inactive tab: White background, charcoal text
- Padding: 12px each tab
- Height: 44px
- Border radius: 12px
- Tap: Switch mode, update recipe card below

#### 12. Spacing
- 12px gap

#### 13. Selected Mode Recipe Card
- Background: White
- Border: 1px soft beige
- Padding: 16px
- Border radius: 12px
- Content:
  - **Top row:** Mode name (14px bold, orange) + "Recommended" badge (optional)
  - **Title:** Recipe name (18px bold, charcoal)
  - **Description:** Short 1-2 line explanation (14px, gray)
  - **Chips row:** 
    - Match score chip: "92% match" (soft green background, dark green text, 12px bold)
    - Savings chip: "$24.60" (soft orange background, dark orange text, 12px bold)
    - Servings chip: "Serves 2" (soft blue background, dark blue text, 12px bold)

#### 14. Spacing
- 16px gap

#### 15. Primary CTA Button
- Text: "View Recipe"
- Background: Orange `#F97316`
- Text: White, 16px bold
- Padding: 16px top/bottom
- Full width
- Height: 56px
- Border radius: 12px
- Tap: Navigate to RecipeDetailScreen

#### 16. Spacing
- 12px gap

#### 17. Secondary Action Buttons
- Three buttons in a row or stacked (decide based on space):
  - Button 1: "Share" (white border, charcoal text)
  - Button 2: "Save recipe" (white border, charcoal text)
  - Button 3: "View groceries" (white border, charcoal text)
- Height: 44px
- Width: Equal if row, full width if stacked
- Border radius: 12px
- Gap: 12px

#### 18. Bottom Safe Area
- 20px padding

### Main Cards/Components

**Savings Card:**
- Shows restaurant price → home cost with big savings amount
- Green accent
- 12px border radius

**Stats Row:**
- Three metrics: match, difficulty, time
- White card, icons, centered text

**Mode Tabs:**
- Three radio-style buttons
- Active: orange background
- Easy visual selection

**Recipe Card:**
- Shows selected recipe variant
- Include match %, savings, servings chips

### Exact Recommended Copy

- **Header center (optional):** "Result"
- **Header left button:** "Scan again"
- **Dish title:** Use dynamic dish name (e.g., "Margherita Pasta")
- **Subtitle:** "Homemade restaurant-style swap"
- **Savings card row:** "You save"
- **Savings amount:** "$X.XX" (calculated)
- **Price breakdown:** "Restaurant $X.XX → Home $X.XX"
- **Stats labels:** "Match" | "Difficulty" | "Time"
- **Mode tabs:** "Restaurant Style" | "Budget" | "Lighter"
- **Mode card label:** Selected mode name
- **Chips:** "92% match" | "$24.60 saved" | "Serves 2"
- **Primary button:** "View Recipe"
- **Secondary buttons:** "Share" | "Save recipe" | "View groceries"

### Button Labels and Order

1. **Primary:** "View Recipe" (orange, large)
2. **Secondary (row or stack):** "Share" | "Save recipe" | "View groceries"
3. **Header action:** "Scan again" (left)

### What Dynamic Data Should Appear

- Scanned food image
- Detected dish name
- Match confidence %
- Restaurant price
- Estimated home cost
- Savings amount
- Difficulty level
- Time estimate
- Difficulty/time per mode
- Recipe description per mode
- Servings
- Match score per mode

### Empty/Error State

- **Scan failed:** Remove all cards, show friendly error message with Kiko sympathetic face, "Try again" button, explain why (photo was blurry, not food, etc.)
- **Network error:** Retry button, fallback to demo mode if available
- **Partial result:** Show what we detected, explain recipe generation incomplete, offer demo mode

### Kiko Usage

- **Only in error/partial state:** Kiko with sympathetic or encouraging expression
- **Otherwise:** No Kiko on this screen
- If used: Small (60-80px), top-right or beside error message

### Fixes from Current Screenshots

- ✅ Remove duplicate header (no "Analyzing" + gear + result header trio)
- ✅ Remove blue gear icon
- ✅ Remove AI/OpenRouter/debug labels
- ✅ Remove "AI recipe match" text
- ✅ Image card fits without clipping
- ✅ Mode tabs don't overflow or clip text
- ✅ No repeated information
- ✅ Clean top bar with only "Scan again" and settings
- ✅ Savings card is prominent, easy to understand
- ✅ Stats are readable and clear
- ✅ Recipe card shows only relevant info per mode
- ✅ Buttons all visible, no clipping

### Visual Style Notes

- **Spacing:** 16px between major sections, 12px within cards
- **Colors:** Cream background, white cards, orange primary, green savings highlight
- **Typography:** Large bold dish name, smaller supporting text
- **Depth:** Soft shadows or 1px borders on all cards
- **Layout:** Vertical scroll, single column, full width

### Developer Checklist

- [ ] Header has "Scan again" left, optional settings right
- [ ] Dish name is dynamic and uses detected dish name
- [ ] Subtitle text: "Homemade restaurant-style swap"
- [ ] Image card is square or 16:9, responsive, no clipping
- [ ] Savings card shows "$X.XX", restaurant price, home cost
- [ ] Stats row has 3 equal columns with icons, labels, values
- [ ] Mode tabs are radio-style, switch on tap
- [ ] Recipe card updates when mode changes
- [ ] Recipe card shows match %, savings, servings chips
- [ ] "View Recipe" button is orange, full width, 56px height
- [ ] Secondary buttons: "Share", "Save recipe", "View groceries"
- [ ] No AI/debug labels visible
- [ ] No blue gear icon
- [ ] Colors match palette exactly
- [ ] All text visible, no overflow
- [ ] Bottom safe area padding included

---

## SCREEN 3 — RECIPE DETAIL / INGREDIENTS SCREEN

**Purpose:** Show what the user is making and all ingredients organized by component/section.

### Layout (Top to Bottom)

#### 1. Header Bar
- **Left:** Back arrow (24px, charcoal)
- **Center:** "Recipe" (text, 14px, optional)
- **Right:** Share icon or empty (optional)
- Minimal line or soft border below

#### 2. Spacing
- 16px

#### 3. Recipe Title
- Text: Dynamic recipe name (e.g., "Homemade Margherita Pasta")
- Style: 24px bold, dark charcoal
- Padding: 0 16px

#### 4. "What you're making" Card
- Background: Soft accent background (maybe very light green or cream)
- Border: 1px soft border
- Padding: 16px
- Border radius: 12px
- Content:
  - **Row 1:** Mode chip (e.g., "Restaurant Style") on left
  - **Row 2:** Short description (2-3 lines max, 14px, gray)
  - **Row 3:** Three inline badges:
    - Servings: "Serves 2"
    - Difficulty: "Medium"
    - Time: "30 min total"
- Margin: 16px left/right

#### 5. Spacing
- 12px

#### 6. Savings Summary (Small Version)
- Horizontal card or two-column layout
- Left: "Estimated cost" + "$X.XX" (orange, bold)
- Right: "Saves $X.XX" (green text, green background chip)
- Padding: 12px
- Border radius: 12px
- Margin: 16px left/right

#### 7. Spacing
- 20px

#### 8. "Ingredients" Section Header
- Text: "Ingredients"
- Style: 18px bold, dark charcoal
- Margin: 16px left/right

#### 9. Ingredients by Component (Multiple sections)
- For pasta: Crust | Sauce | Cheese | Toppings
- For burger: Patty | Sauce | Assembly
- For pizza: Dough | Sauce | Cheese | Toppings
- For other: logical groupings or single "Ingredients" list

#### 10. Each Component Section
- **Header row:**
  - Component name (e.g., "Sauce")
  - Small gray subtitle (e.g., "Makes it rich and tangy")
  - Expandable toggle (arrow icon) if collapsible, or always expanded
- **Ingredient list:**
  - Bullet or number format
  - Each line: amount + unit + ingredient name (e.g., "2 tbsp olive oil")
  - Text: 14px, 400, charcoal
  - Line height: 1.6 for easy reading
  - Padding: 12px left/right, 8px between items
- **Background:** White card with soft border
- **Padding:** 16px card padding
- **Border radius:** 12px
- **Margin:** 16px left/right, 12px between sections

#### 11. Spacing
- 20px

#### 12. Optional Kiko Tip Card
- Only if there's a genuinely helpful beginner tip
- Card background: Soft yellow or cream
- Border: 1px soft border
- Padding: 12px
- Border radius: 12px
- Content:
  - Kiko icon (small, 32px)
  - Text: "Pro tip: Emulsify the sauce slowly to avoid breaking"
  - Font: 14px, gray
- Margin: 16px left/right
- **Only include if it adds real value, not just for decoration**

#### 13. Spacing
- 20px

#### 14. Action Button
- Text: "Start Cooking"
- Background: Orange
- Padding: 16px top/bottom, 16px left/right sides
- Full width
- Height: 56px
- Border radius: 12px
- Margin: 16px left/right
- Tap: Navigate to RecipeInstructionsScreen

#### 15. Bottom Safe Area
- 20px padding

### Main Cards/Components

**"What You're Making" Card:**
- Description, mode, servings, difficulty, time
- Soft accent background

**Savings Card:**
- Small horizontal layout showing estimated cost and savings

**Component Ingredient Sections:**
- Each section is a white card
- Organized by component (Sauce, Crust, etc.)
- List format, 1 ingredient per line

**Kiko Tip Card (optional):**
- Yellow/cream background, Kiko icon, short helpful text
- Only if truly useful

### Exact Recommended Copy

- **Header center:** "Recipe"
- **Card heading:** "What you're making"
- **Description:** Recipe description (dynamic, 2-3 lines)
- **Mode chip:** "Restaurant Style" or selected mode
- **Badges:** "Serves 2" | "Medium" | "30 min total"
- **Cost row:** "Estimated cost" + "$X.XX"
- **Savings row:** "Saves $X.XX"
- **Section header:** "Ingredients"
- **Component headers:** "Sauce", "Crust", "Cheese", "Toppings", etc. (contextual)
- **Component subtitle:** Brief flavor/purpose (e.g., "Makes it rich and tangy")
- **Ingredient lines:** "2 tbsp olive oil", "1 can (28 oz) crushed tomatoes", etc. (dynamic)
- **Kiko tip:** Context-specific tip (e.g., "Pro tip: Add pasta water to help sauce cling")
- **Button:** "Start Cooking"

### Button Labels and Order

1. **Header back:** Back arrow
2. **Primary action:** "Start Cooking" (orange, large)
3. **Header right (optional):** Share icon

### What Dynamic Data Should Appear

- Recipe name
- Mode name
- Description
- Servings
- Difficulty level
- Total time
- Estimated home cost
- Savings amount
- Component names
- Component descriptions
- Ingredient lists per component (amount, unit, name)
- Optional beginner tips

### Empty/Error State

- **No recipe data:** Show loading spinner or fallback message
- **Very short ingredient list:** Still organize by component, don't leave empty space

### Kiko Usage

- **One small Kiko tip card** only if there's a genuinely helpful cooking tip
- **Do not use Kiko for generic advice** (e.g., "Measure carefully")
- **Never more than one Kiko element per screen**
- If used: 32px Kiko icon, small card, 14px text

### Fixes from Current Screenshots

- ✅ Remove duplicate headers
- ✅ Remove blue gear
- ✅ Remove "Optional boost" cards after every step (this is ingredients screen, not steps)
- ✅ Ingredients organized by component (Sauce/Crust/Cheese/Toppings for pasta)
- ✅ Clean, readable ingredient list
- ✅ Savings summary visible
- ✅ No raw text wall, proper spacing
- ✅ Kiko tip only if useful
- ✅ All text readable, no overflow

### Visual Style Notes

- **Spacing:** 16px margins, 12px between cards, 8px between ingredients
- **Colors:** Cream background, white cards, orange accent for button, green for savings
- **Typography:** Large recipe title (24px), section headers (18px), ingredient text (14px)
- **Layout:** Single column, vertical scroll
- **Depth:** Soft borders on cards, subtle shadows

### Developer Checklist

- [ ] Header has back button and minimal center text
- [ ] Recipe title is dynamic
- [ ] "What you're making" card shows description, mode, servings, difficulty, time
- [ ] Savings card shows cost and savings
- [ ] Ingredients organized by component (e.g., Sauce, Crust, Cheese, Toppings)
- [ ] Each component is a separate white card
- [ ] Ingredient list shows amount, unit, ingredient name
- [ ] Ingredient list is readable (14px, good line height)
- [ ] Kiko tip card only appears if there's data and only one per screen
- [ ] "Start Cooking" button is orange, full width, 56px
- [ ] No blue gear
- [ ] No AI/debug labels
- [ ] Colors match palette
- [ ] Bottom safe area padding
- [ ] No text overflow or clipping

---

## SCREEN 4 — RECIPE INSTRUCTIONS / COOKING STEPS SCREEN

**Purpose:** Step-by-step guide to cook the recipe. Clean, readable while cooking.

### Layout (Top to Bottom)

#### 1. Header Bar
- **Left:** Back arrow (24px)
- **Center:** "Cooking" or optional step counter (e.g., "Step 1 of 8")
- **Right:** Timer icon or empty
- Minimal

#### 2. Spacing
- 12px

#### 3. Recipe Progress Indicator (Optional)
- Horizontal line or dots showing steps 1-8
- Current step highlighted in orange
- Previous steps in light gray
- Upcoming steps very light gray
- Padding: 16px left/right

#### 4. Spacing
- 16px

#### 5. Current Step Card (Large, Full Width)
- Background: White with soft border
- Padding: 20px
- Border radius: 16px
- Margin: 16px left/right
- Content layout:
  - **Step number:** "Step 1" (small, 12px, orange, 600)
  - **Step title/action:** "Boil the pasta water" (20px bold, charcoal)
  - **Step description:** 2-3 sentences explaining what to do (14px, gray, line-height 1.6)
  - **Time estimate:** Small gray text, "Est. 8 min"
  - **Cue/done indicator:** Small green chip with checkmark "When it boils"

#### 6. Spacing
- 12px

#### 7. Optional Contextual Boost Card (Only if relevant)
- **When to show:** Only when genuinely useful for this specific step, NOT repeated every step
- **Card style:** Soft blue/purple background, border, 12px radius
- **Content:**
  - Kiko icon (24px)
  - Boost title: "Pro technique" (12px bold, title-cased)
  - Boost text: "Use high heat to bring water to a boil faster" (13px, gray, max 2 lines)
  - **Do NOT repeat the same boost multiple times**
  - **Each boost must be unique and contextual to this step**
- **Margin:** 16px left/right
- **Remove completely if not applicable to this step**

#### 8. Spacing
- 16px

#### 9. Beginner Note / Safety Card (Only if needed)
- **When to show:** Only if step has genuine safety concern or common beginner mistake
- **Card style:** Soft yellow background, 1px border, 12px radius
- **Content:**
  - Icon: Lightbulb or exclamation (20px, warm orange)
  - Text: "Make sure the water is at a rolling boil before adding pasta" (13px, gray)
- **Do NOT show for every step**
- **Margin:** 16px left/right

#### 10. Spacing
- 16px

#### 11. Cooking Terms / Helper Chip (If applicable)
- **When to show:** If step uses cooking terminology user might not know
- **Style:** Small white cards with soft border, 8px padding, 10px radius
- **Text:** "What is 'al dente'?" (12px, charcoal, underline or icon)
- **Tap action:** Show small tooltip or expand to definition
- **Margin:** 16px left/right
- **Example terms:** "emulsify", "fold", "sear", "deglaze"
- **Do NOT use for common actions** (boil, stir, etc.)

#### 12. Spacing
- 20px

#### 13. Navigation Buttons (Bottom)
- Two buttons side-by-side:
  - **Left:** "Previous" (secondary white button, 44px height, gray text)
  - **Right:** "Next Step" (primary orange button, 44px height)
- Gap: 12px between
- Margin: 16px left/right
- Disabled state on first step: "Previous" is grayed out or hidden

#### 14. Optional Step-by-Step Timer
- If user sets timer for step: Show running countdown timer (16px bold orange)
- Positioned near step title or in footer

#### 15. Bottom Safe Area
- 20px padding

### Main Cards/Components

**Current Step Card:**
- Large, primary focus
- Shows step number, action, description, time, cue

**Optional Boost Card:**
- Only if unique and useful for this step
- Soft blue background, Kiko icon, short text
- **Never repeated**

**Beginner Note Card:**
- Only if genuine safety/common mistake
- Soft yellow background
- Not on every step

**Cooking Term Helper:**
- Small chip/button for terminology
- Tap to see definition

**Navigation Buttons:**
- Previous | Next
- Previous disabled on step 1

### Exact Recommended Copy

- **Header center:** "Cooking" or "Step 1 of 8"
- **Step number:** "Step 1" (orange)
- **Step action:** "Boil the pasta water"
- **Step description:** (Dynamic, 2-3 sentences describing the action)
- **Time estimate:** "Est. 8 min" (small, gray)
- **Cue/done chip:** "When it boils" (green, checkmark)
- **Boost card (if shown):** "Pro technique" + contextual text (e.g., "Use high heat to bring water to a boil faster")
- **Beginner note (if shown):** Contextual safety/tip (e.g., "Make sure the water is at a rolling boil before adding pasta")
- **Cooking term (if shown):** Question format: "What is 'al dente'?"
- **Navigation buttons:** "Previous" | "Next Step"
- **Button disabled (if applicable):** "Previous" is grayed out on step 1

### Button Labels and Order

1. **Header back:** Back arrow
2. **Primary navigation:** "Previous" (if not first step) | "Next Step"
3. **Header right (optional):** Timer icon

### What Dynamic Data Should Appear

- Current step number and total steps
- Step action/title
- Step description
- Time estimate
- Cue/completion indicator
- Unique contextual boosts (not repeated)
- Beginner notes (contextual, not generic)
- Cooking term definitions (if applicable)
- Step progress indicator

### Empty/Error State

- **No steps data:** Show fallback message, option to return to recipe
- **Last step:** "Next Step" becomes "Done!" or "Finish" button
- **Error loading steps:** Retry button

### Kiko Usage

- **Only in boost cards** if they appear
- **Small Kiko icon (20-24px)** next to "Pro technique" text
- **Not standalone** — always part of the boost card
- **Expression:** Helpful, thoughtful
- **Do not use Kiko for beginner warnings** — use lightbulb icon instead

### Fixes from Current Screenshots

- ✅ Remove repeated "Optional boost" after every step
- ✅ Each boost is unique and contextual
- ✅ No repeated generic text
- ✅ Step layout is clean and readable
- ✅ Time estimate visible
- ✅ Beginner notes only when needed
- ✅ Cooking terms as helper chips, not full cards
- ✅ Navigation buttons are obvious and working
- ✅ No blue gear
- ✅ No AI/debug labels
- ✅ Step number is visible
- ✅ All text readable while cooking

### Visual Style Notes

- **Spacing:** 16px margins, 12-20px between sections
- **Colors:** White main card, soft blue boost card, soft yellow beginner note, orange accents
- **Typography:** Large step title (20px), supporting text (14px), labels (12px)
- **Layout:** Single column, full-width step card, focused on current step
- **Readability:** Large text for cooking (16px minimum), high contrast

### Developer Checklist

- [ ] Header shows step progress (optional)
- [ ] Step number is orange (12px)
- [ ] Step title is large and bold (20px)
- [ ] Step description is 2-3 sentences, 14px, readable
- [ ] Time estimate shown in gray
- [ ] Cue/done indicator in green chip with checkmark
- [ ] Boost card only shows if data exists and is unique for this step
- [ ] Boost card is soft blue, not repeated
- [ ] Kiko icon in boost card only (24px)
- [ ] Beginner note only shows if needed, soft yellow
- [ ] Cooking term chips shown for terminology user might not know
- [ ] "Previous" button disabled on step 1 or hidden
- [ ] "Next Step" button orange and active
- [ ] Progress indicator (dots/line) shows current step
- [ ] Step counter in header (optional but helpful)
- [ ] No repeated content
- [ ] No generic repeated text
- [ ] Colors match palette
- [ ] Bottom safe area padding
- [ ] Text is readable at normal mobile distance

---

## SCREEN 5 — SHARE PREVIEW SCREEN

**Purpose:** Create a shareable card showing the recipe dupe result. User can post to social media.

### Layout (Top to Bottom)

#### 1. Header Bar
- **Left:** Close "X" (24px)
- **Center:** "Share Preview" (14px, optional)
- **Right:** Help icon (optional)
- Minimal

#### 2. Spacing
- 12px

#### 3. Headline
- Text: "Share your homemade win"
- Style: 22px bold, dark charcoal, centered
- Padding: 0 16px

#### 4. Subtext
- Text: "Post this card to inspire others"
- Style: 14px, 400, warm gray, centered
- Padding: 0 16px

#### 5. Spacing
- 20px

#### 6. **LARGE SHARE CARD PREVIEW** (The main visual)
- **Aspect ratio:** Portrait, roughly 9:16 or 4:5 (TikTok/Instagram Stories ratio)
- **Background:** Solid warm cream `#FAF8F3` or very light off-white
- **Padding within card:** 20px all around
- **Border radius:** 12px (on the preview container)
- **Margin:** 16px left/right
- **Content layers (top to bottom):**

  **Layer 1 — Image**
  - Scanned food image
  - Aspect ratio: 1:1 square or slightly rectangular
  - Rounded corners: 12px
  - Border: None or very subtle
  - Position: Top-center, 20px from top

  **Layer 2 — Headline Text**
  - Text: "I found a homemade swap"
  - Style: 20px bold, dark charcoal
  - Centered
  - Padding: 12px top from image

  **Layer 3 — Dish Name**
  - Text: Detected dish name (e.g., "Margherita Pasta")
  - Style: 26px bold, warm orange
  - Centered

  **Layer 4 — Price Comparison**
  - Format: "Restaurant: $38 → Homemade: $6"
  - Or stacked format:
    - "Restaurant: $38"
    - "Homemade: $6"
  - Text: 16px, charcoal, centered
  - Arrow icon between or above/below

  **Layer 5 — Savings Highlight**
  - Text: "Saves $32"
  - Background: Green `#86EFAC`
  - Text color: Dark green `#166534`
  - Font: 18px bold
  - Padding: 12px horizontal, 8px vertical
  - Border radius: 8px
  - Centered

  **Layer 6 — Mode + Match Chip**
  - Two small chips side-by-side or stacked:
    - Chip 1: "Restaurant Style" (soft orange background)
    - Chip 2: "92% match" (soft green background)
  - Text: 12px bold, centered in each chip
  - Padding: 8px horizontal, 6px vertical
  - Border radius: 8px
  - Centered

  **Layer 7 — Footer**
  - Text: "Made with Okyo"
  - Style: 12px, 500, warm gray, centered
  - Padding: 12px top from bottom of content

#### 7. Spacing
- 20px below preview card

#### 8. Action Buttons
- Three buttons stacked or 2+1 layout:
  - **Button 1 (Primary):** "Share to Stories" — Orange, full width, 56px height
  - **Button 2:** "Copy caption" — White border, full width, 44px height
  - **Button 3:** "Save image" — White border, full width, 44px height
- Gap: 12px between
- Margin: 16px left/right

#### 9. Spacing
- 12px

#### 10. Optional Caption Suggestion
- **When to show:** Optional section if you want to suggest a caption
- **Style:** Gray box, italic text
- **Text:** "Try this caption: 'Found a homemade dupe worth $32. Would you cook this?'"
- **Tap to copy** action (indicated by copy icon or "Tap to copy" label)
- **Margin:** 16px left/right
- **Padding:** 12px

#### 11. Bottom Safe Area
- 20px padding

### Main Cards/Components

**Large Share Card Preview:**
- Portrait aspect ratio (9:16 or 4:5)
- Image, headline, dish name, prices, savings, chips, footer
- Designed to be screenshot-able and shareable

**Action Buttons:**
- Share, Copy, Save

**Optional Caption Box:**
- Suggested caption with tap-to-copy

### Exact Recommended Copy

- **Header center:** "Share Preview"
- **Headline:** "Share your homemade win"
- **Subtext:** "Post this card to inspire others"
- **Card headline:** "I found a homemade swap"
- **Card dish name:** (Dynamic, e.g., "Margherita Pasta")
- **Card prices:** "Restaurant: $38 → Homemade: $6" (or stacked)
- **Card savings:** "Saves $32" (in green chip)
- **Card chips:** "Restaurant Style" | "92% match"
- **Card footer:** "Made with Okyo"
- **Button 1:** "Share to Stories"
- **Button 2:** "Copy caption"
- **Button 3:** "Save image"
- **Caption suggestion (optional):** "Try this caption: 'Found a homemade dupe worth $32. Would you cook this?'"

### Button Labels and Order

1. **Header close:** "X" (close button)
2. **Primary action:** "Share to Stories" (orange, large)
3. **Secondary:** "Copy caption" (white)
4. **Tertiary:** "Save image" (white)

### What Dynamic Data Should Appear

- Scanned food image
- Detected dish name
- Restaurant price
- Estimated home cost
- Savings amount
- Match percentage
- Mode name
- Servings (optional)

### Empty/Error State

- **Missing image:** Show placeholder gray box with camera icon
- **Missing data:** Show fallback copy or retry button
- **Share failed:** Friendly message, fallback to copy/save options

### Kiko Usage

- **No Kiko on this screen** — focus on the shareable card
- **Not needed here**

### Fixes from Current Screenshots

- ✅ Remove "Mock story card" placeholder text
- ✅ Remove "real image export comes later" text
- ✅ Remove "Restaurant copy" label (use dynamic dish name)
- ✅ Use "Restaurant Style" instead of "Restaurant Copy"
- ✅ Share card looks polished and shareable
- ✅ Image is centered and sized properly
- ✅ Prices are clear and easy to read
- ✅ Savings amount is prominent
- ✅ No debug/AI labels
- ✅ Card fits in viewport with room for buttons
- ✅ Text is readable in preview

### Visual Style Notes

- **Card background:** Warm cream `#FAF8F3`
- **Text colors:** Orange for dish name, green for savings, charcoal for body
- **Spacing:** 20px card padding, 12px between layers
- **Typography:** Large friendly fonts (20-26px for headline/name)
- **Aspect ratio:** Portrait (9:16 or 4:5 for Instagram Stories/TikTok)
- **Design:** Clean, minimal, optimized for screenshot/share

### Developer Checklist

- [ ] Header has close "X" button
- [ ] Preview card is portrait aspect ratio (9:16 or 4:5)
- [ ] Preview card image is 1:1 or rectangular, rounded corners
- [ ] Headline text: "I found a homemade swap"
- [ ] Dish name is dynamic, large, orange (26px)
- [ ] Price comparison shows restaurant → home
- [ ] Savings amount in green chip (18px bold)
- [ ] Mode chip shows selected mode
- [ ] Match chip shows percentage (92%)
- [ ] Footer text: "Made with Okyo"
- [ ] "Share to Stories" button is orange, full width, 56px
- [ ] "Copy caption" button is white, 44px
- [ ] "Save image" button is white, 44px
- [ ] Buttons are full width
- [ ] No clipping or overflow in preview card
- [ ] Text is readable in preview
- [ ] Image quality is good
- [ ] Card background color is warm cream
- [ ] Colors match palette
- [ ] Bottom safe area padding

---

## SCREEN 6 — DUPE CHALLENGE SCREEN

**Purpose:** Encourage user to cook the recipe and compare it to the restaurant version. Gamified cooking experience.

### Layout (Top to Bottom)

#### 1. Header Bar
- **Left:** Back arrow (24px)
- **Center:** "Dupe Challenge" (14px)
- **Right:** Help icon (optional)
- Minimal line below

#### 2. Spacing
- 16px

#### 3. Dynamic Dish Title
- Text: Detected dish name (e.g., "Margherita Pasta")
- Style: 28px bold, dark charcoal, centered
- Padding: 0 16px

#### 4. Challenge Description
- Text: Friendly, encouraging challenge description
- Style: 14px, 500, warm gray, centered
- Example: "Cook our recipe and see how close you can get to the restaurant version. Compare taste, texture, and appearance."
- Padding: 12px top, 0 16px bottom

#### 5. Spacing
- 20px

#### 6. Challenge Info Card
- Background: White, 1px soft border
- Padding: 20px
- Border radius: 12px
- Margin: 16px left/right
- Content layout:
  - **Top row:** Mode chip (e.g., "Restaurant Style") + Difficulty badge (e.g., "Medium")
  - **Second row:** Dish name (16px, charcoal)
  - **Third row:** "Estimated savings: $24.60" (14px bold, green text)
  - **Fourth row:** "Prep time: 15 min | Cook time: 15 min | Total: 30 min" (13px, gray)

#### 7. Spacing
- 20px

#### 8. Challenge Steps / Sections
- Three main sections, each a step:

  **Section 1: Cook**
  - Card background: White with soft border
  - Padding: 16px
  - Border radius: 12px
  - Content:
    - **Icon/step number:** "1" (large, orange, 32px)
    - **Title:** "Cook your Okyo recipe"
    - **Description:** "Follow our step-by-step guide to prepare the dish" (13px, gray)
    - **Button/action:** "Start cooking" (arrow right icon, right-aligned)
  - Margin: 16px left/right

  **Section 2: Compare**
  - Same card style as Section 1
  - Content:
    - **Icon/step number:** "2" (large, orange, 32px)
    - **Title:** "Compare the results"
    - **Description:** "Taste your version and compare it to the restaurant dish. How's the taste, texture, and appearance?" (13px, gray)
    - **Button/action:** "I'm ready" (or similar, right-aligned)
  - Margin: 16px left/right

  **Section 3: Rate**
  - Same card style
  - Content:
    - **Icon/step number:** "3" (large, orange, 32px)
    - **Title:** "Rate your dupe match"
    - **Description:** "Tell us how close your homemade version matched the restaurant version" (13px, gray)
    - **Button/action:** "Rate now" (right-aligned)
  - Margin: 16px left/right

#### 9. Spacing
- 20px

#### 10. Kiko Encouragement (Optional)
- **When to show:** If user hasn't started challenge yet, or before final rating
- **Card background:** Soft yellow or light peach
- **Content:**
  - Small Kiko illustration (60-80px) on left or top
  - Text: Encouraging message like "You've got this! Cooking is easier than you think." (14px, charcoal)
  - Optional: Smiley or friendly expression
- **Margin:** 16px left/right
- **Padding:** 16px
- **Border radius:** 12px
- **Do not show if user has completed the challenge**

#### 11. Spacing
- 20px

#### 12. Primary CTA Button
- Text: "Start challenge" or "Continue challenge" (if already started)
- Background: Orange
- Padding: 16px top/bottom
- Full width
- Height: 56px
- Border radius: 12px
- Margin: 16px left/right

#### 13. Spacing
- 12px

#### 14. Secondary Button
- Text: "Back to recipe"
- Background: White with soft border
- Padding: 14px top/bottom
- Full width
- Height: 44px
- Border radius: 12px
- Margin: 16px left/right

#### 15. Bottom Safe Area
- 20px padding

### Main Cards/Components

**Challenge Info Card:**
- Shows mode, difficulty, savings, time estimates

**Challenge Steps (3 cards):**
- Cook | Compare | Rate
- Each numbered, with description and action

**Kiko Encouragement Card (optional):**
- Small Kiko illustration, friendly message

### Exact Recommended Copy

- **Header center:** "Dupe Challenge"
- **Dish title:** (Dynamic, e.g., "Margherita Pasta")
- **Challenge description:** "Cook our recipe and see how close you can get to the restaurant version. Compare taste, texture, and appearance."
- **Info card row 1:** Mode chip (e.g., "Restaurant Style") + Difficulty (e.g., "Medium")
- **Info card row 2:** Dish name
- **Info card row 3:** "Estimated savings: $24.60"
- **Info card row 4:** "Prep time: 15 min | Cook time: 15 min | Total: 30 min"
- **Step 1 title:** "Cook your Okyo recipe"
- **Step 1 description:** "Follow our step-by-step guide to prepare the dish"
- **Step 2 title:** "Compare the results"
- **Step 2 description:** "Taste your version and compare it to the restaurant dish. How's the taste, texture, and appearance?"
- **Step 3 title:** "Rate your dupe match"
- **Step 3 description:** "Tell us how close your homemade version matched the restaurant version"
- **Kiko message (optional):** "You've got this! Cooking is easier than you think."
- **Primary button:** "Start challenge"
- **Secondary button:** "Back to recipe"

### Button Labels and Order

1. **Header back:** Back arrow
2. **Primary CTA:** "Start challenge" (orange, large)
3. **Secondary:** "Back to recipe" (white)

### What Dynamic Data Should Appear

- Dish name
- Mode
- Difficulty level
- Estimated savings
- Prep time
- Cook time
- Total time
- Challenge status (not started / in progress / completed)

### Empty/Error State

- **Missing data:** Show fallback copy, retry button
- **Challenge already completed:** Show completion state with badge/celebration and option to see rating or start new challenge

### Kiko Usage

- **One optional Kiko encouragement card**
- **Small Kiko illustration (60-80px)**, happy and encouraging
- **Only if user hasn't started challenge yet**
- **Remove when challenge is completed**
- **Expression:** Enthusiastic, supportive, "Let's do this!"

### Fixes from Current Screenshots

- ✅ Remove "mock recipe" placeholder text
- ✅ Remove placeholder dish name if shown
- ✅ Update with dynamic dish name
- ✅ Clean layout, three clear steps
- ✅ No repeated information
- ✅ Info card shows all relevant data
- ✅ Buttons are clear and actionable
- ✅ Kiko only appears as encouragement, not everywhere
- ✅ No blue gear
- ✅ No AI/debug labels
- ✅ Friendly, exciting tone

### Visual Style Notes

- **Spacing:** 16-20px between sections, 16px margins
- **Colors:** Orange for step numbers, white cards, green for savings, soft yellow/peach for Kiko card
- **Typography:** Large title (28px), step titles (18px), supporting text (14px)
- **Layout:** Single column, vertical flow, top-to-bottom progression
- **Tone:** Encouraging, gamified, supportive

### Developer Checklist

- [ ] Header shows "Dupe Challenge"
- [ ] Dynamic dish name is shown and bold (28px)
- [ ] Challenge description is friendly and clear
- [ ] Info card shows mode, difficulty, savings, times
- [ ] Three step cards are in order: Cook, Compare, Rate
- [ ] Step numbers are large and orange (32px)
- [ ] Step titles are clear (18px)
- [ ] Step descriptions are 1-2 sentences (13px)
- [ ] Kiko card appears only if appropriate (optional)
- [ ] Kiko card has small illustration (60-80px)
- [ ] "Start challenge" button is orange, full width, 56px
- [ ] "Back to recipe" button is white, full width, 44px
- [ ] No placeholder copy
- [ ] No debug labels
- [ ] Colors match palette
- [ ] Bottom safe area padding
- [ ] All buttons are tappable and responsive

---

## SCREEN 7 — LIBRARY / SAVED RECIPES SCREEN

**Purpose:** View all saved recipes. Browse by mode, search, see savings total.

### Layout (Top to Bottom)

#### 1. Header Bar
- **Left:** Optional menu icon (if drawer available) or hamburger
- **Center:** "Library" (14px, optional)
- **Right:** Search icon (24px)
- Minimal line below (optional)

#### 2. Spacing
- 12px

#### 3. Hero Card
- Background: Soft green `#ECFDF5` or light gradient
- Padding: 20px
- Border radius: 16px
- Margin: 16px left/right
- Content:
  - **Headline:** "Saved recipes worth remaking"
  - **Subtext:** "You've saved N recipes worth $XXX total" (e.g., "You've saved 5 recipes worth $127.50 total")
  - **Optional badge:** Total XP earned or streak
- Text: Large friendly text, 18px bold for headline

#### 4. Spacing
- 16px

#### 5. Search / Filter Row
- **Search input:** Text input with search icon, placeholder "Search recipes..."
- **Divider:** Soft line
- **Filter button (optional):** Dropdown for sort (Recent, Saved, Mode, Difficulty)
- Padding: 12px horizontal
- Height: 44px
- Background: White or light
- Border radius: 8px

#### 6. Spacing
- 12px

#### 7. Mode/Filter Chips
- Horizontal scroll row of chips:
  - "All" (or default)
  - "Restaurant Style"
  - "Budget"
  - "Lighter"
- Active chip: Orange background, white text
- Inactive chip: White background, charcoal text, soft border
- Padding: 12px horizontal, 8px vertical
- Border radius: 8px
- Gap: 8px
- Margin left/right: 16px, allow horizontal scroll

#### 8. Spacing
- 12px

#### 9. **Saved Recipe Cards List**
- **For each recipe card:**
  - Background: White with soft border
  - Padding: 16px
  - Border radius: 12px
  - Margin: 16px left/right, 12px bottom
  - Layout:
    - **Top row (left to right):**
      - Recipe title (16px bold, charcoal)
      - Mode chip (small, e.g., "Budget")
    - **Second row:**
      - Image thumbnail (if available, 60x60px, rounded, 8px)
      - Recipe info (title, mode)
    - **Third row (centered):**
      - Difficulty: "Medium" (12px, gray)
      - Separator: "|"
      - Time: "30 min" (12px, gray)
      - Separator: "|"
      - Savings: "$24.60" (12px bold, green)
    - **Bottom row (right-aligned):**
      - Subtle options menu icon (⋮, 16px, gray, tap for delete)

  **Alternative card layout (simplified):**
  - Left: Recipe title (16px bold)
  - Right: Savings amount ($X.XX, green, bold)
  - Below left: Mode chip + difficulty + time
  - Right: Arrow or menu icon

#### 10. Spacing (between cards)
- 12px

#### 11. **Empty State (if no saved recipes)**
- Center of screen:
  - Kiko illustration (80-120px, happy, cooking-themed)
  - Headline: "No saved recipes yet"
  - Subtext: "Scan a dish and save the recipe to get started"
  - Button: "Scan a meal" (orange, 48px height)
- Positioning: Vertically centered, 16px margins

#### 12. Bottom Safe Area
- 20px padding

### Main Cards/Components

**Hero Card:**
- Total saved, total value, friendly message

**Search/Filter Row:**
- Search input with icon

**Mode Chips:**
- Horizontal scroll filter by mode

**Saved Recipe Cards:**
- Title, image, mode, difficulty, time, savings
- Options menu for delete

**Empty State:**
- Kiko illustration, message, CTA

### Exact Recommended Copy

- **Header center:** "Library"
- **Hero headline:** "Saved recipes worth remaking"
- **Hero subtext:** "You've saved N recipes worth $XXX total"
- **Search placeholder:** "Search recipes..."
- **Mode chips:** "All" | "Restaurant Style" | "Budget" | "Lighter"
- **Recipe card info:** (Dynamic) Title | Mode | Difficulty | Time | Savings
- **Empty state headline:** "No saved recipes yet"
- **Empty state subtext:** "Scan a dish and save the recipe to get started"
- **Empty state button:** "Scan a meal"

### Button Labels and Order

1. **Header search:** Search icon (tap to open search)
2. **Header menu/filter:** Optional filter dropdown
3. **Mode filter chips:** "All" | "Restaurant Style" | "Budget" | "Lighter"
4. **Empty state CTA:** "Scan a meal"
5. **Recipe card actions:** Options menu (⋮)

### What Dynamic Data Should Appear

- Total number of saved recipes
- Total savings from all recipes
- List of saved recipes (title, image, mode, difficulty, time, savings)
- Most recent first (or sorted by filter)
- Search results (if searching)
- Filtered results by mode (if filtering)

### Empty/Error State

- **No saved recipes:** Show empty state with Kiko, message, "Scan a meal" button
- **Search no results:** "No recipes found. Try another search."
- **Network error:** Retry button

### Kiko Usage

- **In empty state only**
- Small Kiko illustration (80-120px)
- Happy, friendly, cooking-themed
- Expression: Encouraging, "Let's save some recipes!"

### Fixes from Current Screenshots

- ✅ Hero card shows total saved and total value
- ✅ Search bar is obvious and functional
- ✅ Mode filter chips are clear and clickable
- ✅ Recipe cards show all relevant info without clipping
- ✅ Remove "Restaurant copy" label (use mode chip)
- ✅ Cards are readable and scannable
- ✅ Empty state has Kiko and clear CTA
- ✅ No blue gear
- ✅ No AI/debug labels
- ✅ Bottom nav is not placeholder

### Visual Style Notes

- **Spacing:** 16px card margins, 12px between cards, 16px section gaps
- **Colors:** Cream background, white cards, orange for active chips, green for savings
- **Typography:** Large hero headline (18px), recipe title (16px), supporting text (12px)
- **Layout:** Single column, scrollable list, full width cards

### Developer Checklist

- [ ] Header shows "Library" and search icon
- [ ] Hero card shows total recipes and total savings
- [ ] Hero card has friendly subtext
- [ ] Search input is functional with placeholder
- [ ] Mode chips are horizontal scroll, allow active selection
- [ ] Active chip has orange background
- [ ] Recipe cards show title, mode, difficulty, time, savings
- [ ] Recipe cards have options menu (⋮) for delete
- [ ] Cards are full width with proper margins
- [ ] Empty state shows Kiko (80-120px)
- [ ] Empty state headline: "No saved recipes yet"
- [ ] Empty state CTA: "Scan a meal" (orange)
- [ ] Newest recipes first (or sortable)
- [ ] Cards are scrollable
- [ ] No card clipping or overflow
- [ ] All text readable
- [ ] Colors match palette
- [ ] Bottom safe area padding
- [ ] Search works dynamically

---

## SCREEN 8 — RANKINGS / LEADERBOARD SCREEN

**Purpose:** Gamified rankings showing user progress compared to others. Show categories, XP, badges.

### Layout (Top to Bottom)

#### 1. Header Bar
- **Left:** Menu icon or optional
- **Center:** "Rankings" (14px)
- **Right:** Share icon (24px, optional)
- Minimal

#### 2. Spacing
- 12px

#### 3. Weekly Leaderboard Summary Card
- Background: Light gradient or warm color
- Padding: 20px
- Border radius: 16px
- Margin: 16px left/right
- Content:
  - **Headline:** "This week's standings"
  - **Your rank info:**
    - Row 1: "You're ranked #X out of Y" (14px, bold)
    - Row 2: "XP earned this week: XXX" (13px, gray)
    - Row 3: Optional: "Total lifetime savings: $XXX" (13px, gray)
  - **Badge or medal display (optional):** Small icon showing your current tier/badge

#### 4. Spacing
- 20px

#### 5. Category Tabs / Leaderboard Selector
- Horizontal scroll row of tabs:
  - "Biggest Saver"
  - "Best Match Score"
  - "Most Recipes"
  - "Budget Hero"
  - "Healthy Swap"
- Active tab: Orange underline or background
- Inactive tab: Gray text
- Padding: 12px horizontal
- Margin: 16px left/right, allow horizontal scroll

#### 6. Spacing
- 12px

#### 7. **Leaderboard List** (Repeats for each category)
- **Top 3 (or top performers):**
  - Position card with medal/badge:
    - **Medal icon:** 🥇 (gold), 🥈 (silver), 🥉 (bronze), or number #4, #5, etc.
    - **User name:** "Username" (16px, bold)
    - **User stat:** XP | Savings | Match Score | etc. (14px, bold, orange)
    - **Highlight:** If it's the current user, background is soft green or light orange

- **Standard leaderboard rows:**
  - **Layout (left to right):**
    - Rank number (#1, #2, #3, etc.) — 14px, bold, charcoal
    - User name / username — 14px, 600, charcoal
    - Score/stat — 16px bold, orange
  - **Spacing:** 12px padding top/bottom, 16px left/right
  - **Background:** White with soft border or alternating light/white
  - **Divider:** Soft line between rows
  - **Current user row:** Highlight with light background color (light green or light orange)

- **All rows for a category:**
  - Show top 10 or top 20 (decide based on data)
  - Scroll within category if needed
  - Clear ranking numbers

#### 8. Spacing
- 20px

#### 9. Optional "Share Ranking" Card (Bottom of leaderboard)
- Background: Soft yellow or accent color
- Padding: 16px
- Border radius: 12px
- Content:
  - Headline: "Share your ranking"
  - Button: "Share my position" (orange, 44px)
- Margin: 16px left/right
- Tap action: Opens share sheet or generates share card

#### 10. Bottom Safe Area
- 20px padding

### Main Cards/Components

**Weekly Summary Card:**
- Your rank, XP earned, optional lifetime savings

**Category Tabs:**
- "Biggest Saver" | "Best Match Score" | "Most Recipes" | "Budget Hero" | "Healthy Swap"

**Leaderboard Rows:**
- Rank | Username | Score
- Highlight current user's row

**Share Ranking Card (optional):**
- Button to share ranking

### Exact Recommended Copy

- **Header center:** "Rankings"
- **Summary card headline:** "This week's standings"
- **Summary card row 1:** "You're ranked #X out of Y"
- **Summary card row 2:** "XP earned this week: XXX"
- **Summary card row 3 (optional):** "Total lifetime savings: $XXX"
- **Category tabs:** "Biggest Saver" | "Best Match Score" | "Most Recipes" | "Budget Hero" | "Healthy Swap"
- **Leaderboard rows:** Rank | Username | Score (dynamic)
- **Share card headline:** "Share your ranking"
- **Share card button:** "Share my position"

### Button Labels and Order

1. **Header share:** Share icon (optional)
2. **Category tabs:** Tap to switch leaderboard category
3. **Share ranking button:** "Share my position"

### What Dynamic Data Should Appear

- Current user's rank
- Current user's XP
- Current user's lifetime savings
- Top 10-20 users per category
- User names
- User scores (XP, savings, match score, etc.)
- Rank positions (#1, #2, #3, etc.)
- Category data (which leaderboard is selected)

### Empty/Error State

- **No ranking data yet:** "Come back after your first cook to see rankings."
- **Network error:** Retry button
- **User not ranked yet:** "You'll appear here after your first challenge!"

### Kiko Usage

- **No Kiko on this screen**
- Rankings should feel achievement-focused, not mascot-focused

### Fixes from Current Screenshots

- ✅ Fix ranking numbers so they make sense (no duplicates or missing numbers)
- ✅ Clean leaderboard layout
- ✅ Category tabs are clear and switchable
- ✅ User row is highlighted
- ✅ No repeated information
- ✅ Share ranking button is optional but polished
- ✅ Badges/medals shown tastefully (small icons)
- ✅ No blue gear
- ✅ No AI/debug labels
- ✅ Bottom nav not placeholder

### Visual Style Notes

- **Spacing:** 16px margins, 12px between rows
- **Colors:** Orange for active tab and scores, light green for user row highlight, white cards
- **Typography:** Large category tabs (14px, 600), leaderboard rows (14px, 16px score bold)
- **Layout:** Single column, switchable categories, vertical scroll
- **Medals/badges:** Small (24-32px), standard emoji or custom icons

### Developer Checklist

- [ ] Header shows "Rankings"
- [ ] Summary card shows current user's rank
- [ ] Summary card shows XP earned this week
- [ ] Summary card shows optional lifetime savings
- [ ] Category tabs are horizontal scroll
- [ ] Active tab has orange underline or background
- [ ] Leaderboard shows rank | username | score
- [ ] User row is highlighted (light background)
- [ ] Rank numbers are sequential (no duplicates)
- [ ] Top 3 have medals/badges (gold, silver, bronze)
- [ ] All rows show correct data
- [ ] Share ranking button is optional and polished
- [ ] "Share my position" button is orange, 44px
- [ ] Categories are: Biggest Saver, Best Match Score, Most Recipes, Budget Hero, Healthy Swap
- [ ] Data is dynamic per category
- [ ] No placeholder ranking data
- [ ] Colors match palette
- [ ] Bottom safe area padding
- [ ] No debug labels

---

## SCREEN 9 — SETTINGS SCREEN

**Purpose:** User preferences, account info, notifications, dark mode, support, legal.

### Layout (Top to Bottom)

#### 1. Header Bar
- **Left:** Back arrow (24px)
- **Center:** "Settings" (14px, optional)
- **Right:** Empty or help icon
- Minimal

#### 2. Spacing
- 12px

#### 3. Profile / Account Status Card
- Background: White with soft border
- Padding: 20px
- Border radius: 12px
- Margin: 16px left/right
- Content:
  - **Row 1:** "Okyo Account" (14px bold)
  - **Row 2:** Email or user identifier (14px, gray)
  - **Row 3:** Optional: Tier or badge display (e.g., "Free plan")
  - **Button (optional):** "Sign out" (small, secondary, right-aligned)

#### 4. Spacing
- 20px

#### 5. "Preferences" Section Header
- Text: "Preferences"
- Style: 14px bold, charcoal
- Padding: 0 16px
- No card background

#### 6. Preference Toggles
- **Toggle 1: Notifications**
  - Label: "Notifications"
  - Subtext: "Get tips and reminders" (12px, gray)
  - Toggle switch: Right-aligned, white with green toggle when on
  - Tap: Toggle on/off
  - Layout: White card, 16px padding, soft border, 12px margin bottom

- **Toggle 2: Dark Mode**
  - Label: "Dark mode"
  - Subtext: "Easy on the eyes" (12px, gray)
  - Toggle switch: Right-aligned
  - Layout: White card, 16px padding, soft border
  - Margin: 16px left/right, 12px bottom

- **Toggle 3 (optional): Weekly Stats Email**
  - Label: "Weekly digest"
  - Subtext: "Get a summary of your progress" (12px, gray)
  - Toggle: Right-aligned
  - Layout: Same as above
  - Margin: 16px left/right, 12px bottom

#### 7. Spacing
- 20px

#### 8. "Support & Legal" Section Header
- Text: "Support & Legal"
- Style: 14px bold, charcoal
- Padding: 0 16px

#### 9. Support / Legal Links
- **Button 1: Frequently Asked Questions**
  - Label: "FAQ" (14px, charcoal)
  - Icon: Question mark or arrow (right-aligned)
  - Layout: White card, 16px padding, soft border, 12px margin bottom
  - Tap: Open FAQ (web or in-app)

- **Button 2: Contact Support**
  - Label: "Contact support"
  - Icon: Arrow (right-aligned)
  - Layout: Same as FAQ
  - Tap: Open email composer or support form
  - Margin: 16px left/right, 12px bottom

- **Button 3: Privacy Policy**
  - Label: "Privacy policy"
  - Icon: Arrow (right-aligned)
  - Layout: Same as above
  - Margin: 16px left/right, 12px bottom

- **Button 4: Terms of Service**
  - Label: "Terms of service"
  - Icon: Arrow (right-aligned)
  - Layout: Same as above
  - Margin: 16px left/right, 12px bottom

#### 10. Spacing
- 20px

#### 11. "Development" Section (Optional, Hidden by default)
- **When to show:** Only if feature flag is enabled (e.g., Dev mode toggle in hidden settings)
- **Background:** Very light gray or distinct background
- **Header:** "Development" (12px, gray, italic)
- **Options:**
  - "Reset onboarding" button (secondary, 44px)
  - "Delete all data" button (secondary with red text/border, 44px)
  - "View debug info" button (secondary, 44px)
- **Margin:** 16px left/right, 12px between
- **Visual separation:** This section should feel distinct from normal user settings
- **Warning:** If "Delete all data" is tapped, show confirmation modal before deleting

#### 12. Spacing
- 20px

#### 13. App Version (Footer)
- Text: "Okyo version 1.0.0" (12px, gray, centered)
- Margin: 16px left/right

#### 14. Bottom Safe Area
- 20px padding

### Main Cards/Components

**Account Status Card:**
- Email, tier, optional sign out

**Preference Toggles:**
- Notifications | Dark Mode | Weekly Digest (optional)

**Support/Legal Links:**
- FAQ | Contact Support | Privacy | Terms

**Development Section (hidden by default):**
- Reset | Delete | Debug (dev only, visually distinct)

### Exact Recommended Copy

- **Header center:** "Settings"
- **Account card header:** "Okyo Account"
- **Account card button (optional):** "Sign out"
- **Section header 1:** "Preferences"
- **Toggle 1 label:** "Notifications"
- **Toggle 1 subtext:** "Get tips and reminders"
- **Toggle 2 label:** "Dark mode"
- **Toggle 2 subtext:** "Easy on the eyes"
- **Toggle 3 label (optional):** "Weekly digest"
- **Toggle 3 subtext:** "Get a summary of your progress"
- **Section header 2:** "Support & Legal"
- **Link 1:** "FAQ"
- **Link 2:** "Contact support"
- **Link 3:** "Privacy policy"
- **Link 4:** "Terms of service"
- **Section header 3 (dev):** "Development" (hidden by default)
- **Dev button 1:** "Reset onboarding"
- **Dev button 2:** "Delete all data"
- **Dev button 3:** "View debug info"
- **Footer:** "Okyo version 1.0.0"

### Button Labels and Order

1. **Header back:** Back arrow
2. **Account sign out:** Optional button in account card
3. **Preference toggles:** Notification | Dark Mode | Weekly Digest
4. **Support links:** FAQ | Contact Support | Privacy | Terms
5. **Dev buttons (hidden):** Reset | Delete | Debug

### What Dynamic Data Should Appear

- User email or account identifier
- User tier/plan
- App version number
- Toggle states (on/off)
- Feature availability (if some features are premium)

### Empty/Error State

- **No account data:** Show placeholder or loading state
- **Network error on support links:** Friendly message
- **Delete data confirmation:** Modal asking "Are you sure? This cannot be undone."

### Kiko Usage

- **No Kiko on this screen**
- Settings should feel straightforward and simple

### Fixes from Current Screenshots

- ✅ Remove blue gear icon
- ✅ Remove placeholder text
- ✅ Replace placeholder toggles with real, polished toggles
- ✅ Remove "placeholder theme toggle" label
- ✅ Remove "no push notifications requested yet" copy
- ✅ Real user-friendly toggle descriptions
- ✅ Development section is hidden or clearly separated
- ✅ "Delete all data" is clear but not ugly (subtle red or warning text)
- ✅ Legal/support links are obvious
- ✅ Sign out is easy but not scary
- ✅ No developer metadata visible to normal users

### Visual Style Notes

- **Spacing:** 16px section margins, 12px between cards
- **Colors:** White cards, green toggle when on, red text for destructive actions
- **Typography:** Section headers (14px bold), labels (14px), subtexts (12px gray)
- **Layout:** Single column, vertical scroll
- **Toggles:** Modern toggle switch, green when on, gray when off
- **Development section:** Visually distinct (light gray background or italicized header)

### Developer Checklist

- [ ] Header shows "Settings" and back arrow
- [ ] Account card shows email/identifier
- [ ] Account card shows tier (optional)
- [ ] Account card has "Sign out" button (optional)
- [ ] Notification toggle works and has user-friendly copy
- [ ] Dark mode toggle works
- [ ] Weekly digest toggle (optional) has user-friendly copy
- [ ] Support links (FAQ, Contact, Privacy, Terms) are all present
- [ ] Support links are tappable and navigate correctly
- [ ] Development section is hidden by default
- [ ] If visible, dev section is clearly separated
- [ ] "Reset onboarding" button works (test)
- [ ] "Delete all data" button shows confirmation modal
- [ ] App version is shown and dynamic
- [ ] No placeholder copy visible
- [ ] No blue gear icon
- [ ] Colors match palette
- [ ] Toggle switches are polished (not placeholder rectangles)
- [ ] Bottom safe area padding
- [ ] All buttons are tappable
- [ ] No debug info visible to normal users

---

## GLOBAL DESIGN CHECKLIST

After redesigning all 9 screens, verify the entire app meets these standards:

### Structural Fixes
- [ ] **Duplicate headers removed:** No screen has two headers or redundant navigation bars
- [ ] **Blue gear removed:** No blue gear icon on any screen
- [ ] **Placeholder text gone:** No "Mock story card", "real image export comes later", "placeholder theme toggle", etc.
- [ ] **No dev metadata visible:** No "AI: OpenRouter", "AI: fallback", "confidence: 0.87", provider names, etc.
- [ ] **No "copycat" wording:** Use "Restaurant Style", "inspired-by", "homemade version", "restaurant-style swap"

### Content & UX
- [ ] **No clipped content:** All text is fully visible, no overflow
- [ ] **No horizontal scrolling:** All content fits vertically on mobile
- [ ] **No cut-off text:** Buttons, labels, prices all readable
- [ ] **No giant empty spaces:** Spacing is intentional, not wasteful
- [ ] **No repeated information:** Each card/section adds value
- [ ] **All buttons intentional and tappable:** No placeholder button styling
- [ ] **Each card has purpose:** No filler cards
- [ ] **Bottom tab bar polished:** Not placeholder triangles, modern icons
- [ ] **Whole app feels consistent:** One design system, not separate rough screens

### Visual System
- [ ] **Colors match palette:**
  - Background: Warm cream `#FEFBF7`
  - Primary: Orange `#F97316`
  - Savings: Green `#86EFAC`
  - Text: Charcoal `#1F2937`
  - Secondary text: Warm gray `#78716F`
  - Cards: White `#FFFFFF`
  - Borders: Soft beige `#E8E3DB`

- [ ] **Typography consistent:** Headlines bold, supporting text gray, no wild font sizes
- [ ] **Spacing uniform:** 16px margins standard, 12px gaps between sections
- [ ] **Shadows/borders consistent:** All cards same shadow style
- [ ] **Border radius consistent:** 16px for large cards, 12px for smaller, 8px for buttons
- [ ] **Icons consistent:** Same icon family, same sizes, same colors

### Kiko Mascot
- [ ] **Kiko is consistent:** Same design sheet across all uses
- [ ] **Kiko never distorted, creepy, low-quality:** Only use approved design
- [ ] **Kiko only improves screens:** Removed from screens where not needed
- [ ] **Kiko never dominates UI:** Small (60-120px), positioned naturally
- [ ] **Kiko placement natural:** As helper, empty state character, encouragement, not forced
- [ ] **Kiko expression appropriate:** Happy, helpful, encouraging, never confused or sad unless context calls for it
- [ ] **One Kiko max per screen:** Not multiple mascots competing

### Mobile Fit & Performance
- [ ] **All content fits viewport:** No horizontal scroll on any screen
- [ ] **Buttons are tap-friendly:** Minimum 44px height for most buttons
- [ ] **Text is readable:** Minimum 14px for body text, no tiny labels
- [ ] **Safe area respected:** Notch/home indicator account for
- [ ] **Bottom nav safe area:** 20px padding below last content
- [ ] **Images load fast:** No unnecessary huge images
- [ ] **Scrolling smooth:** No jank or lag

### Copy & Tone
- [ ] **Copy is friendly and clear:** Not corporate or robotic
- [ ] **No technical jargon:** Users understand error messages
- [ ] **Button text action-oriented:** "View Recipe" not "OK"
- [ ] **Headlines hook attention:** "What are we remaking today?" not "Welcome"
- [ ] **Errors are supportive:** Not scary or blaming user

### Navigation & Flow
- [ ] **Back buttons work:** Users can navigate back from any screen
- [ ] **Header bars are minimal:** No clutter or redundant buttons
- [ ] **Tab bar is clear:** All 4-5 main tabs labeled and easy to tap
- [ ] **CTA buttons are orange:** Primary action always orange and prominent
- [ ] **Secondary buttons are white with border:** Clear hierarchy
- [ ] **No dead-end screens:** Users can always move forward or back

### Final Polish
- [ ] **Every screen feels complete:** Not half-done or rough
- [ ] **App feels premium:** Not cheap or cluttered
- [ ] **App feels fun:** Not overly serious or corporate
- [ ] **App feels useful:** Every screen helps user accomplish something
- [ ] **App feels fast:** No loading delays or confusing transitions
- [ ] **App feels magical:** Scan results feel like delightful moments

---

## IMPLEMENTATION NOTES FOR DEVELOPERS

### Tech Stack Assumptions
- React Native + Expo (mobile)
- TypeScript
- React Navigation for routing
- Zustand or similar for state management
- TanStack Query for API calls (when ready)

### Figma / Design Files
- Create one Figma file per screen (or one file with all 9 screens as frames)
- Use design system components (buttons, cards, toggles, etc.)
- Export icons as SVG or PNG @2x and @3x for mobile
- Share with development team

### Component Library (Build These)
- `Button` (primary orange, secondary white)
- `Card` (white, soft border, standard padding)
- `Toggle` (green when on, gray when off)
- `Chip` (small, colored backgrounds, centered text)
- `SavingsCard` (green accent layout)
- `RecipeCard` (title, mode, stats)
- `LeaderboardRow` (rank, name, score)
- `EmptyState` (Kiko, headline, CTA)
- `LoadingSpinner` (subtle animation)
- `BottomTabBar` (polished icons, active state)

### Animation & Transitions
- Keep animations subtle (200-300ms)
- Tap feedback: slight scale or opacity change
- Slide between screens: smooth 300ms
- Loading states: gentle spinner, no jarring loaders

### Accessibility
- All buttons have min 48px tap target (44px minimum, 56px preferred)
- Color is not the only way to convey info (use text labels too)
- Text contrast meets WCAG AA standards
- Icons have labels or aria-labels
- Errors announced to screen readers

### Performance
- Lazy load images (especially on Library screen)
- Memoize expensive components
- Optimize list rendering (FlatList in React Native)
- Avoid re-renders of full screens on toggle

### Testing Checklist
- [ ] Tap every button on every screen
- [ ] Verify all copy is correct
- [ ] Test on iPhone SE (smallest screen) and Plus (largest)
- [ ] Test in light mode and dark mode
- [ ] Verify safe area padding on notch devices
- [ ] Test all error states
- [ ] Test all empty states
- [ ] Verify all links work (FAQ, privacy, etc.)
- [ ] Check no content clips or overflows
- [ ] Verify tab navigation works
- [ ] Test back button on all screens
- [ ] Verify images load and display correctly
- [ ] Test share buttons (share sheet opens)
- [ ] Verify calculations (savings, XP, rankings) are accurate

---

## SUMMARY OF CHANGES

### What's Different from Current App

1. **Removed visual noise:**
   - Blue gear icon removed entirely
   - Duplicate headers combined into one
   - Developer metadata hidden (no "AI: OpenRouter", confidence%, etc.)
   - Placeholder copy replaced with real, friendly copy
   - Placeholder button styles replaced with polished design system

2. **Improved hierarchy:**
   - Clear primary actions (orange buttons)
   - Clear secondary actions (white buttons)
   - Copy is more scannable with headlines, subtexts, labels
   - Cards have clear purposes (no filler)

3. **Better mobile experience:**
   - No horizontal overflow or clipping
   - Content fits one-handed viewing
   - Safe area respected
   - Buttons are tappable (44-56px min)
   - Text is readable (14px+ min)

4. **Consistent design system:**
   - Warm cream background
   - White cards with soft borders
   - Orange primary actions
   - Green savings highlights
   - Dark charcoal text
   - Consistent spacing (16px margins, 12px gaps)
   - Rounded corners (16px, 12px, 8px)
   - One polished bottom tab bar

5. **Friendly, premium tone:**
   - Kiko mascot used tastefully (not everywhere)
   - Copy is warm and encouraging (not corporate)
   - Empty states feel supportive (not scary)
   - Error messages are clear and helpful

6. **Gamification & engagement:**
   - Rankings feel rewarding (not random)
   - Dupe Challenge is exciting and clear
   - Library shows total savings (motivating)
   - Badges and XP progress visible
   - Share features feel natural (not forced)

### Screen-by-Screen Changes

| Screen | Key Fixes |
|--------|-----------|
| Home/Scan | Large scan card, hero headline, two secondary buttons, Kiko optional |
| Result Summary | Clean header, savings prominent, mode tabs work, recipe card per mode, error states friendly |
| Recipe Ingredients | Ingredients organized by component, Kiko tip only if useful, "Start Cooking" button |
| Recipe Steps | Steps numbered, boosts unique and contextual (not repeated), beginner notes optional, cooking term helpers |
| Share Preview | Portrait card (9:16), dynamic data, polished buttons, no placeholder text |
| Dupe Challenge | Three clear steps, friendly tone, Kiko encouragement optional, info card shows all details |
| Library | Hero card shows total savings, search + filter, mode chips, empty state with Kiko |
| Rankings | Fix ranking numbers, category tabs, user row highlighted, badges tasteful |
| Settings | Toggle switches polished, dev section hidden, no placeholder text, support links clear |

---

## NEXT STEPS

1. **Share this doc with design team:** Use as specification for Figma mockups
2. **Create Figma file:** One per screen or all in one file
3. **Build component library:** Buttons, cards, toggles before screens
4. **Implement screens one by one:** Start with Home/Scan, then Results, then navigate from there
5. **Test on real devices:** Especially iPhone SE and Plus sizes
6. **Get user feedback:** Especially on Dupe Challenge and Share features
7. **Iterate based on feedback:** Adjust colors, spacing, copy as needed

---

**Redesign complete. Ready to build.** 🚀

