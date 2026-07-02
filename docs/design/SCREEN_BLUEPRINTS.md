# SCREEN_BLUEPRINTS.md
# Okyo Onboarding — Screen Blueprints

Each screen has one action, one message, one emotion, one goal.

---

## Blueprint Format

```
SCREEN NAME
Objective     — single sentence
Core Message  — what the user reads and remembers
Primary CTA   — button label
Visual Hierarchy — what captures attention first → second → third
Emotional Purpose — what the user should feel
Kiko Role     — how the mascot is used (if present)
Animation / Motion — how the screen moves
Transition Logic — what comes before and after
Success Metric — how we know this screen is working
```

---

## Screen 1: Hero

**Objective**
Create immediate identity resonance — make the user feel Okyo is built exactly for them within 2 seconds.

**Core Message**
"Stop paying restaurant prices."

**Primary CTA**
`LET'S DO THIS` (or `GET STARTED`)

**Visual Hierarchy**
1. Full-bleed or hero-sized food image (warm, appetizing, high-contrast)
2. Headline: large, bold, coral — declaration, not a question
3. Kiko mascot: lower-right, waving or curious — small, not competing with food
4. CTA button: bottom, full-width pill, high-contrast orange on cream
5. Progress dots: centered below CTA, minimal (4px dots)

**Emotional Purpose**
Recognition. The user's internal monologue should be: *"Yes. That's me."*
Not curiosity — confirmation. They should feel named, not sold to.

**Kiko Role**
Presence signal only. Kiko appears small, friendly, not instructional. She exists to communicate "this app has a personality." No speech bubble on this screen — the headline carries the message.

**Animation / Motion**
- Food image: subtle parallax or scale-in on load (0.3s ease-out)
- Headline: fade up, 0.4s delay after image loads
- Kiko: bounce-in from bottom-right, 0.5s delay (she arrives last, as a reward)
- CTA: fade in last, 0.6s delay (screen is ready when button appears)
No continuous looping animations — they distract from the declaration.

**Transition Logic**
- Entry: from splash screen fade (app open)
- Exit: tap CTA → slide left to Weekly Goal
- Back: no back navigation on this screen

**Success Metric**
Hero screen → CTA tap rate ≥ 92%.
Drop-off on this screen indicates a visual or copy mismatch with user expectations. Threshold for action: < 88%.

---

## Screen 2: Weekly Goal

**Objective**
Capture a micro-commitment through goal selection that increases retention probability.

**Core Message**
"How often do you want to cook at home instead of eating out?"

**Primary CTA**
`I'M COMMITTED` (disabled until goal selected)
Variant by selection:
- Casual → `LET'S START EASY`
- Regular → `I'M IN`
- Serious → `LET'S DO THIS`
- All In → `I'M ALL IN`

**Visual Hierarchy**
1. Kiko speech bubble: "Pick your goal and I'll build your plan." (warm framing, top)
2. Four goal cards: centered, generous spacing, full-width minus horizontal padding
3. Selected card: orange border + orange background tint, clear state change
4. CTA: bottom, disabled (gray) → enabled (orange) on selection

**Emotional Purpose**
Agency. The user makes a real choice about their life. They are not being enrolled — they are opting in. The disabled CTA signals that the app takes this seriously.

**Kiko Role**
Encouragement framing. Kiko's speech bubble sets a warm, non-judgmental tone for the choice. No wrong answer exists — Kiko communicates this through casual language ("whatever feels right for you"). Kiko does not appear again on this screen after the bubble.

**Animation / Motion**
- Cards: stagger fade-in, 0.1s between each card (feels like a hand of cards being dealt)
- Selection tap: card background tints orange, border pulses once (haptic feedback)
- CTA: cross-fades from gray to orange when selection is made
- Kiko bubble: slides in from top-left, 0.3s delay after screen appears

**Transition Logic**
- Entry: slide in from right (coming from Hero)
- Back: tap back → slide right to Hero (no data loss on back — goal selection preserved)
- Exit: tap CTA → slide left to Reminder

**Success Metric**
Goal selection rate ≥ 85% of users who reach this screen.
CTA tap rate (selected → CTA tap) ≥ 95%.
Distribution of goal choices (track for retention correlation).

---

## Screen 3: Reminder

**Objective**
Secure notification permission by framing it as a personal accountability tool, not a marketing channel.

**Core Message**
"I'll remind you to cook so it actually becomes a habit."

**Primary CTA**
`REMIND ME TO COOK`

**Secondary action**
`Maybe later` (low-prominence text link below CTA)

**Visual Hierarchy**
1. Kiko: centered, large, speech bubble with her message above
2. iOS-style permission dialog mock: white card, "Okyo" as app name, "Allow / Don't Allow" buttons, hairline dividers — native-feeling
3. Orange upward arrow: animated, pointing toward "Allow" in the dialog
4. `REMIND ME TO COOK` button: bottom, orange pill
5. `Maybe later` link: small, below button, visible but not prominent

**Emotional Purpose**
Warmth + accountability. The user should feel Kiko is asking them as a friend — "I'll check in on you" — not "the app wants to send you promotions."

**Kiko Role**
Primary voice of the screen. Kiko owns this ask. Her speech bubble reads: *"I'll remind you to cook so it becomes a habit!"* This reframes the permission ask from corporate to personal. The request is coming from Kiko, not from Okyo the company.

**Animation / Motion**
- Kiko: bounce-in on screen load
- Orange arrow: continuous slow bounce (↑) pointing to Allow, starts after 0.5s
- Permission dialog: slides up from center, 0.4s ease-out, after Kiko is visible
- `Maybe later` link: fades in last (0.8s delay) — user needs to see the main option first

**Transition Logic**
- Entry: slide in from right (from Weekly Goal)
- On `REMIND ME TO COOK` tap: trigger system notification permission dialog, then advance to Loading
- On system dialog "Allow": fire `notification_permission_granted`, advance to Loading
- On system dialog "Don't Allow": fire `notification_permission_denied`, advance to Loading
- On `Maybe later` tap: fire `notification_permission_skipped`, advance to Loading
- Back: tap back → slide right to Weekly Goal

**Edge case — system permission denied:**
If `Notifications.getPermissionsAsync()` returns denied (prior system denial), show alternative UI:
- Replace arrow + dialog mock with: "Looks like notifications are off. Enable them in Settings to stay on track."
- CTA becomes: `OPEN SETTINGS` (deep links to iOS Settings > Okyo > Notifications)
- Skip link remains

**Success Metric**
Notification grant rate ≥ 60% of users who reach this screen.
Abandon rate on this screen ≤ 5% (abandon = app closed, not skip tapped).

---

## Screen 4: Building Your Plan (Loading)

**Objective**
Create the perception of AI personalization — bridge the commitment screens and the action screen with a moment of anticipation.

**Core Message**
"Building your plan..."

**Primary CTA**
None. Auto-advances after 2,500ms.

**Visual Hierarchy**
1. Kiko: large, centered, "working" or "thinking" expression
2. `BUILDING YOUR PLAN...` label: uppercase, medium weight, centered, below Kiko
3. Rotating body text: one line, cycles through 2–3 messages every 800ms
4. Three pulsing dots: below body text, animated in sequence (left → center → right)

**Rotating body text options:**
- "Calibrating your taste profile..."
- "Mapping your cooking style..."
- "Preparing your first dupe..."
- "Almost ready..."

**Emotional Purpose**
Anticipation + trust in AI. The user should feel the app is genuinely working on their behalf — computing something specific to them, not playing a loading animation.

**Kiko Role**
Worker. This is the most "active" Kiko appears in onboarding. She should look engaged, not idle. If available: a "thinking" or "focused" Kiko expression. Her size is large (centered, dominant) — she is the focal point, which communicates she is doing the work.

**Animation / Motion**
- Kiko: subtle idle animation (gentle scale pulse, 2s period) — alive, not static
- Pulsing dots: sequential opacity animation (1→0.3→1), 400ms per dot, looping
- Body text: fade out / fade in (300ms) between rotation cycles
- No entrance animation needed — this screen appears mid-flow, not as a landing

**Transition Logic**
- Entry: slide in from right (from Reminder)
- Exit: auto-advance after 2,500ms → slide left to Scan
- If `selectedScanImage` is already set (user already has an image): auto-advance immediately → OnboardingScanLoadingScreen
- Back: back gesture disabled on this screen (auto-advance makes back redundant; prevents re-triggering the auto-advance loop)

**Success Metric**
This screen has no conversion metric — it is infrastructural. Track: `loading_screen_viewed` and ensure transition to scan fires within 3,000ms in 99% of sessions.

---

## Screen 5: Scan

**Objective**
Get the user to complete one AI food interaction — the activation event.

**Core Message**
"Scan any restaurant meal to see your homemade dupe."

**Primary CTA**
`SCAN A MEAL` (camera) + `PICK FROM GALLERY` (secondary, visible but smaller)

**Visual Hierarchy**
1. Scan frame: centered, large — camera viewfinder aesthetic
2. Kiko: above or beside the scan frame, encouraging pose
3. Instructional micro-copy: 1–2 lines, casual voice ("Point at any restaurant food")
4. `SCAN A MEAL` button: orange pill, bottom
5. `PICK FROM GALLERY` button: white/outline pill, below primary CTA
6. Demo option (if implemented): small text link — "No food nearby? Try an example →"

**Emotional Purpose**
Confidence + eagerness. The user should feel: *"I want to try this right now."* Not obligation, not anxiety — genuine curiosity about what the AI will do.

**Kiko Role**
Cheerleader. Kiko's expression is anticipatory — she's excited to see what food the user has. Optional speech bubble: *"Show me what you're eating!"* Kiko should feel like she's leaning in, interested.

**Animation / Motion**
- Scan frame: shimmer or pulse animation on the border — signals "ready, live"
- Kiko: excited idle (small bounce or lean)
- No entrance fanfare — this screen is a call to action, not a reveal
- After tap: camera permission check → if granted, open camera. If denied, show edge case UI.

**Edge cases:**
- Camera denied: show full-screen state — "Camera access is needed to scan food. Enable it in Settings." + `OPEN SETTINGS` button + `USE GALLERY INSTEAD` link
- No food nearby: demo mode — "Want to see how it works? Try this example →" loads a pre-set food image and runs it through the scan flow

**Transition Logic**
- Entry: slide in from right (from Loading)
- On scan/gallery completion: → OnboardingScanLoadingScreen (analyzing)
- After result returns: → First Result screen
- If result fails (low confidence, non-food): → First Result failure state (warm error)
- Back from scan: → Reminder (skip back over Loading to prevent auto-advance loop — this is correct existing behavior)

**Success Metric**
Scan attempt rate (scan_initiated / scan_screen_viewed) ≥ 65%.
Gallery use rate (source: gallery / scan_initiated): track — if > 40%, demo mode is needed urgently.
Activation rate (first_result with confidence ≥ 0.6 / scan_initiated) ≥ 80%.

---

## Screen 6: First Result

**Objective**
Deliver the payoff — show the user exactly what Okyo produces and make it feel intelligent and real.

**Core Message**
"[Dish Name] — make it at home for ~$[X] less."

**Primary CTA**
`SEE YOUR RECIPE`

**Visual Hierarchy**
1. Dish identification + confidence signal: dish name large, confidence pill subtle
2. Savings estimate: green, bold, prominent — "$12.40 cheaper to make at home"
3. Recipe teaser: 3–4 ingredients visible (enough to create desire)
4. Kiko: celebration pose, positioned to react to the result
5. `SEE YOUR RECIPE` CTA: bottom, orange pill

**Emotional Purpose**
Delight + validation. The user's internal monologue should be: *"It worked. It actually recognized my food. This is real."*
The savings number is the secondary wow — the primary wow is "it knows what this is."

**Kiko Role**
Celebrant. Kiko reacts to the successful scan with an excited or proud expression. Optional: a brief animation of Kiko celebrating (arms up, confetti). This is the emotional peak of onboarding — Kiko's energy should match it.

**Animation / Motion**
- Result card: slides up from bottom, 0.4s ease-out — reward reveal feeling
- Savings number: counts up from $0 to final value (600ms, ease-out) — computed, not arbitrary
- Kiko: confetti burst or jump animation on result appear
- Confidence pill: fades in after dish name, 0.3s delay

**Failure state (low confidence or non-food):**
- Replace dish name with: "Hmm, this one's tricky"
- Show: "The photo was a little unclear — try a different angle or pick a different dish"
- Kiko: apologetic or curious expression (not sad — curious is better)
- CTA: `TRY AGAIN` (primary) + `CONTINUE ANYWAY` (secondary, advances to paywall)
- No mock result. No generic pasta. No fabricated savings number.

**Transition Logic**
- Entry: slide in from right (from scan loading)
- On CTA tap: → Paywall
- Back: back gesture shows scan screen (user can retry)

**Success Metric**
Positive result rate (confidence ≥ 0.6) ≥ 80% of scans.
"See Your Recipe" tap rate ≥ 88% on successful results.
"Try Again" tap rate on failure state (measures recovery, not drop-off).

---

## Screen 7: Paywall

**Objective**
Convert motivated, activated users into trial subscribers at peak emotional investment.

**Core Message**
"Keep discovering recipes — start free for [X] days."

**Primary CTA**
`START FREE TRIAL`

**Secondary action**
`Continue with [X] free scans` (or `Maybe later`) — visible, not hidden

**Visual Hierarchy**
1. Value summary headline: personalized if possible ("Regular cooks save $87/month")
2. Trial offer: bold, centered — "3 days free, then $X/month"
3. Feature bullets: 3 max, specific
   - "Unlimited AI food scans"
   - "Save recipes + grocery lists"
   - "Track your total savings"
4. `START FREE TRIAL` button: orange pill, full-width
5. `Continue free` link: below button, small but visible
6. Fine print: "Cancel anytime. Billed monthly after trial." — one line, small

**Emotional Purpose**
Investment readiness. The user has just experienced real value. They are at peak trust and peak motivation. This screen should feel like the natural next step, not a sales pitch.

**Kiko Role**
Supportive. Kiko can appear in a small, non-dominant position — perhaps a small Kiko waving in the corner, or a Kiko expression on the feature illustration. She should not be the main character on this screen — the offer is.

**Animation / Motion**
- Screen slides in from right (standard transition)
- Feature bullets: stagger fade-in, 0.1s between each
- Trial offer badge: subtle glow or pulse (once only, not looping)
- CTA button: no animation — it should look stable and ready

**Transition Logic**
- Entry: slide in from right (from First Result)
- On `START FREE TRIAL` tap: trigger IAP flow → on success, navigate to main app (MainTabs)
- On `Continue free` tap: fire `paywall_skipped`, navigate to main app (MainTabs)
- No back navigation from paywall (onboarding is complete at this point)

**Personalization (goal-based):**
- Casual: "Even once a week adds up. Start free."
- Regular: "Regular cooks save ~$87/month with Okyo."
- Serious: "Serious about cooking? Serious about saving."
- All In: "You said All In. Make it official."

**Success Metric**
Trial start rate ≥ 20% of users who reach this screen.
Paywall abandon rate (close app on paywall) ≤ 15%.
"Continue free" tap rate: track — high rate means paywall value prop needs work.

---

## Flow Summary

```
Splash (auto)
  ↓
[1] Hero — recognition → tap CTA
  ↓
[2] Weekly Goal — commitment → select + tap CTA
  ↓
[3] Reminder — habit permission → grant/skip
  ↓
[4] Building Your Plan — anticipation → auto-advance (2.5s)
  ↓
[5] Scan — activation → scan or gallery upload
  ↓
[→ Scan Loading (analyzing)]
  ↓
[6] First Result — payoff → tap "See Your Recipe"
  ↓
[7] Paywall — conversion → trial or skip
  ↓
Main App (Home tab)
```

Total screens: 7 (excluding splash and scan loading)
Total user decisions: 4 (CTA tap, goal select, reminder grant/skip, scan action)
Total required taps to reach activation: 4
Total required taps to complete full onboarding: 6

This is tight. Every additional screen or decision is a risk to completion rate.
