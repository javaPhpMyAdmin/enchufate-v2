import React from 'react';
import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator } from 'react-native';

import { colors } from '@/theme';

export type IconSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_PX: Record<IconSize, number> = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

export interface IconProps {
  /** Lucide icon component (e.g. `import { Home } from 'lucide-react-native'`). */
  icon?: LucideIcon;
  size?: IconSize;
  color?: string;
  strokeWidth?: number;
}

/**
 * Icon — the single gateway for vector icons in the app.
 *
 * All atoms/molecules/organisms render icons through this wrapper
 * so the icon library (`lucide-react-native`) can be swapped out
 * in one place. Consumers pass the Lucide component class as
 * `icon={Home}`; the wrapper instantiates it with the requested
 * `size`, `color`, and `strokeWidth`.
 *
 * Renders nothing if `icon` is undefined; this is useful for
 * conditional icons in molecules (e.g. `icon={loading ? undefined : Plus}`).
 */
export function Icon({
  icon: IconCmp,
  size = 'md',
  color = colors.textPrimary,
  strokeWidth = 2,
}: IconProps): React.JSX.Element | null {
  if (!IconCmp) {
    return <ActivityIndicator size="small" color={color} />;
  }
  return <IconCmp size={SIZE_PX[size]} color={color} strokeWidth={strokeWidth} />;
}
