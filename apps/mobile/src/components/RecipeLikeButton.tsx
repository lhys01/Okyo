import { Heart, HeartSolid } from 'iconoir-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, fontFamilies } from './OkyoUI';

type RecipeLikeButtonProps = {
  isLiked: boolean;
  onToggle: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function RecipeLikeButton({
  compact = false,
  isLiked,
  onToggle,
  style,
}: RecipeLikeButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  const toggle = () => {
    onToggle();
    if (isLiked || reduceMotion) {
      return;
    }

    scale.stopAnimation();
    Animated.sequence([
      Animated.timing(scale, { duration: 70, toValue: 0.9, useNativeDriver: true }),
      Animated.spring(scale, {
        friction: 4,
        tension: 210,
        toValue: 1.16,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        friction: 5,
        tension: 180,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const Icon = isLiked ? HeartSolid : Heart;
  const accessibilityLabel = isLiked ? 'Unlike recipe' : 'Like recipe';

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected: isLiked }}
      hitSlop={compact ? 8 : 0}
      onPress={toggle}
      style={({ pressed }) => [
        styles.button,
        compact ? styles.buttonCompact : null,
        isLiked ? styles.buttonLiked : null,
        pressed ? styles.pressed : null,
        style,
      ]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Icon color={colors.coral} height={compact ? 23 : 21} strokeWidth={2.2} width={compact ? 23 : 21} />
      </Animated.View>
      {!compact ? (
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.label}>{isLiked ? 'Liked' : 'Like'}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: '#FFFFFFB8',
    borderColor: '#E9DDD5',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 58,
    minWidth: 0,
    paddingHorizontal: 12,
  },
  buttonCompact: {
    borderRadius: 999,
    flex: 0,
    height: 44,
    minHeight: 44,
    paddingHorizontal: 0,
    width: 44,
  },
  buttonLiked: {
    backgroundColor: '#FFF0F4',
    borderColor: '#F5DDE6',
  },
  copy: {
    minWidth: 0,
  },
  label: {
    color: colors.coralDark,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
  },
});
