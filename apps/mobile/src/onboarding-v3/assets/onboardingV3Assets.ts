import { Image as ExpoImage } from 'expo-image';
import { Image as ReactNativeImage } from 'react-native';

export const onboardingV3Assets: Readonly<Record<string, number>> = Object.freeze({
  approvedHeroArtwork: require('../../../assets/onboarding-approved/reach-your-food-goals-sticker.png'),
  // Derived screen-only exports. The supplied source PNGs remain untouched;
  // these assets remove the embedded device frame before rendering in-app.
  approvedOnboarding3: require('../../../assets/onboarding ex/onboarding3-screen.png'),
  approvedOnboarding4: require('../../../assets/onboarding ex/onboarding4-screen.png'),
  approvedOnboarding5: require('../../../assets/onboarding ex/onboarding5-screen.png'),
  approvedOnboarding1: require('../../../assets/splash/okyo-loading.png'),
  approvedOnboarding2: require('../../../assets/onboarding ex/onboarding2.png'),
  onboarding2GranolaCarouselArtwork: require('../../../assets/onboarding-v3/onboarding2-granola-carousel-artwork.png'),
  approvedSalmonRecipeValueArtwork: require('../../../assets/onboarding-v3/approved-salmon-recipe-value-artwork.png'),
  onboarding3CarouselArtwork: require('../../../assets/onboarding-v3/onboarding3-carousel-artwork-sticker.png'),
  onboarding4CarouselArtwork: require('../../../assets/onboarding-v3/onboarding4-carousel-artwork.png'),
  onboarding5CarouselArtwork: require('../../../assets/onboarding-v3/onboarding5-carousel-artwork.png'),
  onboarding6KikoMark: require('../../../assets/onboarding-ex-transparent/o6-kiko-mark-sticker.png'),
  approachScanCard: require('../../../assets/onboarding-ex-transparent/o8-card-scan.png'),
  approachMacrosCard: require('../../../assets/onboarding-ex-transparent/o8-card-macros.png'),
  approachCustomizeCard: require('../../../assets/onboarding-ex-transparent/o8-card-customize.png'),
  meetKikoHero: require('../../../assets/onboarding-ex-transparent/o10-kiko-hero-sticker.png'),
  meetKikoHeroUpdated: require('../../../assets/onboarding-ex-transparent/o10-kiko-updated-sticker.png'),
  doodleCarrot: require('../../../assets/onboarding-ex-transparent/o10-doodle-carrot.png'),
  doodleMushroom: require('../../../assets/onboarding-ex-transparent/o10-doodle-mushroom.png'),
  doodleHerb: require('../../../assets/onboarding-ex-transparent/o10-doodle-herb.png'),
  doodleFishbone: require('../../../assets/onboarding-ex-transparent/o10-doodle-fishbone.png'),
  doodleAppleCore: require('../../../assets/onboarding-ex-transparent/o10-doodle-applecore.png'),
  doodleSparkle: require('../../../assets/onboarding-ex-transparent/o10-doodle-sparkle.png'),
  doodleSquiggle: require('../../../assets/onboarding-ex-transparent/o10-doodle-squiggle.png'),
  nameFoxKikoPeek: require('../../../assets/onboarding-ex-transparent/o11-kiko-peek-sticker.png'),
  nameFoxKikoPeekUpdated: require('../../../assets/onboarding-ex-transparent/o11-kiko-updated-sticker.png'),
  nameFoxReference: require('../../../assets/kiko-transparent/kiko-paw-raised-sticker.png'),
  welcomeArtwork: require('../../../assets/onboarding-v3/welcome.png'),
  stickerSparkle: require('../../../assets/onboarding-v3/sticker-sparkle.png'),
  stickerHeart: require('../../../assets/onboarding-v3/sticker-heart.png'),
  stickerPaw: require('../../../assets/onboarding-v3/sticker-paw.png'),
  saveMoneyIntro: require('../../../assets/kiko-transparent/kiko-curious-sticker.png'),
  saveMoneyRevealReaction: require('../../../assets/kiko-transparent/kiko-sitting-front-sticker.png'),
  saveMoneyFrequency: require('../../../assets/onboarding-v3/stickers/fox-checklist-hd.png'),
  saveMoneyCost: require('../../../assets/kiko-transparent/kiko-curious-sticker.png'),
  saveMoneyFriction: require('../../../assets/kiko-transparent/kiko-thoughtful-sticker.png'),
  saveMoneyEncouragement: require('../../../assets/onboarding-v3/stickers/fox-face-happy.png'),
  saveMoneyMeals: require('../../../assets/onboarding-v3/stickers/fox-holding-carrot.png'),
  saveMoneyReplacement: require('../../../assets/onboarding-v3/stickers/fox-chef-alt.png'),
  saveMoneyPriority: require('../../../assets/onboarding-v3/stickers/fox-cooking-laptop.png'),
  saveMoneyReassurance: require('../../../assets/kiko-transparent/kiko-holding-bowl-sticker.png'),
  saveMoneyReassuranceKiko: require('../../../assets/kiko-transparent/kiko-paw-raised-sticker.png'),
  saveMoneyReassuranceBowl: require('../../../assets/onboarding-v3/stickers/accent-food-bowl.png'),
  saveMoneyHousehold: require('../../../assets/onboarding-v3/stickers/fox-serving-bowl.png'),
  saveMoneyReveal: require('../../../assets/onboarding-v3/stickers/fox-checklist-hd.png'),
  saveMoneyComplete: require('../../../assets/onboarding-v3/save-money/save-money-kiko-celebrate.png'),
  saveMoneyPlanMeal: require('../../../assets/food/recipes/teriyaki-chicken-bowl.png'),
  // Reused, approved source artwork for the native Eat Healthier visual beats.
  // These are intentionally independent so the food and Kiko can responsively
  // overlap without embedding a reference screen image.
  healthPizza: require('../../../assets/food/recipes/margherita-flatbread-pizza.png'),
  healthBalancedMeal: require('../../../assets/food/recipes/pan-seared-salmon-dill.png'),
  // Health branch uses the supplied extracted sticker artwork consistently;
  // keep these aliases screen-specific so its visual layer never falls back
  // to the older mascot sheet.
  healthKikoFlex: require('../../../assets/onboarding-v3/stickers/fox-waving-alt-hd.png'),
  healthKikoRamen: require('../../../assets/onboarding-v3/stickers/fox-holding-bowl.png'),
  healthKikoRecipe: require('../../../assets/onboarding-v3/stickers/fox-checklist-hd.png'),
  healthQuestionMeaning: require('../../../assets/onboarding-v3/stickers/fox-holding-bowl.png'),
  healthQuestionBarrier: require('../../../assets/kiko-transparent/kiko-thoughtful-sticker.png'),
  healthQuestionTradeoff: require('../../../assets/onboarding-v3/stickers/fox-heart-hug.png'),
  healthQuestionStyles: require('../../../assets/onboarding-v3/stickers/fox-cooking-laptop.png'),
  healthQuestionDealbreaker: require('../../../assets/onboarding-v3/stickers/fox-winking.png'),
  healthQuestionFrequency: require('../../../assets/onboarding-v3/stickers/fox-drinking-water.png'),
  healthQuestionMeal: require('../../../assets/kiko-transparent/kiko-holding-bowl-sticker.png'),
  iconbreakfast: require('../../../assets/onboarding-v3/meal-icons/iconbreakfast-transparent.png'),
  iconlunch: require('../../../assets/onboarding-v3/meal-icons/iconlunch-transparent.png'),
  icondinner: require('../../../assets/onboarding-v3/meal-icons/icondinner-transparent.png'),
  iconsnacks: require('../../../assets/onboarding-v3/meal-icons/iconsnacks-transparent.png'),
  iconvaries: require('../../../assets/onboarding-v3/meal-icons/iconvaries-transparent.png'),
  // Eat Healthier redesign — one distinct Kiko pose per screen, drawn only from
  // assets/onboarding-v3/stickers. No pose is reused across the branch.
  healthIntro: require('../../../assets/kiko-transparent/kiko-paw-raised-sticker.png'),
  healthMeaning: require('../../../assets/kiko-transparent/kiko-curious-sticker.png'),
  healthMeaningInsight: require('../../../assets/onboarding-v3/stickers/fox-holding-bowl.png'),
  healthBarrier: require('../../../assets/kiko-transparent/kiko-thoughtful-sticker.png'),
  healthBarrierResponse: require('../../../assets/onboarding-v3/stickers/fox-chef-hd.png'),
  healthMeal: require('../../../assets/kiko-transparent/kiko-holding-bowl-sticker.png'),
  healthMealInsight: require('../../../assets/onboarding-v3/stickers/fox-holding-carrot.png'),
  healthFoodStyle: require('../../../assets/onboarding-v3/stickers/fox-cooking-laptop.png'),
  healthReassurance: require('../../../assets/onboarding-v3/stickers/fox-heart-hug.png'),
  healthApproach: require('../../../assets/onboarding-v3/stickers/fox-checklist-hd.png'),
  healthWhatOkyo: require('../../../assets/onboarding-v3/stickers/fox-chef-alt.png'),
  healthCommitment: require('../../../assets/onboarding-v3/stickers/fox-sitting-happy.png'),
  healthReveal: require('../../../assets/onboarding-v3/stickers/fox-carrot-heart.png'),
  healthPlanHero: require('../../../assets/kiko-transparent/kiko-holding-bowl-sticker.png'),
  macrosDiagnosis: require('../../../assets/kiko-transparent/kiko-thoughtful-sticker.png'),
  // Deterministic transparent crops from the four supplied Health references.
  healthReferenceIntro: require('../../../assets/onboarding-v3/health-reference/kiko-health-intro.png'),
  healthReferenceApproach: require('../../../assets/onboarding-v3/health-reference/kiko-approach.png'),
  healthReferenceCarrot: require('../../../assets/onboarding-v3/health-reference/kiko-carrot.png'),
  healthReferenceComplete: require('../../../assets/onboarding-v3/health-reference/kiko-plan-complete.png'),
  // Exact supplied fox artwork, rendered from offline transparent copies so
  // the source PNGs' white canvas never appears as a screen-level rectangle.
  cutefox: require('../../../assets/onboarding-v3/cutefox/cutefox.png'),
  cutefox1: require('../../../assets/onboarding-v3/cutefox/cutefox.png'),
  cutefox2: require('../../../assets/onboarding-v3/cutefox/cutefox2.png'),
  cutefox3: require('../../../assets/onboarding-v3/cutefox/cutefox3.png'),
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
  macrosFavoriteKiko: require('../../../assets/kiko-transparent/kiko-paw-raised-sticker.png'),
  macrosExampleKiko: require('../../../assets/kiko-transparent/kiko-curious-sticker.png'),
  macrosPlanKiko: require('../../../assets/onboarding-v3/stickers/fox-checklist-hd.png'),
  macrosCaloriesIcon: require('../../../assets/food/macros/calories-kcal.png'),
  macrosProteinIcon: require('../../../assets/food/macros/protein-dumbbell.png'),
  macrosCarbsIcon: require('../../../assets/food/macros/carbs-bread.png'),
  macrosFatIcon: require('../../../assets/food/macros/fat-droplet.png'),
  // Hit my macros redesign — one distinct Kiko pose per screen, drawn only from
  // assets/onboarding-v3/stickers. No pose is reused across the branch.
  macrosIntro: require('../../../assets/onboarding-v3/stickers/fox-running-hd.png'),
  macrosFocus: require('../../../assets/kiko-transparent/kiko-curious-sticker.png'),
  macrosFocusInsight: require('../../../assets/onboarding-v3/stickers/fox-checklist-hd.png'),
  macrosCalorie: require('../../../assets/onboarding-v3/stickers/fox-laptop-alt.png'),
  macrosCalorieInsight: require('../../../assets/onboarding-v3/stickers/fox-sitting-alt.png'),
  macrosBarrier: require('../../../assets/kiko-transparent/kiko-thoughtful-sticker.png'),
  macrosBarrierResponse: require('../../../assets/onboarding-v3/stickers/fox-chef-hd.png'),
  macrosMeal: require('../../../assets/kiko-transparent/kiko-holding-bowl-sticker.png'),
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
