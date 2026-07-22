import assert from 'node:assert/strict';
import test from 'node:test';

import type { ScanImageMetadata } from '../api/types';
import {
  canUseScanStateForRoute,
  getMissingOnboardingImageError,
  getNextOnboardingPlanScreen,
  getOnboardingResponseImage,
  getOnboardingResultFallbackScreen,
  getOnboardingScanStartDecision,
  getOnboardingUploadUri,
  getRealOnboardingImageUri,
  isCurrentOnboardingScanSession,
} from './onboardingScanGuards';

const selectedImage: ScanImageMetadata = {
  fileName: 'ramen.jpg',
  height: 800,
  mimeType: 'image/jpeg',
  placeholder: false,
  source: 'photos',
  uri: 'file:///tmp/okyo-picked-ramen.jpg',
  width: 1000,
};

test('initial onboarding scan has no image and cannot start', () => {
  const decision = getOnboardingScanStartDecision(false, null);

  assert.deepEqual(decision, { canStart: false, reason: 'missing_image' });
});

test('picker cancellation sends no request because no image is accepted', () => {
  const decision = getOnboardingScanStartDecision(false, undefined);

  assert.equal(decision.canStart, false);
  assert.equal(decision.reason, 'missing_image');
});

test('selected image URI is passed unchanged into onboarding scan preparation', () => {
  const decision = getOnboardingScanStartDecision(false, selectedImage);

  assert.equal(decision.canStart, true);
  assert.equal(decision.image.uri, selectedImage.uri);
  assert.equal(getRealOnboardingImageUri(decision.image), selectedImage.uri);
});

test('stale previous scan state is rejected for route-specific results', () => {
  assert.equal(canUseScanStateForRoute('new-session', 'old-session', 'old-session'), false);
  assert.equal(canUseScanStateForRoute('new-session', 'new-session', 'old-session'), true);
  assert.equal(canUseScanStateForRoute('new-session', 'old-session', 'new-session'), true);
});

test('missing or placeholder image fails visibly instead of using a fallback', () => {
  const missingUriDecision = getOnboardingScanStartDecision(false, { ...selectedImage, uri: '' });
  const placeholderDecision = getOnboardingScanStartDecision(false, { ...selectedImage, placeholder: true });

  assert.equal(missingUriDecision.canStart, false);
  assert.equal(missingUriDecision.reason, 'missing_image_uri');
  assert.equal(placeholderDecision.canStart, false);
  assert.equal(placeholderDecision.reason, 'placeholder_image');
  assert.match(getMissingOnboardingImageError(), /Choose another image/);
});

test('result image stays linked to the current selected scan image', () => {
  const apiPlaceholder: ScanImageMetadata = {
    placeholder: true,
    source: 'mock',
    uri: 'file:///tmp/sample-sushi.jpg',
  };

  const responseImage = getOnboardingResponseImage(selectedImage, { image: apiPlaceholder });

  assert.equal(responseImage?.uri, selectedImage.uri);
  assert.equal(responseImage?.placeholder, false);
});

test('rapid double tap does not create two scan requests', () => {
  const firstDecision = getOnboardingScanStartDecision(false, selectedImage);
  const secondDecision = getOnboardingScanStartDecision(true, selectedImage);

  assert.equal(firstDecision.canStart, true);
  assert.deepEqual(secondDecision, { canStart: false, reason: 'scan_already_submitting' });
});

test('scan writes only apply to the current onboarding session', () => {
  assert.equal(isCurrentOnboardingScanSession('scan-2', 'scan-1'), false);
  assert.equal(isCurrentOnboardingScanSession('scan-2', 'scan-2'), true);
});

test('cooking frequency follows the existing reminder then plan flow', () => {
  assert.equal(getNextOnboardingPlanScreen('weeklyGoal'), 'reminder');
  assert.equal(getNextOnboardingPlanScreen('reminder'), 'loading');
  assert.equal(getNextOnboardingPlanScreen('loading'), 'scan');
});

test('incomplete first result state falls back to the visible scan screen', () => {
  assert.equal(getOnboardingResultFallbackScreen(), 'scan');
});

test('processed image URI is preferred for upload', () => {
  assert.equal(
    getOnboardingUploadUri('file:///documents/processed.jpg', 'file:///picker/original.heic'),
    'file:///documents/processed.jpg',
  );
});

test('missing processed URI falls back to the original URI for validation', () => {
  assert.equal(
    getOnboardingUploadUri(undefined, 'file:///picker/original.heic'),
    'file:///picker/original.heic',
  );
});
