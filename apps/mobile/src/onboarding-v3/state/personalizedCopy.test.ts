import test from 'node:test';
import assert from 'node:assert/strict';

import { planReadyCopy, savingsFutureCopy, savingsInsightCopy, savingsRevealCopy } from './personalizedCopy';
import { annualTakeoutSpend, emptyPersonalizedProfile } from './personalizedOnboarding';

test('saved name appears on non-question payoff copy', () => {
  assert.match(savingsRevealCopy('Eric'), /^Eric,/);
  assert.match(savingsInsightCopy('Eric', 'We’ll make choosing dinner easier.'), /^Eric,/);
  assert.match(savingsFutureCopy('Eric'), /^Eric,/);
  assert.equal(planReadyCopy('Eric'), 'Eric, your Okyo plan is ready.');
});

test('questions remain name-free', () => {
  const question = 'How often do you order takeout or eat out?';
  assert.equal(question.includes('Eric'), false);
  assert.equal(savingsInsightCopy(undefined, question), question);
});

test('missing names use the existing generic versions', () => {
  assert.equal(savingsRevealCopy(''), 'That’s roughly what takeout adds up to in a year.');
  assert.equal(savingsFutureCopy(null), 'One home meal a week can change the picture.');
  assert.equal(planReadyCopy(undefined), 'Your Okyo plan is ready.');
});

test('long names use a compact safe form without changing calculations', () => {
  const copy = planReadyCopy('Alexandria Montgomery Harrison');
  assert.equal(copy, 'Alexandria, your Okyo plan is ready.');
  assert.ok(copy.length < 60);
  assert.equal(annualTakeoutSpend({ ...emptyPersonalizedProfile, savings: { ...emptyPersonalizedProfile.savings, takeoutFrequency: 'About once a week', spendPerMeal: 25 } }), 1300);
});
