/**
 * StarPicker — 1–5 tappable star rating selector.
 *
 * Used in two modes:
 *   - **Interactive**: provide `onChange` → stars are tappable, user
 *     picks a rating. Default value is 5.
 *   - **Display**: omit `onChange` → stars are read-only, used to
 *     show an existing rating (e.g. in ReviewCard).
 *
 * Size options match the project's atom sizing convention (sm/md/lg).
 */
import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { Star } from 'lucide-react-native';

import { colors, spacing } from '@/theme';

export type StarPickerSize = 'sm' | 'md' | 'lg';

export interface StarPickerProps {
  /** Current rating (1–5). In interactive mode, this is the selected value. */
  value: number;
  /** Called when the user taps a star. When omitted, stars are read-only. */
  onChange?: (rating: number) => void;
  /** Visual size. Defaults to `'md'`. */
  size?: StarPickerSize;
  style?: StyleProp<ViewStyle>;
}

const STAR_SIZE: Record<StarPickerSize, number> = { sm: 16, md: 22, lg: 28 };
const GAP: Record<StarPickerSize, number> = { sm: 2, md: 4, lg: 6 };

/**
 * Renders 5 stars. Filled stars up to `value`, outline for the rest.
 * Tapping a star sets `value` to that index (1-based) when `onChange`
 * is provided.
 */
export function StarPicker({
  value,
  onChange,
  size = 'md',
  style,
}: StarPickerProps): React.JSX.Element {
  const starPx = STAR_SIZE[size];
  const gap = GAP[size];

  return (
    <View style={[{ flexDirection: 'row', gap }, style]}>
      {Array.from({ length: 5 }, (_, i) => {
        const rating = i + 1;
        const filled = rating <= value;
        return (
          <Pressable
            key={rating}
            onPress={onChange ? () => onChange(rating) : undefined}
            disabled={!onChange}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={`${rating} estrella${rating > 1 ? 's' : ''}`}
          >
            <Star
              size={starPx}
              color={filled ? colors.primary : colors.textSecondary}
              fill={filled ? colors.primary : 'transparent'}
              strokeWidth={filled ? 0 : 2}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
