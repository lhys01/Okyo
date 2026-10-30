export type MacroDetailPreference = 'simple' | 'all' | 'own';
export type OwnDailyMacroReferences = { proteinGrams?: number; calories?: number };
export type MacroPreferences = {
  detail: MacroDetailPreference;
  focus: string | null;
  ownDailyReferences: OwnDailyMacroReferences;
  obstacle?: string | null;
  recipePriorities?: string[];
  targetMode?: 'estimate' | 'known' | 'flexible';
};

export function isMacroDetailPreference(value: unknown): value is MacroDetailPreference {
  return value === 'simple' || value === 'all' || value === 'own';
}

export function normalizeOwnDailyReferences(value: unknown): OwnDailyMacroReferences {
  const candidate = value && typeof value === 'object' ? value as OwnDailyMacroReferences : {};
  const result: OwnDailyMacroReferences = {};
  if (Number.isFinite(candidate.proteinGrams) && candidate.proteinGrams! > 0 && candidate.proteinGrams! <= 400) result.proteinGrams = candidate.proteinGrams;
  if (Number.isFinite(candidate.calories) && candidate.calories! >= 800 && candidate.calories! <= 6000) result.calories = candidate.calories;
  return result;
}

export function normalizeMacroPreferences(value: unknown): MacroPreferences | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<MacroPreferences>;
  if (!isMacroDetailPreference(candidate.detail)) return undefined;
  return {
    detail: candidate.detail,
    focus: typeof candidate.focus === 'string' ? candidate.focus.slice(0, 80) : null,
    ownDailyReferences: candidate.detail === 'own' ? normalizeOwnDailyReferences(candidate.ownDailyReferences) : {},
    obstacle: typeof candidate.obstacle === 'string' ? candidate.obstacle.slice(0, 80) : null,
    recipePriorities: Array.isArray(candidate.recipePriorities) ? candidate.recipePriorities.filter((value): value is string => typeof value === 'string').slice(0, 2) : [],
    targetMode: candidate.targetMode === 'estimate' || candidate.targetMode === 'known' || candidate.targetMode === 'flexible' ? candidate.targetMode : undefined,
  };
}

/** Reuses the API's nutrition-detail context; never supplies a full calculated target. */
export function macroPreferenceRequestContext(preferences: MacroPreferences): string {
  const display = preferences.detail === 'simple' ? 'Keep nutrition simple' : 'Show all macros';
  const focus = preferences.focus ? '; focus on ' + preferences.focus : '';
  const own = preferences.detail === 'own' ? normalizeOwnDailyReferences(preferences.ownDailyReferences) : {};
  const references = [own.proteinGrams !== undefined ? own.proteinGrams + 'g protein/day' : '', own.calories !== undefined ? own.calories + ' calories/day' : ''].filter(Boolean);
  const obstacle = preferences.obstacle ? '; obstacle: ' + preferences.obstacle : '';
  const priorities = preferences.recipePriorities?.length ? '; recipe priorities: ' + preferences.recipePriorities.join(', ') : '';
  return display + focus + obstacle + priorities + (references.length ? '; user-entered daily reference: ' + references.join(', ') + '. Not recommended by Okyo; not a per-meal target.' : '');
}
