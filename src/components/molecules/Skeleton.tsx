/**
 * Skeleton — pulsing rectangle used as a content placeholder while a
 * query is in flight.
 *
 * **Why RN Animated, not Reanimated 4** — Phase 8 explicitly bans
 * Reanimated 4 (the version pinned in this Expo SDK 54 install) because
 * the project standard is Reanimated 3 / RN Animated, and a one-off
 * pulse doesn't justify adding a worklets runtime dependency just for
 * opacity. RN Animated is built in, no install required.
 *
 * **Pulse** — opacity 0.5 → 1.0 over 1200ms, `useNativeDriver: true`
 * so the animation runs on the UI thread (no JS hop per frame).
 *
 * **Shape** — `width` accepts a fixed pixel number OR a `${number}%`
 * template (e.g. `'100%'`) for full-width strips. The `Animated.View`
 * style only supports those two shapes; pass `style={{ width: ... }}`
 * instead if you need something exotic. `borderRadius` defaults to
 * the design `radius.button` (12) so a card-shaped skeleton lines up
 * with a Card below it.
 */
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native';

import { colors, radius } from '@/theme';

const PULSE_DURATION_MS = 1200;
const PULSE_MIN = 0.5;
const PULSE_MAX = 1.0;

export type SkeletonWidth = number | `${number}%`;

export interface SkeletonProps {
  width: SkeletonWidth;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({
  width,
  height,
  borderRadius = radius.button,
  style,
}: SkeletonProps): React.JSX.Element {
  const opacity = useRef(new Animated.Value(PULSE_MIN)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: PULSE_MAX,
          duration: PULSE_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: PULSE_MIN,
          duration: PULSE_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        { width, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
