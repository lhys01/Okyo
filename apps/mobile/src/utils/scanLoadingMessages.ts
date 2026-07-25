export const FIRST_SCAN_STATUS_MESSAGE = 'Identifying the dish';

export const SCAN_STATUS_MESSAGE_POOL = [
  'Mapping the dish', 'Spreading the sauce', 'Chopping the herbs', 'Checking the texture',
  'Tasting the seasoning', 'Matching the ingredients', 'Warming the pan', 'Folding the dough',
  'Simmering the sauce', 'Checking the garnish', 'Reading the toppings', 'Finding the protein',
  'Checking the portion', 'Building the steps', 'Timing the cook', 'Balancing the flavors',
  'Tracing the aroma', 'Studying the colors', 'Noting the crunch', 'Watching the edges',
  'Measuring the balance', 'Layering the flavors', 'Heating the skillet', 'Toasting the spices',
  'Rinsing the grains', 'Slicing the vegetables', 'Dicing the aromatics', 'Peeling the garlic',
  'Crushing the pepper', 'Whisking the dressing', 'Stirring the base', 'Blending the sauce',
  'Seasoning the broth', 'Chilling the filling', 'Resting the dough', 'Shaping the bites',
  'Rolling the noodles', 'Shredding the cheese', 'Grating the zest', 'Picking the herbs',
  'Washing the greens', 'Checking the color', 'Following the aroma', 'Testing the tenderness',
  'Watching the simmer', 'Listening to the sizzle', 'Counting the layers', 'Weighing the portions',
  'Mapping the ingredients', 'Planning the timing', 'Finding the right pan', 'Setting the heat',
  'Waking up the spices', 'Coating the vegetables', 'Browning the protein', 'Crisping the edges',
  'Softening the onions', 'Folding in the herbs', 'Pouring the broth', 'Reducing the sauce',
  'Thickening the mixture', 'Loosening the grains', 'Tossing the noodles', 'Turning the pieces',
  'Flipping the bites', 'Checking the center', 'Watching the steam', 'Balancing the salt',
  'Brightening the sauce', 'Checking the balance', 'Studying the serving',
  'Arranging the toppings', 'Sprinkling the garnish', 'Warming the bowl', 'Chopping the scallions',
  'Slicing the avocado', 'Toasting the bread', 'Melting the cheese', 'Folding the wrap',
  'Filling the bowl', 'Mixing the crunch', 'Testing the sauce', 'Checking the warmth',
  'Reading the recipe shape', 'Matching the cook time', 'Finding the final texture',
  'Comparing the flavors', 'Rounding out the sauce', 'Comparing the layers', 'Making room for garnish',
  'Checking every layer', 'Listening for the sizzle', 'Letting it rest', 'Giving it a stir',
  'Comparing the textures', 'Reading the sauce', 'Studying the portion', 'Comparing the seasonings',
  'Checking the herbs',
] as const;

export function createScanStatusSequence(random = Math.random) {
  const remaining = [...SCAN_STATUS_MESSAGE_POOL];
  for (let index = remaining.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [remaining[index], remaining[swapIndex]] = [remaining[swapIndex], remaining[index]];
  }

  return [FIRST_SCAN_STATUS_MESSAGE, ...remaining];
}

export function createDescriptionStatusSequence(random = Math.random) {
  const remaining = [...SCAN_STATUS_MESSAGE_POOL];
  for (let index = remaining.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [remaining[index], remaining[swapIndex]] = [remaining[swapIndex], remaining[index]];
  }
  return ['Reading your idea', ...remaining];
}

export function createStatusSequenceForScan(source: 'description' | 'camera' | 'photos' | 'mock', random = Math.random) {
  return source === 'description' ? createDescriptionStatusSequence(random) : createScanStatusSequence(random);
}
