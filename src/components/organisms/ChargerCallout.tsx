/**
 * ChargerCallout — info-window bubble anchored above a selected pin.
 *
 * Rendered inside MapContent via MapboxGL.MarkerView so it moves
 * naturally with the map. The downward triangle points to the pin.
 * Tapping opens the ChargerBottomSheet.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

interface ChargerCalloutProps {
  title: string;
  onPress: () => void;
}

export function ChargerCallout({ title, onPress }: ChargerCalloutProps) {
  return (
    <Pressable onPress={onPress} style={styles.wrapper}>
      {/* Card body */}
      <View style={styles.card}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.arrow}>›</Text>
      </View>
      {/* Downward-pointing triangle */}
      <View style={styles.triangle} />
      {/* Spacer so the bubble floats above the pin */}
      <View style={styles.spacer} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    // No padding — the card + triangle sit flush
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.card,
    // Shadow
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    maxWidth: 220,
  },
  title: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
    maxWidth: 160,
  },
  arrow: {
    fontSize: 18,
    color: colors.primary,
    lineHeight: 20,
  },
  triangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#fff',
    marginTop: -1,
  },
  spacer: {
    height: 0,
  },
});
