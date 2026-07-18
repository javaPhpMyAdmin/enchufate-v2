/**
 * Mapa tab — Phase 2 placeholder.
 *
 * Phase 4 will mount `react-native-maps` here with `PROVIDER_GOOGLE`,
 * a default region covering Uruguay, and tappable charger pins.
 * For now we render an EmptyState with a peach FAB to anchor the
 * layout; the FAB's onPress is a no-op (the recenter logic lands
 * in Phase 4 with the location helper).
 */
import { StyleSheet, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/molecules/EmptyState';
import { FAB } from '@/components/atoms/FAB';
import { colors, spacing } from '@/theme';

export default function MapTab() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <EmptyState
        icon={MapPin}
        title="Mapa próximamente"
        body="Acá vas a poder explorar cargadores cercanos y filtrarlos por conector, potencia y disponibilidad."
      />
      <FAB
        onPress={() => {
          /* Phase 4: requestLocationPermission + recenter on user */
        }}
        accessibilityLabel="Centrar mapa en tu ubicación"
        style={{ bottom: insets.bottom + spacing.lg }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});
