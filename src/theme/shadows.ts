import { Platform, type ViewStyle } from 'react-native';

import { colors } from './colors';

/**
 * Shadow scale per design.md §5.1 (card variant).
 * Cross-platform: iOS uses shadow* props, Android uses elevation.
 */
function buildShadow(
  offsetY: number,
  radius: number,
  opacity: number,
  elevation: number,
): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
    android: { elevation },
    default: {},
  }) as ViewStyle;
}

export const shadows = {
  none: {} as ViewStyle,
  card: buildShadow(2, 8, 0.06, 2),
} as const;

export type ShadowToken = keyof typeof shadows;
