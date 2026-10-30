export const showcaseContent = Object.freeze({
  hero: {
    title: 'Scan any dish. Recreate it at home.',
    body: 'Take or upload a prepared-dish photo — or describe the dish — and Okyo works out what you’re looking at.',
    inputMethods: ['Take photo', 'Upload photo', 'Describe a dish'],
  },
  scan: {
    title: 'Scan any dish. Get the recipe.',
    body: 'Take a photo and Okyo identifies the ingredients, then gives you a recipe you can make at home.',
    recipeParts: ['Practical ingredients', 'Cookbook-style steps', 'Tools included'],
  },
  customize: {
    title: 'Make every recipe work for you.',
    body: 'Add protein, lower calories, swap ingredients, or tailor any dish to how you like to eat.',
    actions: ['More protein', 'Fewer calories', 'Swap ingredient', 'Simpler steps', 'Cook step-by-step'],
  },
  savings: {
    title: 'Spend less on the dishes you love',
    body: 'Compare takeout spending with your estimated homemade cost over time.',
    exampleAmount: '$84 saved this month with Okyo',
    exampleLabel: 'Illustrative example',
  },
  value: {
    title: "See what's in every bite.",
    fact: 'See calories, protein, and what it costs to make the dish at home.',
  },
  recipeDetails: {
    title: 'Everything you need to cook it.',
    fact: 'Get nutrition, cooking time, cost, and step-by-step directions in one place.',
  },
  meetKiko: {
    title: 'This fox is now your virtual pet',
  },
} as const);
