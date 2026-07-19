/**
 * Mapa tab — public charger discovery surface (Phase 4).
 *
 * Renders a MapLibre view tiled from OpenFreeMap (no tokens required)
 * centered on Uruguay, with native clustering of charger pins
 * (`cluster: true` on the GeoJSONSource, `clusterMaxZoom: 14`).
 *
 * **Lazy loading**: The MapLibre-dependent `MapContent` component is
 * loaded via `React.lazy` to defer TurboModule resolution. This
 * prevents the `MLRNCameraModule could not be found` crash that
 * occurs when the app returns from Google OAuth (the bridge isn't
 * fully ready when the native module is synchronously accessed).
 *
 * The Filtros pill and PermissionToast stay here — they don't
 * depend on MapLibre.
 */
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import type { NativeSyntheticEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RefreshCw } from 'lucide-react-native';

import { useChargers } from '@/features/chargers/hooks/useChargers';
import { useFilterStore } from '@/stores/filterStore';
import {
  URUGUAY_FALLBACK,
  getLastKnownPosition,
  requestLocationPermission,
} from '@/lib/location';
import { LoadingState } from '@/components/molecules/LoadingState';
import { ErrorState } from '@/components/molecules/ErrorState';
import { PermissionToast } from '@/components/molecules/PermissionToast';
import { FiltersSheet } from '@/components/organisms/FiltersSheet';
import { Icon } from '@/components/atoms/Icon';
import { colors, radius, spacing, typography } from '@/theme';

// ── Lazy import ──────────────────────────────────────────────
// React.lazy defers the native module resolution to after the
// first render cycle. This is the fix for the OAuth redirect crash.
import type {
  CameraRef,
  GeoJSONSourceRef,
  PressEventWithFeatures,
  ChargerFC,
} from './MapContent';
import { chargersToGeoJSON } from './MapContent';

const MapContent = React.lazy(() => import('./MapContent'));

// ── Error boundary for lazy import failure ────────────────────
interface LazyErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface LazyErrorBoundaryState {
  hasError: boolean;
}

class LazyErrorBoundary extends React.Component<
  LazyErrorBoundaryProps,
  LazyErrorBoundaryState
> {
  override state: LazyErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): LazyErrorBoundaryState {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// ── Component ────────────────────────────────────────────────
export default function MapTab() {
  const insets = useSafeAreaInsets();
  const filters = useFilterStore((s) => s.filters);
  const { data, isLoading, error, refetch } = useChargers(filters);
  const cameraRef = useRef<CameraRef>(null);
  const sourceRef = useRef<GeoJSONSourceRef>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showLocationToast, setShowLocationToast] = useState(false);
  const [lazyFailed, setLazyFailed] = useState(false);
  const router = useRouter();

  // Request location permission on first mount (Phase 4 spec).
  useEffect(() => {
    requestLocationPermission().then((result) => {
      if (result !== 'granted') {
        setShowLocationToast(true);
      }
    });
  }, []);

  const geojson = useMemo<ChargerFC | null>(
    () => (data ? chargersToGeoJSON(data) : null),
    [data],
  );

  const handleRecenter = useCallback(async () => {
    const last = await getLastKnownPosition();
    const target = last ?? { lat: URUGUAY_FALLBACK.lat, lng: URUGUAY_FALLBACK.lng };
    cameraRef.current?.easeTo({
      center: [target.lng, target.lat],
      zoom: last ? 13 : URUGUAY_FALLBACK.zoom,
      duration: 600,
    });
  }, []);

  const handleSourcePress = useCallback(
    async (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
      const feature = event.nativeEvent.features?.[0];
      if (!feature?.properties) return;
      const props = feature.properties as unknown as {
        cluster?: boolean;
        cluster_id?: number;
        id?: string;
      };
      if (props.cluster && typeof props.cluster_id === 'number' && sourceRef.current) {
        const expansionZoom = await sourceRef.current.getClusterExpansionZoom(props.cluster_id);
        cameraRef.current?.zoomTo(expansionZoom, { duration: 500 });
        return;
      }
      if (props.id) {
        router.push(`/charger/${props.id}` as never);
      }
    },
    [router],
  );

  // ── Loading / error states ────────────────────────────────
  if (isLoading) {
    return <LoadingState label="Cargando cargadores..." />;
  }
  if (error) {
    return (
      <ErrorState
        body={error.message || 'No pudimos cargar el mapa. Probá de nuevo.'}
        onRetry={refetch}
      />
    );
  }

  // ── Lazy import failure fallback ──────────────────────────
  if (lazyFailed) {
    return (
      <View style={fallbackStyles.base}>
        <Icon icon={RefreshCw} size="lg" color={colors.textSecondary} />
        <Text style={fallbackStyles.title}>No se pudo cargar el mapa</Text>
        <Text style={fallbackStyles.body}>
          Ocurrió un error al inicializar el mapa. Probá de nuevo.
        </Text>
        <Pressable
          onPress={() => {
            setLazyFailed(false);
            // Force a tick so the lazy component unmounts then remounts
            requestAnimationFrame(() => setLazyFailed(false));
          }}
          style={({ pressed }) => [
            fallbackStyles.button,
            pressed && fallbackStyles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Reintentar carga del mapa"
        >
          <Text style={fallbackStyles.buttonLabel}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>
      <LazyErrorBoundary
        fallback={
          <View style={fallbackStyles.base}>
            <Icon icon={RefreshCw} size="lg" color={colors.textSecondary} />
            <Text style={fallbackStyles.title}>No se pudo cargar el mapa</Text>
            <Text style={fallbackStyles.body}>
              Ocurrió un error al inicializar el mapa. Probá de nuevo.
            </Text>
            <Pressable
              onPress={() => setLazyFailed(true)}
              style={({ pressed }) => [
                fallbackStyles.button,
                pressed && fallbackStyles.buttonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Reintentar carga del mapa"
            >
              <Text style={fallbackStyles.buttonLabel}>Reintentar</Text>
            </Pressable>
          </View>
        }
      >
        <Suspense fallback={<LoadingState label="Cargando mapa..." />}>
          <MapContent
            geojson={geojson}
            onRecenter={handleRecenter}
            onSourcePress={handleSourcePress}
            insets={insets}
            onFilterPress={() => setSheetOpen(true)}
            cameraRef={cameraRef}
            sourceRef={sourceRef}
          />
        </Suspense>
      </LazyErrorBoundary>

      <FiltersSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />

      <PermissionToast
        visible={showLocationToast}
        onDismiss={() => setShowLocationToast(false)}
        message="Necesitamos tu ubicación para mostrar cargadores cerca tuyo."
        ctaLabel="Activar"
        onCtaPress={() => {
          setShowLocationToast(false);
          void Linking.openSettings();
        }}
      />
    </View>
  );
}

// ── Lazy import error fallback styles ────────────────────────
const fallbackStyles = {
  base: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
  },
  title: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600' as const,
    marginTop: spacing.base,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center' as const,
    marginTop: spacing.xs,
  },
  button: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.button,
  },
  buttonPressed: { opacity: 0.85 },
  buttonLabel: {
    ...typography.body,
    color: colors.textOnPrimary,
    fontWeight: '600' as const,
  },
};
