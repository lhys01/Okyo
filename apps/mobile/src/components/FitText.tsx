import { Text, type TextProps } from 'react-native';

/** One-line text that keeps its size unless fixed-width content needs to shrink. */
export function FitText({ minimumFontScale = 0.65, numberOfLines = 1, ...props }: TextProps) {
  return (
    <Text {...props} adjustsFontSizeToFit minimumFontScale={minimumFontScale} numberOfLines={numberOfLines} />
  );
}
