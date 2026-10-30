export function shouldHideMainTabBar(route: { name: string; params?: unknown } | undefined) {
  // Focused detail/result and settings screens should not display global tabs.
  if (
    route?.name === 'DietaryPreferencesScreen' ||
    route?.name === 'IdeaBoardScreen' ||
    route?.name === 'PersonalizationScreen' ||
    route?.name === 'ResultSummaryScreen' ||
    route?.name === 'RecipeDetailScreen'
  ) {
    return true;
  }

  if (route?.name !== 'RecipeStepsScreen') {
    return false;
  }

  return (route.params as { completion?: unknown } | undefined)?.completion !== true;
}
