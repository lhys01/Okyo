import type { ShareCard } from './types';

export const mockShareCards: ShareCard[] = [
  {
    id: 'share-spicy-vodka-rigatoni',
    scanResultId: '001',
    kind: 'scan-result',
    headline: '$38 restaurant pasta -> $6.40 homemade dupe',
    subheadline: 'Saved ~$31.60',
    savedAmount: 31.6,
    matchScore: 8.4,
    footer: 'Made with Okyo',
  },
  {
    id: 'share-cheddar-biscuits',
    scanResultId: '002',
    kind: 'scan-result',
    headline: '$12 cheddar-style biscuits -> $2.50 homemade dupe',
    subheadline: 'Saved ~$9.50',
    savedAmount: 9.5,
    matchScore: 9.1,
    footer: 'Made with Okyo',
  },
  {
    id: 'share-cava-grain-bowl',
    scanResultId: '003',
    kind: 'scan-result',
    headline: '$17 Cava-style bowl -> $5.80 homemade dupe',
    subheadline: 'Saved ~$11.20',
    savedAmount: 11.2,
    matchScore: 8.2,
    footer: 'Made with Okyo',
  },
  {
    id: 'share-ranking-biggest-saver',
    kind: 'ranking',
    headline: '#3 Biggest Saver This Week',
    subheadline: '$74 saved making restaurant dupes',
    savedAmount: 74,
    footer: 'Made with Okyo',
  },
  {
    id: 'share-badge-nailed-it',
    kind: 'badge',
    headline: 'Nailed It Badge unlocked',
    subheadline: '9.1/10 match',
    matchScore: 9.1,
    footer: 'Made with Okyo',
  },
];

export const defaultShareCard = mockShareCards[0];
