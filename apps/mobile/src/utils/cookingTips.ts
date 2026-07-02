export type CookingTipCategory =
  | 'prep'
  | 'knife'
  | 'heat'
  | 'safety'
  | 'seasoning'
  | 'visual'
  | 'texture'
  | 'cleanup';

export type CookingTip = {
  body: string;
  category: CookingTipCategory;
  title: string;
};

type TipStepContext = {
  ingredientsUsed?: { name: string }[];
  instruction: string;
  safetyNote?: string;
  toolsUsed?: string[];
  visualCue?: string;
};

const generalTip: CookingTip = {
  category: 'prep',
  title: 'Set yourself up',
  body: 'Read the step once before you start, then pull the needed ingredients close. Cooking feels calmer when the next move is already in reach.',
};

const tipRules: Array<{ keywords: string[]; tip: CookingTip }> = [
  {
    keywords: ['knife', 'chop', 'slice', 'dice', 'mince', 'cutting board'],
    tip: {
      category: 'knife',
      title: 'Knife safety',
      body: 'Keep fingertips tucked slightly under your knuckles and move slowly. A steady cut beats a fast one every time.',
    },
  },
  {
    keywords: ['raw chicken', 'raw beef', 'raw pork', 'raw turkey', 'raw meat', 'egg', 'eggs', 'thermometer'],
    tip: {
      category: 'safety',
      title: 'Food safety',
      body: 'Wash hands and surfaces after raw meat or eggs. For meat, use a thermometer when possible instead of guessing by color alone.',
    },
  },
  {
    keywords: ['skillet', 'pan', 'sauté', 'saute', 'sear', 'brown', 'medium heat', 'medium-high', 'heat'],
    tip: {
      category: 'heat',
      title: 'Heat control',
      body: 'If food browns too fast or smells sharp, lower the heat and give the pan a moment. You can always add heat back.',
    },
  },
  {
    keywords: ['salt', 'season', 'pepper', 'taste', 'spice', 'spices', 'sauce'],
    tip: {
      category: 'seasoning',
      title: 'Season gradually',
      body: 'Add a little seasoning, taste if it is safe to taste, then adjust. Small changes are easier to fix than one big pour.',
    },
  },
  {
    keywords: ['golden', 'bubbly', 'opaque', 'tender', 'crisp', 'thickened', 'visual cue', 'look for'],
    tip: {
      category: 'visual',
      title: 'Trust visual cues',
      body: 'Times are estimates. Color, texture, bubbling, and aroma usually tell you more than the clock.',
    },
  },
  {
    keywords: ['stir', 'fold', 'whisk', 'mix', 'toss', 'combine'],
    tip: {
      category: 'texture',
      title: 'Mix with intention',
      body: 'Stir just until things come together unless the step asks for more. Overmixing can make tender foods dense or mushy.',
    },
  },
  {
    keywords: ['serve', 'plate', 'finish', 'garnish'],
    tip: {
      category: 'cleanup',
      title: 'Finish clean',
      body: 'Before plating, wipe the counter and clear the board. A calm finish makes the food feel better too.',
    },
  },
];

export function getCookingTipForStep(step: TipStepContext): CookingTip {
  const text = [
    step.instruction,
    step.visualCue,
    step.safetyNote,
    ...(step.ingredientsUsed ?? []).map((ingredient) => ingredient.name),
    ...(step.toolsUsed ?? []),
  ]
    .join(' ')
    .toLowerCase();

  const matchedRule = tipRules.find((rule) => rule.keywords.some((keyword) => text.includes(keyword)));

  return matchedRule?.tip ?? generalTip;
}
