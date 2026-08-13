import { Image } from 'expo-image';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  getKikoOnboardingSource,
  kikoOnboardingInventory,
  kikoSizeRoles,
  type KikoOnboardingAssetId,
  type KikoSizeRole,
} from '../assets/kikoOnboardingRegistry';

export function KikoOnboardingArtwork({ assetId, sizeRole, style }: {
  assetId: KikoOnboardingAssetId;
  sizeRole: KikoSizeRole;
  style?: StyleProp<ViewStyle>;
}) {
  const { width } = useWindowDimensions();
  const size = kikoSizeRoles[sizeRole];
  const displayWidth = Math.min(size.maximum, Math.max(size.minimum, width * size.responsiveWidth));
  const metadata = kikoOnboardingInventory.find((asset) => asset.id === assetId);
  const aspectRatio = metadata?.aspectRatio ?? 1;

  return (
    <View accessibilityLabel={`Kiko, ${metadata?.mood ?? 'supporting the story'}`} accessibilityRole="image" style={[{ aspectRatio, width: displayWidth }, style]}>
      <Image contentFit="contain" source={getKikoOnboardingSource(assetId)} style={StyleSheet.absoluteFill} />
    </View>
  );
}
