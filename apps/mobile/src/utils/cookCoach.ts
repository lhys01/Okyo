import type { Recipe, RecipeIngredient } from '../mocks';
import { buildSmartGrocerySummary } from './smartGrocery';

export type CookRescueAction =
  | 'messedUp'
  | 'substitute'
  | 'explain'
  | 'simplify'
  | 'howShouldItLook';

export type CookCoachTip = {
  id: string;
  title: string;
  body: string;
  tone: 'calm' | 'warning' | 'encouraging' | 'practical';
};

export type CookCoachTimer = {
  id: string;
  label: string;
  seconds: number;
  source: 'stepEstimate' | 'instructionText';
};

export type CookCoachStepHelp = {
  stepId: string;
  visualCue?: string;
  doneWhen?: string;
  why?: string;
  avoidThis?: string;
  commonMistake?: string;
  timers: CookCoachTimer[];
  rescueTips: Record<CookRescueAction, CookCoachTip[]>;
};

type CookCoachStepLike = {
  commonMistake?: string;
  commonQuestion?: string;
  commonQuestionAnswer?: string;
  doneWhen?: string;
  estimatedMinutes?: number | null;
  ingredientsUsed?: RecipeIngredient[];
  instruction?: string;
  safetyNote?: string;
  stepNumber?: number;
  title?: string;
  toolsUsed?: string[];
  visualCue?: string;
  why?: string;
};

const COOKING_TERM_EXPLANATIONS: Array<[RegExp, string, string]> = [
  [/\bsaut[eé]\b|\bsaute\b/i, 'Saute', 'Cook in a little oil or butter over medium heat until softened, lightly golden, or fragrant.'],
  [/\bsimmer\b/i, 'Simmer', 'Keep the liquid gently bubbling, not boiling hard. Small bubbles should rise slowly.'],
  [/\bsear\b/i, 'Sear', 'Use steady heat so the outside browns before you move the food around.'],
  [/\bfold\b/i, 'Fold', 'Gently lift and turn the mixture so it combines without knocking out too much air.'],
  [/\bdeglaze\b/i, 'Deglaze', 'Add liquid to a hot pan and scrape up the browned bits for flavor.'],
  [/\bwhisk\b/i, 'Whisk', 'Beat quickly with a fork or whisk until the mixture looks smooth and even.'],
  [/\breduce\b/i, 'Reduce', 'Let liquid bubble until some water cooks off and the sauce gets thicker.'],
  [/\brest\b/i, 'Rest', 'Leave the food alone for a few minutes so juices settle and texture improves.'],
];

export function deriveCookCoachStepHelp(
  recipe: Recipe | null | undefined,
  step: CookCoachStepLike | null | undefined,
  stepIndex: number,
): CookCoachStepHelp {
  const safeStep = step ?? {};
  const stepId = `${recipe?.id ?? 'recipe'}-step-${stepIndex + 1}`;
  const instruction = getStepInstruction(safeStep);
  const visualCue = safeStep.visualCue;
  const doneWhen = safeStep.doneWhen;
  const commonMistake = safeStep.commonMistake ?? safeStep.safetyNote;
  const avoidThis = recipe?.avoidMistake ?? recipe?.mistakeWarning ?? commonMistake;
  const why = safeStep.why;

  return {
    stepId,
    visualCue,
    doneWhen,
    why,
    avoidThis,
    commonMistake,
    timers: extractStepTimers(safeStep),
    rescueTips: {
      messedUp: deriveMessedUpTips(safeStep, recipe),
      substitute: deriveSubstitutionTips(recipe, safeStep),
      explain: [deriveExplainTip(safeStep)],
      simplify: [simplifyStep(safeStep)],
      howShouldItLook: deriveLookTips(safeStep),
    },
  };
}

export function extractStepTimers(step: CookCoachStepLike | null | undefined): CookCoachTimer[] {
  const timers: CookCoachTimer[] = [];
  const estimatedMinutes = step?.estimatedMinutes;
  if (typeof estimatedMinutes === 'number' && Number.isFinite(estimatedMinutes) && estimatedMinutes > 0) {
    timers.push({
      id: 'step-estimate',
      label: `Start ${estimatedMinutes} min timer`,
      seconds: Math.max(1, Math.round(estimatedMinutes)) * 60,
      source: 'stepEstimate',
    });
  }

  const instruction = getStepInstruction(step);
  const matches = instruction.matchAll(/(\d+)(?:\s*[–-]\s*(\d+))?\s*(?:minutes?|mins?|min)\b/gi);
  Array.from(matches).forEach((match, index) => {
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    const minutes = Number.isFinite(end) ? Math.max(start, end) : start;
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return;
    }
    if (timers.some((timer) => Math.abs(timer.seconds - minutes * 60) < 30)) {
      return;
    }
    timers.push({
      id: `instruction-${index}`,
      label: `Start ${minutes} min timer`,
      seconds: minutes * 60,
      source: 'instructionText',
    });
  });

  return timers.slice(0, 2);
}

export function deriveSubstitutionTips(recipe: Recipe | null | undefined, step: CookCoachStepLike | null | undefined): CookCoachTip[] {
  const tips: CookCoachTip[] = [];
  const smartSwap = recipe ? buildSmartGrocerySummary(recipe).swaps[0] : null;
  if (smartSwap) {
    tips.push({
      id: `smart-swap-${smartSwap.id}`,
      title: getSwapTitle(smartSwap.kind),
      body: smartSwap.reason,
      tone: 'practical',
    });
  }

  const substitution = recipe?.substitutions?.find(Boolean);
  if (substitution) {
    tips.push({
      id: 'recipe-substitution',
      title: 'Recipe swap',
      body: substitution,
      tone: 'practical',
    });
  }

  const ingredient = step?.ingredientsUsed?.[0]?.name;
  if (tips.length === 0 && ingredient) {
    tips.push({
      id: 'general-substitution',
      title: 'Substitute this',
      body: `If you do not have ${ingredient}, use the closest ingredient with a similar role, then start with a smaller amount and taste.`,
      tone: 'calm',
    });
  }

  return tips.length > 0 ? tips.slice(0, 2) : [{
    id: 'no-substitution',
    title: 'Substitute this',
    body: 'No obvious swap is listed for this step. Keep the same role if you improvise: protein for protein, acid for acid, crunch for crunch.',
    tone: 'calm',
  }];
}

export function simplifyStep(step: CookCoachStepLike | null | undefined): CookCoachTip {
  const instruction = getStepInstruction(step);
  const tinyActions = splitIntoTinyActions(instruction);
  return {
    id: 'simplify-step',
    title: 'Make this step simpler',
    body: tinyActions.map((action, index) => `${index + 1}. ${action}`).join('\n'),
    tone: 'encouraging',
  };
}

function deriveMessedUpTips(step: CookCoachStepLike, recipe?: Recipe | null): CookCoachTip[] {
  const cue = step.doneWhen ?? step.visualCue;
  const mistake = step.commonMistake ?? step.safetyNote ?? recipe?.avoidMistake ?? recipe?.mistakeWarning;
  return [{
    id: 'messed-up-calm',
    title: 'No panic',
    body: mistake
      ? `Pause and fix the risky part first: ${mistake} ${cue ? `Then check this cue: ${cue}` : 'Then continue slowly.'}`
      : `Lower the heat, stop adding new ingredients for a moment, and ${cue ? `check this cue: ${cue}` : 'look for the food to smell good and cook evenly before continuing.'}`,
    tone: 'calm',
  }];
}

function deriveExplainTip(step: CookCoachStepLike): CookCoachTip {
  const instruction = getStepInstruction(step);
  const explanation = COOKING_TERM_EXPLANATIONS.find(([pattern]) => pattern.test(instruction));
  if (explanation) {
    return {
      id: `explain-${explanation[1].toLowerCase()}`,
      title: `What "${explanation[1]}" means`,
      body: explanation[2],
      tone: 'practical',
    };
  }
  return {
    id: 'explain-step',
    title: 'What this means',
    body: `This step is asking you to ${instruction.toLowerCase()} Go slowly and use the cue before moving on.`,
    tone: 'practical',
  };
}

function deriveLookTips(step: CookCoachStepLike): CookCoachTip[] {
  const cue = step.visualCue ?? step.doneWhen;
  if (cue) {
    return [{
      id: 'look-cue',
      title: 'How should it look?',
      body: cue,
      tone: 'encouraging',
    }];
  }
  return [{
    id: 'look-general',
    title: 'How should it look?',
    body: 'Look for the food to match the step: hot food should steam, sauces should look even, and browned food should have golden edges before you move on.',
    tone: 'encouraging',
  }];
}

function getStepInstruction(step: CookCoachStepLike | null | undefined) {
  return (step?.instruction ?? step?.title ?? 'finish this step carefully').trim();
}

function splitIntoTinyActions(instruction: string) {
  const parts = instruction
    .split(/,\s+|\s+then\s+|\s+and\s+/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (parts.length >= 2) {
    return parts.map(capitalizeSentence);
  }

  return [
    'Read the step once before touching the pan.',
    'Set out the ingredients and tools you need right now.',
    capitalizeSentence(instruction),
  ];
}

function getSwapTitle(kind: 'cheaper' | 'easier' | 'pantry' | 'healthier') {
  switch (kind) {
    case 'cheaper':
      return 'Cheaper swap';
    case 'easier':
      return 'Easier swap';
    case 'healthier':
      return 'Balanced swap';
    case 'pantry':
    default:
      return 'Pantry swap';
  }
}

function capitalizeSentence(value: string) {
  const trimmed = value.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
