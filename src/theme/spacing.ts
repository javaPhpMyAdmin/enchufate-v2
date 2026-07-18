/**
 * Spacing scale — 4px base, used for padding, margin, and gap.
 * Per design.md §5.1.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export type SpacingToken = keyof typeof spacing;
