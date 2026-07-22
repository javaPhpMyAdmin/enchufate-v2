/**
 * Publish wizard — step 2: location.
 *
 * Three states on mount:
 *   1. **Permission granted** — we call `getCurrentPosition()` and
 *      seed the store with `{ lat, lng, address: <lat,lng stub> }`.
 *      The user sees an "Ubicación detectada" card with the coords
 *      and an editable address `Input` (real reverse geocoding lands
 *      in Phase 8; per the spec we surface the raw coords as the
 *      initial text so the user has something to edit).
 *   2. **Permission denied / undetermined** — we show a single
 *      manual `Input` with the helper "Escribí la dirección
 *      manualmente". The user can still publish; the charger is
 *      searchable by the address string per the design.
 *   3. **Permission request in flight** — a `LoadingState` until
 *      the OS prompt resolves.
 *
 * **Why re-request on this screen, not the Mapa screen's grant**:
 * the publish flow is independent of the map browse. A user might
 * have denied the map but granted publish, or vice versa. We ask
 * here so the user is in control of the permission at the moment
 * they need the data.
 *
 * The Siguiente CTA lives in `<PublishWizardNav />` (rendered by
 * the layout). When pressed, the nav mutates `step` to 3; the
 * layout's useEffect navigates to `/publish/3-connector`, which
 * is a 404 in PR-B (PR-C adds that route).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin } from 'lucide-react-native';

import { Card } from '@/components/atoms/Card';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { PermissionToast } from '@/components/molecules/PermissionToast';
import {
  getCurrentPosition,
  requestLocationPermission,
} from '@/lib/location';
import {
  usePublishStore,
  type PublishLocation,
} from '@/stores/publishStore';
import { colors, radius, spacing, typography } from '@/theme';

type PermissionState = 'loading' | 'granted' | 'denied';

/**
 * Stub "reverse-geocoded" address. Per the spec, we surface the
 * raw lat/lng as the address text until Phase 8 wires real
 * reverse geocoding. The user can edit the string before
 * tapping Siguiente.
 */
function coordsAsAddress(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export default function PublishStep2Location(): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const location = usePublishStore((s) => s.location);
  const setLocation = usePublishStore((s) => s.setLocation);

  const [permission, setPermission] = useState<PermissionState>('loading');
  const [showDeniedToast, setShowDeniedToast] = useState(false);

  // ----- Permission + position on mount -----
  useEffect(() => {
    let mounted = true;
    void (async () => {
      const result = await requestLocationPermission();
      if (!mounted) return;
      if (result !== 'granted') {
        setPermission('denied');
        setShowDeniedToast(true);
        return;
      }
      const pos = await getCurrentPosition();
      if (!mounted) return;
      if (pos) {
        const next: PublishLocation = {
          lat: pos.lat,
          lng: pos.lng,
          address: coordsAsAddress(pos.lat, pos.lng),
        };
        setLocation(next);
        setPermission('granted');
      } else {
        setPermission('denied');
        setShowDeniedToast(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [setLocation]);

  // ----- Address edit handlers -----
  const onAddressChange = useCallback(
    (next: string) => {
      if (location) {
        setLocation({ ...location, address: next });
      } else {
        // User typing in the manual-entry branch (denied path).
        setLocation({ lat: null, lng: null, address: next });
      }
    },
    [location, setLocation],
  );

  const onClearLocation = useCallback(() => {
    setLocation(null);
  }, [setLocation]);

  // ----- Loading branch -----
  if (permission === 'loading') {
    return (
      <View style={[styles.flex, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingLabel}>Pidiendo permiso de ubicación...</Text>
      </View>
    );
  }

  // ----- Granted branch — detected card + editable address -----
  if (permission === 'granted' && location && location.lat !== null && location.lng !== null) {
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.lg }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Detectamos tu ubicación</Text>
            <Text style={styles.subtitle}>
              Podés cambiar la dirección si querés.
            </Text>
          </View>

          <Card variant="default" padding="md">
            <View style={styles.detectedRow}>
              <View style={styles.detectedIcon}>
                <Icon icon={MapPin} size="md" color={colors.primary} />
              </View>
              <View style={styles.detectedText}>
                <Text style={styles.detectedLabel}>Ubicación detectada</Text>
                <Text style={styles.detectedCoords}>
                  {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </Text>
              </View>
            </View>
          </Card>

          <View style={styles.field}>
            <Input
              label="Dirección"
              value={location.address}
              onChangeText={onAddressChange}
              placeholder="Calle, número, ciudad"
              autoCapitalize="words"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ----- Denied / undetermined branch — manual entry only -----
  return (
    <View style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.lg }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Escribí la dirección manualmente</Text>
            <Text style={styles.subtitle}>
              Si no nos das permiso de ubicación, podés cargar la dirección a mano.
            </Text>
          </View>

          <View style={styles.field}>
            <Input
              label="Dirección"
              value={location?.address ?? ''}
              onChangeText={onAddressChange}
              placeholder="Calle, número, ciudad"
              autoCapitalize="words"
            />
            <Text style={styles.helper}>
              Tus huéspedes van a encontrar el cargador por esta dirección.
            </Text>
          </View>

          {location?.lat !== null && location?.lng !== null ? (
            // If a previous session saved a GPS-tagged location and the
            // user is now denying, give them a way to clear it. The
            // manual entry branch assumes lat/lng are null.
            <Text style={styles.clearLink} onPress={onClearLocation}>
              Quitar la ubicación detectada
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <PermissionToast
        visible={showDeniedToast}
        onDismiss={() => setShowDeniedToast(false)}
        message="Sin permiso de ubicación vamos a mostrar solo la dirección que escribas."
        ctaLabel="Activar"
        onCtaPress={() => {
          setShowDeniedToast(false);
          void Linking.openSettings();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  loadingLabel: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.base,
  },
  scroll: {
    padding: spacing.base,
    gap: spacing.base,
  },
  header: { gap: spacing.xs },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary },
  detectedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  detectedIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detectedText: { flex: 1, gap: 2 },
  detectedLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  detectedCoords: { ...typography.body, color: colors.textPrimary },
  field: { gap: spacing.xs },
  helper: { ...typography.caption, color: colors.textSecondary },
  clearLink: {
    ...typography.caption,
    color: colors.primary,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
});
