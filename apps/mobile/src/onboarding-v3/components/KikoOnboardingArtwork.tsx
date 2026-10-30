import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  getKikoOnboardingSource,
  hasKikoMomentArtwork,
  kikoOnboardingInventory,
  kikoSizeRoles,
  type KikoOnboardingAssetId,
  type KikoSizeRole,
} from '../assets/kikoOnboardingRegistry';
import { ResilientImage } from '../../components/ResilientImage';
import { useMascotName } from '../../state/useMascotName';

const momentDescriptions: Readonly<Record<string, string>> = {
  'annual-spending-reveal': 'looking surprised',
  'savings-demonstration': 'looking curious',
  'favorite-foods-reveal': 'holding a salmon and vegetable meal',
  'macro-transformation': 'thinking about your plan',
  'post-purchase-first-scan': 'waving hello',
};

export function KikoOnboardingArtwork({ assetId, moment, sizeRole, style }: {
  assetId: KikoOnboardingAssetId;
  moment?: string;
  sizeRole: KikoSizeRole;
  style?: StyleProp<ViewStyle>;
}) {
  const mascotName = useMascotName();
  const { width } = useWindowDimensions();
  const size = kikoSizeRoles[sizeRole];
  const displayWidth = Math.min(size.maximum, Math.max(size.minimum, width * size.responsiveWidth));
  const metadata = kikoOnboardingInventory.find((asset) => asset.id === assetId);
  const aspectRatio = hasKikoMomentArtwork(moment) ? 1 : metadata?.aspectRatio ?? 1;
  const description = (moment && momentDescriptions[moment]) || metadata?.mood || 'supporting the story';

  return (
    <View accessibilityLabel={`${mascotName}, ${description}`} accessibilityRole="image" style={[{ aspectRatio, width: displayWidth }, style]}>
      <ResilientImage assetKind="mascot" componentName="KikoOnboardingArtwork" contentFit="contain" imageId={`kiko:${moment ?? assetId}`} source={getKikoOnboardingSource(assetId, moment)} style={StyleSheet.absoluteFill} />
    </View>
  );
}
