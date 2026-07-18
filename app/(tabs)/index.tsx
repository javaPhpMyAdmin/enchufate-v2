/**
 * Inicio tab — Phase 2 placeholder.
 *
 * The full Phase 4 Inicio screen renders the Enchufate wordmark +
 * `home_card_.png` hero + two CTA cards ("Buscar un cargador",
 * "Publicar mi cargador"). For now we render a minimal brand
 * surface using the design system: a title, a hero Card with
 * the two CTAs (wired to a no-op handler — the actual
 * navigation lands in Phase 4 once auth + map screen exist).
 */
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { colors, spacing, typography } from '@/theme';

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
      <Text style={styles.wordmark}>Enchufate</Text>
      <Text style={styles.tagline}>Cargá tu auto en cualquier punto del país</Text>

      <Card variant="elevated" padding="lg" style={styles.heroCard}>
        <Text style={styles.heroTitle}>¿Qué necesitás hoy?</Text>
        <Text style={styles.heroBody}>
          Buscá un cargador cerca tuyo o publicá el tuyo y empezá a generar ingresos.
        </Text>
        <View style={styles.ctaRow}>
          <Button
            label="Buscar un cargador"
            variant="secondary"
            fullWidth
            onPress={() => router.push('/(tabs)/map')}
          />
          <Button
            label="Publicar mi cargador"
            variant="primary"
            fullWidth
            onPress={() => router.push('/(tabs)/map')}
          />
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, gap: spacing.base },
  wordmark: { ...typography.display, color: colors.primary },
  tagline: { ...typography.body, color: colors.textSecondary },
  heroCard: { marginTop: spacing.md, gap: spacing.md },
  heroTitle: { ...typography.title, color: colors.textPrimary },
  heroBody: { ...typography.body, color: colors.textSecondary },
  ctaRow: { gap: spacing.md, marginTop: spacing.sm },
});
