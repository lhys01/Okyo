import type { ComponentType } from 'react';

import { ResilientImage } from '../../components/ResilientImage';

type StickerIconProps = { color?: string; height?: number; width?: number; strokeWidth?: number };
export type StickerIcon = ComponentType<StickerIconProps>;
export type OnboardingIconName = keyof typeof sources;

const sources = {
  sun: require('../../../assets/onboarding-v3/iconsnew/onboarding-icon-sun.png'),
  meal: require('../../../assets/onboarding-v3/iconsnew/onboarding-icon-meal.png'),
  steak: require('../../../assets/onboarding-v3/iconsnew/onboarding-icon-steak.png'),
  proteinBar: require('../../../assets/onboarding-v3/iconsnew/onboarding-icon-protein-bar.png'),
  shuffle: require('../../../assets/onboarding-v3/iconsnew/onboarding-icon-shuffle.png'),
  timer: require('../../../assets/onboarding-v3/iconsnew/onboarding-icon-timer.png'),
  chat: require('../../../assets/onboarding-v3/iconsnew/onboarding-icon-chat.png'),
  pulse: require('../../../assets/onboarding-v3/iconsnew/onboarding-icon-pulse.png'),
  balance: require('../../../assets/onboarding-v3/iconsnew/onboarding-icon-balance.png'),
  apple: require('../../../assets/onboarding-v3/iconsnew/onboarding-icon-apple.png'),
  bread: require('../../../assets/onboarding-v3/iconsnew/onboarding-icon-bread.png'),
  portions: require('../../../assets/onboarding-v3/iconsnew/onboarding-icon-portions.png'),
  takeout: require('../../../assets/onboarding-v3/iconsnew/onboarding-icon-takeout.png'),
  coins: require('../../../assets/onboarding-v3/iconsnew/onboarding-icon-coins.png'),
  fish: require('../../../assets/onboarding-v3/iconsnew/onboarding-icon-fish.png'),
  flame: require('../../../assets/onboarding-v3/iconsnew/onboarding-icon-flame.png'),
  sparkle: require('../../../assets/onboarding-v3/iconsnew/onboarding-icon-sparkle.png'),
  leaf: require('../../../assets/onboarding-v3/iconsnew/onboarding-icon-leaf.png'),
  target: require('../../../assets/onboarding-v3/iconsnew/onboarding-icon-target.png'),
  bars: require('../../../assets/onboarding-v3/iconsnew/onboarding-icon-bars.png'),
} as const;

const ICON_OPTICAL_SCALE: Record<OnboardingIconName, number> = {
  sun: 1, meal: 1.05, steak: 1.1, proteinBar: 1.4, shuffle: 0.78,
  timer: 1.12, chat: 1, pulse: 0.98, balance: 0.96, apple: 1,
  bread: 0.92, portions: 0.94, takeout: 0.96, coins: 0.98, fish: 1.1,
  flame: 1, sparkle: 0.98, leaf: 0.98, target: 0.96, bars: 1,
};

function makeSticker(source: number): StickerIcon {
  const scale = Object.values(sources).indexOf(source) >= 0 ? ICON_OPTICAL_SCALE[Object.keys(sources)[Object.values(sources).indexOf(source)] as OnboardingIconName] : 1;
  return function Sticker({ height = 26, width = height }: StickerIconProps) {
    return <ResilientImage assetKind="icon" componentName="OnboardingStickerIcon" contentFit="contain" imageId="onboarding-sticker-icon" source={source} style={{ height: height * scale, width: width * scale }} />;
  };
}

export function OnboardingIcon({ icon, variant = 'option', size }: { icon: OnboardingIconName; variant?: 'option' | 'feature' | 'summary'; size?: number }) {
  const dimension = size ?? (variant === 'option' ? 26 : 25);
  const Icon = stickerIcons[icon];
  return <Icon height={dimension} width={dimension} />;
}

export const stickerIcons = Object.freeze(Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, makeSticker(source)])) as Record<keyof typeof sources, StickerIcon>);

// Semantic aliases keep existing answer IDs and component data readable while
// replacing the old line icons with the supplied sticker artwork.
export const SunLight = stickerIcons.sun;
export const Cutlery = stickerIcons.meal;
export const PizzaSlice = stickerIcons.steak;
export const Cookie = stickerIcons.proteinBar;
export const Shuffle = stickerIcons.shuffle;
export const Timer = stickerIcons.timer;
export const ChatBubbleQuestion = stickerIcons.chat;
export const Activity = stickerIcons.pulse;
export const MenuScale = stickerIcons.balance;
export const Apple = stickerIcons.apple;
export const BreadSlice = stickerIcons.bread;
export const ScaleFrameReduce = stickerIcons.portions;
export const ShoppingBag = stickerIcons.takeout;
export const Coins = stickerIcons.coins;
export const Fish = stickerIcons.fish;
export const FireFlame = stickerIcons.flame;
export const Sparks = stickerIcons.sparkle;
export const Leaf = stickerIcons.leaf;
export const Target = stickerIcons.target;
export const StatsUpSquare = stickerIcons.bars;
export const Weight = stickerIcons.steak;
export const LightBulb = stickerIcons.sparkle;
export const Repeat = stickerIcons.shuffle;
export const ClockRotateRight = stickerIcons.timer;
export const EmojiQuite = stickerIcons.sparkle;
export const EmojiSatisfied = stickerIcons.sparkle;
export const Flash = stickerIcons.sparkle;
export const List = stickerIcons.balance;
export const QuestionMark = stickerIcons.chat;
export const Hashtag = stickerIcons.bars;
export const Bed = stickerIcons.pulse;
export const Heart = stickerIcons.sparkle;
export const Dishwasher = stickerIcons.sparkle;
export const Package = stickerIcons.proteinBar;
export const User = stickerIcons.chat;
export const UserLove = stickerIcons.chat;
export const Group = stickerIcons.chat;
export const Community = stickerIcons.chat;
export const HouseRooms = stickerIcons.chat;
export const Home = stickerIcons.takeout;
