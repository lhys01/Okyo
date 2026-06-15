import type { Recipe, RecipeIngredient, RecipeStep } from '../mocks';
import { getSampleFoodImageUrl, type SampleFoodImageKey } from './sampleFoodImages';

// Okyo recommendation recipes (seed data).
//
// These are non-scan "food inspiration" recipes shown on Home and Discover so the
// app feels alive before a user scans anything. They are real, specific, cookable
// recipes that follow Okyo's quality rules: exact amounts, named ingredients,
// numbered steps with timing + visual cues, substitutions, and honest cost.
//
// Honesty: estimatedSavings is 0 (there is no scanned restaurant price), and
// estimatedHomemadeCost is a clearly-labeled home-kitchen estimate. Recipe Detail
// only shows savings when restaurantPrice > 0 AND savings > 0, so these correctly
// show "Homemade estimate" instead of any fake savings.
//
// This is a small starter set (15 recipes). A larger 100-item pack can be added
// later by appending specs here or loading a generated manifest — the card UI and
// category browsing already scale to any length.

export type MealTime = 'morning' | 'afternoon' | 'evening' | 'late_night';

export type RecommendationCategory =
  | 'Breakfast'
  | 'Smoothies'
  | 'High Protein'
  | 'Pasta'
  | 'Bowls'
  | 'Salads'
  | 'Burgers & Sandwiches'
  | 'Pizza'
  | 'Desserts'
  | 'Snacks'
  | 'Dinner Ideas';

export const recommendationCategories: RecommendationCategory[] = [
  'Breakfast',
  'Smoothies',
  'High Protein',
  'Pasta',
  'Bowls',
  'Salads',
  'Burgers & Sandwiches',
  'Pizza',
  'Desserts',
  'Snacks',
  'Dinner Ideas',
];

// Soft, on-brand tints + an emoji used for Discover category tiles.
const categoryArt: Record<RecommendationCategory, { tint: string; emoji: string }> = {
  Breakfast: { tint: '#fff1d9', emoji: '🍳' },
  Smoothies: { tint: '#f3e6f7', emoji: '🥤' },
  'High Protein': { tint: '#ffe2d6', emoji: '🍗' },
  Pasta: { tint: '#ffe7c7', emoji: '🍝' },
  Bowls: { tint: '#e7f0d6', emoji: '🥗' },
  Salads: { tint: '#e3f3e0', emoji: '🥬' },
  'Burgers & Sandwiches': { tint: '#ffe6cc', emoji: '🍔' },
  Pizza: { tint: '#ffe0d0', emoji: '🍕' },
  Desserts: { tint: '#f7e3e9', emoji: '🍫' },
  Snacks: { tint: '#fff0cf', emoji: '🧀' },
  'Dinner Ideas': { tint: '#ffe8d4', emoji: '🍽️' },
};

export function getCategoryArt(category: RecommendationCategory) {
  return categoryArt[category];
}

export type RecommendationRecipe = Recipe & {
  category: RecommendationCategory;
  mealTimes: MealTime[];
  blurb: string;
  tint: string;
  emoji: string;
};

type RecommendationSpec = {
  id: string;
  title: string;
  category: RecommendationCategory;
  mealTimes: MealTime[];
  difficulty: Recipe['difficulty'];
  prep: number;
  cook: number;
  servings: number;
  homemadeCost: number;
  blurb: string;
  ingredients: Array<[quantity: string, name: string]>;
  steps: Array<{ text: string; time?: string; cue?: string }>;
  substitutions: string[];
  equipment: string[];
  imageKey?: SampleFoodImageKey;
  pantryNote: string;
};

function buildRecommendation(spec: RecommendationSpec): RecommendationRecipe {
  const ingredients: RecipeIngredient[] = spec.ingredients.map(([quantity, name]) => ({ name, quantity }));
  const structuredSteps: RecipeStep[] = spec.steps.map((step) => ({
    text: step.text,
    timeEstimate: step.time,
    visualCue: step.cue,
  }));
  const art = categoryArt[spec.category];

  return {
    id: `rec-${spec.id}`,
    scanResultId: `rec-${spec.id}`,
    imageStatus: 'ready',
    imageUrl: getSampleFoodImageUrl(spec.imageKey ?? getCategoryImageKey(spec.category)),
    title: spec.title,
    mode: 'Restaurant Copy',
    description: spec.blurb,
    prepTimeMinutes: spec.prep,
    cookTimeMinutes: spec.cook,
    totalTimeMinutes: spec.prep + spec.cook,
    servings: spec.servings,
    difficulty: spec.difficulty,
    skillLevel: spec.difficulty,
    estimatedHomemadeCost: spec.homemadeCost,
    estimatedSavings: 0,
    ingredients,
    steps: structuredSteps.map((step) => step.text),
    structuredSteps,
    substitutions: spec.substitutions,
    pantryNote: spec.pantryNote,
    confidenceNote: 'Okyo recommended recipe. Cost is a home-kitchen estimate, not a restaurant price.',
    equipment: spec.equipment,
    bestFor: spec.blurb,
    category: spec.category,
    mealTimes: spec.mealTimes,
    blurb: spec.blurb,
    tint: art.tint,
    emoji: art.emoji,
  };
}

function getCategoryImageKey(category: RecommendationCategory): SampleFoodImageKey {
  switch (category) {
    case 'Breakfast':
    case 'Smoothies':
      return 'breakfast';
    case 'High Protein':
    case 'Bowls':
    case 'Dinner Ideas':
      return 'bowl';
    case 'Pasta':
      return 'pasta';
    case 'Salads':
      return 'salad';
    case 'Burgers & Sandwiches':
    case 'Pizza':
    case 'Snacks':
      return 'burger';
    case 'Desserts':
      return 'dessert';
    default:
      return 'bowl';
  }
}

const specs: RecommendationSpec[] = [
  {
    id: 'scrambled-eggs-toast',
    title: 'Fluffy Scrambled Eggs on Toast',
    category: 'Breakfast',
    mealTimes: ['morning'],
    difficulty: 'Easy',
    prep: 3,
    cook: 7,
    servings: 1,
    homemadeCost: 2.5,
    blurb: 'Soft, creamy scrambled eggs piled on buttery toast — a 10-minute breakfast.',
    ingredients: [
      ['3', 'large eggs'],
      ['1 tbsp', 'milk'],
      ['1 tbsp', 'butter'],
      ['2 slices', 'sourdough bread'],
      ['1/4 tsp', 'kosher salt'],
      ['1 pinch', 'black pepper'],
      ['1 tbsp', 'chopped chives'],
    ],
    steps: [
      { text: 'Crack 3 eggs into a bowl, add 1 tablespoon milk and 1/4 teaspoon salt, and whisk for 30 seconds until fully blended.', time: '1 min', cue: 'No streaks of white remain.' },
      { text: 'Melt 1 tablespoon butter in a nonstick pan over medium-low heat.', time: '1 min', cue: 'Butter is foamy but not browned.' },
      { text: 'Pour in the eggs and let them sit for 20 seconds, then push them gently from the edges to the center with a spatula.', time: '3 min', cue: 'Soft curds form and the pan looks creamy.' },
      { text: 'Take the pan off the heat while the eggs still look slightly wet — they finish cooking from residual heat.', time: '30 sec', cue: 'Glossy, just-set curds.' },
      { text: 'Toast the 2 slices of sourdough until golden, then top with the eggs, a pinch of black pepper, and 1 tablespoon chopped chives.', time: '2 min', cue: 'Toast is crisp and golden.' },
    ],
    substitutions: ['Swap chives for sliced scallions or parsley.', 'Use any sturdy bread you have.'],
    equipment: ['nonstick pan', 'whisk', 'spatula', 'toaster'],
    pantryNote: 'Assumes salt, pepper, and butter are on hand.',
  },
  {
    id: 'cinnamon-banana-oats',
    title: 'Cinnamon Banana Oats',
    category: 'Breakfast',
    mealTimes: ['morning'],
    difficulty: 'Easy',
    prep: 2,
    cook: 6,
    servings: 1,
    homemadeCost: 1.5,
    blurb: 'Creamy stovetop oats sweetened with banana and warm cinnamon.',
    ingredients: [
      ['1/2 cup', 'rolled oats'],
      ['1 cup', 'milk'],
      ['1', 'ripe banana'],
      ['1/2 tsp', 'ground cinnamon'],
      ['1 tbsp', 'honey'],
      ['1 pinch', 'kosher salt'],
      ['1 tbsp', 'chopped walnuts'],
    ],
    steps: [
      { text: 'Add 1/2 cup oats, 1 cup milk, and a pinch of salt to a small pot over medium heat.', time: '1 min', cue: 'Liquid starts to steam.' },
      { text: 'Cook, stirring often, for 4-5 minutes until the oats are thick and creamy.', time: '5 min', cue: 'Oats hold a soft mound on the spoon.' },
      { text: 'Mash half the banana and stir it in with 1/2 teaspoon cinnamon for the last minute.', time: '1 min', cue: 'Oats turn pale gold and smell sweet.' },
      { text: 'Spoon into a bowl, slice the remaining banana on top, and finish with 1 tablespoon honey and 1 tablespoon walnuts.', time: '1 min', cue: 'Glossy honey drizzle over the fruit.' },
    ],
    substitutions: ['Use maple syrup instead of honey.', 'Swap walnuts for almonds or skip for nut-free.'],
    equipment: ['small pot', 'spoon'],
    pantryNote: 'Assumes cinnamon and a sweetener are on hand.',
  },
  {
    id: 'berry-banana-smoothie',
    title: 'Berry Banana Smoothie',
    category: 'Smoothies',
    mealTimes: ['morning', 'late_night'],
    difficulty: 'Easy',
    prep: 5,
    cook: 0,
    servings: 1,
    homemadeCost: 2.25,
    blurb: 'A thick, frosty berry smoothie that blends in under 2 minutes.',
    ingredients: [
      ['1 cup', 'frozen mixed berries'],
      ['1', 'ripe banana'],
      ['1/2 cup', 'plain Greek yogurt'],
      ['1/2 cup', 'milk'],
      ['1 tsp', 'honey'],
      ['4', 'ice cubes'],
    ],
    steps: [
      { text: 'Add 1 cup frozen berries, 1 banana, 1/2 cup Greek yogurt, and 1/2 cup milk to a blender.', time: '1 min', cue: 'Liquid sits below the fruit line.' },
      { text: 'Blend on high for 45-60 seconds until completely smooth, stopping once to scrape down the sides.', time: '1 min', cue: 'No frozen chunks remain.' },
      { text: 'Check the thickness: add a splash of milk to thin or 4 ice cubes to thicken, then blend 10 seconds more.', time: '30 sec', cue: 'Pours thick but smooth.' },
      { text: 'Taste and blend in 1 teaspoon honey if the berries are tart, then pour into a tall glass and serve cold.', time: '30 sec', cue: 'Even purple-pink color.' },
    ],
    substitutions: ['Use a dairy-free yogurt and oat milk to make it vegan.', 'Swap berries for mango or peach.'],
    equipment: ['blender', 'tall glass'],
    pantryNote: 'Assumes a sweetener is on hand.',
  },
  {
    id: 'garlic-chicken-rice-bowl',
    title: 'Garlic Chicken Rice Bowl',
    category: 'High Protein',
    mealTimes: ['afternoon', 'evening'],
    difficulty: 'Easy',
    prep: 10,
    cook: 15,
    servings: 2,
    homemadeCost: 6.5,
    blurb: 'Juicy garlic chicken over rice with a quick soy-honey glaze.',
    ingredients: [
      ['2', 'boneless chicken thighs'],
      ['2 cups', 'cooked white rice'],
      ['3 cloves', 'garlic, minced'],
      ['2 tbsp', 'soy sauce'],
      ['1 tbsp', 'honey'],
      ['1 tbsp', 'vegetable oil'],
      ['1 cup', 'steamed broccoli'],
      ['1', 'scallion, sliced'],
    ],
    steps: [
      { text: 'Pat 2 chicken thighs dry and cut into bite-size pieces.', time: '3 min', cue: 'Surface looks dry, not wet.' },
      { text: 'Heat 1 tablespoon oil in a skillet over medium-high heat for 1 minute until shimmering.', time: '1 min', cue: 'Oil moves easily and looks glossy.' },
      { text: 'Add the chicken in a single layer and cook for 5-6 minutes, turning once, until golden and 165°F / 74°C inside.', time: '6 min', cue: 'Deep golden edges, no pink inside.' },
      { text: 'Lower the heat to medium, add 3 minced garlic cloves, and stir for 30 seconds until fragrant.', time: '30 sec', cue: 'Garlic smells nutty, not burnt.' },
      { text: 'Pour in 2 tablespoons soy sauce and 1 tablespoon honey and toss for 1 minute until the chicken is glazed.', time: '1 min', cue: 'Sauce thickens and coats each piece.' },
      { text: 'Spoon over 2 cups rice with 1 cup steamed broccoli and top with sliced scallion.', time: '1 min', cue: 'Glaze pools slightly over the rice.' },
    ],
    substitutions: ['Use chicken breast or firm tofu.', 'Swap broccoli for green beans or snap peas.'],
    equipment: ['skillet', 'knife', 'cutting board'],
    pantryNote: 'Assumes oil and a cooked rice base are on hand.',
  },
  {
    id: 'crispy-tofu-power-bowl',
    title: 'Crispy Tofu Power Bowl',
    category: 'Bowls',
    mealTimes: ['afternoon', 'evening'],
    difficulty: 'Medium',
    prep: 15,
    cook: 15,
    servings: 2,
    homemadeCost: 5.75,
    blurb: 'Golden pan-crisped tofu over grains with crunchy veg and sesame.',
    ingredients: [
      ['14 oz', 'firm tofu'],
      ['1 tbsp', 'cornstarch'],
      ['2 tbsp', 'vegetable oil'],
      ['2 cups', 'cooked brown rice'],
      ['1 cup', 'shredded carrots'],
      ['1', 'cucumber, sliced'],
      ['2 tbsp', 'soy sauce'],
      ['1 tsp', 'toasted sesame oil'],
      ['1 tsp', 'sesame seeds'],
    ],
    steps: [
      { text: 'Press 14 oz tofu between paper towels under a plate for 10 minutes, then cube it.', time: '10 min', cue: 'Tofu feels firmer and drier.' },
      { text: 'Toss the cubes with 1 tablespoon cornstarch until lightly coated on all sides.', time: '1 min', cue: 'A thin white dusting clings to each cube.' },
      { text: 'Heat 2 tablespoons oil in a nonstick pan over medium-high heat and cook the tofu for 8-10 minutes, turning, until crisp and golden.', time: '10 min', cue: 'Crackly golden crust on most sides.' },
      { text: 'Whisk 2 tablespoons soy sauce with 1 teaspoon sesame oil, then toss the hot tofu in it off the heat.', time: '1 min', cue: 'Tofu glistens and smells nutty.' },
      { text: 'Divide 2 cups rice into bowls, add carrots and cucumber, top with tofu, and finish with sesame seeds.', time: '2 min', cue: 'Bright colors in clear sections.' },
    ],
    substitutions: ['Use cooked chicken or chickpeas instead of tofu.', 'Swap brown rice for quinoa.'],
    equipment: ['nonstick pan', 'knife', 'cutting board'],
    pantryNote: 'Assumes oil, cornstarch, and a cooked grain are on hand.',
  },
  {
    id: 'creamy-tomato-rigatoni',
    title: 'Creamy Tomato Rigatoni',
    category: 'Pasta',
    mealTimes: ['evening'],
    difficulty: 'Easy',
    prep: 5,
    cook: 20,
    servings: 2,
    homemadeCost: 4.5,
    blurb: 'Silky tomato-cream sauce clinging to ridged rigatoni.',
    ingredients: [
      ['8 oz', 'rigatoni'],
      ['1 tbsp', 'olive oil'],
      ['2 cloves', 'garlic, minced'],
      ['1 cup', 'tomato sauce'],
      ['1/4 cup', 'heavy cream'],
      ['1/4 cup', 'grated parmesan'],
      ['1/2 tsp', 'red pepper flakes'],
      ['1/2 tsp', 'kosher salt, plus more for pasta water'],
    ],
    steps: [
      { text: 'Boil a pot of salted water and cook 8 oz rigatoni for 1 minute less than the package says.', time: '11 min', cue: 'Pasta is tender with a slight bite.' },
      { text: 'Scoop out 1/2 cup pasta water, then drain the pasta.', time: '1 min', cue: 'Reserved water looks cloudy.' },
      { text: 'Warm 1 tablespoon olive oil in a skillet over medium heat and cook 2 minced garlic cloves for 30 seconds until fragrant.', time: '1 min', cue: 'Garlic is pale gold.' },
      { text: 'Pour in 1 cup tomato sauce and 1/4 cup heavy cream and stir for 2 minutes until smooth and orange.', time: '2 min', cue: 'Sauce turns a creamy orange color.' },
      { text: 'Add the rigatoni and a splash of pasta water and toss for 1-2 minutes until every piece is coated.', time: '2 min', cue: 'Sauce clings instead of pooling.' },
      { text: 'Stir in 1/4 cup parmesan and 1/2 teaspoon red pepper flakes, taste, and add salt if needed.', time: '1 min', cue: 'Cheese melts into the sauce.' },
    ],
    substitutions: ['Use half-and-half instead of heavy cream.', 'Swap rigatoni for penne or ziti.'],
    equipment: ['large pot', 'skillet', 'colander'],
    pantryNote: 'Assumes salt, olive oil, and red pepper flakes are on hand.',
  },
  {
    id: 'garlic-butter-spaghetti',
    title: 'Garlic Butter Spaghetti',
    category: 'Pasta',
    mealTimes: ['evening', 'late_night'],
    difficulty: 'Easy',
    prep: 3,
    cook: 12,
    servings: 2,
    homemadeCost: 3.0,
    blurb: 'A 15-minute buttery garlic spaghetti with parmesan and parsley.',
    ingredients: [
      ['8 oz', 'spaghetti'],
      ['3 tbsp', 'butter'],
      ['4 cloves', 'garlic, thinly sliced'],
      ['1/4 cup', 'grated parmesan'],
      ['2 tbsp', 'chopped parsley'],
      ['1/2 tsp', 'red pepper flakes'],
      ['1/2 tsp', 'kosher salt, plus more for pasta water'],
    ],
    steps: [
      { text: 'Boil 8 oz spaghetti in salted water until just tender, then reserve 1/2 cup pasta water and drain.', time: '9 min', cue: 'Strands bend without snapping.' },
      { text: 'Melt 3 tablespoons butter in a large pan over medium-low heat.', time: '1 min', cue: 'Butter foams gently.' },
      { text: 'Add 4 sliced garlic cloves and cook for 1-2 minutes until pale gold and fragrant.', time: '2 min', cue: 'Garlic is soft, not browned.' },
      { text: 'Add the spaghetti, a splash of pasta water, and 1/2 teaspoon red pepper flakes, tossing for 1 minute.', time: '1 min', cue: 'Strands look glossy and coated.' },
      { text: 'Off the heat, toss in 1/4 cup parmesan and 2 tablespoons parsley, then taste and add salt.', time: '1 min', cue: 'Cheese clings to the strands.' },
    ],
    substitutions: ['Use olive oil for a dairy-light version.', 'Add cooked shrimp or chicken for protein.'],
    equipment: ['large pot', 'large pan', 'colander'],
    pantryNote: 'Assumes salt, butter, and red pepper flakes are on hand.',
  },
  {
    id: 'crunchy-chickpea-salad',
    title: 'Crunchy Chickpea Salad',
    category: 'Salads',
    mealTimes: ['afternoon'],
    difficulty: 'Easy',
    prep: 12,
    cook: 0,
    servings: 2,
    homemadeCost: 4.0,
    blurb: 'A no-cook protein salad of chickpeas, crisp veg, and lemon dressing.',
    ingredients: [
      ['1 can (15 oz)', 'chickpeas, drained and rinsed'],
      ['1', 'cucumber, diced'],
      ['1 cup', 'cherry tomatoes, halved'],
      ['1/4', 'red onion, finely diced'],
      ['1/3 cup', 'crumbled feta cheese'],
      ['3 tbsp', 'olive oil'],
      ['1 tbsp', 'lemon juice'],
      ['1/2 tsp', 'kosher salt'],
    ],
    steps: [
      { text: 'Drain and rinse 1 can of chickpeas and shake them dry in the colander.', time: '2 min', cue: 'No foam or liquid clinging.' },
      { text: 'Dice 1 cucumber, halve 1 cup cherry tomatoes, and finely dice 1/4 red onion into a large bowl.', time: '6 min', cue: 'Pieces are roughly even, bite-size.' },
      { text: 'Whisk 3 tablespoons olive oil with 1 tablespoon lemon juice and 1/2 teaspoon salt until blended.', time: '1 min', cue: 'Dressing looks cloudy and emulsified.' },
      { text: 'Add the chickpeas and 1/3 cup feta to the bowl, pour the dressing around the edges, and toss for 30 seconds.', time: '1 min', cue: 'Everything is lightly coated, not soggy.' },
      { text: 'Taste, add a pinch more salt if flat, and serve right away or chill for 20 minutes.', time: '1 min', cue: 'Bright, glossy, and fresh.' },
    ],
    substitutions: ['Use white beans instead of chickpeas.', 'Skip feta for a dairy-free salad.'],
    equipment: ['colander', 'large bowl', 'knife'],
    pantryNote: 'Assumes olive oil and salt are on hand.',
  },
  {
    id: 'greek-salad',
    title: 'Classic Greek Salad',
    category: 'Salads',
    mealTimes: ['afternoon'],
    difficulty: 'Easy',
    prep: 12,
    cook: 0,
    servings: 2,
    homemadeCost: 4.5,
    blurb: 'Juicy tomatoes, cucumber, and feta with oregano and olive oil.',
    ingredients: [
      ['2', 'large tomatoes, cut in wedges'],
      ['1', 'cucumber, sliced'],
      ['1/4', 'red onion, thinly sliced'],
      ['1/2 cup', 'kalamata olives, pitted'],
      ['4 oz', 'feta cheese, in slabs'],
      ['3 tbsp', 'olive oil'],
      ['1 tsp', 'dried oregano'],
      ['1/4 tsp', 'kosher salt'],
    ],
    steps: [
      { text: 'Cut 2 tomatoes into wedges and slice 1 cucumber into thick half-moons into a wide bowl.', time: '5 min', cue: 'Chunky, rustic pieces.' },
      { text: 'Add 1/4 thinly sliced red onion and 1/2 cup olives.', time: '3 min', cue: 'Even scatter of onion and olives.' },
      { text: 'Drizzle 3 tablespoons olive oil over the top and sprinkle with 1/4 teaspoon salt and 1 teaspoon oregano.', time: '1 min', cue: 'Oregano dusts the vegetables.' },
      { text: 'Lay 4 oz feta in slabs on top — do not toss, so the cheese stays in pieces.', time: '1 min', cue: 'White feta sits proud on the salad.' },
      { text: 'Let it sit 5 minutes so the juices and oil mingle, then serve.', time: '5 min', cue: 'A pool of pink-orange dressing forms.' },
    ],
    substitutions: ['Use red wine vinegar for extra tang.', 'Swap kalamata for any brined olive.'],
    equipment: ['wide bowl', 'knife', 'cutting board'],
    pantryNote: 'Assumes olive oil, salt, and dried oregano are on hand.',
  },
  {
    id: 'smash-cheeseburger',
    title: 'Smash Cheeseburger',
    category: 'Burgers & Sandwiches',
    mealTimes: ['evening'],
    difficulty: 'Medium',
    prep: 8,
    cook: 10,
    servings: 2,
    homemadeCost: 6.0,
    blurb: 'Crispy-edged smashed beef patties with melty cheese on toasted buns.',
    ingredients: [
      ['8 oz', 'ground beef (80/20)'],
      ['2', 'burger buns'],
      ['2 slices', 'cheddar cheese'],
      ['2 tbsp', 'mayonnaise'],
      ['1 tbsp', 'ketchup'],
      ['4', 'dill pickle slices'],
      ['1/2 tsp', 'kosher salt'],
      ['1/4 tsp', 'black pepper'],
    ],
    steps: [
      { text: 'Divide 8 oz beef into 2 loose balls — do not pack them tightly.', time: '2 min', cue: 'Balls hold together but look craggy.' },
      { text: 'Heat a skillet or griddle over medium-high heat for 2 minutes until very hot.', time: '2 min', cue: 'A drop of water dances and evaporates.' },
      { text: 'Add the beef balls and smash each flat with a spatula, then season with 1/2 teaspoon salt and 1/4 teaspoon pepper.', time: '1 min', cue: 'Thin patties with lacy edges.' },
      { text: 'Cook for 2-3 minutes until the edges are deep brown, flip, add cheese, and cook 1-2 minutes to 160°F / 71°C.', time: '4 min', cue: 'Cheese melts over a browned patty.' },
      { text: 'Toast the buns cut-side down for 1 minute and mix 2 tablespoons mayo with 1 tablespoon ketchup.', time: '1 min', cue: 'Buns are golden inside.' },
      { text: 'Spread the sauce on the buns, add the patties and pickles, and close the burgers.', time: '1 min', cue: 'Sauce peeks out the sides.' },
    ],
    substitutions: ['Use ground turkey (cook to 165°F / 74°C).', 'Swap cheddar for American or skip for dairy-free.'],
    equipment: ['cast-iron skillet', 'sturdy spatula'],
    pantryNote: 'Assumes salt, pepper, mayo, and ketchup are on hand.',
  },
  {
    id: 'turkey-avocado-sandwich',
    title: 'Turkey Avocado Sandwich',
    category: 'Burgers & Sandwiches',
    mealTimes: ['afternoon'],
    difficulty: 'Easy',
    prep: 8,
    cook: 0,
    servings: 1,
    homemadeCost: 4.25,
    blurb: 'A stacked no-cook sandwich with turkey, creamy avocado, and crunch.',
    ingredients: [
      ['2 slices', 'whole-grain bread'],
      ['4 slices', 'deli turkey'],
      ['1/2', 'avocado'],
      ['2 leaves', 'romaine lettuce'],
      ['2 slices', 'tomato'],
      ['1 tbsp', 'mayonnaise'],
      ['1 tsp', 'dijon mustard'],
      ['1 pinch', 'kosher salt'],
    ],
    steps: [
      { text: 'Mash 1/2 avocado with a pinch of salt and spread it on 1 slice of bread.', time: '2 min', cue: 'Spreadable but still a little chunky.' },
      { text: 'Mix 1 tablespoon mayo with 1 teaspoon dijon and spread it on the second slice.', time: '1 min', cue: 'Even pale-yellow layer.' },
      { text: 'Layer 4 slices turkey, 2 tomato slices, and 2 romaine leaves on the avocado side.', time: '2 min', cue: 'Fillings sit flat and even.' },
      { text: 'Close the sandwich, press gently, and cut it in half on the diagonal.', time: '1 min', cue: 'Clean cut with visible layers.' },
    ],
    substitutions: ['Use sliced chicken or ham.', 'Swap romaine for spinach or arugula.'],
    equipment: ['knife', 'fork', 'cutting board'],
    pantryNote: 'Assumes mayo, mustard, and salt are on hand.',
  },
  {
    id: 'margherita-flatbread-pizza',
    title: 'Margherita Flatbread Pizza',
    category: 'Pizza',
    mealTimes: ['evening'],
    difficulty: 'Easy',
    prep: 8,
    cook: 12,
    servings: 2,
    homemadeCost: 5.0,
    blurb: 'A crisp flatbread with tomato sauce, melty mozzarella, and basil.',
    ingredients: [
      ['1', 'flatbread or naan'],
      ['1/3 cup', 'tomato sauce'],
      ['1 cup', 'shredded mozzarella'],
      ['4', 'fresh basil leaves'],
      ['1 tbsp', 'olive oil'],
      ['1/4 tsp', 'dried oregano'],
      ['1 pinch', 'kosher salt'],
    ],
    steps: [
      { text: 'Heat the oven to 450°F / 230°C and let it fully preheat for 10 minutes.', time: '10 min', cue: 'Oven is fully up to temperature.' },
      { text: 'Brush the flatbread edges with 1 tablespoon olive oil and spread 1/3 cup tomato sauce, leaving a 1/2-inch border.', time: '2 min', cue: 'Thin, even layer of sauce.' },
      { text: 'Scatter 1 cup mozzarella over the sauce and sprinkle with 1/4 teaspoon oregano and a pinch of salt.', time: '1 min', cue: 'Cheese covers the sauce evenly.' },
      { text: 'Bake for 8-10 minutes until the cheese is bubbling and the edges are golden and crisp.', time: '10 min', cue: 'Cheese is melted with golden spots.' },
      { text: 'Tear 4 basil leaves over the hot pizza, slice, and serve.', time: '1 min', cue: 'Basil wilts slightly from the heat.' },
    ],
    substitutions: ['Use fresh mozzarella torn into pieces.', 'Add sliced cherry tomatoes for extra freshness.'],
    equipment: ['baking sheet', 'oven', 'pizza cutter'],
    pantryNote: 'Assumes olive oil, salt, and dried oregano are on hand.',
  },
  {
    id: 'chocolate-mug-cake',
    title: 'Chocolate Mug Cake',
    category: 'Desserts',
    mealTimes: ['evening', 'late_night'],
    difficulty: 'Easy',
    prep: 3,
    cook: 2,
    servings: 1,
    homemadeCost: 1.25,
    blurb: 'A warm, gooey single-serving chocolate cake from the microwave.',
    ingredients: [
      ['4 tbsp', 'all-purpose flour'],
      ['3 tbsp', 'granulated sugar'],
      ['2 tbsp', 'cocoa powder'],
      ['1/4 tsp', 'baking powder'],
      ['3 tbsp', 'milk'],
      ['2 tbsp', 'vegetable oil'],
      ['1 pinch', 'kosher salt'],
      ['1 tbsp', 'chocolate chips'],
    ],
    steps: [
      { text: 'In a large microwave-safe mug, whisk 4 tablespoons flour, 3 tablespoons sugar, 2 tablespoons cocoa, 1/4 teaspoon baking powder, and a pinch of salt.', time: '1 min', cue: 'No streaks of cocoa remain.' },
      { text: 'Stir in 3 tablespoons milk and 2 tablespoons oil until the batter is smooth.', time: '1 min', cue: 'Thick, glossy batter with no dry pockets.' },
      { text: 'Scatter 1 tablespoon chocolate chips on top and press them in slightly.', time: '30 sec', cue: 'Chips sit just under the surface.' },
      { text: 'Microwave on high for 70-90 seconds until the top is set but still looks slightly moist.', time: '90 sec', cue: 'Cake springs back and pulls from the mug edges.' },
      { text: 'Let it rest 1 minute before eating — the center stays molten.', time: '1 min', cue: 'Steam rises and the center is gooey.' },
    ],
    substitutions: ['Use a dairy-free milk and chips to make it vegan.', 'Swap oil for melted butter.'],
    equipment: ['large microwave-safe mug', 'fork', 'microwave'],
    pantryNote: 'Assumes flour, sugar, cocoa, baking powder, and salt are on hand.',
  },
  {
    id: 'loaded-grilled-cheese',
    title: 'Loaded Grilled Cheese',
    category: 'Snacks',
    mealTimes: ['afternoon', 'late_night'],
    difficulty: 'Easy',
    prep: 4,
    cook: 8,
    servings: 1,
    homemadeCost: 2.75,
    blurb: 'Crunchy buttery bread with three oozy melted cheeses.',
    ingredients: [
      ['2 slices', 'sourdough bread'],
      ['2 tbsp', 'butter, softened'],
      ['1/3 cup', 'shredded cheddar'],
      ['1/3 cup', 'shredded mozzarella'],
      ['2 tbsp', 'grated parmesan'],
    ],
    steps: [
      { text: 'Butter one side of each bread slice all the way to the edges with 2 tablespoons softened butter.', time: '1 min', cue: 'Even, edge-to-edge coverage.' },
      { text: 'Heat a nonstick pan over medium-low heat and place one slice butter-side down.', time: '1 min', cue: 'Bread sizzles quietly.' },
      { text: 'Pile on 1/3 cup cheddar, 1/3 cup mozzarella, and 2 tablespoons parmesan, then top with the second slice butter-side up.', time: '1 min', cue: 'Cheese mounds in the center.' },
      { text: 'Cook for 3-4 minutes until deep golden, then flip and cook 3-4 minutes more until the cheese is fully melted.', time: '7 min', cue: 'Both sides are crisp and the cheese stretches.' },
      { text: 'Rest 1 minute, then cut in half so the cheese pulls.', time: '1 min', cue: 'A visible cheese pull when separated.' },
    ],
    substitutions: ['Use any good melting cheese you have.', 'Add sliced tomato or ham inside.'],
    equipment: ['nonstick pan', 'spatula'],
    pantryNote: 'Assumes butter is on hand.',
  },
  {
    id: 'sheet-pan-lemon-chicken',
    title: 'Sheet-Pan Lemon Chicken',
    category: 'Dinner Ideas',
    mealTimes: ['evening'],
    difficulty: 'Easy',
    prep: 12,
    cook: 28,
    servings: 4,
    homemadeCost: 8.5,
    blurb: 'Hands-off roasted chicken and potatoes with bright lemon and herbs.',
    ingredients: [
      ['4', 'bone-in chicken thighs'],
      ['1 lb', 'baby potatoes, halved'],
      ['1', 'lemon, sliced'],
      ['3 tbsp', 'olive oil'],
      ['3 cloves', 'garlic, minced'],
      ['1 tsp', 'dried oregano'],
      ['1 tsp', 'kosher salt'],
      ['1/2 tsp', 'black pepper'],
    ],
    steps: [
      { text: 'Heat the oven to 425°F / 220°C and line a sheet pan.', time: '10 min', cue: 'Oven fully preheated.' },
      { text: 'Toss 1 lb halved potatoes with 2 tablespoons olive oil, 3 minced garlic cloves, 1 teaspoon oregano, and half the salt and pepper.', time: '4 min', cue: 'Potatoes are evenly coated.' },
      { text: 'Pat 4 chicken thighs dry, rub with 1 tablespoon olive oil and the remaining salt and pepper, and place skin-up among the potatoes.', time: '3 min', cue: 'Skin looks dry and seasoned.' },
      { text: 'Tuck lemon slices around the pan and roast for 25-30 minutes until the chicken reaches 165°F / 74°C.', time: '28 min', cue: 'Skin is crisp and golden, juices run clear.' },
      { text: 'Rest 5 minutes, then spoon the pan juices over the chicken and potatoes to serve.', time: '5 min', cue: 'Glossy juices coat everything.' },
    ],
    substitutions: ['Use chicken drumsticks or breasts (adjust time to 165°F / 74°C).', 'Swap potatoes for carrots or green beans.'],
    equipment: ['sheet pan', 'mixing bowl', 'instant-read thermometer'],
    pantryNote: 'Assumes olive oil, salt, pepper, and dried oregano are on hand.',
  },
];

export const recommendedRecipes: RecommendationRecipe[] = specs.map(buildRecommendation);

export function getRecommendationsByCategory(category: RecommendationCategory): RecommendationRecipe[] {
  return recommendedRecipes.filter((recipe) => recipe.category === category);
}

export function getRecommendationsForMealTime(mealTime: MealTime, limit = 6): RecommendationRecipe[] {
  const matches = recommendedRecipes.filter((recipe) => recipe.mealTimes.includes(mealTime));
  // Fall back to the full set if a meal time has too few tagged recipes.
  const source = matches.length >= 4 ? matches : recommendedRecipes;
  return source.slice(0, limit);
}

export function getMealTimeForHour(hour: number): MealTime {
  if (hour >= 22 || hour < 5) {
    return 'late_night';
  }
  if (hour < 11) {
    return 'morning';
  }
  if (hour < 17) {
    return 'afternoon';
  }
  return 'evening';
}

export function getRecommendationById(id: string): RecommendationRecipe | undefined {
  return recommendedRecipes.find((recipe) => recipe.id === id);
}
