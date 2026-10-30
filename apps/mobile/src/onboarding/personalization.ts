// answers -> honest promises + the preferences payload sent with the scan.

import type {
  OnboardingAnswers, Problem, ScanPreferences,
} from './types';
import { getFoxDisplayName } from '../state/foxDisplayName';

/** Only claims that map to a real preference field or a named UI consumer. */
const PROBLEM_PROMISE: Record<Problem, string> = {
  decision_help: 'One clear idea, not a list',
  ingredient_flexibility: 'Flexible about what’s missing',
  less_effort: 'Fewer ingredients and steps',
  use_food_first: 'Uses what you already have',
  save_time: 'Quick to get on the table',
};

const FRICTION_PROMISE: Record<string, string> = {
  random_ingredients: 'Works with a random fridge',
  low_energy: 'Low-effort when you’re tired',
  cooking_for_others: 'Scaled for four',
  needs_substitutions: 'Substitutes for anything missing',
  mark_optional: 'Optional items marked clearly',
  avoid_extra_shopping: 'Nothing you’d have to go buy',
  fewer_ingredients: 'Short ingredient lists',
  fewer_steps: 'Fewer steps',
  clearer_instructions: 'Plain-language instructions',
  less_cleanup: 'Low cleanup',
};

const SPOIL_PROMISE: Record<string, string> = {
  produce: 'Uses up your produce first',
  leftovers: 'Builds around leftovers',
  protein: 'Uses the meat or fish first',
  opened: 'Finishes what’s already open',
};

export function buildPreferences(answers: OnboardingAnswers): ScanPreferences {
  const prefs: ScanPreferences = {};
  if (answers.problem) prefs.priority = answers.problem;
  if (answers.guidance) prefs.guidance = answers.guidance;
  if (answers.dietPattern) prefs.dietPattern = answers.dietPattern;
  if (answers.avoid?.length) prefs.avoid = [...answers.avoid];
  if (answers.recipePriority) prefs.recipePriority = answers.recipePriority;

  const f = answers.followUp;
  if (f) {
    if (f.kind === 'friction') prefs.frictionDetail = f.value;
    else if (f.kind === 'spoilFirst') prefs.spoilFirst = f.value;
    else if (f.kind === 'maxMinutes') prefs.maxMinutes = f.value;
    else if (f.kind === 'servings') prefs.servings = f.value;
    // 'maxMinutesUnknown' deliberately sets nothing — no false ceiling.
  }
  return prefs;
}

/** Returns undefined when nothing was answered, so the request field stays absent. */
export function buildPreferencesOrUndefined(answers: OnboardingAnswers): ScanPreferences | undefined {
  const prefs = buildPreferences(answers);
  return Object.keys(prefs).length ? prefs : undefined;
}

/** 3-4 promises for the setup screen, most specific first. */
export function buildPromises(answers: OnboardingAnswers): string[] {
  const out: string[] = [];
  const f = answers.followUp;
  if (f?.kind === 'friction') out.push(FRICTION_PROMISE[f.value]);
  if (f?.kind === 'spoilFirst') out.push(SPOIL_PROMISE[f.value]);
  if (f?.kind === 'maxMinutes') out.push(`Recipes under ${f.value} minutes`);
  if (f?.kind === 'servings') out.push('Scaled for four');
  if (answers.problem) {
    const p = PROBLEM_PROMISE[answers.problem];
    if (!out.includes(p)) out.push(p);
  }
  if (answers.guidance === 'step_by_step') out.push('Step-by-step guidance');
  else if (answers.guidance === 'essentials') out.push('Compact, no hand-holding');
  if (answers.dietPattern || answers.avoid?.length) out.push('Respects what you avoid');
  return out.slice(0, 4);
}

/** Single sentence under the setup headline. */
export function buildSummaryLine(answers: OnboardingAnswers, mascotName?: string | null): string {
  const promises = buildPromises(answers).slice(0, 3).map((p) => p.toLowerCase());
  if (!promises.length) return 'Okyo will build recipes from whatever you photograph.';
  return `Based on your answers, ${getFoxDisplayName(mascotName)} will write recipes that are ${joinList(promises)}.`;
}

function joinList(values: string[]): string {
  if (values.length === 1) return values[0];
  return `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}`;
}
