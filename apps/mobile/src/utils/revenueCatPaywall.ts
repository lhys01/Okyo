type RevenueCatProductLike = {
  identifier: string;
  pricePerWeekString?: string | null;
  priceString: string;
  subscriptionPeriod: string | null;
  title: string;
};

export type RevenueCatPackageLike = {
  identifier: string;
  packageType: string;
  product: RevenueCatProductLike;
};

export type RevenueCatPaywallPlan<TPackage extends RevenueCatPackageLike> = {
  badge: string;
  package: TPackage;
  pricing: {
    primary: string;
    secondary: string;
  };
  title: string;
};

const packageOrder: Record<string, number> = {
  ANNUAL: 0,
  WEEKLY: 1,
};

function getPlanTitle(pkg: RevenueCatPackageLike): string {
  switch (pkg.packageType) {
    case 'ANNUAL': return 'Annual';
    case 'SIX_MONTH': return 'Six months';
    case 'THREE_MONTH': return 'Three months';
    case 'TWO_MONTH': return 'Two months';
    case 'MONTHLY': return 'Monthly';
    case 'WEEKLY': return 'Weekly';
    default: return pkg.product.title;
  }
}

function getPeriodLabel(period: string | null): string | null {
  switch (period) {
    case 'P1W': return 'weekly';
    case 'P1M': return 'monthly';
    case 'P2M': return 'every 2 months';
    case 'P3M': return 'every 3 months';
    case 'P6M': return 'every 6 months';
    case 'P1Y': return 'yearly';
    default: return null;
  }
}

function getPlanPricing(pkg: RevenueCatPackageLike) {
  const periodLabel = getPeriodLabel(pkg.product.subscriptionPeriod);
  if (pkg.packageType === 'ANNUAL' && pkg.product.pricePerWeekString) {
    return {
      primary: `${pkg.product.pricePerWeekString} / week`,
      secondary: `Billed ${pkg.product.priceString} yearly`,
    };
  }

  return {
    primary: periodLabel ? `${pkg.product.priceString} / ${periodLabel.replace(/ly$/, '')}` : pkg.product.priceString,
    secondary: periodLabel ? `Billed ${periodLabel}` : pkg.product.title,
  };
}

/**
 * Converts only the annual and weekly packages RevenueCat actually returned.
 * Okyo has no monthly onboarding plan, so an obsolete dashboard monthly
 * package is ignored rather than relabeled or fabricated. The original
 * PurchasesPackage object is retained so selection can purchase that exact
 * package without recreating identifiers or product state.
 */
export function getRevenueCatPaywallPlans<TPackage extends RevenueCatPackageLike>(
  offering: { availablePackages: readonly TPackage[] } | null | undefined,
): RevenueCatPaywallPlan<TPackage>[] {
  if (!offering) return [];

  return offering.availablePackages
    .filter((pkg) => pkg.packageType === 'ANNUAL' || pkg.packageType === 'WEEKLY')
    .filter((pkg, index, packages) => packages.findIndex((candidate) => candidate.identifier === pkg.identifier) === index)
    .slice()
    .sort((left, right) => (packageOrder[left.packageType] ?? 99) - (packageOrder[right.packageType] ?? 99))
    .map((pkg) => ({
      badge: pkg.packageType === 'ANNUAL' ? 'BEST VALUE' : 'FLEXIBLE',
      package: pkg,
      pricing: getPlanPricing(pkg),
      title: getPlanTitle(pkg),
    }));
}

export function hasUsableRevenueCatOffering(
  offering: { availablePackages: readonly RevenueCatPackageLike[] } | null | undefined,
): boolean {
  return getRevenueCatPaywallPlans(offering).length > 0;
}

