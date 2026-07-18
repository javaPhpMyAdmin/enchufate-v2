/**
 * Theme — single import surface for every token.
 *
 *   import { colors, spacing, radius, typography, shadows } from '@/theme';
 *
 * The bundled `theme` object groups all five so consumers that
 * need several at once (e.g. Card) don't have to destructure.
 */
export { colors } from './colors';
export type { ColorToken } from './colors';

export { spacing } from './spacing';
export type { SpacingToken } from './spacing';

export { radius } from './radius';
export type { RadiusToken } from './radius';

export { typography } from './typography';
export type { TypographyToken } from './typography';

export { shadows } from './shadows';
export type { ShadowToken } from './shadows';

import { colors as _colors } from './colors';
import { spacing as _spacing } from './spacing';
import { radius as _radius } from './radius';
import { typography as _typography } from './typography';
import { shadows as _shadows } from './shadows';

export const theme = {
  colors: _colors,
  spacing: _spacing,
  radius: _radius,
  typography: _typography,
  shadows: _shadows,
} as const;

export type Theme = typeof theme;
