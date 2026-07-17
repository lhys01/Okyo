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
  ingredients: [...fullCoreRepairInitialFixture.ingredients],
  steps: fullCoreRepairInitialFixture.steps.map((step, index) =>
    index === 1
      ? {
          ...step,
          doneWhen: 'The olive oil looks glossy and moves easily across the skillet.',
        }
      : { ...step }),
};

export const fullCoreRepairUnknownIngredientPatchFixture = {
  ingredients: [...fullCoreRepairInitialFixture.ingredients],
  steps: fullCoreRepairInitialFixture.steps.map((step, index) =>
    index === 1
      ? {
          ...step,
          step: 'Melt the butter in the large skillet for 1 minute until melted.',
        }
      : { ...step }),
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
  ingredients: [...fullCoreIndexThreeInitialFixture.ingredients],
  steps: [{
    stepIndex: 3,
    title: 'Cook Chicken',
    step: 'Cook the chicken in the large skillet for 6 minutes, flipping halfway.',
    safetyNote: 'Cook chicken to 165°F/74°C.',
  }],
};

export const fullCoreIndexThreeSensoryPatchFixture = {
  ingredients: [...fullCoreIndexThreeInitialFixture.ingredients],
  steps: [{
    stepNumber: 4,
    title: 'Cook Chicken',
    step: 'Cook the chicken in the large skillet.',
    doneWhen: 'The center reaches 165°F/74°C and the juices run clear.',
    safetyNote: 'Cook chicken to 165°F/74°C.',
  }],
};
