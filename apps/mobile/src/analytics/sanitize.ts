/** Explicit event inventory. Additions here require a privacy review. */
export const ALLOWED_ANALYTICS_EVENTS = [
  'app_opened', 'session_started', 'app_backgrounded', 'app_foregrounded', 'screen_viewed',
  'onboarding_started', 'onboarding_screen_viewed', 'onboarding_answer_submitted',
  'onboarding_goal_selected', 'onboarding_completed', 'onboarding_reset', 'account_created',
  'onboarding_experiment_started', 'onboarding_experiment_branch_completed',
  'account_creation_started',
  'primary_goal_selected', 'personal_insight_viewed', 'dietary_preferences_saved',
  'personal_plan_viewed', 'first_scan_input_selected', 'camera_permission_prompted',
  'camera_permission_result', 'photo_confirmed', 'analysis_started', 'analysis_succeeded',
  'analysis_failed', 'first_recipe_revealed', 'meaningful_action_selected',
  'purchase_started', 'purchase_succeeded', 'purchase_failed', 'purchase_restored',
  'save_money_step_viewed', 'save_money_step_completed', 'personalization_completed',
  'personalization_skipped', 'sign_in_started', 'sign_in_succeeded', 'sign_in_failed',
  'sign_in_skipped', 'sign_out', 'scan_started', 'scan_succeeded', 'scan_failed',
  'recipe_generated', 'recipe_viewed', 'recipe_saved', 'recipe_unsaved', 'recipe_customized',
  'customization_started', 'customization_completed', 'guided_tour_started',
  'guided_tour_step_viewed', 'guided_tour_completed', 'guided_tour_skipped',
  'settings_viewed', 'account_deletion_started', 'account_deletion_succeeded',
  'account_deletion_failed', 'local_data_cleared', 'client_error', 'performance_timing',
  'grocery_list_viewed', 'grocery_list_exported', 'share_card_generated', 'share_completed',
  'challenge_started', 'challenge_completed', 'accuracy_rating_submitted', 'badge_unlocked',
  'leaderboard_viewed', 'restaurant_pack_viewed', 'paywall_viewed', 'subscription_started',
  'subscription_renewed', 'subscription_cancelled', 'subscription_expired',
] as const;

export type AnalyticsEventName = (typeof ALLOWED_ANALYTICS_EVENTS)[number];

export const ALLOWED_PROPERTY_KEYS = [
  'app_version', 'platform', 'environment', 'screen', 'step', 'flow', 'source', 'provider',
  'result', 'reason', 'category', 'action', 'error_code', 'duration_ms',
  'experiment_name', 'experiment_variant',
] as const;

export type AnalyticsPropertyKey = (typeof ALLOWED_PROPERTY_KEYS)[number];
export type AnalyticsProperties = Partial<{
  app_version: string;
  platform: 'ios' | 'android' | 'web';
  environment: 'development' | 'production';
  screen: 'welcome' | 'home' | 'discover' | 'liked' | 'profile' | 'settings' | 'goal' | 'scan' | 'scan_result' | 'recipe' | 'recipe_steps' | 'grocery' | 'privacy_data' | 'notifications' | 'stats' | 'help' | 'legal' | 'tour' | 'onboarding' | 'paywall';
  step: 'start' | 'goal' | 'preferences' | 'plan' | 'scan' | 'recipe' | 'home' | 'discover' | 'liked' | 'grocery' | 'settings' | 'tour_1' | 'tour_2' | 'tour_3' | 'tour_4' | 'tour_5' | 'tour_6' | 'tour_7' | 'tour_8';
  flow: 'onboarding_v3' | 'onboarding_v4' | 'guided_tour' | 'account_deletion' | 'scan' | 'recipe_customization';
  source: 'camera' | 'photos' | 'description' | 'mock' | 'home' | 'onboarding' | 'library' | 'tour' | 'settings' | 'notification' | 'unknown';
  provider: 'apple' | 'google';
  result: 'success' | 'failure' | 'partial' | 'cancelled' | 'skipped';
  reason: 'unclear_photo' | 'not_food' | 'network' | 'timeout' | 'unavailable' | 'cancelled' | 'invalid_input' | 'unknown' | 'user_action' | 'completed' | 'validation' | 'provider_error' | 'auth_failed';
  category: 'recipe' | 'notifications' | 'privacy' | 'subscription' | 'tour';
  action: 'started' | 'completed' | 'skipped' | 'saved' | 'removed' | 'continued' | 'retried' | 'exported' | 'cook' | 'customize';
  error_code: 'network' | 'timeout' | 'unavailable' | 'validation' | 'unknown' | 'scan_failed' | 'auth_failed';
  duration_ms: number;
  experiment_name: 'branch_questions_v1';
  experiment_variant: 'A' | 'B' | 'C';
}>;

const ALLOWED_EVENTS: ReadonlySet<string> = new Set(ALLOWED_ANALYTICS_EVENTS);
const ALLOWED_KEYS: ReadonlySet<string> = new Set(ALLOWED_PROPERTY_KEYS);

const ENUMS: Partial<Record<AnalyticsPropertyKey, ReadonlySet<string>>> = {
  platform: new Set(['ios', 'android', 'web']),
  environment: new Set(['development', 'production']),
  screen: new Set([
    'welcome', 'home', 'discover', 'liked', 'profile', 'settings', 'goal', 'scan', 'scan_result',
    'recipe', 'recipe_steps', 'grocery', 'privacy_data',
    'notifications', 'stats', 'help', 'legal', 'tour', 'onboarding', 'paywall',
  ]),
  step: new Set(['start', 'goal', 'preferences', 'plan', 'scan', 'recipe', 'home', 'discover', 'liked', 'grocery', 'settings', 'tour_1', 'tour_2', 'tour_3', 'tour_4', 'tour_5', 'tour_6', 'tour_7', 'tour_8']),
  flow: new Set(['onboarding_v3', 'onboarding_v4', 'guided_tour', 'account_deletion', 'scan', 'recipe_customization']),
  source: new Set(['camera', 'photos', 'description', 'mock', 'home', 'onboarding', 'library', 'tour', 'settings', 'notification', 'unknown']),
  provider: new Set(['apple', 'google']),
  result: new Set(['success', 'failure', 'partial', 'cancelled', 'skipped']),
  reason: new Set([
    'unclear_photo', 'not_food', 'network', 'timeout', 'unavailable', 'cancelled', 'invalid_input',
    'unknown', 'user_action', 'completed', 'validation', 'provider_error',
    'auth_failed',
  ]),
  category: new Set(['recipe', 'notifications', 'privacy', 'subscription', 'tour']),
  action: new Set(['started', 'completed', 'skipped', 'saved', 'removed', 'continued', 'retried', 'exported', 'cook', 'customize']),
  error_code: new Set(['network', 'timeout', 'unavailable', 'validation', 'unknown', 'scan_failed', 'auth_failed']),
  experiment_name: new Set(['branch_questions_v1']),
  experiment_variant: new Set(['A', 'B', 'C']),
};

const NUMERIC_KEYS: ReadonlySet<string> = new Set(['duration_ms']);
export const MAX_STRING_LENGTH = 40;

/**
 * Keeps only predefined event names and property keys with small, approved
 * enumerations. Arbitrary strings are rejected, so user content cannot pass
 * through even when a call site accidentally supplies it.
 */
export function sanitizeProperties(input: Record<string, unknown> = {}): AnalyticsProperties {
  const out: AnalyticsProperties = {};
  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    if (NUMERIC_KEYS.has(key)) {
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 86_400_000) {
        (out as Record<string, string | number>)[key] = Math.round(value);
      }
      continue;
    }
    if (typeof value !== 'string' || value.length === 0 || value.length > MAX_STRING_LENGTH) continue;
    if (key === 'app_version' && /^[A-Za-z0-9.+-]+$/.test(value)) {
      (out as Record<string, string | number>)[key] = value;
      continue;
    }
    const allowedValues = ENUMS[key as AnalyticsPropertyKey];
    if (allowedValues?.has(value)) (out as Record<string, string | number>)[key] = value;
  }
  return out;
}

export function sanitizeAnalyticsEvent(event: string, properties: Record<string, unknown> = {}) {
  if (!ALLOWED_EVENTS.has(event)) return null;
  return { event: event as AnalyticsEventName, properties: sanitizeProperties(properties) };
}

type AnalyticsScreen = NonNullable<AnalyticsProperties['screen']>;
const SCREEN_BY_ROUTE: Readonly<Record<string, AnalyticsScreen>> = {
  WelcomeScreen: 'welcome', GoalScreen: 'goal', HomeScreen: 'home', RestaurantPacksScreen: 'discover',
  LibraryScreen: 'liked', ProfileScreen: 'profile', SettingsScreen: 'settings',
  AnalysisLoadingScreen: 'scan', ResultSummaryScreen: 'scan_result', DescribeMealScreen: 'scan',
  RecipeDetailScreen: 'recipe', RecipeStepsScreen: 'recipe_steps', GroceryListScreen: 'grocery',
  PrivacyDataScreen: 'privacy_data', PersonalizationScreen: 'settings',
  NutritionTargetsScreen: 'settings', DietaryPreferencesScreen: 'settings', NotificationPreferencesScreen: 'notifications',
  StatsProgressScreen: 'stats', HelpSupportScreen: 'help', LegalScreen: 'legal',
  RestaurantPackDetailScreen: 'discover',
};

export function analyticsScreenForRoute(routeName: string | undefined): AnalyticsScreen | null {
  return routeName ? SCREEN_BY_ROUTE[routeName] ?? null : null;
}

/** Coarse onboarding phase; never reflects a selected goal, answer, or health path. */
export function onboardingAnalyticsStage(step: string): NonNullable<AnalyticsProperties['step']> {
  if (step === 'splash' || step === 'showcase' || step === 'nameFox' || step === 'foxIntro' || step === 'name') return 'start';
  if (step.startsWith('question') || step.startsWith('branch') || step === 'dietaryPreferences') return 'preferences';
  if (step === 'planReady' || step === 'personalizationChoice' || step === 'paywall' || step === 'postPurchase') return 'plan';
  if (step === 'photo' || step === 'scanEntry' || step === 'analyzing') return 'scan';
  if (step === 'recipe' || step === 'cooking' || step === 'cookingComplete') return 'recipe';
  return 'start';
}
