import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('tour copy and spotlight are committed together with no typewriter reveal', () => {
  const overlay = readSource('src/tour/TourOverlay.tsx');
  const coach = readSource('src/tour/CoachDock.tsx');

  assert.match(overlay, /if \(!spotlightCommitted\) return null/);
  assert.doesNotMatch(overlay, /typewriter|revealedCount|mascotNameLoaded/);
  assert.match(coach, /\{fullBody\}/);
  assert.match(coach, /typography\.body/);
  assert.match(coach, /typography\.button/);
  assert.doesNotMatch(coach, /revealedBody|Animated\.View/);
  assert.doesNotMatch(overlay, /NATIVE_SCENE_SETTLE_MS|SCROLL_SETTLE_MS/);
  assert.match(overlay, /scheduleNextFrame\(tryMeasure\)/);
});

test('tour activation waits for Clerk, persisted state, Home layout, and onboarding reset completion', () => {
  const context = readSource('src/tour/TourContext.tsx');
  const home = readSource('src/screens/HomeScreen.tsx');
  const settings = readSource('src/screens/SettingsScreen.tsx');

  assert.match(context, /shouldStartTour\(\{ authReady: canStart, homeReady, hydrated, pendingStart, status: persistedStatus \}\)/);
  assert.match(context, /reportHomeReady/);
  assert.doesNotMatch(context, /START_DELAY_MS|setTimeout\(/);
  assert.match(home, /onContentSizeChange=/);
  assert.match(home, /onLayout=/);
  assert.match(home, /reportHomeReady\(\)/);
  assert.match(settings, /devResetTour\(\)/);
});

test('compound scan step publishes the native plus target while preserving all spotlight holes', () => {
  const steps = readSource('src/tour/tourSteps.ts');
  const overlay = readSource('src/tour/TourOverlay.tsx');
  const fab = readSource('src/components/okyo/ScanFab.tsx');

  assert.match(steps, /home-first-use-scan/);
  assert.match(steps, /home-add-scan/);
  assert.match(overlay, /getHighlightedTourAnchorId\(mountedTargets\)/);
  assert.match(fab, /highlightedByTour/);
  assert.match(fab, /tourTargetMeasured/);
});

test('Liked Explore spotlight preserves the complete CTA instead of clipping at the coach dock', () => {
  const overlay = readSource('src/tour/TourOverlay.tsx');
  assert.match(overlay, /target\?\.anchorId === 'liked-explore-recipes'/);
  assert.match(overlay, /target\?\.anchorId === 'grocery-tab' \|\| target\?\.anchorId === 'liked-explore-recipes'/);
});

test('populated Liked tour target stays registered with its real scrolling screen and full-screen overlay root', () => {
  const library = readSource('src/screens/LibraryScreen.tsx');
  const tabs = readSource('src/navigation/MainTabs.tsx');
  assert.match(library, /<LibraryFrame onScroll=\{onTourScroll\} scrollRef=\{libraryScrollRef\}>[\s\S]*?tourAnchorRef=\{index === 0 \? likedFirstRecipeAnchorRef : undefined\}/);
  assert.match(tabs, /<View style=\{styles\.mainTabsRoot\}>[\s\S]*?<TourOverlay \/>[\s\S]*?<\/View>/);
});
