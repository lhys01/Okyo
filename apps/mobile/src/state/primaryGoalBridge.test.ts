import assert from 'node:assert/strict';
import test from 'node:test';

import { PRIMARY_GOAL_PROFILE_KEY, readPersonalizedHomeProfile, readPrimaryGoalFromProfile } from './primaryGoalBridge.js';

test('primary goal bridge reads the authoritative onboarding profile record', async () => {
  const storage = memoryStorage(JSON.stringify({ name: 'Megan', primaryGoal: 'hit_macros' }));
  assert.equal(await readPrimaryGoalFromProfile(storage), 'hit_macros');
  assert.deepEqual(storage.keys, [PRIMARY_GOAL_PROFILE_KEY]);
});

test('Home reads the saved onboarding name from that same authoritative profile', async () => {
  const storage = memoryStorage(JSON.stringify({ name: ' Megan ', primaryGoal: 'eat_healthier' }));
  assert.deepEqual(await readPersonalizedHomeProfile(storage), { name: 'Megan', primaryGoal: 'eat_healthier' });
  assert.deepEqual(storage.keys, [PRIMARY_GOAL_PROFILE_KEY]);
});

test('primary goal bridge fails safely for missing, malformed, and retired goals', async () => {
  assert.equal(await readPrimaryGoalFromProfile(memoryStorage(null)), null);
  assert.equal(await readPrimaryGoalFromProfile(memoryStorage('{broken')), null);
  assert.equal(await readPrimaryGoalFromProfile(memoryStorage(JSON.stringify({ primaryGoal: 'cook_more' }))), null);
});

function memoryStorage(value: string | null) {
  const keys: string[] = [];
  return {
    keys,
    async getItem(key: string) {
      keys.push(key);
      return value;
    },
  };
}
