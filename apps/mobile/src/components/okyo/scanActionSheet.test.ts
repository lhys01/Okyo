import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  clearScanAction,
  createScanSheetActions,
  getScanSheetMaxHeight,
  queueScanAction,
  SCAN_SHEET_ACTIONS,
  shouldDismissScanSheet,
  takeScanAction,
} from './scanActionSheetModel';

const root = process.cwd();
const sheet = readFileSync(resolve(root, 'src/components/okyo/ScanFab.tsx'), 'utf8');
const tabs = readFileSync(resolve(root, 'src/navigation/MainTabs.tsx'), 'utf8');
const home = readFileSync(resolve(root, 'src/screens/HomeScreen.tsx'), 'utf8');

test('sheet height scales with short devices and remains capped on tall devices', () => {
  assert.equal(getScanSheetMaxHeight(568), 523);
  assert.equal(getScanSheetMaxHeight(844), 680);
  assert.match(sheet, /maxHeight: getScanSheetMaxHeight\(windowHeight\)/);
  assert.match(sheet, /Math\.max\(insets\.bottom, spacing\.lg\)/);
  assert.match(sheet, /borderTopLeftRadius: radius\.hero/);
  assert.match(sheet, /optionsViewport: \{ flexShrink: 1 \}/);
});

test('sheet supports backdrop, system-back, and drag-handle dismissal', () => {
  assert.match(sheet, /accessibilityLabel="Close scan options"/);
  assert.match(sheet, /onRequestClose=\{onClose\}/);
  assert.match(sheet, /accessibilityLabel="Swipe down to close"/);
  assert.match(sheet, /shouldDismissScanSheet\(gesture\.dy, gesture\.vy\)/);
  assert.equal(shouldDismissScanSheet(73, 0), true);
  assert.equal(shouldDismissScanSheet(30, 0.9), true);
  assert.equal(shouldDismissScanSheet(30, 0.2), false);
});

test('pending selection is consumed once and cleared when a new sheet opens', () => {
  const pending = { current: null as (() => void) | null };
  let calls = 0;
  queueScanAction(pending, () => { calls += 1; });
  takeScanAction(pending)?.();
  takeScanAction(pending)?.();
  assert.equal(calls, 1);
  queueScanAction(pending, () => { calls += 1; });
  clearScanAction(pending);
  takeScanAction(pending)?.();
  assert.equal(calls, 1);
  assert.match(sheet, /if \(!visible\) return;[\s\S]*clearScanAction\(pendingAction\)/);
  assert.match(sheet, /onDismiss=\{flushPendingAction\}/);
});

test('single shared sheet exposes the three scan actions from Home and the global FAB', () => {
  assert.deepEqual(SCAN_SHEET_ACTIONS, ['Take photo', 'Upload photo', 'Describe a dish']);
  const calls: string[] = [];
  const actions = createScanSheetActions({
    onTakePhoto: () => calls.push('camera'),
    onUpload: () => calls.push('photos'),
    onDescribeMeal: () => calls.push('describe'),
  });
  actions.forEach((action) => action.onSelect());
  assert.deepEqual(calls, ['camera', 'photos', 'describe']);
  assert.match(sheet, /actions\.map\(\(action\) =>/);
  assert.match(sheet, /choose\(action\.onSelect\)/);
  assert.equal((tabs.match(/<ScanActionSheet\b/g) ?? []).length, 1);
  assert.doesNotMatch(home, /<ScanActionSheet\b/);
  assert.match(home, /openSharedScanSheet\(\)/);
  assert.match(tabs, /onTakePhoto=\{\(\) => void startPickedScan\('camera'\)\}/);
  assert.match(tabs, /onUpload=\{\(\) => void startPickedScan\('photos'\)\}/);
  assert.match(tabs, /onDescribeMeal=\{\(\) => rootNavigation\.navigate\('DescribeMealScreen'\)\}/);
});
