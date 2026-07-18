import type { TextStyle } from 'react-native';

/**
 * Typography scale — every text style lives here.
 *
 * Each entry is a `TextStyle` fragment consumers can spread or
 * pass directly to a `Text` component. Per design.md §5.1:
 *   display (24/bold), title (22/bold), heading (18/semibold),
 *   body (16/regular), caption (14/regular), tab (12/medium)
 *
 * The `tab` style is the bottom-tab-bar label.
 */
const weight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

export const typography = {
  display: { fontSize: 24, lineHeight: 32, fontWeight: weight.bold },
  title: { fontSize: 22, lineHeight: 28, fontWeight: weight.bold },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: weight.semibold },
  body: { fontSize: 16, lineHeight: 24, fontWeight: weight.regular },
  caption: { fontSize: 14, lineHeight: 20, fontWeight: weight.regular },
  tab: { fontSize: 12, lineHeight: 16, fontWeight: weight.medium },
} as const satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof typography;
