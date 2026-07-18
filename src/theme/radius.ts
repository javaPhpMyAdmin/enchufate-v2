/**
 * Border-radius scale per design.md §5.1.
 *   card (16) — primary card radius
 *   button (12) — input + button radius
 *   chip (999) — pill shape for Chip, StatusPill
 *   pill (999) — alias for chip
 *   input (12) — alias for button
 */
export const radius = {
  button: 12,
  input: 12,
  card: 16,
  chip: 999,
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radius;
