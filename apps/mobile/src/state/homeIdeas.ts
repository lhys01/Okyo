export type HomeIdeasPeriod = 'overnight' | 'morning' | 'afternoon' | 'dinner';

const IDEAS_BY_PERIOD = Object.freeze({
  overnight: ['rec-scrambled-eggs-toast', 'rec-berry-banana-smoothie'],
  morning: ['rec-scrambled-eggs-toast', 'rec-crispy-tofu-power-bowl'],
  afternoon: ['rec-greek-salad', 'rec-creamy-tomato-rigatoni'],
  dinner: ['rec-smash-cheeseburger', 'rec-sheet-pan-lemon-chicken'],
} as const);

export function getHomeIdeasPeriod(localHour: number): HomeIdeasPeriod {
  const hour = Math.max(0, Math.min(23, Math.floor(localHour)));
  if (hour < 4) return 'overnight';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'dinner';
}

/** Returns a deterministic pair using the device's local hour, never UTC. */
export function getHomeIdeaIdsForLocalHour(localHour: number): readonly [string, string] {
  return IDEAS_BY_PERIOD[getHomeIdeasPeriod(localHour)];
}
