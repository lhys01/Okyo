export type CanonicalProgress = { answered: number; total: number };
export type CanonicalProgressRequest = {
  routeOrder: readonly string[];
  currentRoute: string;
  hiddenRoutes?: readonly string[];
};

/**
 * Resolve progress from the mounted route order, never from an answer count.
 * This preserves preview branch behavior on Back and resume while providing a
 * single helper for future canonical branch migrations.
 */
export function resolveCanonicalProgress(
  routeOrder: readonly string[],
  currentRoute: string,
  options: { hiddenRoutes?: readonly string[] } = {},
): CanonicalProgress {
  return resolveCanonicalProgressSnapshot({ routeOrder, currentRoute, hiddenRoutes: options.hiddenRoutes });
}

export function resolveCanonicalProgressSnapshot({
  routeOrder,
  currentRoute,
  hiddenRoutes = [],
}: CanonicalProgressRequest): CanonicalProgress {
  const hidden = new Set(hiddenRoutes);
  const visible = routeOrder.filter((route) => !hidden.has(route));
  const total = Math.max(visible.length - 1, 1);
  const index = visible.indexOf(currentRoute);
  return { answered: index < 0 ? 0 : Math.min(index, total), total };
}
