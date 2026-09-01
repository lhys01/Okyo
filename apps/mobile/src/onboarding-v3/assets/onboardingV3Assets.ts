import { Image as ExpoImage } from 'expo-image';
import { Image as ReactNativeImage } from 'react-native';

export const onboardingV3Assets: Readonly<Record<string, number>> = Object.freeze({
  approvedHeroArtwork: require('../../../assets/onboarding-approved/reach-your-food-goals.png'),
  // Derived screen-only exports. The supplied source PNGs remain untouched;
  // these assets remove the embedded device frame before rendering in-app.
  approvedOnboarding3: require('../../../assets/onboarding ex/onboarding3-screen.png'),
  approvedOnboarding4: require('../../../assets/onboarding ex/onboarding4-screen.png'),
  approvedOnboarding5: require('../../../assets/onboarding ex/onboarding5-screen.png'),
  approvedOnboarding1: require('../../../assets/onboarding ex/onboarding1.png'),
  approvedOnboarding2: require('../../../assets/onboarding ex/onboarding2.png'),
  onboarding2GranolaCarouselArtwork: require('../../../assets/onboarding-v3/onboarding2-granola-carousel-artwork.png'),
  approvedSalmonRecipeValueArtwork: require('../../../assets/onboarding-v3/approved-salmon-recipe-value-artwork.png'),
  onboarding3CarouselArtwork: require('../../../assets/onboarding-v3/onboarding3-carousel-artwork.png'),
  onboarding4CarouselArtwork: require('../../../assets/onboarding-v3/onboarding4-carousel-artwork.png'),
  onboarding5CarouselArtwork: require('../../../assets/onboarding-v3/onboarding5-carousel-artwork.png'),
  onboarding6KikoMark: require('../../../assets/onboarding-ex-transparent/o6-kiko-mark.png'),
  approachScanCard: require('../../../assets/onboarding-ex-transparent/o8-card-scan.png'),
  approachMacrosCard: require('../../../assets/onboarding-ex-transparent/o8-card-macros.png'),
  approachCustomizeCard: require('../../../assets/onboarding-ex-transparent/o8-card-customize.png'),
  meetKikoHero: require('../../../assets/onboarding-ex-transparent/o10-kiko-hero.png'),
  meetKikoHeroUpdated: require('../../../assets/onboarding-ex-transparent/o10-kiko-updated.png'),
  doodleCarrot: require('../../../assets/onboarding-ex-transparent/o10-doodle-carrot.png'),
  doodleMushroom: require('../../../assets/onboarding-ex-transparent/o10-doodle-mushroom.png'),
  doodleHerb: require('../../../assets/onboarding-ex-transparent/o10-doodle-herb.png'),
  doodleFishbone: require('../../../assets/onboarding-ex-transparent/o10-doodle-fishbone.png'),
  doodleAppleCore: require('../../../assets/onboarding-ex-transparent/o10-doodle-applecore.png'),
  doodleSparkle: require('../../../assets/onboarding-ex-transparent/o10-doodle-sparkle.png'),
  doodleSquiggle: require('../../../assets/onboarding-ex-transparent/o10-doodle-squiggle.png'),
  nameFoxKikoPeek: require('../../../assets/onboarding-ex-transparent/o11-kiko-peek.png'),
  nameFoxKikoPeekUpdated: require('../../../assets/onboarding-ex-transparent/o11-kiko-updated.png'),
  nameFoxReference: require('../../../assets/onboarding-v3/stickers/fox-waving-alt.png'),
  welcomeArtwork: require('../../../assets/onboarding-v3/welcome.png'),
  stickerSparkle: require('../../../assets/onboarding-v3/sticker-sparkle.png'),
  stickerHeart: require('../../../assets/onboarding-v3/sticker-heart.png'),
  stickerPaw: require('../../../assets/onboarding-v3/sticker-paw.png'),
  saveMoneyIntro: require('../../../assets/onboarding-v3/stickers/fox-chef.png'),
  saveMoneyFrequency: require('../../../assets/onboarding-v3/stickers/fox-checklist.png'),
  saveMoneyCost: require('../../../assets/onboarding-v3/stickers/fox-questioning.png'),
  saveMoneyFriction: require('../../../assets/onboarding-v3/stickers/fox-questioning.png'),
  saveMoneyEncouragement: require('../../../assets/onboarding-v3/stickers/fox-face-happy.png'),
  saveMoneyMeals: require('../../../assets/onboarding-v3/stickers/fox-holding-carrot.png'),
  saveMoneyReplacement: require('../../../assets/onboarding-v3/stickers/fox-chef-alt.png'),
  saveMoneyPriority: require('../../../assets/onboarding-v3/stickers/fox-cooking-laptop.png'),
  saveMoneyReassurance: require('../../../assets/onboarding-v3/stickers/fox-holding-bowl.png'),
  saveMoneyReassuranceKiko: require('../../../assets/onboarding-v3/stickers/fox-waving.png'),
  saveMoneyReassuranceBowl: require('../../../assets/onboarding-v3/stickers/accent-food-bowl.png'),
  saveMoneyHousehold: require('../../../assets/onboarding-v3/stickers/fox-serving-bowl.png'),
  saveMoneyReveal: require('../../../assets/onboarding-v3/stickers/fox-checklist.png'),
  saveMoneyComplete: require('../../../assets/onboarding-v3/stickers/fox-celebrating.png'),
  // Reused, approved source artwork for the native Eat Healthier visual beats.
  // These are intentionally independent so the food and Kiko can responsively
  // overlap without embedding a reference screen image.
  healthPizza: require('../../../assets/food/recipes/margherita-flatbread-pizza.png'),
  healthBalancedMeal: require('../../../assets/food/recipes/pan-seared-salmon-dill.png'),
  // Health branch uses the supplied extracted sticker artwork consistently;
  // keep these aliases screen-specific so its visual layer never falls back
  // to the older mascot sheet.
  healthKikoFlex: require('../../../assets/onboarding-v3/stickers/fox-waving-alt.png'),
  healthKikoRamen: require('../../../assets/onboarding-v3/stickers/fox-holding-bowl.png'),
  healthKikoRecipe: require('../../../assets/onboarding-v3/stickers/fox-checklist.png'),
  healthQuestionMeaning: require('../../../assets/onboarding-v3/stickers/fox-holding-bowl.png'),
  healthQuestionBarrier: require('../../../assets/onboarding-v3/stickers/fox-questioning.png'),
  healthQuestionTradeoff: require('../../../assets/onboarding-v3/stickers/fox-heart-hug.png'),
  healthQuestionStyles: require('../../../assets/onboarding-v3/stickers/fox-cooking-laptop.png'),
  healthQuestionDealbreaker: require('../../../assets/onboarding-v3/stickers/fox-winking.png'),
  healthQuestionFrequency: require('../../../assets/onboarding-v3/stickers/fox-drinking-water.png'),
  healthQuestionMeal: require('../../../assets/onboarding-v3/stickers/fox-serving-bowl.png'),
  // Eat Healthier redesign — one distinct Kiko pose per screen, drawn only from
  // assets/onboarding-v3/stickers. No pose is reused across the branch.
  healthIntro: require('../../../assets/onboarding-v3/stickers/fox-waving-alt.png'),
  healthMeaning: require('../../../assets/onboarding-v3/stickers/fox-questioning.png'),
  healthMeaningInsight: require('../../../assets/onboarding-v3/stickers/fox-holding-bowl.png'),
  healthBarrier: require('../../../assets/onboarding-v3/stickers/fox-profile.png'),
  healthBarrierResponse: require('../../../assets/onboarding-v3/stickers/fox-chef.png'),
  healthMeal: require('../../../assets/onboarding-v3/stickers/fox-serving-bowl.png'),
  healthMealInsight: require('../../../assets/onboarding-v3/stickers/fox-holding-carrot.png'),
  healthFoodStyle: require('../../../assets/onboarding-v3/stickers/fox-cooking-laptop.png'),
  healthReassurance: require('../../../assets/onboarding-v3/stickers/fox-heart-hug.png'),
  healthApproach: require('../../../assets/onboarding-v3/stickers/fox-checklist.png'),
  healthWhatOkyo: require('../../../assets/onboarding-v3/stickers/fox-chef-alt.png'),
  healthCommitment: require('../../../assets/onboarding-v3/stickers/fox-sitting-happy.png'),
  healthReveal: require('../../../assets/onboarding-v3/stickers/fox-carrot-heart.png'),
  healthPlanHero: require('../../../assets/onboarding-v3/stickers/fox-celebrating.png'),
  healthAccentHeart: require('../../../assets/onboarding-v3/stickers/accent-heart.png'),
  healthAccentSparkle: require('../../../assets/onboarding-v3/stickers/accent-sparkle.png'),
  healthAccentBowl: require('../../../assets/onboarding-v3/stickers/accent-food-bowl.png'),
  valuePastaBowl: require('../../../assets/onboarding-ex-transparent/o2-pasta-bowl.png'),
  saveMoneyGraphSparkle: require('../../../assets/onboarding-v3/stickers/accent-sparkle.png'),
  approachHeroSticker: require('../../../assets/onboarding-v3/stickers/fox-holding-bowl.png'),
  macrosFavoriteFood: require('../../../assets/food/recipes/margherita-flatbread-pizza.png'),
  // A balanced, everyday salmon and vegetables plate for the Macros nutrition
  // reassurance moment. This deliberately avoids the former dessert artwork.
  macrosNutritionMeal: require('../../../assets/food/recipes/pan-seared-salmon-dill.png'),
  macrosFavoriteKiko: require('../../../assets/onboarding-v3/stickers/fox-waving-alt.png'),
  macrosExampleKiko: require('../../../assets/onboarding-v3/stickers/fox-questioning.png'),
  macrosPlanKiko: require('../../../assets/onboarding-v3/stickers/fox-checklist.png'),
  macrosCaloriesIcon: require('../../../assets/food/macros/calories-kcal.png'),
  macrosProteinIcon: require('../../../assets/food/macros/protein-dumbbell.png'),
  macrosCarbsIcon: require('../../../assets/food/macros/carbs-bread.png'),
  macrosFatIcon: require('../../../assets/food/macros/fat-droplet.png'),
  // Hit my macros redesign — one distinct Kiko pose per screen, drawn only from
  // assets/onboarding-v3/stickers. No pose is reused across the branch.
  macrosIntro: require('../../../assets/onboarding-v3/stickers/fox-running.png'),
  macrosFocus: require('../../../assets/onboarding-v3/stickers/fox-questioning.png'),
  macrosFocusInsight: require('../../../assets/onboarding-v3/stickers/fox-checklist.png'),
  macrosCalorie: require('../../../assets/onboarding-v3/stickers/fox-laptop-alt.png'),
  macrosCalorieInsight: require('../../../assets/onboarding-v3/stickers/fox-sitting-alt.png'),
  macrosBarrier: require('../../../assets/onboarding-v3/stickers/fox-profile.png'),
  macrosBarrierResponse: require('../../../assets/onboarding-v3/stickers/fox-chef.png'),
  macrosMeal: require('../../../assets/onboarding-v3/stickers/fox-serving-bowl.png'),
  macrosMealInsight: require('../../../assets/onboarding-v3/stickers/fox-holding-bowl.png'),
  macrosTracking: require('../../../assets/onboarding-v3/stickers/fox-cooking-laptop.png'),
  macrosApproach: require('../../../assets/onboarding-v3/stickers/fox-backpack.png'),
  macrosWhatOkyo: require('../../../assets/onboarding-v3/stickers/fox-chef-alt.png'),
  macrosCommitment: require('../../../assets/onboarding-v3/stickers/fox-sitting-happy.png'),
  macrosReveal: require('../../../assets/onboarding-v3/stickers/fox-flying-heart.png'),
  macrosPlanHero: require('../../../assets/onboarding-v3/stickers/fox-waving-burst.png'),
  macrosAccentSparkle: require('../../../assets/onboarding-v3/stickers/accent-sparkle.png'),
  macrosAccentMotion: require('../../../assets/onboarding-v3/stickers/accent-motion-lines.png'),
  macrosAccentPaw: require('../../../assets/onboarding-v3/stickers/accent-paw.png'),
});

// Individual transparent exports from the supplied sticker sheets. Keeping these
// as separate requires lets screens place each sticker without rendering a sheet.
export const onboardingStickerAssets = Object.freeze([
  require('../../../assets/onboarding-v3/stickers/sticker-01.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-02.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-03.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-04.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-05.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-06.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-07.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-08.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-09.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-10.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-11.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-12.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-13.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-14.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-15.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-16.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-17.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-18.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-19.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-20.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-21.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-22.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-23.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-24.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-25.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-26.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-27.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-28.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-29.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-30.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-31.png'),
  require('../../../assets/onboarding-v3/stickers/sticker-32.png'),
] as const);

export type OnboardingV3AssetKey = keyof typeof onboardingV3Assets;

export async function prefetchOnboardingV3Assets(keys: readonly OnboardingV3AssetKey[]): Promise<void> {
  const urls = keys
    .map((key) => onboardingV3Assets[key])
    .filter((source): source is number => typeof source === 'number')
    .map((source) => ReactNativeImage.resolveAssetSource(source).uri);
  await ExpoImage.prefetch(urls, { cachePolicy: 'memory-disk' });
}
