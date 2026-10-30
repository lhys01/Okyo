import assert from 'node:assert/strict';
import test from 'node:test';

import { isLaunchReady, type LaunchReadiness } from './launchReadiness';

const complete: LaunchReadiness = { resources: true, navigation: true, destination: true, image: true, layout: true };

test('fonts alone cannot dismiss launch while auth, local state, or navigation is unresolved', () => {
  const restoring: LaunchReadiness = { resources: false, navigation: false, destination: false, image: true, layout: true };
  assert.equal(isLaunchReady(restoring), false);
  assert.equal(isLaunchReady({ ...restoring, resources: true }), false);
  assert.equal(isLaunchReady({ ...restoring, resources: true, navigation: true }), false);
  assert.equal(isLaunchReady(complete), true);
});

test('a destination must not be exposed before its launch image and root layout are committed', () => {
  for (const missing of Object.keys(complete) as (keyof LaunchReadiness)[]) {
    assert.equal(isLaunchReady({ ...complete, [missing]: false }), false, missing);
  }
});
