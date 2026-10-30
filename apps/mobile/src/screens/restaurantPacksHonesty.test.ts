import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('static restaurant inspiration and shared pack cards are identified as examples', () => {
  const screen = readFileSync(resolve(process.cwd(), 'src/screens/RestaurantPacksScreen.tsx'), 'utf8');
  const detail = readFileSync(resolve(process.cwd(), 'src/screens/RestaurantPackDetailScreen.tsx'), 'utf8');
  const share = readFileSync(resolve(process.cwd(), 'src/screens/ShareCardPreviewScreen.tsx'), 'utf8');
  assert.match(screen, /Sample dishes\. Prices and savings are estimates/);
  assert.match(detail, /Example recipes inspired by restaurant dishes\. Prices and savings are estimates/);
  assert.match(share, /Example pack · \$\{selectedPack\.name\}/);
});
