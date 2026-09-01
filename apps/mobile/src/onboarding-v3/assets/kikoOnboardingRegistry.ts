import type { ImageSourcePropType } from 'react-native';

export type KikoOnboardingRole =
  | 'intro'
  | 'question'
  | 'thinking'
  | 'explaining'
  | 'activation'
  | 'supportive'
  | 'money'
  | 'health'
  | 'macros'
  | 'cooking'
  | 'celebration'
  | 'paywall'
  | 'postPurchase'
  | 'generalUnused';

export type KikoSizeRole = 'small' | 'medium' | 'hero';
export type KikoFacing = 'left' | 'right' | 'center';
export type KikoBackgroundState = 'transparent' | 'baked-intact';
export type KikoOnboardingMotion = 'none' | 'fade' | 'brief-scale';

type Bounds = Readonly<{ x: number; y: number; width: number; height: number }>;

export interface KikoOnboardingInventoryItem {
  id: string;
  filename: string;
  dimensions: Readonly<{ width: number; height: number }>;
  aspectRatio: number;
  hasTransparentBackground: boolean;
  backgroundState: KikoBackgroundState;
  approximateArtworkBounds: Bounds;
  pose: string;
  expression: string;
  facing: KikoFacing;
  mood: string;
  role: KikoOnboardingRole;
  supportedUses: readonly string[];
  bestUse: string;
  recommendedScale: KikoSizeRole;
  preserveAsIntactComposition: boolean;
  needsBackgroundRemoval: false;
  considerFor: readonly string[];
  avoidFor: readonly string[];
  intentionallyUnused: boolean;
  unusedReason?: string;
  sha256: string;
}

const transparentSize = Object.freeze({ width: 1536, height: 1024 });
const opaqueSize = Object.freeze({ width: 1254, height: 1254 });

export const kikoOnboardingInventory = Object.freeze([
  {
    id: 'kikoPointingUp', filename: '132a9d97-deb6-4740-9e71-68e57ccf6177.png', dimensions: opaqueSize,
    aspectRatio: 1, hasTransparentBackground: false, backgroundState: 'baked-intact', approximateArtworkBounds: { x: 0, y: 0, width: 1, height: 1 },
    pose: 'Full-body wide stance, one arm pointing up-right and the other pointing inward', expression: 'Open-mouth smile', facing: 'right', mood: 'Energetic and directive', role: 'explaining',
    supportedUses: ['hero art', 'pointing pose', 'activation', 'transition artwork'], bestUse: 'Post-purchase transition toward the first scan action', recommendedScale: 'hero', preserveAsIntactComposition: true, needsBackgroundRemoval: false,
    considerFor: ['post-purchase', 'feature explanation'], avoidFor: ['questions', 'data-heavy results', 'paywall'], intentionallyUnused: false,
    sha256: '980814d9d3250438e0fdd7529e7a8dc69dab29aa24c0d81d559ad3343b43f004',
  },
  {
    id: 'kikoWellnessPlan', filename: '1c1c3872-25a4-4134-9dc9-b2fc12ffe8a0.png', dimensions: transparentSize,
    aspectRatio: 1.5, hasTransparentBackground: true, backgroundState: 'transparent', approximateArtworkBounds: { x: 0.22, y: 0.06, width: 0.53, height: 0.82 },
    pose: 'Seated with healthy bowl, apple, and a phone showing a positive checklist', expression: 'Warm open smile', facing: 'center', mood: 'Supportive and reassuring', role: 'health',
    supportedUses: ['supporting illustration', 'plan ready', 'health/wellness'], bestUse: 'Health plan-ready or positive wellness reveal', recommendedScale: 'medium', preserveAsIntactComposition: true, needsBackgroundRemoval: false,
    considerFor: ['eat-healthier plan', 'shared plan-ready'], avoidFor: ['money reveal', 'macro calculation', 'paywall'], intentionallyUnused: false,
    sha256: '0e36d9cd4625337d0e19bc46d9dd43eb2696e4945c73bc1b115a71fcad34303c',
  },
  {
    id: 'kikoMetricsCalculator', filename: '230c541a-ba2e-4d13-89d5-29d16e02851b.png', dimensions: transparentSize,
    aspectRatio: 1.5, hasTransparentBackground: true, backgroundState: 'transparent', approximateArtworkBounds: { x: 0.23, y: 0.07, width: 0.55, height: 0.81 },
    pose: 'Seated holding a rising chart and calculator', expression: 'Bright attentive smile', facing: 'center', mood: 'Clear and analytical without feeling clinical', role: 'macros',
    supportedUses: ['supporting illustration', 'explaining', 'macros/data'], bestUse: 'Macro transformation explanation beside before/after numbers', recommendedScale: 'medium', preserveAsIntactComposition: true, needsBackgroundRemoval: false,
    considerFor: ['hit-my-macros transformation', 'savings calculation explanation'], avoidFor: ['simple questions', 'celebration', 'post-purchase'], intentionallyUnused: false,
    sha256: '6ef2264756c620cdbc118054947ff2ad105fccd4d6540bf98a2eb819bcd7ada2',
  },
  {
    id: 'kikoServingDinner', filename: '238389cc-1d24-4c1a-9a4b-bb00d0066532.png', dimensions: transparentSize,
    aspectRatio: 1.5, hasTransparentBackground: true, backgroundState: 'transparent', approximateArtworkBounds: { x: 0.32, y: 0.05, width: 0.39, height: 0.84 },
    pose: 'Standing and presenting a plated steak dinner', expression: 'Proud smile', facing: 'center', mood: 'Helpful and food-focused', role: 'cooking',
    supportedUses: ['supporting illustration', 'cooking', 'recipe reveal'], bestUse: 'Recipe-result or meal transformation reveal', recommendedScale: 'medium', preserveAsIntactComposition: true, needsBackgroundRemoval: false,
    considerFor: ['cook-more recipe reveal', 'favorite-food transformation'], avoidFor: ['questions', 'money result', 'paywall'], intentionallyUnused: false,
    sha256: '1de53b0a407290bf07f37ae63d0055b4ed17e0b9641eb2a427a0b2a5c5b1fb91',
  },
  {
    id: 'kikoChefProud', filename: '6d8ea0cf-7d49-40a0-8085-664d1ac9098f.png', dimensions: transparentSize,
    aspectRatio: 1.5, hasTransparentBackground: true, backgroundState: 'transparent', approximateArtworkBounds: { x: 0.31, y: 0.04, width: 0.41, height: 0.88 },
    pose: 'Chef hat, one fist raised, other hand on hip', expression: 'Confident open smile', facing: 'center', mood: 'Proud and encouraging', role: 'celebration',
    supportedUses: ['celebration', 'cooking', 'plan ready'], bestUse: 'Cook-more plan-ready celebration', recommendedScale: 'medium', preserveAsIntactComposition: true, needsBackgroundRemoval: false,
    considerFor: ['cook-more plan-ready', 'cooking completion'], avoidFor: ['questionnaire', 'money calculation', 'paywall'], intentionallyUnused: false,
    sha256: 'fe1ad632d5cc58c7c8ba4e90786809db1822fa4a023cc66f533efbfba47b0b4a',
  },
  {
    id: 'kikoChefBowl', filename: '7878fa78-7c7f-4f8e-8bf8-24d168154ac9.png', dimensions: transparentSize,
    aspectRatio: 1.5, hasTransparentBackground: true, backgroundState: 'transparent', approximateArtworkBounds: { x: 0.31, y: 0.04, width: 0.41, height: 0.88 },
    pose: 'Chef outfit holding a wooden spoon and vegetable bowl', expression: 'Welcoming smile', facing: 'center', mood: 'Friendly and practical', role: 'cooking',
    supportedUses: ['hero art', 'cooking', 'supporting illustration'], bestUse: 'Cook-more demonstration or recipe creation', recommendedScale: 'hero', preserveAsIntactComposition: true, needsBackgroundRemoval: false,
    considerFor: ['cook-more demonstration'], avoidFor: ['money', 'macro data', 'paywall'], intentionallyUnused: false,
    sha256: 'a2fee45de1ae54fef9fb86dd007a28a39e7abce84a38953ccf7a48ddc9cc4c77',
  },
  {
    id: 'kikoDumbbells', filename: '7f3ecdd2-326b-41fb-a5b2-bb6b320f3cfe.png', dimensions: opaqueSize,
    aspectRatio: 1, hasTransparentBackground: false, backgroundState: 'baked-intact', approximateArtworkBounds: { x: 0, y: 0, width: 1, height: 1 },
    pose: 'Standing with a dumbbell in each hand', expression: 'Cheerful focused smile', facing: 'center', mood: 'Positive fitness energy', role: 'health',
    supportedUses: ['hero art', 'health/wellness', 'macros'], bestUse: 'Optional fitness-goal support when exercise framing is explicitly relevant', recommendedScale: 'medium', preserveAsIntactComposition: true, needsBackgroundRemoval: false,
    considerFor: ['hit-my-macros supporting moment'], avoidFor: ['food questions', 'money', 'paywall'], intentionallyUnused: true, unusedReason: 'Exercise equipment shifts the product story away from food and nutrition.',
    sha256: '80359f79688da3c13bb871cc0db7c09a56904ce0630aeda89164491dade01e1f',
  },
  {
    id: 'kikoDessertJoy', filename: '881317ee-c791-4c0a-9fb5-568b78d9eea7.png', dimensions: transparentSize,
    aspectRatio: 1.5, hasTransparentBackground: true, backgroundState: 'transparent', approximateArtworkBounds: { x: 0.29, y: 0.04, width: 0.45, height: 0.87 },
    pose: 'Seated eating strawberry cake', expression: 'Delighted open smile', facing: 'center', mood: 'Indulgent and playful', role: 'generalUnused',
    supportedUses: ['reaction', 'supporting illustration'], bestUse: 'Future celebratory dessert context only', recommendedScale: 'medium', preserveAsIntactComposition: true, needsBackgroundRemoval: false,
    considerFor: ['future dessert-specific feature'], avoidFor: ['health plan', 'macros', 'money', 'paywall'], intentionallyUnused: true, unusedReason: 'The cake conflicts with current health and macro storytelling and has no necessary live moment.',
    sha256: '2b3977045faf6e28bf94922f55f9d2ccdb5787d4d868e36610802a61861d9f73',
  },
  {
    id: 'kikoBodybuilder', filename: '9757d179-cbbc-43b7-8074-bff9c3e728e5.png', dimensions: opaqueSize,
    aspectRatio: 1, hasTransparentBackground: false, backgroundState: 'baked-intact', approximateArtworkBounds: { x: 0, y: 0, width: 1, height: 1 },
    pose: 'Exaggerated muscular double-biceps pose', expression: 'Happy smile', facing: 'center', mood: 'Comedic and extreme', role: 'generalUnused',
    supportedUses: ['reaction'], bestUse: 'No current onboarding use', recommendedScale: 'medium', preserveAsIntactComposition: true, needsBackgroundRemoval: false,
    considerFor: ['future humorous achievement'], avoidFor: ['questions', 'health', 'macros', 'paywall', 'plan-ready'], intentionallyUnused: true, unusedReason: 'The exaggerated physique is visually off-tone and can imply unrealistic body outcomes.',
    sha256: '369139e8cde1d7025aaf0433b69d7ceb8107b7bf2d186cc61495d4e69e5395be',
  },
  {
    id: 'kikoMagicRecipeBook', filename: 'a1dfb6d0-f86a-4aae-bca5-34c022fbf32d.png', dimensions: opaqueSize,
    aspectRatio: 1, hasTransparentBackground: false, backgroundState: 'baked-intact', approximateArtworkBounds: { x: 0, y: 0, width: 1, height: 1 },
    pose: 'Standing and reading an open glowing recipe book', expression: 'Curious delighted smile', facing: 'left', mood: 'Curious and imaginative', role: 'thinking',
    supportedUses: ['thinking pose', 'transition artwork', 'cooking'], bestUse: 'Pre-recipe realization or recipe-generation transition', recommendedScale: 'hero', preserveAsIntactComposition: true, needsBackgroundRemoval: false,
    considerFor: ['cook-more realization', 'recipe generation transition'], avoidFor: ['money', 'macro data', 'paywall'], intentionallyUnused: false,
    sha256: '96575b2f8ae0894fbc1636413ac727bec300964dbf4046b97a6b33eb8f6b0dce',
  },
  {
    id: 'kikoNoodleBowl', filename: 'a5b80c47-4959-4335-9f4a-f1fac5c46a0d.png', dimensions: transparentSize,
    aspectRatio: 1.5, hasTransparentBackground: true, backgroundState: 'transparent', approximateArtworkBounds: { x: 0.31, y: 0.06, width: 0.41, height: 0.82 },
    pose: 'Standing and lifting noodles from a bowl', expression: 'Excited open smile', facing: 'center', mood: 'Food-loving and energetic', role: 'cooking',
    supportedUses: ['reaction', 'cooking', 'supporting illustration'], bestUse: 'Favorite-food positive reveal', recommendedScale: 'medium', preserveAsIntactComposition: true, needsBackgroundRemoval: false,
    considerFor: ['eat-healthier favorite-food reveal', 'cook-more food moment'], avoidFor: ['money', 'macro calculation', 'paywall'], intentionallyUnused: false,
    sha256: '4656c3d749d2fa7ece05717925921fe455498dd7ffa4d9ab2240ec7ed776867c',
  },
  {
    id: 'kikoConfidentShades', filename: 'b022a98e-d2b0-422a-9817-f6d77a25773d.png', dimensions: transparentSize,
    aspectRatio: 1.5, hasTransparentBackground: true, backgroundState: 'transparent', approximateArtworkBounds: { x: 0.31, y: 0.08, width: 0.41, height: 0.78 },
    pose: 'Standing with one hand adjusting sunglasses and one hand on hip', expression: 'Small confident smile', facing: 'center', mood: 'Confident and anticipatory', role: 'paywall',
    supportedUses: ['paywall/anticipation', 'supporting illustration'], bestUse: 'Positive paywall anticipation without guilt or pleading', recommendedScale: 'small', preserveAsIntactComposition: true, needsBackgroundRemoval: false,
    considerFor: ['shared paywall'], avoidFor: ['questions', 'health concern', 'data results'], intentionallyUnused: false,
    sha256: '945906883d428183720a3213d7c8c0b43fde51496cd230fb63c5a1940bfd27ac',
  },
  {
    id: 'kikoFullBelly', filename: 'b7b103e2-e298-49fb-b1c1-ee7dc6be741e.png', dimensions: transparentSize,
    aspectRatio: 1.5, hasTransparentBackground: true, backgroundState: 'transparent', approximateArtworkBounds: { x: 0.21, y: 0.06, width: 0.56, height: 0.85 },
    pose: 'Reclining with paws on a very full belly and snack crumbs nearby', expression: 'Satisfied smile', facing: 'center', mood: 'Overindulgent and comedic', role: 'generalUnused',
    supportedUses: ['reaction'], bestUse: 'No current onboarding use', recommendedScale: 'medium', preserveAsIntactComposition: true, needsBackgroundRemoval: false,
    considerFor: ['future humorous food moment'], avoidFor: ['health', 'macros', 'money', 'questions', 'paywall'], intentionallyUnused: true, unusedReason: 'The overfull-belly framing is potentially shaming and conflicts with supportive onboarding.',
    sha256: 'b1af113725c9b9705ec394fa5e8db66f7eac13b3eae732ee48f7b7562bdcfe7f',
  },
  {
    id: 'kikoGroceryBag', filename: 'c0aa8fbf-4dc6-42bf-8e5d-ec1f094be968.png', dimensions: opaqueSize,
    aspectRatio: 1, hasTransparentBackground: false, backgroundState: 'baked-intact', approximateArtworkBounds: { x: 0, y: 0, width: 1, height: 1 },
    pose: 'Standing and holding a paper grocery bag', expression: 'Friendly smile', facing: 'left', mood: 'Helpful and practical', role: 'supportive',
    supportedUses: ['supporting illustration', 'cooking'], bestUse: 'Grocery-list or ingredient handoff', recommendedScale: 'medium', preserveAsIntactComposition: true, needsBackgroundRemoval: false,
    considerFor: ['future grocery handoff'], avoidFor: ['questions', 'paywall', 'macro data'], intentionallyUnused: true, unusedReason: 'No grocery-list moment exists in the current personalized onboarding sequence.',
    sha256: 'dcfaf370f1f7df69e3714af638f56d80db3e5d37bd19b8e2a8f5cc7e98f0db36',
  },
  {
    id: 'kikoSavings', filename: 'cec8b757-677d-49fe-ad8c-5492542fd647.png', dimensions: transparentSize,
    aspectRatio: 1.5, hasTransparentBackground: true, backgroundState: 'transparent', approximateArtworkBounds: { x: 0.27, y: 0.07, width: 0.47, height: 0.83 },
    pose: 'Winking while holding cash and a coin beside a wallet and savings jar', expression: 'Excited wink', facing: 'center', mood: 'Positive savings celebration', role: 'money',
    supportedUses: ['money/savings', 'reaction', 'celebration'], bestUse: 'Okyo savings demonstration after the personalized cost reveal', recommendedScale: 'medium', preserveAsIntactComposition: true, needsBackgroundRemoval: false,
    considerFor: ['save-money demonstration', 'save-money plan-ready'], avoidFor: ['pre-reveal questions', 'health', 'paywall'], intentionallyUnused: false,
    sha256: '0f88ffe3c6041504537999b96a06b17df87ca9eb9965d038ee1b373adec9759f',
  },
  {
    id: 'kikoEncouragingFlex', filename: 'd4e6874f-8d57-4467-bdbe-882b1735b6a7.png', dimensions: opaqueSize,
    aspectRatio: 1, hasTransparentBackground: false, backgroundState: 'baked-intact', approximateArtworkBounds: { x: 0, y: 0, width: 1, height: 1 },
    pose: 'Standing with one modest biceps flex and other hand on hip', expression: 'Friendly confident smile', facing: 'center', mood: 'Encouraging and capable', role: 'supportive',
    supportedUses: ['supporting illustration', 'encouragement', 'plan ready'], bestUse: 'Optional confidence beat after a user choice', recommendedScale: 'medium', preserveAsIntactComposition: true, needsBackgroundRemoval: false,
    considerFor: ['shared plan-ready'], avoidFor: ['questions', 'money calculation', 'paywall'], intentionallyUnused: true, unusedReason: 'The stronger plan-specific assets communicate the product outcome more clearly.',
    sha256: '704daabc779348fc193d2f402dea036a12d821f9532374605f8648a07b0cd958',
  },
  {
    id: 'kikoChefPan', filename: 'e9307088-2191-4163-8752-e529c023ce13.png', dimensions: opaqueSize,
    aspectRatio: 1, hasTransparentBackground: false, backgroundState: 'baked-intact', approximateArtworkBounds: { x: 0, y: 0, width: 1, height: 1 },
    pose: 'Chef outfit holding a spatula and tossing vegetables in a pan', expression: 'Focused happy smile', facing: 'right', mood: 'Active and capable', role: 'cooking',
    supportedUses: ['hero art', 'cooking', 'activation'], bestUse: 'Make-anything-you-see cooking hero', recommendedScale: 'hero', preserveAsIntactComposition: true, needsBackgroundRemoval: false,
    considerFor: ['cook-more activation'], avoidFor: ['questions', 'money', 'paywall'], intentionallyUnused: false,
    sha256: 'f397a097410ace4b982893700e6821d5727035b64388c6efd46510651b738ed3',
  },
  {
    id: 'kikoDeadlift', filename: 'f86a0ab6-5705-4c68-a925-e999d7cda72d.png', dimensions: opaqueSize,
    aspectRatio: 1, hasTransparentBackground: false, backgroundState: 'baked-intact', approximateArtworkBounds: { x: 0, y: 0, width: 1, height: 1 },
    pose: 'Straining over an extremely heavy barbell', expression: 'Determined grin', facing: 'center', mood: 'Aggressive fitness effort', role: 'generalUnused',
    supportedUses: ['reaction'], bestUse: 'No current onboarding use', recommendedScale: 'medium', preserveAsIntactComposition: true, needsBackgroundRemoval: false,
    considerFor: ['future strength achievement'], avoidFor: ['health', 'macros', 'questions', 'paywall'], intentionallyUnused: true, unusedReason: 'The aggressive gym metaphor is unrelated to Okyo food personalization and can imply pressure.',
    sha256: 'bb27a986fd57600e8b1239348589c8acc6fb7de7c80dac596489a23aeea010c2',
  },
  {
    id: 'kikoChefChecklist', filename: 'fafa2e45-3d5f-421e-b9b4-3bac690c9614.png', dimensions: transparentSize,
    aspectRatio: 1.5, hasTransparentBackground: true, backgroundState: 'transparent', approximateArtworkBounds: { x: 0.28, y: 0.05, width: 0.44, height: 0.79 },
    pose: 'Seated in chef hat holding a completed checklist', expression: 'Thoughtful proud smile', facing: 'right', mood: 'Prepared and reassuring', role: 'celebration',
    supportedUses: ['plan ready', 'celebration', 'supporting illustration'], bestUse: 'Shared personalized-plan-ready screen', recommendedScale: 'medium', preserveAsIntactComposition: true, needsBackgroundRemoval: false,
    considerFor: ['shared plan-ready'], avoidFor: ['questionnaire', 'data-heavy result', 'paywall'], intentionallyUnused: false,
    sha256: '3bee5be1df0d9b01bcd02dc849b9e154daa54254678675996da2e36d3b8923e5',
  },
  {
    id: 'kikoBroccoli', filename: 'fbfb2006-9c94-45e3-a277-bc1e8077be85.png', dimensions: transparentSize,
    aspectRatio: 1.5, hasTransparentBackground: true, backgroundState: 'transparent', approximateArtworkBounds: { x: 0, y: 0, width: 0.74, height: 1 },
    pose: 'Seated and hugging a large broccoli crown', expression: 'Warm delighted smile', facing: 'left', mood: 'Positive and non-clinical wellness', role: 'health',
    supportedUses: ['health/wellness', 'reaction', 'supporting illustration'], bestUse: 'Favorite-foods-can-support-your-goals reveal', recommendedScale: 'medium', preserveAsIntactComposition: true, needsBackgroundRemoval: false,
    considerFor: ['eat-healthier positive reveal'], avoidFor: ['money', 'macro calculation', 'paywall'], intentionallyUnused: false,
    sha256: '807a959b7503e7c7d4845aa0fa4c9b055bddd75839e2ff709f57b2d1625c1899',
  },
] satisfies readonly KikoOnboardingInventoryItem[]);

export type KikoOnboardingAssetId = (typeof kikoOnboardingInventory)[number]['id'];

const kikoSourceLoaders: Record<KikoOnboardingAssetId, () => ImageSourcePropType> = {
  kikoPointingUp: () => require('../../../assets/kiko-static/approved/kiko-vegetables.png'),
  kikoWellnessPlan: () => require('../../../assets/kiko-static/approved/kiko-produce-crate.png'),
  kikoMetricsCalculator: () => require('../../../assets/kiko-static/approved/kiko-flex.png'),
  kikoServingDinner: () => require('../../../assets/kiko-static/approved/kiko-ramen.png'),
  kikoChefProud: () => require('../../../assets/kiko-static/approved/kiko-soup.png'),
  kikoChefBowl: () => require('../../../assets/kiko-static/approved/kiko-ramen.png'),
  kikoDumbbells: () => require('../../../assets/kiko-static/approved/kiko-flex.png'),
  kikoDessertJoy: () => require('../../../assets/kiko-static/approved/kiko-thinking.png'),
  kikoBodybuilder: () => require('../../../assets/kiko-static/approved/kiko-flex.png'),
  kikoMagicRecipeBook: () => require('../../../assets/kiko-static/approved/kiko-recipe.png'),
  kikoNoodleBowl: () => require('../../../assets/kiko-static/approved/kiko-ramen.png'),
  kikoConfidentShades: () => require('../../../assets/kiko-static/approved/kiko-flex.png'),
  kikoFullBelly: () => require('../../../assets/kiko-static/approved/kiko-ramen.png'),
  kikoGroceryBag: () => require('../../../assets/kiko-static/approved/kiko-grocery-bag.png'),
  kikoSavings: () => require('../../../assets/kiko-static/approved/kiko-savings.png'),
  kikoEncouragingFlex: () => require('../../../assets/kiko-static/approved/kiko-flex.png'),
  kikoChefPan: () => require('../../../assets/kiko-static/approved/kiko-soup.png'),
  kikoDeadlift: () => require('../../../assets/kiko-static/approved/kiko-flex.png'),
  kikoChefChecklist: () => require('../../../assets/kiko-static/approved/kiko-recipe.png'),
  kikoBroccoli: () => require('../../../assets/kiko-static/approved/kiko-vegetables.png'),
};

export function getKikoOnboardingSource(id: KikoOnboardingAssetId): ImageSourcePropType {
  return kikoSourceLoaders[id]();
}

export function resolveKikoOnboardingMotion(
  motion: KikoOnboardingMotion,
  reduceMotionEnabled: boolean,
): KikoOnboardingMotion {
  if (!reduceMotionEnabled) return motion;
  return motion === 'brief-scale' ? 'fade' : motion;
}

export const kikoSizeRoles = Object.freeze({
  small: { minimum: 70, responsiveWidth: 0.22, maximum: 100 },
  medium: { minimum: 110, responsiveWidth: 0.34, maximum: 160 },
  hero: { minimum: 150, responsiveWidth: 0.45, maximum: 240 },
} satisfies Record<KikoSizeRole, { minimum: number; responsiveWidth: number; maximum: number }>);

export type KikoOnboardingBranch = 'shared' | 'saveMoney' | 'eatHealthier' | 'hitMacros' | 'cookMore';

export interface KikoOnboardingAssignment {
  moment: string;
  branch: KikoOnboardingBranch;
  assetId: KikoOnboardingAssetId | null;
  classification: KikoOnboardingRole | 'none';
  position: string;
  size: KikoSizeRole | 'none';
  motion: KikoOnboardingMotion;
  maximumKikos: 0 | 1;
  reasoning: string;
}

export const kikoOnboardingAssignmentPlan = Object.freeze([
  { moment: 'questionnaire', branch: 'saveMoney', assetId: null, classification: 'none', position: 'none', size: 'none', motion: 'none', maximumKikos: 0, reasoning: 'Keep questions fast and uncluttered.' },
  { moment: 'annual-spending-reveal', branch: 'saveMoney', assetId: 'kikoMetricsCalculator', classification: 'macros', position: 'lower-left beside result card', size: 'medium', motion: 'brief-scale', maximumKikos: 1, reasoning: 'The chart and calculator acknowledge the personalized number without adding dollar-sign theatrics.' },
  { moment: 'savings-demonstration', branch: 'saveMoney', assetId: 'kikoSavings', classification: 'money', position: 'lower-right beside savings card', size: 'medium', motion: 'fade', maximumKikos: 1, reasoning: 'The only explicitly savings-oriented composition appears after value is demonstrated.' },
  { moment: 'savings-projection-graph', branch: 'saveMoney', assetId: null, classification: 'none', position: 'none', size: 'none', motion: 'none', maximumKikos: 0, reasoning: 'The graph is the focal content.' },
  { moment: 'favorite-foods-reveal', branch: 'eatHealthier', assetId: 'kikoBroccoli', classification: 'health', position: 'right of positive reveal copy, facing inward', size: 'medium', motion: 'fade', maximumKikos: 1, reasoning: 'It makes wellness feel warm and food-positive rather than clinical.' },
  { moment: 'nutrition-data', branch: 'eatHealthier', assetId: null, classification: 'none', position: 'none', size: 'none', motion: 'none', maximumKikos: 0, reasoning: 'Nutrition values need visual priority.' },
  { moment: 'macro-transformation', branch: 'hitMacros', assetId: 'kikoMetricsCalculator', classification: 'macros', position: 'left of before/after metric card', size: 'medium', motion: 'none', maximumKikos: 1, reasoning: 'The pose directly supports data explanation and remains static so numbers stay primary.' },
  { moment: 'macro-result', branch: 'hitMacros', assetId: null, classification: 'none', position: 'none', size: 'none', motion: 'none', maximumKikos: 0, reasoning: 'The data-heavy result does not need a mascot.' },
  { moment: 'make-anything-you-see', branch: 'cookMore', assetId: 'kikoChefPan', classification: 'cooking', position: 'centered hero below headline', size: 'hero', motion: 'fade', maximumKikos: 1, reasoning: 'This is the strongest active cooking pose and naturally carries the branch hero.' },
  { moment: 'recipe-generation-transition', branch: 'cookMore', assetId: 'kikoMagicRecipeBook', classification: 'thinking', position: 'centered below progress copy', size: 'hero', motion: 'none', maximumKikos: 1, reasoning: 'The glowing recipe book supports anticipation without continuous motion.' },
  { moment: 'personalized-plan-ready', branch: 'shared', assetId: 'kikoChefChecklist', classification: 'celebration', position: 'lower-right beside completed plan card, facing inward', size: 'medium', motion: 'brief-scale', maximumKikos: 1, reasoning: 'The checklist makes the celebration specific to a completed plan.' },
  { moment: 'paywall', branch: 'shared', assetId: 'kikoConfidentShades', classification: 'paywall', position: 'top-right above plan choices', size: 'small', motion: 'fade', maximumKikos: 1, reasoning: 'Confident anticipation without sadness, begging, or guilt.' },
  { moment: 'post-purchase-first-scan', branch: 'shared', assetId: 'kikoPointingUp', classification: 'postPurchase', position: 'lower-left, pointing toward scan actions', size: 'hero', motion: 'brief-scale', maximumKikos: 1, reasoning: 'The pointing pose directs attention into the first real food action.' },
] satisfies readonly KikoOnboardingAssignment[]);

export function getKikoOnboardingAssignment(
  branch: KikoOnboardingBranch,
  moment: string,
): KikoOnboardingAssignment | null {
  return kikoOnboardingAssignmentPlan.find(
    (assignment) => assignment.branch === branch && assignment.moment === moment,
  ) ?? null;
}

export const kikoMascotNamePolicy = 'User-facing mascot names never change internal kiko asset IDs.' as const;
