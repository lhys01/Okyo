// Safe, synthetic reproduction of the production failure shape. It contains no
// user image data or production provider payload. The seven-step layout keeps
// the observed zero-based indices 1, 5, and 6 so tests can capture every stage
// of the targeted repair deterministically.
export const fullCoreRepairInitialFixture = {
  title: 'Tomato Garlic Pasta',
  ingredients: [
    '8 oz spaghetti',
    '8 cups water',
    '2 tbsp olive oil',
    '3 cloves garlic, minced',
    '1 cup tomatoes, chopped',
    '1/2 tsp salt',
    '2 tbsp basil, chopped',
  ],
  equipment: ['large pot', 'large skillet'],
  steps: [
    { title: 'Boil Water', step: 'Bring the water to a rolling boil for 8 minutes.' },
    { title: 'Heat Oil', step: 'Heat the olive oil in the large skillet.' },
    { title: 'Build Sauce', step: 'Cook the garlic and tomatoes for 5 minutes until aromatic and softened.' },
    { title: 'Cook Pasta', step: 'Cook the spaghetti for 9 minutes until al dente.' },
    { title: 'Finish Pasta', step: 'Toss the spaghetti with the tomato sauce for 2 minutes until glossy.' },
    { title: 'Divide', step: 'Divide the pasta between two bowls.' },
    { title: 'Serve', step: 'Garnish with the basil and serve immediately.' },
  ],
  prepTime: 8,
  cookTime: 17,
  totalTime: 25,
  servings: 2,
  skillLevel: 'Easy',
};

export const fullCoreRepairSuccessfulPatchFixture = {
  stepCorrections: [{
    stepIndex: 1,
    ...fullCoreRepairInitialFixture.steps[1],
    doneWhen: 'The olive oil looks glossy and moves easily across the skillet.',
  }],
};

export const fullCoreRepairUnknownIngredientPatchFixture = {
  stepCorrections: [{
    stepIndex: 1,
    ...fullCoreRepairInitialFixture.steps[1],
    step: 'Melt the butter in the large skillet for 1 minute until melted.',
  }],
};

// Production-shaped five-step fixture for request
// scan-photos-1784255341665-br54io: one active invalid step at zero-based index
// 3 and one presentation-only step at index 4.
export const fullCoreIndexThreeInitialFixture = {
  title: 'Grilled Chicken Sandwich',
  ingredients: [
    '2 boneless chicken breasts',
    '2 sandwich buns',
    '2 tbsp mayonnaise',
    '1 tbsp mustard',
    '1/2 tsp salt',
    '1 tbsp olive oil',
  ],
  equipment: ['mixing bowl', 'large skillet'],
  steps: [
    { title: 'Gather', step: 'Gather the chicken, buns, mayonnaise, mustard, salt, and olive oil.' },
    { title: 'Mix Sauce', step: 'Mix the mayonnaise and mustard in the bowl.' },
    { title: 'Toast Buns', step: 'Toast the buns for 2 minutes until golden.' },
    {
      title: 'Cook Chicken',
      step: 'Cook the chicken in the large skillet.',
      safetyNote: 'Cook chicken to 165°F/74°C.',
    },
    { title: 'Serve', step: 'Serve the chicken on the buns with the sauce.' },
  ],
  prepTime: 8,
  cookTime: 12,
  totalTime: 20,
  servings: 2,
  skillLevel: 'Easy',
};

export const fullCoreIndexThreeTimePatchFixture = {
  stepCorrections: [{
    stepIndex: 3,
    title: 'Cook Chicken',
    step: 'Cook the chicken in the large skillet for 6 minutes, flipping halfway.',
    safetyNote: 'Cook chicken to 165°F/74°C.',
  }],
};

export const fullCoreIndexThreeSensoryPatchFixture = {
  stepCorrections: [{
    stepIndex: 3,
    title: 'Cook Chicken',
    step: 'Cook the chicken in the large skillet.',
    doneWhen: 'The center reaches 165°F/74°C and the juices run clear.',
    safetyNote: 'Cook chicken to 165°F/74°C.',
  }],
};

// Safe synthetic reproduction of scan-photos-1784258523066-loj218. It keeps
// the production shape without retaining user images or provider text.
export const fullCoreRawTunaInitialFixture = {
  title: 'Ahi Tuna Poke Bowl',
  ingredients: [
    '1 lb sushi-grade ahi tuna',
    '2 cups cooked rice',
    '2 tbsp olive oil',
    '3 tbsp soy sauce',
    '1 tbsp sesame seeds',
    '1 cup cucumber, diced',
    '1 avocado, sliced',
    '1 lime, juiced',
  ],
  equipment: ['mixing bowl', 'chef knife', 'serving bowls'],
  steps: [
    { title: 'Cook Rice', step: 'Cook the rice for 15 minutes until tender.' },
    { title: 'Cool Rice', step: 'Cool the rice for 10 minutes until it reaches room temperature.' },
    { title: 'Mix Sauce', step: 'Mix the soy sauce and lime juice for 1 minute until combined.' },
    { title: 'Dice Tuna', step: 'Dice the ahi tuna into bite-size cubes.' },
    { title: 'Marinate Tuna', step: 'Marinate the tuna with soy sauce and oil.' },
    { title: 'Build Bowls', step: 'Arrange the rice, cucumber, and avocado in serving bowls.' },
    { title: 'Chill Tuna', step: 'Chill the tuna mixture.' },
    { title: 'Serve', step: 'Serve the tuna over the prepared bowls with sesame seeds.' },
  ],
  prepTime: 20,
  cookTime: 15,
  totalTime: 35,
  servings: 4,
  skillLevel: 'Easy',
};

export const fullCoreRawTunaSuccessfulPatchFixture = {
  stepCorrections: [
    {
      stepIndex: 4,
      title: 'Marinate Tuna',
      step: 'Marinate the tuna with soy sauce and oil for 5 minutes until evenly glossy.',
    },
    {
      stepIndex: 6,
      title: 'Chill Tuna',
      step: 'Chill the tuna mixture for 10 minutes until cold.',
    },
  ],
};

// Safe synthetic reproduction of the confirmed Mochi mixed-repair shape. The
// provider text is intentionally invented; only the observed defect indices
// and ingredient concepts are retained.
export const fullCoreMochiMixedInitialFixture = {
  title: 'Soft Mochi',
  ingredients: [
    '1 cup sweet rice flour',
    '3/4 cup water',
    '1/3 cup sugar',
    'cornstarch for dusting',
    '1 tsp vegetable oil',
  ],
  equipment: ['mixing bowl', 'microwave-safe bowl', 'rubber spatula'],
  steps: [
    {
      title: 'Gather Ingredients',
      step: 'Gather the sweet rice flour, water, sugar, cornstarch, and vegetable oil.',
    },
    {
      title: 'Mix Batter',
      step: 'Mix the sweet rice flour, water, and sugar into a smooth batter.',
    },
    {
      title: 'Heat Batter',
      step: 'Heat the batter in the microwave-safe bowl.',
    },
    {
      title: 'Stir Dough',
      step: 'Stir the dough for 1 minute until thickened and glossy.',
    },
    {
      title: 'Cook Dough',
      step: 'Cook the dough in the microwave-safe bowl.',
    },
    {
      title: 'Serve',
      step: 'Plate the mochi, dust with cornstarch, divide into pieces, and serve.',
    },
  ],
  prepTime: 10,
  cookTime: 4,
  totalTime: 14,
  servings: 4,
  skillLevel: 'Easy',
};

export const fullCoreMochiMixedSuccessfulPatchFixture = {
  ingredientCorrections: [{
    ingredientIndex: 3,
    value: '2 tbsp cornstarch, for dusting',
  }],
  stepCorrections: [
    {
      stepIndex: 2,
      title: 'Heat Batter',
      step: 'Heat the batter for 1 minute until it begins to thicken.',
    },
    {
      stepIndex: 4,
      title: 'Cook Dough',
      step: 'Cook the dough for 1 minute until glossy and firm.',
    },
  ],
};
