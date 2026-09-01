export const showcaseContent = Object.freeze({
  hero: {
    title: 'Scan any dish. Recreate it at home.',
    body: 'Take or upload a prepared-dish photo — or describe the dish — and Okyo works out what you’re looking at.',
    inputMethods: ['Take photo', 'Upload photo', 'Describe a dish'],
  },
  scan: {
    title: 'Get the ingredients and full recipe',
    body: 'Okyo finds practical ingredients and builds clear cookbook-style steps.',
    recipeParts: ['Practical ingredients', 'Cookbook-style steps', 'Tools included'],
  },
  customize: {
    title: 'Make every recipe yours',
    body: 'Change ingredients, macros, or steps in seconds.',
    actions: ['More protein', 'Fewer calories', 'Swap ingredient', 'Simpler steps', 'Cook step-by-step'],
  },
  savings: {
    title: 'Spend less on the dishes you love',
    body: 'Compare takeout spending with your estimated homemade cost over time.',
    exampleAmount: '$84 saved this month with Okyo',
    exampleLabel: 'Illustrative example',
  },
  value: {
    title: 'Know what goes into every bite',
    fact: 'Cooking at home gives you more control over what goes into your food.',
  },
  meetKiko: {
    title: 'This fox is now your virtual pet',
  },
} as const);
