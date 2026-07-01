# ACTIVATION_STRATEGY.md
# Okyo Onboarding — Activation Strategy

---

## Core Onboarding Goals

Ranked by priority:

1. **Activation** — get one user to one successful AI food scan result
2. **Trust** — make the user believe the AI is intelligent and honest
3. **Commitment** — capture a goal declaration and notification permission
4. **Conversion** — present a paywall at peak emotional investment
5. **Retention signal** — create the conditions for a D2 return

Everything in onboarding is subordinate to goal 1. A user who completes a scan and sees a result is retained. A user who completes onboarding without scanning is not.

---

## User Belief Transformation

Onboarding must move the user through four belief states:

```
BEFORE ONBOARDING
"I spend too much eating out but I don't really cook."

↓ AFTER HERO SCREEN
"Someone understands my situation and built something for it."

↓ AFTER GOAL + REMINDER
"I made a small commitment. I want to see if this is real."

↓ AFTER SCAN + FIRST RESULT
"The AI actually works. It recognized my food. This is useful."

↓ AFTER PAYWALL
"This is worth paying for. I want to keep doing this."
```

Each screen transition is a belief upgrade. If any transition fails — if a screen does not convincingly complete its belief job — all subsequent screens lose effectiveness. The chain breaks at the weakest link.

---

## Activation Funnel Breakdown

```
INSTALL
  100% enter app

HERO SCREEN
  Target: 95% tap Continue (friction-free, no decision)
  Drop-off cause: visual mismatch with user's food preferences

WEEKLY GOAL
  Target: 85% select goal and advance
  Drop-off cause: indecision, or feeling the question is arbitrary

REMINDER
  Target: 75% grant notification OR tap "maybe later" (not abandon)
  Drop-off cause: no, the app wants to spam me

BUILDING YOUR PLAN
  Target: 100% auto-advance (no user action required)
  Drop-off cause: none (auto-advance eliminates this risk)

SCAN
  Target: 65% complete a scan or gallery upload
  Drop-off cause: no food nearby; camera anxiety; permission denied
  THIS IS THE CRITICAL DROP-OFF POINT.

FIRST RESULT
  Target: 90% of users who scan see a usable result
  Drop-off cause: low-confidence result; AI misidentification; slow response

PAYWALL
  Target: 15–25% trial start rate among users who reach this screen
  Drop-off cause: unclear value prop; price shock; distrust
```

**The funnel pinch point is the Scan screen.**
Every optimization effort should prioritize reducing scan drop-off before any other screen. Adding a demo/gallery option, pre-granting camera, and showing scan previews will have more impact than any other single change.

---

## First Value Moment Definition

**Definition:** The activation event is the moment a user sees a named dish + savings estimate + recipe preview generated from their own uploaded image.

This event must occur within the first session.

**Sub-criteria for a valid first value moment:**
- AI identified a dish with ≥60% confidence (not a generic fallback)
- Savings estimate is non-zero and dish-specific
- Recipe shows ≥3 ingredients relevant to the identified dish
- Result appears in ≤6 seconds of perceived wait time

**Why this definition matters:** A result that meets all four criteria creates belief in AI intelligence. A result that fails any one criterion creates doubt that persists through all future sessions. The app earns second chances from activated users; it does not earn them from doubters.

---

## Trust-Building Sequence

Trust is built incrementally across screens. Each element below is a trust deposit:

| Step | Trust Action | Why It Works |
|------|-------------|--------------|
| Hero | No email gate, no permissions | Signals "we respect you" |
| Hero | Kiko mascot, warm aesthetic | Signals "we are not corporate" |
| Weekly Goal | Only 4 options, no wrong answer | Signals "we're not trying to trick you" |
| Reminder | Kiko makes the ask, not the app | Signals "this is for your benefit" |
| Loading | App "working" for you | Signals AI is real and active |
| Scan | Gallery option available | Signals "no pressure, your pace" |
| First Result | Confidence score shown | Signals "we're honest about uncertainty" |
| First Result | Specific $ savings number | Signals "this is calculated, not made up" |
| Paywall | "Cancel anytime" prominent | Signals "no tricks" |

**Trust debt** accumulates from:
- Generic or wrong AI results (biggest single trust destroyer)
- Notifications that don't feel personal
- Savings numbers that seem random
- Any screen that feels like "app wants my data"

Trust debt is hard to repay once incurred. Prioritize prevention over recovery.

---

## Commitment Mechanics

Three commitment actions are embedded in onboarding:

**1. Goal Selection (Weekly Goal screen)**
Type: public self-declaration
Mechanism: foot-in-the-door
Effect: user creates a self-image as a regular home cook. Increases D7 retention.

**2. Notification Permission (Reminder screen)**
Type: behavioral commitment
Mechanism: reciprocity (Kiko asks personally → user feels obligated to respond positively)
Effect: push access increases D30 retention 3–4×. Even users who decline feel they were asked by a friend, not a corporation — reduces brand damage from the ask.

**3. Scan Completion (Scan screen)**
Type: effort investment
Mechanism: effort justification (I worked for this result, so it must be valuable)
Effect: strongest predictor of Day 2 return. Physical action (pointing camera at food) amplifies this — it cannot be replicated by a tap.

These three commitments compound. A user who declares a goal, grants notifications, and completes a scan has made three commitments and invested real effort. Their probability of returning on Day 2 is approximately 5–7× higher than a user who tapped through without engaging.

---

## Habit Formation Design

Okyo's retention model is habit formation, not engagement maximization. The target behavior is: **scan food when eating out → cook the dupe at home.** This is a weekly habit with a natural trigger (restaurant visit) and a variable reward (recipe quality, savings amount).

**Habit loop structure:**

```
TRIGGER: Restaurant visit / meal decision
  ↓
CUE: Kiko push notification ("What are you eating tonight? 👀")
  ↓
ROUTINE: Open Okyo → scan → get recipe
  ↓
REWARD: Specific recipe + savings estimate + XP
  ↓
INVESTMENT: Save recipe → grocery list → cook → earn badge
```

**Onboarding's role in habit formation:**
- Sets the trigger expectation (notification permission)
- Demonstrates the routine (scan → result in first session)
- Delivers the reward (first result experience)
- Previews the investment (shows saved recipes library, savings dashboard)

The first session is a compressed rehearsal of the full habit loop. If the user experiences the full loop once, they have a mental model for what returning to the app feels like. This dramatically lowers the activation energy for the second session.

---

## Retention Hooks

**Immediate hooks (within onboarding):**
- First saved recipe (if user saves from first result)
- Goal commitment (internal motivation, D7 pull)
- Notification permission (external trigger, D2 pull)
- XP earned from first scan (gamification hook, visible progress)

**Deferred hooks (post-onboarding, surfaced in session 2+):**
- Savings dashboard (accumulating number creates return motivation)
- Dupe Challenge (completion loop — cook the recipe, earn the badge)
- Weekly leaderboard (social comparison, competitive re-engagement)
- Recipe library (collection behavior — "I have 3 saved, I want 10")
- Restaurant Packs (content pull — "I want to see the Chipotle pack")

**Notification strategy (post-permission grant):**
- D1 evening: "Ready to try tonight's dinner? Scan it with Okyo 🍕"
- D3: "You haven't duped anything this week — your [goal] is waiting"
- D7: "Weekly Dupe Challenge is live — see how much you saved vs. eating out"

Notifications must feel personal, not broadcast. Use goal selection data to personalize message tone (Casual vs. All In users respond to different framings).

---

## Analytics Event Map (Activation Strategy View)

**Funnel events (required):**
- `onboarding_started`
- `hero_screen_viewed`
- `weekly_goal_viewed`
- `weekly_goal_selected` {goal_id}
- `reminder_viewed`
- `notification_permission_granted`
- `notification_permission_denied`
- `notification_permission_skipped`
- `loading_screen_viewed`
- `scan_screen_viewed`
- `scan_initiated` {source: camera|gallery|demo}
- `scan_completed`
- `first_result_viewed` {confidence, dish_name, savings_estimate}
- `paywall_viewed`
- `trial_started`
- `onboarding_completed`

**Activation event (north star):**
- `activation_event` — fired when first_result_viewed with confidence ≥ 0.6

**Drop-off events (required):**
- `onboarding_abandoned` {screen, time_on_screen_ms}

**Computed metrics:**
- onboarding_completion_rate = onboarding_completed / onboarding_started
- scan_attempt_rate = scan_initiated / scan_screen_viewed
- activation_rate = activation_event / onboarding_started
- notification_grant_rate = notification_permission_granted / reminder_viewed
- paywall_conversion_rate = trial_started / paywall_viewed

---

## Hostile Audit: Where This Fails

**Scenario 1: User opens app but has no food to scan**
The scan screen presents a high-friction action. Users without food nearby have no natural entry point. Current gallery option exists but may not be prominent enough.
Fix: Add demo scan mode with pre-loaded example food image.

**Scenario 2: Camera permission denied**
If the user previously denied camera access, the scan screen renders as dead UI.
Fix: Detect denied state, show "Enable Camera in Settings" with deep link.

**Scenario 3: AI returns a generic result**
If OpenRouter fails or returns low confidence, the first result screen may show a meaningless or wrong dish. This destroys trust in a way that is very hard to recover from.
Fix: Onboarding must use the most reliable AI path available. Never show a default pasta result for a real scan failure during onboarding. Show a clear, warm failure state with retry option.

**Scenario 4: User completes onboarding but doesn't return on D2**
The notification hook covers this, but users who declined notifications and didn't save a recipe have zero external pull.
Fix: Ensure first result screen prompts recipe save with a motivating CTA: "Save this recipe — your grocery list is ready."

**Scenario 5: Paywall appears before user trusts the product**
Users who speed through onboarding without engaging (no goal selected, skipped reminder, fast-tapped scan) arrive at paywall with minimal trust and minimal activation. They will not convert.
Fix: Gate paywall on scan completion — do not show paywall to users who didn't complete a scan.
