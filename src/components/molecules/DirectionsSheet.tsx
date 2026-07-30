/**
 * DirectionsSheet — shared directions-picker BottomSheetModal.
 *
 * Encapsulates the "Cómo llegar" sheet that shows available map
 * apps (Apple Maps, Google Maps, Waze) for a given destination.
 * Both ChargerBottomSheet and ChargerDetailScreen use this.
 *
 * Usage:
 *   const ref = useRef<DirectionsSheetHandle>(null);
 *   <DirectionsSheet ref={ref} />
 *   ref.current?.checkAndOpen({ lat: -34.9, lng: -56.2, title: 'Cargador' });
 */
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
} from '@gorhom/bottom-sheet';
import { ChevronRight, Compass, Map, Navigation } from 'lucide-react-native';

import { getMapsUrls } from '@/lib/openMaps';
import { colors, radius, spacing, typography } from '@/theme';

// ── Types ────────────────────────────────────────────────────

interface MapApp {
  label: string;
  url: string;
  icon: any;
  color: string;
}

export interface DirectionsSheetHandle {
  checkAndOpen: (params: {
    lat: number;
    lng: number;
    title: string;
  }) => void;
}

// ── Component ────────────────────────────────────────────────

export const DirectionsSheet = forwardRef<DirectionsSheetHandle, object>(
  function DirectionsSheet(_props, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const [mapApps, setMapApps] = useState<MapApp[]>([]);

    const checkAndOpen = useCallback(
      ({ lat, lng, title }: { lat: number; lng: number; title: string }) => {
        const { googleUrl, wazeUrl, appleUrl } = getMapsUrls(lat, lng, title);

        if (Platform.OS === 'ios') {
          // On iOS, Apple Maps is always available; check others via schemes.
          const iosChecks: (MapApp & { scheme: string })[] = [
            {
              label: 'Apple Maps',
              url: appleUrl,
              icon: Compass as any,
              color: '#007AFF',
              scheme: 'maps://',
            },
            {
              label: 'Google Maps',
              url: googleUrl,
              icon: Map as any,
              color: '#34A853',
              scheme: 'comgooglemaps://',
            },
            {
              label: 'Waze',
              url: wazeUrl,
              icon: Navigation as any,
              color: '#33CCFF',
              scheme: 'waze://',
            },
          ];
          void Promise.all(
            iosChecks.map((app) =>
              Linking.canOpenURL(app.scheme).then(
                (ok) => (ok ? { label: app.label, url: app.url, icon: app.icon, color: app.color } : null),
              ),
            ),
          ).then((results) => {
            const apps = results.filter(Boolean) as MapApp[];
            if (apps.length === 0) return;
            if (apps.length === 1) {
              void Linking.openURL(apps[0]!.url);
              return;
            }
            setMapApps(apps);
            sheetRef.current?.present();
          });
        } else {
          // On Android, Google Maps is always available; Waze is optional.
          void Linking.canOpenURL(wazeUrl).then((wazeOk) => {
            const apps: MapApp[] = [
              {
                label: 'Google Maps',
                url: googleUrl,
                icon: Map as any,
                color: '#34A853',
              },
              ...(wazeOk
                ? [
                    {
                      label: 'Waze',
                      url: wazeUrl,
                      icon: Navigation as any,
                      color: '#33CCFF',
                    },
                  ]
                : []),
            ];
            if (apps.length === 1) {
              void Linking.openURL(apps[0]!.url);
              return;
            }
            setMapApps(apps);
            sheetRef.current?.present();
          });
        }
      },
      // setMapApps is stable; sheetRef.current is mutable (assigned on mount)
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    );

    useImperativeHandle(ref, () => ({ checkAndOpen }), [checkAndOpen]);

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['30%']}
        enableDynamicSizing={false}
        backdropComponent={(p) => (
          <BottomSheetBackdrop
            {...p}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
          />
        )}
        backgroundStyle={styles.sheetBg}
      >
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Cómo llegar</Text>
          {mapApps.map((app) => {
            const AppIcon = app.icon;
            return (
              <Pressable
                key={app.label}
                onPress={() => {
                  sheetRef.current?.dismiss();
                  void Linking.openURL(app.url);
                }}
                style={({ pressed }) => [
                  styles.appRow,
                  pressed && styles.appRowPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Abrir en ${app.label}`}
              >
                <View
                  style={[
                    styles.appIcon,
                    { backgroundColor: app.color + '20' },
                  ]}
                >
                  <AppIcon size={20} color={app.color} strokeWidth={2} />
                </View>
                <Text style={styles.appLabel}>{app.label}</Text>
                <ChevronRight size={18} color={colors.textSecondary} />
              </Pressable>
            );
          })}
        </View>
      </BottomSheetModal>
    );
  },
);

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: colors.surface },
  sheetContent: { padding: spacing.lg, gap: spacing.base },
  sheetTitle: { ...typography.title, color: colors.textPrimary },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.button,
  },
  appRowPressed: { backgroundColor: colors.surface },
  appIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appLabel: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    fontWeight: '500',
  },
});
