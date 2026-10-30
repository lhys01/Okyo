import { Animated, StyleSheet } from 'react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';

export const SPOTLIGHT_SCRIM_COLOR = 'rgba(34, 32, 36, 0.22)';

export type ShapedRect = { x: number; y: number; width: number; height: number; borderRadius: number; noBorder?: boolean };

/**
 * A single true SVG mask cutting real, shape-matched holes in the scrim —
 * never four rectangular dimming bands. `pointerEvents="none"` throughout:
 * this layer is purely visual, so the real app underneath stays scrollable
 * and tappable everywhere, including inside the cutout.
 */
export function SpotlightMask({ opacity, rects, screenHeight, screenWidth }: { rects: readonly ShapedRect[]; screenWidth: number; screenHeight: number; opacity: Animated.Value }) {
  const maskId = 'okyo-tour-spotlight-mask';
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
      <Svg height={screenHeight} width={screenWidth}>
        <Defs>
          <Mask
            id={maskId}
            height={screenHeight}
            maskContentUnits="userSpaceOnUse"
            maskUnits="userSpaceOnUse"
            width={screenWidth}
            x={0}
            y={0}
          >
            <Rect fill="#fff" height={screenHeight} width={screenWidth} x={0} y={0} />
            {rects.map((r, i) => (
              // eslint-disable-next-line react/no-array-index-key -- cutouts have no identity beyond position in this frame
              <Rect key={i} fill="#000" height={r.height} rx={r.borderRadius} ry={r.borderRadius} width={r.width} x={r.x} y={r.y} />
            ))}
          </Mask>
        </Defs>
        <Rect fill={SPOTLIGHT_SCRIM_COLOR} height={screenHeight} mask={`url(#${maskId})`} width={screenWidth} x={0} y={0} />
      </Svg>
    </Animated.View>
  );
}
