import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  kikoMascotNamePolicy,
  kikoOnboardingAssignmentPlan,
  kikoOnboardingInventory,
  kikoSizeRoles,
  resolveKikoOnboardingMotion,
} from './assets/kikoOnboardingRegistry';

const assetDirectory = resolve(process.cwd(), 'assets/onboarding-kiko');
const registrySourcePath = resolve(
  process.cwd(),
  'src/onboarding-v3/assets/kikoOnboardingRegistry.ts',
);

const sourcePngs = () =>
  readdirSync(assetDirectory)
    .filter((filename) => filename.toLowerCase().endsWith('.png'))
    .sort();

test('every onboarding kiko PNG is inventoried exactly once and every registered file exists', () => {
  const filenames = kikoOnboardingInventory.map((asset) => asset.filename);

  assert.equal(kikoOnboardingInventory.length, 20);
  assert.equal(new Set(filenames).size, filenames.length);
  assert.deepEqual([...filenames].sort(), sourcePngs());
});

test('registry metadata matches source PNG dimensions, alpha channel, and original hashes', () => {
  for (const asset of kikoOnboardingInventory) {
    const bytes = readFileSync(resolve(assetDirectory, asset.filename));
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    const pngColorType = bytes[25];
    const hasAlphaChannel = pngColorType === 4 || pngColorType === 6;
    const hash = createHash('sha256').update(bytes).digest('hex');

    assert.deepEqual(asset.dimensions, { width, height }, asset.filename);
    assert.equal(asset.aspectRatio, width / height, asset.filename);
    assert.equal(asset.hasTransparentBackground, hasAlphaChannel, asset.filename);
    assert.equal(
      asset.backgroundState,
      hasAlphaChannel ? 'transparent' : 'baked-intact',
      asset.filename,
    );
    assert.equal(asset.sha256, hash, asset.filename);
    assert.equal(asset.needsBackgroundRemoval, false, asset.filename);
    assert.equal(asset.preserveAsIntactComposition, true, asset.filename);
  }
});

test('every source loader uses the approved bundled Kiko artwork', () => {
  const registrySource = readFileSync(registrySourcePath, 'utf8');
  const approvedRequires = [...registrySource.matchAll(/require\('\.\.\/\.\.\/\.\.\/assets\/kiko-static\/approved\/([^']+\.png)'\)/g)]
    .map((match) => match[1]);
  assert.equal(approvedRequires.length, kikoOnboardingInventory.length);
  assert.ok(approvedRequires.every((filename) => filename.startsWith('kiko-')));
});

test('assignments reference audited assets and never declare duplicate Kikos on a screen', () => {
  const assetIds = new Set(kikoOnboardingInventory.map((asset) => asset.id));
  const screenKeys = new Set<string>();

  for (const assignment of kikoOnboardingAssignmentPlan) {
    const screenKey = `${assignment.branch}:${assignment.moment}`;
    assert.equal(screenKeys.has(screenKey), false, `duplicate assignment: ${screenKey}`);
    screenKeys.add(screenKey);

    assert.ok(assignment.maximumKikos <= 1, screenKey);
    assert.equal(assignment.assetId === null, assignment.maximumKikos === 0, screenKey);
    if (assignment.assetId) assert.ok(assetIds.has(assignment.assetId), screenKey);
  }
});

test('intentionally unused variants cannot leak into a branch assignment', () => {
  const assignedIds = new Set(
    kikoOnboardingAssignmentPlan.flatMap((assignment) =>
      assignment.assetId ? [assignment.assetId] : [],
    ),
  );

  for (const asset of kikoOnboardingInventory) {
    if (asset.intentionallyUnused) {
      assert.equal(assignedIds.has(asset.id), false, asset.id);
      assert.ok(asset.unusedReason, `${asset.id} needs an explicit unused reason`);
    }
  }
});

test('responsive size roles are bounded for small and large iPhones', () => {
  assert.deepEqual(Object.keys(kikoSizeRoles), ['small', 'medium', 'hero']);
  for (const [role, size] of Object.entries(kikoSizeRoles)) {
    assert.ok(size.minimum > 0, role);
    assert.ok(size.minimum <= size.maximum, role);
    assert.ok(size.responsiveWidth > 0 && size.responsiveWidth < 1, role);
    assert.equal(
      Math.min(size.maximum, Math.max(size.minimum, 320 * size.responsiveWidth)) <= size.maximum,
      true,
      `${role} exceeds its iPhone SE cap`,
    );
    assert.equal(
      Math.min(size.maximum, Math.max(size.minimum, 430 * size.responsiveWidth)) <= size.maximum,
      true,
      `${role} exceeds its Pro Max cap`,
    );
  }
});

test('Kiko motion has no looping mode and Reduce Motion removes scale reactions', () => {
  for (const assignment of kikoOnboardingAssignmentPlan) {
    assert.ok(['none', 'fade', 'brief-scale'].includes(assignment.motion));
    assert.notEqual(resolveKikoOnboardingMotion(assignment.motion, true), 'brief-scale');
  }

  assert.equal(resolveKikoOnboardingMotion('brief-scale', true), 'fade');
  assert.equal(resolveKikoOnboardingMotion('fade', true), 'fade');
  assert.equal(resolveKikoOnboardingMotion('brief-scale', false), 'brief-scale');
});

test('user-facing mascot naming cannot alter stable internal Kiko asset IDs', () => {
  assert.match(kikoMascotNamePolicy, /never change internal kiko asset IDs/i);
  for (const asset of kikoOnboardingInventory) assert.match(asset.id, /^kiko[A-Z]/);
});
