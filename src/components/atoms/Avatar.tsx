import React from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, typography } from '@/theme';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: AvatarSize;
  style?: StyleProp<ViewStyle>;
}

const SIZE_PX: Record<AvatarSize, number> = { sm: 32, md: 40, lg: 56 };
const FONT: Record<AvatarSize, number> = { sm: 13, md: 16, lg: 20 };

/** Circular image with deterministic initials fallback. */
export function Avatar({ uri, name, size = 'md', style }: AvatarProps): React.JSX.Element {
  const px = SIZE_PX[size];
  const tint = tintFor(name);
  return (
    <View
      style={[styles.base, { width: px, height: px, borderRadius: radius.pill, backgroundColor: tint.bg }, style]}
      accessibilityRole="image"
      accessibilityLabel={name}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: px, height: px, borderRadius: radius.pill }} />
      ) : (
        <Text style={[typography.body, { color: tint.fg, fontSize: FONT[size], fontWeight: '700' }]}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({ base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' } });

/** 1-2 letter initials from a display name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

const TINTS: ReadonlyArray<{ bg: string; fg: string }> = [
  { bg: colors.primarySubtle, fg: colors.primary },
  { bg: colors.infoBg, fg: colors.infoText },
  { bg: colors.successSurface, fg: colors.success },
];

function tintFor(name: string): { bg: string; fg: string } {
  const cleaned = name.trim();
  if (!cleaned) return TINTS[0]!;
  let h = 0;
  for (let i = 0; i < cleaned.length; i += 1) h = (h * 31 + cleaned.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length]!;
}
