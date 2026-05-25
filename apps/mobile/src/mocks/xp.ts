import type { Badge, LeaderboardEntry, XpEvent } from './types';

export const mockXpEvents: XpEvent[] = [
  { id: 'first-scan', label: 'First scan', points: 10 },
  { id: 'save-recipe', label: 'Save recipe', points: 5 },
  { id: 'export-grocery-list', label: 'Export grocery list', points: 10 },
  { id: 'start-dupe-challenge', label: 'Start Dupe Challenge', points: 15 },
  { id: 'complete-dupe-challenge', label: 'Complete Dupe Challenge', points: 40 },
  { id: 'upload-homemade-photo', label: 'Upload homemade photo', points: 20 },
  { id: 'share-card', label: 'Share card', points: 20 },
  { id: 'earn-8-match-score', label: 'Earn 8+/10 match score', points: 25 },
  { id: 'save-25-on-one-dupe', label: 'Save $25+ on one dupe', points: 25 },
  { id: 'complete-5-dupes', label: 'Complete 5 dupes', points: 50 },
];

export const mockBadges: Badge[] = [
  { id: 'first-dupe', name: 'First Dupe', description: 'Complete your first restaurant dupe.', unlocked: true },
  { id: 'nailed-it', name: 'Nailed It', description: 'Earn a 9+/10 match score.', unlocked: true },
  { id: 'budget-beast', name: 'Budget Beast', description: 'Save $25+ on one dupe.', unlocked: true },
  { id: 'pasta-hacker', name: 'Pasta Hacker', description: 'Make a pasta dupe at home.', unlocked: true },
  { id: 'healthy-swap-pro', name: 'Healthy Swap Pro', description: 'Complete a Healthy mode dupe.', unlocked: false },
  { id: 'grocery-exporter', name: 'Grocery Exporter', description: 'Export a grocery list.', unlocked: false },
  { id: '100-saved-club', name: '$100 Saved Club', description: 'Reach $100 in estimated savings.', unlocked: false },
];

export const mockLeaderboardEntries: LeaderboardEntry[] = [
  { id: 'leader-biggest-saver-1', rank: 1, displayName: 'Maya', category: 'Biggest Saver This Week', value: '$92 saved', xp: 420 },
  { id: 'leader-biggest-saver-2', rank: 2, displayName: 'Jordan', category: 'Best Match Score', value: '9.4/10 match', xp: 390 },
  { id: 'leader-biggest-saver-3', rank: 3, displayName: 'You', category: 'Biggest Saver This Week', value: '$74 saved', xp: 350 },
  { id: 'leader-most-dupes-4', rank: 4, displayName: 'Sam', category: 'Most Dupes Completed', value: '6 dupes', xp: 310 },
  { id: 'leader-rising-cook-5', rank: 5, displayName: 'Avery', category: 'Rising Cook', value: '+120 XP', xp: 295 },
];
