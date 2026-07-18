/**
 * Color tokens — Enchufate brand palette.
 *
 * Single source of truth for every color rendered in the app. Per
 * AGENTS.md rule #4, no hex literal is allowed outside `src/theme/`.
 */
export const colors = {
  // Brand — electric orange
  primary: '#FF6B1F',
  primaryDisabled: '#FFB98E',
  primarySubtle: '#FFE6D5',

  // Text
  textPrimary: '#0F1419',
  textSecondary: '#6B7280',
  textOnPrimary: '#FFFFFF',

  // Semantic status
  success: '#1FA774',
  successSurface: '#D1FAE5',
  danger: '#DC2626',
  dangerSurface: '#FEE2E2',

  // Surfaces + borders
  surface: '#FFFFFF',
  background: '#FAFAFA',
  border: '#E5E7EB',

  // Info banner (BetaBanner)
  infoBg: '#DBEAFE',
  infoText: '#1E3A8A',
} as const;

export type ColorToken = keyof typeof colors;
