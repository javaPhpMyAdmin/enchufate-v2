/**
 * Inicio tab — Inicio screen (visual parity with wireframe).
 *
 * Renders three surfaces stacked vertically:
 *   1. Header — Zap icon (green) + "Enchufate" wordmark in primary orange.
 *   2. Hero card — full-bleed `home_card_.png` (electric car + charger plug).
 *   3. CTA card (Buscar un cargador) — search icon, title, subtitle, tappable.
 *   4. CTA card (Publicar mi cargador) — primary orange fill, pin icon, tappable.
 *
 * The "Publicar" CTA routes to /publish/1-name which 404s silently until
 * Phase 6 lands the publish wizard. The "Buscar" CTA routes to /(tabs)/map
 * (the Mapa tab). Both presses are visual-only at this point.
 */
import { useRouter } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, Search, Zap } from 'lucide-react-native';

import { Card } from '@/components/atoms/Card';
import { colors, radius, spacing, typography } from '@/theme';

export default function InicioTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      {/* Header: brand mark + wordmark */}
      <View style={styles.header}>
        <View style={styles.brandMark}>
          <Zap size={22} color={colors.success} fill={colors.success} strokeWidth={1.5} />
        </View>
        <Text style={styles.wordmark}>Enchufate</Text>
      </View>

      {/* Hero card: solid orange (no image) */}
      <Card variant="elevated" padding="none" style={styles.heroCardSolid}>
        <View style={styles.heroSolidInner}>
          <Text style={styles.heroSolidText}>Enchufate</Text>
        </View>
      </Card>

      {/* CTA card 1: Buscar un cargador (white) */}
      <Card
        variant="default"
        padding="lg"
        onPress={() => router.push('/(tabs)/map')}
        accessibilityLabel="Buscar un cargador"
        style={styles.ctaCard}
      >
        <View style={styles.ctaRow}>
          <View style={[styles.iconCircle, styles.iconCircleBuscar]}>
            <Search size={22} color={colors.primary} strokeWidth={2} />
          </View>
          <View style={styles.ctaText}>
            <Text style={styles.ctaTitle}>Buscar un cargador</Text>
            <Text style={styles.ctaSubtitle}>Encontrá estaciones cerca de ti</Text>
          </View>
        </View>
      </Card>

      {/* CTA card 2: Publicar mi cargador (primary orange fill) */}
      <Card
        variant="default"
        padding="lg"
        onPress={() => router.push('/publish/1-name' as never)}
        accessibilityLabel="Publicar mi cargador"
        style={styles.ctaCardPrimary}
      >
        <View style={styles.ctaRow}>
          <View style={[styles.iconCircle, styles.iconCirclePublicar]}>
            <MapPin size={22} color={colors.primary} strokeWidth={2} />
          </View>
          <View style={styles.ctaText}>
            <Text style={styles.ctaTitlePrimary}>Publicar mi cargador</Text>
            <Text style={styles.ctaSubtitlePrimary}>Ganá dinero compartiendo tu punto</Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, gap: spacing.base },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: { ...typography.display, color: colors.primary, fontSize: 28 },

  // Hero card
  heroCard: { overflow: 'hidden', marginBottom: spacing.xs },
  heroImage: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.border },
  heroCardSolid: {
    marginBottom: spacing.xs,
    backgroundColor: colors.primary,
    aspectRatio: 16 / 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroSolidInner: { padding: spacing.base },
  heroSolidText: { ...typography.title, color: colors.textOnPrimary, fontSize: 24 },

  // CTA cards (shared)
  ctaCard: { marginTop: spacing.xs },
  ctaCardPrimary: { marginTop: spacing.xs, backgroundColor: colors.primary },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleBuscar: { backgroundColor: colors.primarySubtle },
  iconCirclePublicar: { backgroundColor: colors.surface },
  ctaText: { flex: 1 },

  // CTA text variants
  ctaTitle: { ...typography.title, color: colors.textPrimary },
  ctaSubtitle: { ...typography.body, color: colors.textSecondary, marginTop: 2 },
  ctaTitlePrimary: { ...typography.title, color: colors.textOnPrimary },
  ctaSubtitlePrimary: {
    ...typography.body,
    color: colors.textOnPrimary,
    opacity: 0.9,
    marginTop: 2,
  },
});
