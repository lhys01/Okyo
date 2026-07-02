# IMPLEMENTATION_PLAN.md
# Okyo Onboarding — Implementation Plan

---

## Full Screen List (Ordered Flow)

| Order | Key | Component | Auto-advance | User Action Required |
|-------|-----|-----------|--------------|----------------------|
| — | `splash` | `SplashScreen` | Yes (1s) | None |
| 1 | `hero` | `OnboardingHeroScreen` | No | Tap CTA |
| 2 | `weeklyGoal` | `OnboardingWeeklyGoalScreen` | No | Select goal + tap CTA |
| 3 | `reminder` | `OnboardingReminderScreen` | No | Grant/skip notification |
| 4 | `loading` | `OnboardingLoadingScreen` | Yes (2.5s) | None |
| 5 | `scan` | `OnboardingScanCard` | No | Camera or gallery action |
| — | `scanLoading` | `OnboardingScanLoadingScreen` | Yes (result-driven) | None |
| 6 | `firstResult` | `OnboardingFirstResultScreen` | No | Tap "See Your Recipe" |
| 7 | `paywall` | `OnboardingPaywallScreen` | No | Trial start or skip |

`progressSteps` array (used for progress indicator):
```ts
const progressSteps: OnboardingScreenKey[] = [
  'hero', 'weeklyGoal', 'reminder', 'loading', 'scan', 'firstResult', 'paywall'
];
```

---

## Component Breakdown

### Shell Components

**`OnboardingScreenShell`**
Wraps all onboarding screens. Provides:
- Safe area insets
- Background color (from `onboardingColors`)
- Progress dots (renders based on `currentStep` and `progressSteps`)
- Optional back button (hidden on hero and paywall)

Props: `step`, `totalSteps`, `showBack`, `onBack`, `backgroundColor`, `children`

**`OnboardingStatefulButton`**
Orange pill CTA button. States: enabled / disabled / loading.
Props: `label`, `onPress`, `disabled`, `loading`

**`KikoSpeechBubble`**
White rounded bubble with Kiko avatar icon. Renders above or beside Kiko.
Props: `message`, `position` (`top-left` | `top-right` | `center`)

---

### Screen Components (in `OnboardingUI.tsx`)

**`OnboardingHeroScreen`**
- Hero food image (full-width, top half of screen)
- Headline (BigShoulders-Bold, 56–72px, coral)
- Kiko mascot (bottom-right, small, waving pose)
- CTA button

**`OnboardingWeeklyGoalScreen`**
- Kiko speech bubble (top)
- 4 goal cards: `FlatList` or mapped `View` with `Pressable`
  - Card state: default (white) / selected (orange border + tint)
- CTA button (disabled until selection)

Goal card component: `OnboardingGoalCard`
Props: `option`, `selected`, `onSelect`

**`OnboardingReminderScreen`**
- Kiko (centered, large)
- Kiko speech bubble
- iOS permission dialog mock (`View` with white card, `#007AFF` buttons, `StyleSheet` hairline borders)
- Animated orange arrow (pointing up at "Allow")
- CTA button
- "Maybe later" `Pressable` text link

Edge case UI: `OnboardingReminderDeniedState` — shown when system notifications already denied.

**`OnboardingLoadingScreen`**
- Kiko (centered, large, "working" expression)
- `BUILDING YOUR PLAN...` label
- Rotating body text (2–3 options, cycles every 800ms via `useEffect + setInterval`)
- Pulsing dots (`Animated.Value` array, sequential opacity)

**`OnboardingScanCard`**
- Scan frame (camera viewfinder aesthetic)
- Kiko beside frame
- Micro-copy
- Camera CTA button
- Gallery CTA button (secondary)
- Demo option text link (if `DEMO_MODE_ENABLED`)

**`OnboardingScanLoadingScreen`**
- Analyzing indicator
- Kiko "thinking" pose
- Progress text ("Reading your meal...")
- Auto-advances when scan result is received via store update

**`OnboardingFirstResultScreen`**
- Dish name (large)
- Confidence pill (small, subtle)
- Savings estimate (green, counting animation)
- Recipe teaser (3–4 ingredients)
- Kiko celebration pose
- `SEE YOUR RECIPE` CTA

Failure variant: `OnboardingFirstResultFailureScreen`
- "Hmm, this one's tricky" messaging
- Retry + continue options
- No mock data

**`OnboardingPaywallScreen`**
- Value headline (goal-personalized)
- Trial offer display
- Feature bullets (3 max)
- `START FREE TRIAL` CTA
- `Continue free` / `Maybe later` link
- Fine print

---

## UI System Structure

### Color Tokens (`onboardingColors`)
```ts
const onboardingColors = {
  background: '#FFF8F0',       // warm cream
  coral: '#FF6B35',            // primary brand
  coralLight: '#FFE5D9',       // card tint on selection
  green: '#2ECC71',            // savings signal
  charcoal: '#2D2D2D',         // body text
  white: '#FFFFFF',
  gray: '#C4C4C4',             // disabled state
  dotActive: '#2D2D2D',
  dotInactive: '#E0E0E0',
  iosBlue: '#007AFF',          // iOS permission dialog
};
```

### Typography
- Hero headline: `BigShoulders-Bold`, 56–72px
- Screen label: `BigShoulders-Bold`, 28–36px
- Body: `Inter-Regular` or system default, 15–16px
- Micro-copy: `Inter-Regular`, 13px
- CTA label: `BigShoulders-Bold` or `Inter-SemiBold`, 16px uppercase

### Spacing
- Screen horizontal padding: 24px
- Card spacing: 12px between cards
- CTA bottom padding: 32px + safe area inset
- Kiko margin from content: 16px

### Border Radius
- Cards: 16px
- CTA button: 100px (full pill)
- Speech bubble: 16px (with tail)

---

## State Management Flow

All onboarding state lives in `useOkyoStore` (Zustand).

### Relevant store slices:

```ts
// Onboarding
hasCompletedOnboarding: boolean
onboardingWeeklyGoal: OnboardingWeeklyGoal | null  // id of selected goal

// Scan
selectedScanImage: { uri: string } | null
latestScanResult: CreateScanResult | null
latestScanFailure: LatestScanFailure | null
isScanLoading: boolean

// Settings
notificationsEnabled: boolean
```

### State transitions during onboarding:

```
weeklyGoal screen: setOnboardingWeeklyGoal(goal_id)

reminder screen:
  → grant: scheduleOkyoDailyReminder(), setNotificationsEnabled(true)
  → deny/skip: setNotificationsEnabled(false)

scan screen:
  → image picked: setSelectedScanImage({ uri })
  → scan submitted: setIsScanLoading(true), call createMockScan or real scan API
  → result received: setLatestScanResult(result), setIsScanLoading(false)
  → failure: setLatestScanFailure(reason), setIsScanLoading(false)

paywall:
  → trial start: IAP purchase flow (StoreKit / expo-in-app-purchases)
  → skip: no state change

exit:
  → setHasCompletedOnboarding(true)
  → navigate to MainTabs via CommonActions.reset
```

---

## Navigation Logic

```
WelcomeScreen (single screen host)
  ↓ manages internal step state
  ↓ currentStep: OnboardingScreenKey

On complete:
  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: 'MainTabs' }],
    })
  );
```

Back navigation rules:
- `hero` → no back
- `weeklyGoal` → hero
- `reminder` → weeklyGoal
- `loading` → back disabled (auto-advance screen)
- `scan` → reminder (skip loading to prevent auto-advance re-trigger)
- `firstResult` → scan (allow retry)
- `paywall` → no back (onboarding complete at this point)

---

## Animation System Plan

### Tools
- `Animated` (React Native core) — for entrance, pulse, count-up
- `Easing` — `Easing.out(Easing.cubic)` for entrances; `Easing.inOut(Easing.sine)` for pulses
- `useNativeDriver: true` — required for transform and opacity animations; cannot use for layout properties

### Animation inventory

| Animation | Screen | Type | Duration | Driver |
|-----------|--------|------|----------|--------|
| Food image scale-in | Hero | scale 0.95→1 | 300ms | Native |
| Headline fade-up | Hero | opacity + translateY | 400ms | Native |
| Kiko bounce-in | Hero, Reminder | translateY + opacity | 500ms | Native |
| Card stagger fade | Weekly Goal | opacity, sequential | 100ms/card | Native |
| Card selection tint | Weekly Goal | backgroundColor | 150ms | JS (color) |
| CTA enable cross-fade | Weekly Goal | opacity gray→orange | 200ms | JS (color) |
| Arrow bounce | Reminder | translateY loop | 600ms period | Native |
| Kiko idle pulse | Loading | scale loop | 2000ms period | Native |
| Dot pulse sequence | Loading | opacity loop | 400ms/dot | Native |
| Text rotation fade | Loading | opacity in/out | 300ms | Native |
| Scan frame shimmer | Scan | opacity loop | 1500ms period | Native |
| Result card slide-up | First Result | translateY + opacity | 400ms | Native |
| Savings count-up | First Result | JS number interpolation | 600ms | JS |
| Confetti burst | First Result | particle system (if implemented) | 800ms | Native |
| Feature bullet stagger | Paywall | opacity, sequential | 100ms/bullet | Native |

### Entrance pattern (reusable)
```ts
const entranceAnim = useRef(new Animated.Value(0)).current;

useEffect(() => {
  Animated.timing(entranceAnim, {
    toValue: 1,
    duration: 400,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
  }).start();
}, []);

// Apply as:
style={{ opacity: entranceAnim, transform: [{ translateY: entranceAnim.interpolate({ inputRange: [0,1], outputRange: [20, 0] }) }] }}
```

---

## Asset Requirements

### Kiko poses needed for onboarding
| Pose | Screen | Description |
|------|--------|-------------|
| `waving` | Hero | friendly wave, small size |
| `encouraging` | Weekly Goal | thumbs up or happy nod |
| `asking` | Reminder | curious lean, personal |
| `working` | Loading | focused, engaged |
| `excited` | Scan | leaning in, anticipatory |
| `thinking` | Scan Loading | chin tilt, processing |
| `celebrating` | First Result | arms up, triumph |
| `proud` | First Result (success) | gentle smile |
| `apologetic` | First Result (failure) | curious-concerned |
| `supportive` | Paywall | calm, encouraging |

### Food images
- Hero screen: 1 high-quality restaurant food photo (warm-lit, appetizing)
- Consider 2–3 variants to A/B test cuisine type match with user population

### Icons
- Goal card icons: 4 icons (one per frequency) — simple, outline style
- Feature bullet icons: 3 icons for paywall features

---

## Analytics Event Map

### Event naming convention
`snake_case`, past tense for completed actions, present tense for states.

### Full event list

```ts
// Session
'onboarding_started'          // app opened, WelcomeScreen mounted

// Screen views
'hero_screen_viewed'
'weekly_goal_screen_viewed'
'reminder_screen_viewed'
'loading_screen_viewed'
'scan_screen_viewed'
'first_result_screen_viewed'  // { confidence, dish_name, savings_estimate }
'paywall_screen_viewed'       // { goal_id }

// User actions
'weekly_goal_selected'        // { goal_id, label }
'weekly_goal_cta_tapped'      // { goal_id }
'notification_permission_granted'
'notification_permission_denied'
'notification_permission_skipped'
'scan_initiated'              // { source: 'camera' | 'gallery' | 'demo' }
'scan_completed'              // { source }
'scan_failed'                 // { reason: 'low_confidence' | 'non_food' | 'api_error' }
'scan_retried'
'first_result_cta_tapped'     // { confidence }
'paywall_trial_started'       // { goal_id, plan }
'paywall_skipped'             // { goal_id }

// Activation
'activation_event'            // { dish_name, confidence, savings_estimate, source }
// Fired when first_result_viewed with confidence >= 0.6

// Completion
'onboarding_completed'        // { goal_id, notification_granted, activated }

// Drop-off
'onboarding_abandoned'        // { screen, time_on_screen_ms }
// Fired via AppState change or NavigationState listener
```

### Event implementation

Events fire via the existing `track()` utility:
```ts
import { track } from '../analytics/track';

track('activation_event', {
  dish_name: result.dishName,
  confidence: result.confidence,
  savings_estimate: result.estimatedSavings,
  source: scanSource,
});
```

---

## Drop-off Tracking Strategy

### Method
Use `AppState` listener combined with `NavigationState` listener to detect when a user closes the app mid-onboarding.

```ts
// In WelcomeScreen
useEffect(() => {
  const subscription = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'background' || nextState === 'inactive') {
      if (!hasCompletedOnboarding) {
        track('onboarding_abandoned', {
          screen: currentStep,
          time_on_screen_ms: Date.now() - screenEntryTime.current,
        });
      }
    }
  });
  return () => subscription.remove();
}, [currentStep, hasCompletedOnboarding]);
```

Track `screenEntryTime` with a ref that updates on each step change.

---

## Funnel Analysis Strategy

### Primary funnel (in analytics dashboard)
```
onboarding_started
→ scan_screen_viewed         (funnel health: goal + reminder step drop-off)
→ scan_initiated             (friction: camera anxiety, no-food problem)
→ activation_event           (AI quality: result usability)
→ onboarding_completed       (completion health)
→ paywall_trial_started      (monetization health)
```

### Secondary funnels
- Notification grant funnel: `reminder_screen_viewed` → `notification_permission_granted`
- Scan source breakdown: `scan_initiated.source` distribution (camera vs. gallery vs. demo)
- Goal distribution: `weekly_goal_selected.goal_id` breakdown and correlation with D7 retention

### Cohort analysis targets
- Completion rate by device (iOS version, model)
- Activation rate by scan source
- Trial conversion rate by goal selection
- D7 retention by: notification granted (Y/N) × scan completed (Y/N) × goal selected (Y/N)

### Threshold alerts (recommended)
| Metric | Alert threshold |
|--------|----------------|
| Hero → next | < 88% |
| Scan attempt rate | < 55% |
| Activation rate | < 60% |
| Paywall trial start | < 12% |
| Onboarding abandoned (any screen) | > 8% single screen |

---

## Evaluation Checklist

### Activation Audit
- [ ] User reaches first value moment (AI result) in first session
- [ ] Scan screen has gallery + demo fallback for users without food
- [ ] No mock result shown during real scan failure
- [ ] Failure state is warm, not technical

### Clarity Audit
- [ ] Every screen has one headline
- [ ] Every screen has one CTA
- [ ] A 14-year-old can understand the goal of every screen in < 3 seconds
- [ ] No jargon (no "AI", "confidence score", "LLM" visible to user)

### Conversion Audit
- [ ] Goal selection creates measurable retention lift (tracked in analytics)
- [ ] Notification permission screen achieves ≥ 60% grant rate
- [ ] Paywall appears only after scan completion
- [ ] Trial terms are clear and visible (no dark patterns)

### Design Audit
- [ ] All screens match "Warm Appetite" aesthetic (coral, cream, charcoal)
- [ ] Kiko is present on every screen with appropriate expression
- [ ] All animations use `useNativeDriver: true` where possible
- [ ] CTA buttons are full-width pill, high-contrast orange
- [ ] No screen has more than 2 interactive elements

### Founder Audit
- [ ] Onboarding completion rate target: ≥ 70%
- [ ] Activation rate target: ≥ 50% of installs
- [ ] Trial start rate target: ≥ 15% of installs
- [ ] All events firing correctly in analytics (smoke test before launch)

### Hostile Audit
- [ ] Camera permission denied → graceful recovery (not broken UI)
- [ ] No food nearby → demo mode available
- [ ] AI returns wrong result → warm error state, retry available
- [ ] User taps back repeatedly → navigation does not loop
- [ ] Loading screen auto-advance does not re-trigger on back navigation
- [ ] Paywall shows correct price (IAP configuration verified on TestFlight)
- [ ] Onboarding re-entry (hasCompletedOnboarding = false) does not corrupt app state
