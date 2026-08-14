import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const flow = read('src/onboarding-v3/screens-v4/OnboardingV4.tsx');
const paywall = read('src/onboarding-v3/screens-v4/V4PaywallScreen.tsx');
const result = read('src/onboarding-v3/screens-v4/FreeRecipeResultScreen.tsx');
const transaction = read('src/onboarding-v3/state/onboardingV4PremiumAction.ts');
const customization = read('src/onboarding-v3/controller/onboardingV4Customization.ts');
const customizationProgress = read('src/onboarding-v3/screens-v4/V4CustomizationScreen.tsx');

test('only Cook and non-empty natural-language customization are eligible paywall triggers', () => {
  assert.match(result, /onPremiumAction\('cook'\)/);
  assert.match(result, /onPremiumAction\('customize', customization\.trim\(\)\)/);
  assert.match(result, /disabled=\{!customization\.trim\(\)\}/);
  assert.doesNotMatch(result, /onSave=.*onPremiumAction|onAddGroceries=.*onPremiumAction|onShare=.*onPremiumAction/);
});

test('result rendering, save, groceries, share, and restoration cannot mount or open paywall', () => {
  assert.doesNotMatch(result, /V4PaywallScreen|purchasePackage|restorePurchases|PAYWALL_REQUIRED/);
  assert.match(flow, /if \(state\.step === 'paywall'/);
  const restoreBlock = flow.slice(flow.indexOf('RESULT_RESTORED'), flow.indexOf('useEffect(() => {', flow.indexOf('RESULT_RESTORED')));
  assert.doesNotMatch(restoreBlock, /purchasePackage|restorePurchases/);
});

test('V4 uses the existing RevenueCat source of truth and verifies entitlement before exact resumption', () => {
  assert.match(flow, /useEntitlement\(\)/);
  assert.match(flow, /purchasePackage\(pkg\)/);
  assert.match(flow, /restorePurchases\(\)/);
  assert.match(flow, /getEntitlementSnapshot\(\)/);
  assert.match(flow, /verified\.status === 'ready' && verified\.isEntitled/);
  assert.match(flow, /resumePremiumAction\(state\.pendingPremiumAction!\)/);
});

test('existing entitlement, purchase success, and restore success all resume the same persisted action', () => {
  assert.match(flow, /if \(decision === 'resume'\)[\s\S]*resumePremiumAction\(action\)/);
  const purchaseBlock = flow.slice(flow.indexOf('const handlePurchase'), flow.indexOf('const handleRestore'));
  const restoreBlock = flow.slice(flow.indexOf('const handleRestore'), flow.indexOf('return <V4PaywallScreen'));
  for (const block of [purchaseBlock, restoreBlock]) {
    assert.match(block, /verified\.status === 'ready'/);
    assert.match(block, /verified\.isEntitled/);
    assert.match(block, /resumePremiumAction\(state\.pendingPremiumAction!\)/);
  }
});

test('paywall prices and products come only from current RevenueCat packages', () => {
  assert.match(paywall, /getRevenueCatPaywallPlans/);
  assert.match(paywall, /selected\.package as PurchasesPackage/);
  assert.doesNotMatch(paywall + transaction, /\$\d|productIdentifier\s*[:=]|packageIdentifier\s*[:=]/);
});

test('purchase and restore controls are guarded and dismissal returns to the free recipe', () => {
  assert.match(flow, /premiumRequestBusyRef\.current/);
  assert.match(paywall, /disabled=\{isBusy\}/);
  assert.match(paywall, /onDismiss/);
  assert.match(flow, /type: 'PAYWALL_DISMISSED'/);
  assert.match(flow, /Your free recipe is still here/);
});

test('exact action execution cannot generate, insert, or consume another recipe or update progress', () => {
  const premiumBlock = flow.slice(flow.indexOf('const resumePremiumAction'), flow.indexOf('useEffect(() => {', flow.indexOf('const resumePremiumAction')));
  assert.match(premiumBlock, /startCookingRecipe/);
  assert.match(premiumBlock, /requestOnboardingV4Customization/);
  assert.match(premiumBlock, /applyOnboardingV4Customization/);
  assert.match(customization, /correctScanRecipe/);
  assert.doesNotMatch(premiumBlock + paywall + transaction + customization, /runOnboardingV4FirstScan|runOnboardingAnalysis|runOnboardingRecipeGeneration|commitSuccessfulScanSession|writeFreeRecipeConsumed|incrementMoneySaved|macroProgress/);
});

test('customization text is durable but absent from analytics calls', () => {
  assert.match(transaction, /customizationText/);
  assert.match(customization, /action\.customizationText/);
  assert.match(customization, /correctionRequestId: action\.actionId/);
  assert.doesNotMatch(customizationProgress, /TextInput|onInstructionChange|onSubmit/);
  const analytics = read('src/onboarding-v3/screens-v4/onboardingV4Instrumentation.ts');
  assert.doesNotMatch(analytics, /customizationText|instruction|recipeId/);
});

test('submitted customization continues automatically with loading and retry UI, never a second submit', () => {
  assert.match(customization, /correctionNote: action\.customizationText/);
  assert.match(customizationProgress, /Applying customization/);
  assert.match(customizationProgress, /Retry.*customization/);
  assert.doesNotMatch(customizationProgress, /TextInput|Submit|Apply customization|onInstructionChange/);
});

test('Cook resumption starts the same canonical recipe and cannot record completion itself', () => {
  assert.match(flow, /startCookingRecipe\(recipe\.recipeId/);
  const premiumBlock = flow.slice(flow.indexOf('const resumePremiumAction'), flow.indexOf('useEffect(() => {', flow.indexOf('const resumePremiumAction')));
  assert.doesNotMatch(premiumBlock + transaction, /completeRecipe|completedMeals|incrementMoneySaved|macroProgress/);
  assert.match(flow, /storeHasHydrated/);
  assert.match(flow, /getCompletedCookRecovery/);
});

test('production V3 paywall, routing, RevenueCat service, notifications, and V4 flag remain isolated', () => {
  for (const path of ['src/onboarding-v3/screens/OnboardingPaywallScreen.tsx', 'src/navigation/AppNavigator.tsx', 'src/services/revenueCat.ts']) assert.doesNotMatch(read(path), /V4PaywallScreen|onboardingV4PremiumAction/);
  assert.doesNotMatch(flow + paywall + transaction, /Notifications|requestPermissionsAsync/);
  assert.match(read('src/config/devFlags.ts'), /export const ONBOARDING_V4_ENABLED = true;/);
});
