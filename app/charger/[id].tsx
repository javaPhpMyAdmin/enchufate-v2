/**
 * Charger detail — `/charger/[id]`.
 *
 * Sections (top → bottom): photo gallery → identity → map snippet
 * → host info → description → rules (conditional). A sticky
 * "Reservar" Button is pinned to the bottom.
 *
 * - Logged-out Reservar tap → `router.push('/login?returnTo=/charger/' + id)`
 *   (per `src/features/auth/allowList.ts`).
 * - Logged-in Reservar tap → opens a placeholder BottomSheetModal
 *   with "Próximamente" copy. The real `ReservationRequestSheet`
 *   (date+time picker + "Lo antes posible" toggle) lands in
 *   Phase 7.
 *
 * Mock data path: `useCharger` returns the matching charger from
 * `MOCK_CHARGERS` joined with `MOCK_HOSTS`, validated by
 * `chargerSchema` on read. Phase 7 swaps the `queryFn` for
 * `supabase.from('chargers').select('*, host:profiles!owner_id(*)')`
 * — the screen does not change.
 *
 * Auth pattern: `useSession()` (hooks, NOT Context). Destructuring
 * the full state matches every other screen (reservation detail,
 * profile, login). The spec's `useSession((s) => s.session)`
 * selector syntax is not supported by the current hook signature;
 * documented as a small deviation.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Camera as MapCamera,
  Map as MapView,
  GeoJSONSource,
  Images,
  Layer,
} from '@maplibre/maplibre-react-native';
import {
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  MapPin,
  Star,
  Zap,
} from 'lucide-react-native';
import { BottomSheetModal, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/atoms/Avatar';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Icon } from '@/components/atoms/Icon';
import { StatusPill } from '@/components/atoms/StatusPill';
import { ErrorState } from '@/components/molecules/ErrorState';
import { Skeleton } from '@/components/molecules/Skeleton';
import { useSession } from '@/features/auth/hooks/useSession';
import { useCharger } from '@/features/chargers/hooks/useCharger';
import { CONNECTOR_LABEL } from '@/features/chargers/types';
import { formatPrice } from '@/lib/format';
import { colors, radius, spacing, typography } from '@/theme';

const OPENFREEMAP_LIBERTY = 'https://tiles.openfreemap.org/styles/liberty';
const CARGADOR_SNIPPET_ICON = 'cargador-snippet';
const PLACEHOLDER_PHOTO = require('@/../assets/icons/cargador.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ChargerDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const chargerId = typeof params.id === 'string' ? params.id : null;

  const { session } = useSession();
  const charger = useCharger(chargerId);
  const sheetRef = useRef<BottomSheetModal>(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  const onOpenInMaps = useCallback(() => {
    const data = charger.data;
    if (!data) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${data.lat},${data.lng}&destination_place_id=${encodeURIComponent(data.title)}`;
    void Linking.openURL(url).catch(() => {
      Alert.alert('No pudimos abrir el mapa', 'Probá más tarde.');
    });
  }, [charger.data]);

  const onReservarPress = useCallback(() => {
    if (!session) {
      router.push(`/login?returnTo=/charger/${chargerId ?? ''}` as never);
      return;
    }
    sheetRef.current?.present();
  }, [session, router, chargerId]);

  // Reset photo index when the route id changes.
  useEffect(() => {
    setPhotoIndex(0);
  }, [chargerId]);

  if (!chargerId) {
    return (
      <ErrorState
        title="Cargador no encontrado"
        body="El enlace que seguiste no apunta a un cargador válido."
        onRetry={() => router.replace('/(tabs)' as never)}
        retryLabel="Volver al inicio"
      />
    );
  }
  if (charger.isLoading) {
    return <ChargerDetailSkeleton topInset={insets.top} />;
  }
  if (charger.error) {
    return (
      <ErrorState
        body={charger.error.userMessage}
        onRetry={() => charger.refetch()}
        retryLabel="Reintentar"
      />
    );
  }
  if (!charger.data) {
    return (
      <ErrorState
        title="Cargador no encontrado"
        body="No encontramos este cargador. Es posible que haya sido eliminado."
        onRetry={() => router.replace('/(tabs)' as never)}
        retryLabel="Volver al inicio"
      />
    );
  }

  const c = charger.data;
  const photos = c.photos.length > 0 ? c.photos : [null];
  const total = photos.length;
  // Inline Intl for "marzo de 2024" — formatDateTime in
  // `src/lib/format` produces "18 jul, 14:30" (short day + time),
  // not the month + year the spec requires.
  const memberSince = new Intl.DateTimeFormat('es-UY', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(c.host.createdAt));
  const snippetGeoJson = {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
        properties: { id: c.id },
      },
    ],
  };

  return (
    <View style={styles.flex}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <Icon icon={ChevronLeft} size="lg" color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>Cargador</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Photo gallery */}
        <View style={styles.galleryWrap}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setPhotoIndex(Math.max(0, Math.min(idx, total - 1)));
            }}
          >
            {photos.map((uri, i) => (
              <Image
                key={i}
                source={uri ? { uri } : PLACEHOLDER_PHOTO}
                style={styles.galleryImage}
                accessibilityIgnoresInvertColors
              />
            ))}
          </ScrollView>
          <View style={styles.galleryCounter}>
            <Text style={styles.galleryCounterText}>{photoIndex + 1}/{total}</Text>
          </View>
        </View>

        {/* Identity */}
        <Card variant="default" padding="md" style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>{c.title}</Text>
            <StatusPill status={c.status === 'active' ? 'disponible' : 'cancelada'} />
          </View>
          <View style={styles.metaRow}>
            <Icon icon={MapPin} size="sm" color={colors.textSecondary} />
            <Text style={styles.metaText} numberOfLines={2}>{c.address}</Text>
          </View>
          <View style={styles.metaRow}>
            <Icon icon={Zap} size="sm" color={colors.primary} />
            <Text style={styles.metaText}>
              {`${c.power_kw % 1 === 0 ? c.power_kw : c.power_kw.toFixed(1)} kW · ${CONNECTOR_LABEL[c.connector_type]}`}
            </Text>
          </View>
          <Text style={styles.price} numberOfLines={1}>
            {formatPrice(c.price_per_hour_usd, 'USD')}<Text style={styles.priceSuffix}> / hora</Text>
          </Text>
        </Card>

        {/* Map snippet */}
        <Pressable
          onPress={onOpenInMaps}
          accessibilityRole="link"
          accessibilityLabel="Ver en el mapa"
          style={styles.mapWrap}
        >
          <MapView
            style={StyleSheet.absoluteFill}
            mapStyle={OPENFREEMAP_LIBERTY}
            logo={false}
            attribution={false}
            pointerEvents="none"
          >
            <MapCamera center={[c.lng, c.lat]} zoom={14} />
            <Images images={{ [CARGADOR_SNIPPET_ICON]: require('@/../assets/icons/cargador.png') }} />
            <GeoJSONSource data={snippetGeoJson}>
              <Layer
                id="snippet-pin"
                type="symbol"
                layout={{
                  'icon-image': CARGADOR_SNIPPET_ICON,
                  'icon-size': 0.12,
                  'icon-anchor': 'bottom',
                  'icon-allow-overlap': true,
                }}
              />
            </GeoJSONSource>
          </MapView>
          <View style={styles.mapOverlay} pointerEvents="none">
            <Text style={styles.mapOverlayText}>Ver en Google Maps</Text>
            <Icon icon={ArrowUpRight} size="sm" color={colors.textOnPrimary} />
          </View>
        </Pressable>

        {/* Host */}
        <Card variant="default" padding="md" style={styles.card}>
          <View style={styles.hostRow}>
            <Avatar uri={c.host.avatarUrl} name={c.host.displayName} size="lg" />
            <View style={styles.hostText}>
              <Text style={styles.hostName} numberOfLines={1}>{c.host.displayName}</Text>
              <View style={styles.metaRow}>
                <Icon icon={Calendar} size="sm" color={colors.textSecondary} />
                <Text style={styles.metaText}>Miembro desde {memberSince}</Text>
              </View>
              <View style={styles.metaRow}>
                <Icon icon={Star} size="sm" color={colors.textSecondary} />
                <Text style={styles.metaText}>0.0 · sin reseñas todavía</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Description */}
        <Card variant="default" padding="md" style={styles.card}>
          <Text style={styles.sectionTitle}>Descripción</Text>
          <Text style={styles.body}>{c.description}</Text>
        </Card>

        {/* Rules (conditional) */}
        {c.rules && c.rules.trim().length > 0 ? (
          <Card variant="default" padding="md" style={styles.card}>
            <Text style={styles.sectionTitle}>Reglas del anfitrión</Text>
            <Text style={styles.body}>{c.rules}</Text>
          </Card>
        ) : null}
      </ScrollView>

      {/* Sticky Reservar CTA */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Button label="Reservar" variant="primary" fullWidth size="lg" onPress={onReservarPress} />
      </View>

      {/* Placeholder bottom sheet — real picker lands in Phase 7 */}
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['35%']}
        enableDynamicSizing={false}
        backdropComponent={(p) => (
          <BottomSheetBackdrop {...p} appearsOnIndex={0} disappearsOnIndex={-1} />
        )}
        backgroundStyle={styles.sheetBg}
      >
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Reservar este cargador</Text>
          <Text style={styles.sheetBody}>
            Próximamente vas a poder elegir día, hora y duración desde acá.
          </Text>
          <Button
            label="Cerrar"
            variant="secondary"
            fullWidth
            onPress={() => sheetRef.current?.dismiss()}
            style={styles.sheetClose}
          />
        </View>
      </BottomSheetModal>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Charger detail loading skeleton                                       */
/* ------------------------------------------------------------------ */

/**
 * Renders a hero placeholder + 3 stacked body blocks while
 * `useCharger(id)` is in flight. Mirrors the layout of the
 * real screen (hero image → identity card → map snippet → host
 * card → description) so the transition from skeleton to real
 * content is visually smooth.
 */
function ChargerDetailSkeleton({
  topInset,
}: {
  topInset: number;
}): React.JSX.Element {
  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: topInset + spacing.sm }]}>
        <View style={styles.backButtonPlaceholder} />
        <Text style={styles.headerTitle} numberOfLines={1}>
          Cargador
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: topInset + spacing.xxl + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        <Skeleton width="100%" height={280} borderRadius={0} style={styles.skeletonHero} />
        <View style={styles.card}>
          <Skeleton width="70%" height={22} />
          <Skeleton width="50%" height={14} style={styles.skeletonSpacerSm} />
          <Skeleton width="40%" height={14} style={styles.skeletonSpacerSm} />
          <Skeleton width="35%" height={20} style={styles.skeletonSpacerMd} />
        </View>
        <Skeleton width="100%" height={160} borderRadius={radius.card} />
        <View style={styles.card}>
          <View style={styles.hostRow}>
            <Skeleton width={48} height={48} borderRadius={radius.pill} />
            <View style={styles.hostText}>
              <Skeleton width="55%" height={16} />
              <Skeleton width="40%" height={12} style={styles.skeletonSpacerSm} />
              <Skeleton width="45%" height={12} />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: { padding: spacing.xs, marginLeft: -spacing.xs },
  headerTitle: { ...typography.heading, color: colors.textPrimary, flex: 1 },

  scroll: { padding: spacing.base, gap: spacing.base },

  galleryWrap: {
    width: SCREEN_WIDTH,
    height: 280,
    marginHorizontal: -spacing.base,
    backgroundColor: colors.surface,
    position: 'relative',
  },
  galleryImage: { width: SCREEN_WIDTH, height: 280, resizeMode: 'cover' },
  galleryCounter: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(15, 20, 25, 0.6)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  galleryCounterText: { ...typography.caption, color: colors.textOnPrimary, fontWeight: '600' },

  card: { gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...typography.title, color: colors.textPrimary, flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { ...typography.body, color: colors.textSecondary, flex: 1 },
  price: { ...typography.heading, color: colors.primary, fontWeight: '700' },
  priceSuffix: { ...typography.body, color: colors.textSecondary, fontWeight: '400' },

  mapWrap: { height: 160, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.surface },
  mapOverlay: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  mapOverlayText: { ...typography.caption, color: colors.textOnPrimary, fontWeight: '600' },

  hostRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  hostText: { flex: 1, gap: 2 },
  hostName: { ...typography.heading, color: colors.textPrimary },

  sectionTitle: { ...typography.caption, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase' },
  body: { ...typography.body, color: colors.textPrimary },

  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  sheetBg: { backgroundColor: colors.surface },
  sheetContent: { padding: spacing.lg, gap: spacing.base },
  sheetTitle: { ...typography.title, color: colors.textPrimary },
  sheetBody: { ...typography.body, color: colors.textSecondary },
  sheetClose: { marginTop: spacing.sm },

  // ----- Skeleton (loading) -----
  backButtonPlaceholder: { width: 24, height: 24 },
  skeletonHero: { width: SCREEN_WIDTH, marginHorizontal: -spacing.base },
  skeletonSpacerSm: { marginTop: spacing.sm },
  skeletonSpacerMd: { marginTop: spacing.md },
});
