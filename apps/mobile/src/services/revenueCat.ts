import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

import {
  resolveRevenueCatConfiguration,
  type RevenueCatPlatform,
} from './revenueCatConfig';

// RevenueCat is the single source of truth for entitlement state. Public SDK
// keys are selected by build type: an explicit Test Store key in development,
// and a platform-specific key in release builds. Missing production config
// always fails closed and can never fall back to the Test Store.
const configuration = resolveRevenueCatConfiguration({
  androidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  entitlementId: process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID,
  iosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  isDevelopment: typeof __DEV__ !== 'undefined' && __DEV__,
  platform: (Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'other') as RevenueCatPlatform,
  testStoreKey: process.env.EXPO_PUBLIC_REVENUECAT_TEST_KEY,
});

export type EntitlementState =
  | { status: 'loading' }
  | { status: 'unavailable'; reason: string }
  | { status: 'error'; error: string }
  | {
      status: 'ready';
      customerInfo: CustomerInfo;
      entitlementIdConfigured: boolean;
      isEntitled: boolean;
      offering: PurchasesOffering | null;
    };

export type RevenueCatPurchaseResult =
  | { status: 'purchased'; customerInfo: CustomerInfo }
  | { status: 'not_entitled'; customerInfo: CustomerInfo; reason: string }
  | { status: 'cancelled' }
  | { status: 'error'; error: string };

let initializationPromise: Promise<void> | null = null;
let hasCustomerInfoListener = false;
let didLogMissingEntitlement = false;
const listeners = new Set<(state: EntitlementState) => void>();
let latestState: EntitlementState = configuration.apiKey
  ? { status: 'loading' }
  : {
      status: 'unavailable',
      reason: configuration.reason ?? 'RevenueCat is not configured for this build.',
    };

function setState(next: EntitlementState) {
  latestState = next;
  listeners.forEach((listener) => listener(next));
}

function hasConfiguredEntitlement(customerInfo: CustomerInfo): boolean {
  return Boolean(
    configuration.entitlementId &&
    customerInfo.entitlements.active[configuration.entitlementId],
  );
}

function toReadyState(
  customerInfo: CustomerInfo,
  offering: PurchasesOffering | null,
): Extract<EntitlementState, { status: 'ready' }> {
  return {
    status: 'ready',
    customerInfo,
    entitlementIdConfigured: Boolean(configuration.entitlementId),
    isEntitled: hasConfiguredEntitlement(customerInfo),
    offering,
  };
}

function logDevelopmentDiagnostic(event: string, details: Record<string, unknown>) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  console.log(event, details);
}

function logOffering(offering: PurchasesOffering | null) {
  logDevelopmentDiagnostic('okyo_revenuecat_offering', {
    currentOfferingIdentifier: offering?.identifier ?? null,
    packages: offering?.availablePackages.map((pkg) => ({
      identifier: pkg.identifier,
      localizedPrice: pkg.product.priceString,
      productIdentifier: pkg.product.identifier,
      subscriptionPeriod: pkg.product.subscriptionPeriod,
    })) ?? [],
  });
}

function logMissingEntitlementDiagnostic() {
  if (configuration.entitlementId || didLogMissingEntitlement) return;
  didLogMissingEntitlement = true;
  logDevelopmentDiagnostic('okyo_revenuecat_entitlement_missing', {
    dashboardLocation: 'Product catalog > Entitlements',
    environmentVariable: 'EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID',
    message: 'Copy the exact RevenueCat entitlement identifier before validating access.',
  });
}

async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  const offerings = await Purchases.getOfferings();
  const offering = offerings.current ?? null;
  logOffering(offering);
  return offering;
}

/**
 * Configures the native singleton once near app launch. Calling this again is
 * safe: every caller receives the same initialization promise.
 */
export async function initializeRevenueCat(): Promise<void> {
  if (!configuration.apiKey) {
    setState({
      status: 'unavailable',
      reason: configuration.reason ?? 'RevenueCat is not configured for this build.',
    });
    return;
  }

  if (!initializationPromise) {
    initializationPromise = (async () => {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        await Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
      }

      Purchases.configure({ apiKey: configuration.apiKey as string });
      logDevelopmentDiagnostic('okyo_revenuecat_initialized', {
        entitlementIdConfigured: Boolean(configuration.entitlementId),
        initialized: true,
        keySource: configuration.keySource,
        platform: Platform.OS,
      });
      logMissingEntitlementDiagnostic();

      if (!hasCustomerInfoListener) {
        hasCustomerInfoListener = true;
        Purchases.addCustomerInfoUpdateListener((customerInfo) => {
          getCurrentOffering()
            .then((offering) => setState(toReadyState(customerInfo, offering)))
            .catch(() => setState(toReadyState(customerInfo, null)));
        });
      }

      const [customerInfo, offering] = await Promise.all([
        Purchases.getCustomerInfo(),
        getCurrentOffering(),
      ]);
      setState(toReadyState(customerInfo, offering));
    })().catch((error: unknown) => {
      setState({ status: 'error', error: getErrorMessage(error) });
    });
  }

  return initializationPromise;
}

export function getEntitlementSnapshot(): EntitlementState {
  return latestState;
}

export function subscribeToEntitlement(listener: (state: EntitlementState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useEntitlement(): EntitlementState {
  const [state, setLocalState] = useState<EntitlementState>(latestState);

  useEffect(() => {
    const unsubscribe = subscribeToEntitlement(setLocalState);
    initializeRevenueCat().catch(() => undefined);
    return unsubscribe;
  }, []);

  return state;
}

export async function purchasePackage(packageToPurchase: PurchasesPackage): Promise<RevenueCatPurchaseResult> {
  await initializeRevenueCat();
  if (latestState.status !== 'ready' || !latestState.offering) {
    return { status: 'error', error: 'RevenueCat does not have a usable offering.' };
  }

  const packageIsCurrent = latestState.offering.availablePackages.some((pkg) => (
    pkg.identifier === packageToPurchase.identifier &&
    pkg.product.identifier === packageToPurchase.product.identifier
  ));
  if (!packageIsCurrent) {
    return { status: 'error', error: 'The selected RevenueCat package is no longer available.' };
  }

  try {
    const result = await Purchases.purchasePackage(packageToPurchase);
    const nextState = toReadyState(result.customerInfo, latestState.offering);
    setState(nextState);
    if (!nextState.isEntitled) {
      logDevelopmentDiagnostic('okyo_revenuecat_purchase_not_entitled', {
        activeEntitlementIdentifiers: Object.keys(result.customerInfo.entitlements.active),
        entitlementIdConfigured: nextState.entitlementIdConfigured,
        packageIdentifier: packageToPurchase.identifier,
        productIdentifier: packageToPurchase.product.identifier,
      });
      return {
        status: 'not_entitled',
        customerInfo: result.customerInfo,
        reason: nextState.entitlementIdConfigured
          ? 'The configured RevenueCat entitlement was not active after purchase.'
          : 'EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID is not configured.',
      };
    }
    return { status: 'purchased', customerInfo: result.customerInfo };
  } catch (error: unknown) {
    if (isUserCancelledError(error)) {
      return { status: 'cancelled' };
    }
    return { status: 'error', error: getErrorMessage(error) };
  }
}

export async function restorePurchases(): Promise<
  { status: 'restored'; isEntitled: boolean } | { status: 'error'; error: string }
> {
  await initializeRevenueCat();
  if (latestState.status !== 'ready') {
    return { status: 'error', error: 'RevenueCat is not ready to restore purchases.' };
  }

  try {
    const customerInfo = await Purchases.restorePurchases();
    const nextState = toReadyState(customerInfo, latestState.offering);
    setState(nextState);
    return { status: 'restored', isEntitled: nextState.isEntitled };
  } catch (error: unknown) {
    return { status: 'error', error: getErrorMessage(error) };
  }
}

function isUserCancelledError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'userCancelled' in error &&
    (error as { userCancelled?: boolean }).userCancelled,
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'RevenueCat request failed.';
}

