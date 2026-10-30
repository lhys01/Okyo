import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(process.cwd(), 'src/screens/RecipeDetailScreen.tsx'), 'utf8');
const guidedScreen = source.slice(source.indexOf('export function RecipeStepsScreen'), source.indexOf('function ActiveCookingKeepAwake'));

test('guided cooking keeps ingredient and equipment references available at every density', () => {
  assert.match(guidedScreen, /<StepChips label="Ingredients" values=\{activeStep\.ingredientsUsed\.map\(getGuidedIngredientChipLabel\)\} \/>/);
  assert.match(guidedScreen, /<StepChips label="Equipment" values=\{activeStep\.toolsUsed\} \/>/);
  assert.doesNotMatch(guidedScreen, /<StepList/);
  assert.match(source, /guidedChipRow:[\s\S]{0,100}flexWrap: 'wrap'/);
});

test('adaptive cooking layouts change spacing only, never the shared type scale', () => {
  assert.match(guidedScreen, /getGuidedStepDensity\(activeStep\)/);
  assert.match(source, /guidedStepCardShort:[\s\S]{0,80}minHeight: 340/);
  assert.match(source, /guidedInstructionContentShort:[\s\S]{0,160}minHeight: 272/);
  assert.match(source, /guidedInstructionContent: \{\s*marginTop: 6/);
  assert.doesNotMatch(source, /guidedStepTitleShort|guidedInstructionShort|guidedChipTextShort/);
});

test('guided cooking reads every shared text role from one typography token set', () => {
  assert.match(source, /import \{ guidedCookingTypography \} from '\.\.\/theme\/guidedCookingTypography'/);
  for (const role of ['nav', 'progress', 'title', 'instruction', 'sectionLabel', 'chip', 'upNext', 'button', 'primaryButton']) {
    assert.match(source, new RegExp(`guidedCookingTypography\\.${role}`));
  }
  assert.match(source, /smallBackText:[\s\S]{0,100}guidedCookingTypography\.nav/);
});

test('up-next is in the fixed footer above navigation and body scrolls clear of it', () => {
  const footerIndex = guidedScreen.indexOf('<View style={styles.guidedControlArea}>');
  assert.ok(footerIndex >= 0);
  assert.ok(guidedScreen.indexOf('guidedNextPreview', footerIndex) < guidedScreen.indexOf('guidedNavRow', footerIndex));
  assert.ok(guidedScreen.indexOf('guidedProgressRow') < footerIndex);
  assert.ok(guidedScreen.indexOf('guidedStepCard') < footerIndex);
  assert.match(guidedScreen, /<ScrollView[\s\S]*?contentContainerStyle=\{styles\.guidedBodyContent\}[\s\S]*?style=\{styles\.guidedBodyScroll\}/);
  assert.match(source, /guidedBodyContent: \{\s*paddingBottom: 32/);
  assert.match(guidedScreen, /accessibilityLabel="Previous cooking step"/);
  assert.match(guidedScreen, /'Finish cooking' : 'Next cooking step'/);
  assert.match(source, /guidedControlArea:[\s\S]{0,220}marginTop: 'auto'/);
  assert.match(source, /guidedNextPreview:[\s\S]{0,300}marginBottom: 10/);
});

test('guided footer stays in safe-area layout flow, outside the scroll view and without overlay positioning', () => {
  const scrollClose = guidedScreen.indexOf('</ScrollView>');
  const footerOpen = guidedScreen.indexOf('<View style={styles.guidedControlArea}>');
  assert.ok(scrollClose >= 0 && footerOpen > scrollClose);
  assert.match(guidedScreen, /<SafeAreaView edges=\{\['top', 'right', 'bottom', 'left'\]\} style=\{styles\.safeArea\}>[\s\S]*?<ActiveCookingKeepAwake \/>/);

  const footerStyleStart = source.indexOf('  guidedControlArea: {');
  const footerStyleEnd = source.indexOf('  guidedNextPreview: {', footerStyleStart);
  const footerStyle = source.slice(footerStyleStart, footerStyleEnd);
  assert.doesNotMatch(footerStyle, /position:|zIndex:/);
  assert.doesNotMatch(footerStyle, /^\s*height:/m);
  assert.match(guidedScreen, /\{nextStepPreview \? \([\s\S]*?styles\.guidedNextPreview[\s\S]*?\) : null\}/);
  assert.equal((guidedScreen.match(/styles\.guidedNextPreview\}/g) ?? []).length, 1);
  assert.match(guidedScreen, /onPress=\{goPreviousStep\}[\s\S]*?styles\.guidedNavButton/);
  assert.match(guidedScreen, /goNextStep[\s\S]*?styles\.guidedNavButtonPrimary/);
  assert.match(guidedScreen, /contentContainerStyle=\{styles\.guidedBodyContent\}/);
});

test('guided header centers total time between Back and End and keeps finish time with progress', () => {
  assert.match(guidedScreen, /<View style=\{styles\.guidedHeaderRow\}>[\s\S]*?guidedHeaderStart[\s\S]*?guidedHeaderTotal[\s\S]*?guidedHeaderEnd/);
  assert.match(guidedScreen, /<FitText minimumFontScale=\{0\.72\} style=\{styles\.guidedHeaderTotal\}>[\s\S]*?min total/);
  assert.match(guidedScreen, /<View style=\{styles\.guidedProgressRow\}>[\s\S]*?guidedProgressTrack[\s\S]*?guidedProgressText[\s\S]*?<\/View>\s*<View style=\{styles\.guidedFinishByRow\}>\s*<FinishByTime remainingMinutes=\{remainingCookingMinutes\} \/>/);
  const progressRow = guidedScreen.slice(guidedScreen.indexOf('<View style={styles.guidedProgressRow}>'), guidedScreen.indexOf('</View>', guidedScreen.indexOf('<View style={styles.guidedProgressRow}>')) + '</View>'.length);
  assert.doesNotMatch(progressRow, /guidedFinishBy/);
  assert.match(source, /guidedHeaderSide:[\s\S]{0,160}minWidth: 82/);
  assert.match(source, /guidedHeaderTotal:[\s\S]{0,160}textAlign: 'center'/);
  assert.match(source, /guidedHeaderEnd:[\s\S]{0,80}justifyContent: 'flex-end'/);
  assert.match(guidedScreen, /hasUsableTimingData \? `\$\{totalCookingMinutes\} min total` : 'Total time unavailable'/);
  assert.match(guidedScreen, /hasUsableTimingData \? guidedSteps\.map/);
});

test('finish-time text has its own right-aligned flexible row on compact widths', () => {
  assert.match(source, /guidedFinishByRow: \{\s*alignItems: 'flex-end',\s*marginTop: 3/);
  assert.match(source, /guidedFinishBy: \{[\s\S]{0,180}flexShrink: 1,[\s\S]{0,60}textAlign: 'right'/);
  assert.match(source, /guidedProgressTrack:[\s\S]{0,160}flex: 1/);
  assert.match(guidedScreen, /<FinishByTime remainingMinutes=\{remainingCookingMinutes\} \/>/);
  assert.match(source, /memo\(function FinishByTime/);
  assert.match(source, /formatFinishByTime\(now, remainingMinutes\)/);
  assert.doesNotMatch(guidedScreen, /clockNow|setClockNow/);
});

test('guided cooking omits only the Flavor booster card and keeps other cooking tips', () => {
  assert.match(guidedScreen, /activeStep\.tip && activeStep\.tip\.title\.trim\(\)\.toLowerCase\(\) !== 'flavor booster'/);
  assert.match(guidedScreen, /<GuidanceBlock label=\{activeStep\.tip\.title\} text=\{activeStep\.tip\.body\} \/>/);
});

test('removed guided-cooking clutter and orange styling stay absent', () => {
  assert.doesNotMatch(guidedScreen, /Ask Okyo|Hands-on|Waiting|THIS STEP|Start timer/);
  assert.doesNotMatch(source, /guidedSafetyLabel:[\s\S]{0,120}recipeColors\.orange/);
});
