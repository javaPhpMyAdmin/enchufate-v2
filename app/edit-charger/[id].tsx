/**
 * Edit charger — `/edit-charger/[id]`.
 *
 * Single-screen edit form for existing chargers. Fetches the charger
 * via `useCharger(id)`, pre-fills all editable fields from the fetched
 * data, validates with `chargerSchema` on save, and persists changes
 * via `useUpdateCharger`.
 *
 * Sections (top → bottom): header → info → location → connector →
 * photos → pricing → schedule → rules → sticky "Guardar" CTA.
 *
 * Owner guard: non-owners see an error state and cannot interact
 * with the form. The guard runs after the fetch succeeds (we need
 * the `owner_id` to compare against `session.user.id`).
 *
 * Photo state model (matches design.md):
 *   - `retained`: existing URLs the user keeps
 *   - `added`: local URIs from expo-image-picker (uploaded on save)
 *   - `removed`: existing URLs the user deleted (removed from Storage on save)
 *
 * Schedule editor reuses the same layout and constants from the
 * publish wizard's `6-schedule.tsx` but operates on local state
 * instead of the Zustand store.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, ChevronLeft, ChevronRight, Clock, ImagePlus, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { BottomSheetModal, BottomSheetBackdrop } from '@gorhom/bottom-sheet';

import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Chip } from '@/components/atoms/Chip';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { ErrorState } from '@/components/molecules/ErrorState';
import { Skeleton } from '@/components/molecules/Skeleton';
import { useSession } from '@/features/auth/hooks/useSession';
import { useCharger } from '@/features/chargers/hooks/useCharger';
import { useUpdateCharger } from '@/features/chargers/hooks/useUpdateCharger';
import { CONNECTOR_LABEL } from '@/features/chargers/types';
import type { ConnectorType, DayKey, MinReservationMinutes } from '@/features/chargers/types';
import { isAppError } from '@/lib/error';
import { compressImage } from '@/lib/imageUpload';
import { colors, radius, spacing, typography } from '@/theme';

/* ------------------------------------------------------------------ */
/* Constants                                                            */
/* ------------------------------------------------------------------ */

const PHOTO_MAX = 5;

const CONNECTOR_OPTIONS: ConnectorType[] = ['tipo_1', 'tipo_2', 'ccs', 'chademo', 'tesla'];

const MIN_RESERVATION_OPTIONS: MinReservationMinutes[] = [30, 60, 120, 240, 480];

const MIN_RESERVATION_LABELS: Record<MinReservationMinutes, string> = {
  30: '30 min',
  60: '1 hora',
  120: '2 horas',
  240: '4 horas',
  480: '8 horas',
};

const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Lun',
  tue: 'Mar',
  wed: 'Mié',
  thu: 'Jue',
  fri: 'Vie',
  sat: 'Sáb',
  sun: 'Dom',
};

type DayMode = 'always' | 'custom' | 'closed';

const ALWAYS_WINDOW = { from: '00:00', to: '23:59' } as const;

/* ------------------------------------------------------------------ */
/* Photo state model                                                    */
/* ------------------------------------------------------------------ */

interface PhotoState {
  retained: string[];
  added: string[];
  removed: string[];
}

/* ------------------------------------------------------------------ */
/* Schedule helpers                                                     */
/* ------------------------------------------------------------------ */

function modeForDay(windows: Array<{ from: string; to: string }> | undefined): DayMode {
  if (!windows || windows.length === 0) return 'closed';
  if (windows.length === 1 && windows[0]?.from === '00:00' && windows[0]?.to === '23:59') {
    return 'always';
  }
  return 'custom';
}

function windowsForMode(
  mode: DayMode,
  custom: { from: string; to: string } | null,
): Array<{ from: string; to: string }> {
  if (mode === 'always') return [{ ...ALWAYS_WINDOW }];
  if (mode === 'closed') return [];
  if (custom) return [custom];
  return [];
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export default function EditChargerScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const chargerId = typeof params.id === 'string' ? params.id : null;

  const { session } = useSession();
  const charger = useCharger(chargerId);
  const { updateCharger, isPending, error: mutationError, reset: resetMutation } = useUpdateCharger();

  /* ---- Bottom sheet refs ---- */
  const photoSheetRef = useRef<BottomSheetModal>(null);
  const scheduleSheetRef = useRef<BottomSheetModal>(null);

  /* ---- Form state ---- */
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [connectorType, setConnectorType] = useState<ConnectorType>('tipo_2');
  const [powerKw, setPowerKw] = useState('22');
  const [pricePerHour, setPricePerHour] = useState('1');
  const [minReservation, setMinReservation] = useState<MinReservationMinutes>(60);
  const [rules, setRules] = useState('');
  const [schedule, setSchedule] = useState<Record<DayKey, Array<{ from: string; to: string }>>>({
    mon: [{ ...ALWAYS_WINDOW }],
    tue: [{ ...ALWAYS_WINDOW }],
    wed: [{ ...ALWAYS_WINDOW }],
    thu: [{ ...ALWAYS_WINDOW }],
    fri: [{ ...ALWAYS_WINDOW }],
    sat: [{ ...ALWAYS_WINDOW }],
    sun: [{ ...ALWAYS_WINDOW }],
  });

  /* ---- Photo state ---- */
  const [photoState, setPhotoState] = useState<PhotoState>({
    retained: [],
    added: [],
    removed: [],
  });
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  /* ---- Schedule custom ranges (UI-only) ---- */
  const [customRange, setCustomRange] = useState<Record<DayKey, { from: string; to: string } | null>>({
    mon: null,
    tue: null,
    wed: null,
    thu: null,
    fri: null,
    sat: null,
    sun: null,
  });

  /* ---- Initialize form from fetched charger ---- */
  useEffect(() => {
    const c = charger.data;
    if (!c) return;

    setTitle(c.title);
    setDescription(c.description ?? '');
    setAddress(c.address);
    setConnectorType(c.connector_type);
    setPowerKw(String(c.power_kw));
    setPricePerHour(String(c.price_per_hour_usd));
    setMinReservation(c.min_reservation_minutes);
    setRules(c.rules ?? '');
    setSchedule(c.schedule as Record<DayKey, Array<{ from: string; to: string }>>);

    // Seed custom ranges from existing schedule
    const initCustom: Record<DayKey, { from: string; to: string } | null> = {
      mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null,
    };
    for (const k of DAY_KEYS) {
      const mode = modeForDay(c.schedule[k as DayKey]);
      if (mode === 'custom' && c.schedule[k as DayKey]?.[0]) {
        const w = c.schedule[k as DayKey]![0]!;
        initCustom[k as DayKey] = { from: w.from, to: w.to };
      }
    }
    setCustomRange(initCustom);

    // Initialize photo state — all existing photos are "retained"
    setPhotoState({ retained: c.photos ?? [], added: [], removed: [] });
  }, [charger.data]);

  /* ---- Owner guard ---- */
  const isOwner = session?.user?.id != null && charger.data?.owner_id === session.user.id;

  /* ---- Photo handlers ---- */
  const totalPhotoCount = photoState.retained.length + photoState.added.length;

  const onPickPhotos = useCallback(async () => {
    if (photoBusy) return;
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      const remaining = PHOTO_MAX - totalPhotoCount;
      if (remaining <= 0) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 1,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const compressed = await Promise.all(
        result.assets.map((asset) =>
          compressImage(asset.uri, { maxWidth: 1600, quality: 0.8 }),
        ),
      );

      setPhotoState((prev) => ({
        ...prev,
        added: [...prev.added, ...compressed.map((c) => c.uri)],
      }));
    } catch (e) {
      if (isAppError(e)) {
        setPhotoError(e.userMessage);
      } else {
        setPhotoError('No pudimos agregar las fotos. Intentá de nuevo.');
      }
    } finally {
      setPhotoBusy(false);
    }
  }, [photoBusy, totalPhotoCount]);

  const onDeleteRetained = useCallback((url: string) => {
    setPhotoError(null);
    setPhotoState((prev) => ({
      retained: prev.retained.filter((u) => u !== url),
      added: prev.added,
      removed: [...prev.removed, url],
    }));
  }, []);

  const onDeleteAdded = useCallback((index: number) => {
    setPhotoError(null);
    setPhotoState((prev) => ({
      retained: prev.retained,
      added: prev.added.filter((_, i) => i !== index),
      removed: prev.removed,
    }));
  }, []);

  /* ---- Schedule handlers ---- */
  const onPickDayMode = useCallback(
    (k: DayKey, mode: DayMode) => {
      let custom = customRange[k];
      if (mode === 'custom' && !custom) {
        custom = { from: '09:00', to: '18:00' };
        setCustomRange((prev) => ({ ...prev, [k]: custom }));
      }
      setSchedule((prev) => ({ ...prev, [k]: windowsForMode(mode, custom) }));
    },
    [customRange],
  );

  const onChangeCustomTime = useCallback(
    (k: DayKey, field: 'from' | 'to', value: string) => {
      const cleaned = value.replace(/[^0-9:]/g, '').slice(0, 5);
      const next = { ...(customRange[k] ?? { from: '09:00', to: '18:00' }), [field]: cleaned };
      setCustomRange((prev) => ({ ...prev, [k]: next }));
      if (modeForDay(schedule[k]) === 'custom') {
        setSchedule((prev) => ({ ...prev, [k]: [next] }));
      }
    },
    [customRange, schedule],
  );

  /* ---- Save handler ---- */
  const onSave = useCallback(async () => {
    if (!chargerId || !charger.data) return;

    // Build the payload
    const payload = {
      title: title.trim(),
      description: description.trim(),
      address: address.trim(),
      lat: charger.data.lat,
      lng: charger.data.lng,
      connector_type: connectorType,
      power_kw: parseFloat(powerKw) || 0,
      price_per_hour_usd: parseFloat(pricePerHour) || 0,
      min_reservation_minutes: minReservation,
      rules: rules.trim().length === 0 ? null : rules.trim(),
      schedule,
    };

    try {
      await updateCharger({
        chargerId,
        payload,
        retainedPhotos: photoState.retained,
        photoOps: {
          delete: photoState.removed,
          add: photoState.added,
        },
      });
      router.back();
    } catch (e) {
      // Mutation error is already captured in `mutationError`.
      // If the error is unexpected, show an alert.
      if (!isAppError(e)) {
        Alert.alert('Error', 'Ocurrió un error inesperado. Intentá de nuevo.');
      }
    }
  }, [
    chargerId, charger.data, title, description, address, connectorType,
    powerKw, pricePerHour, minReservation, rules, schedule,
    photoState, updateCharger, router,
  ]);

  /* ---- Render: loading ---- */
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

  if (charger.isLoading || !session) {
    return <EditChargerSkeleton topInset={insets.top} />;
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

  /* ---- Render: not owner ---- */
  if (!isOwner) {
    return (
      <ErrorState
        title="Sin permiso"
        body="No tenés permiso para editar este cargador."
        onRetry={() => router.back()}
        retryLabel="Volver"
      />
    );
  }

  /* ---- Build display photos list ---- */
  const displayPhotos: Array<{ key: string; uri: string; type: 'retained' | 'added' }> = [
    ...photoState.retained.map((url) => ({ key: url, uri: url, type: 'retained' as const })),
    ...photoState.added.map((uri, i) => ({ key: `added-${i}`, uri, type: 'added' as const })),
  ];

  /* ---- Schedule summary text ---- */
  const allDaysAlways = DAY_KEYS.every((k) => modeForDay(schedule[k]) === 'always');
  const allDaysClosed = DAY_KEYS.every((k) => modeForDay(schedule[k]) === 'closed');
  const scheduleSummary = allDaysAlways
    ? 'Disponible todos los días'
    : allDaysClosed
      ? 'Cerrado todos los días'
      : (() => {
          const openDays = DAY_KEYS.filter((k) => modeForDay(schedule[k]) !== 'closed');
          return `${openDays.length} de ${DAY_KEYS.length} días activos`;
        })();

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <Icon icon={ChevronLeft} size="lg" color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>Editar cargador</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl + 80 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ---- Info ---- */}
        <Card variant="default" padding="md" style={styles.card}>
          <Text style={styles.sectionTitle}>Información</Text>
          <Input
            label="Título"
            value={title}
            onChangeText={setTitle}
            placeholder="Nombre del cargador"
            maxLength={80}
          />
          <View style={styles.charCounter}>
            <Text style={styles.charCounterText}>{title.length}/80</Text>
          </View>
          <Input
            label="Descripción"
            value={description}
            onChangeText={setDescription}
            placeholder="Describí tu cargador (opcional)"
            maxLength={500}
          />
          <View style={styles.charCounter}>
            <Text style={styles.charCounterText}>{description.length}/500</Text>
          </View>
        </Card>

        {/* ---- Location ---- */}
        <Card variant="default" padding="md" style={styles.card}>
          <Text style={styles.sectionTitle}>Ubicación</Text>
          <Input
            label="Dirección"
            value={address}
            onChangeText={setAddress}
            placeholder="Dirección del cargador"
          />
        </Card>

        {/* ---- Connector ---- */}
        <Card variant="default" padding="md" style={styles.card}>
          <Text style={styles.sectionTitle}>Conector</Text>
          <Text style={styles.fieldLabel}>Tipo</Text>
          <View style={styles.chipRow}>
            {CONNECTOR_OPTIONS.map((ct) => (
              <Chip
                key={ct}
                label={CONNECTOR_LABEL[ct]}
                selected={connectorType === ct}
                onPress={() => setConnectorType(ct)}
                size="sm"
              />
            ))}
          </View>
          <Input
            label="Potencia (kW)"
            value={powerKw}
            onChangeText={setPowerKw}
            placeholder="3.7 - 350"
            keyboardType="decimal-pad"
          />
        </Card>

        {/* ---- Photos summary ---- */}
        <Pressable
          onPress={() => photoSheetRef.current?.present()}
          accessibilityRole="button"
          accessibilityLabel="Editar fotos"
        >
          <Card variant="default" padding="md" style={styles.card}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryLeft}>
                <Camera size={20} color={colors.textSecondary} />
                <Text style={styles.sectionTitle}>Fotos</Text>
              </View>
              <View style={styles.summaryRight}>
                <Text style={styles.summaryDetail}>
                  {totalPhotoCount} de {PHOTO_MAX} seleccionadas
                </Text>
                <ChevronRight size={18} color={colors.textSecondary} />
              </View>
            </View>
          </Card>
        </Pressable>

        {/* ---- Photos sheet ---- */}
        <BottomSheetModal
          ref={photoSheetRef}
          snapPoints={['60%']}
          enableDynamicSizing={false}
          backdropComponent={(p) => (
            <BottomSheetBackdrop {...p} appearsOnIndex={0} disappearsOnIndex={-1} />
          )}
          backgroundStyle={styles.sheetBg}
        >
          <View style={styles.sheetContent}>
            <Text style={styles.sheetTitle}>Fotos</Text>
            <View style={styles.photoGrid}>
              {displayPhotos.map((photo) => (
                <View key={photo.key} style={styles.photoCell}>
                  <Image source={{ uri: photo.uri }} style={styles.photoThumb} resizeMode="cover" />
                  <Pressable
                    onPress={() =>
                      photo.type === 'retained'
                        ? onDeleteRetained(photo.uri)
                        : onDeleteAdded(parseInt(photo.key.replace('added-', ''), 10))
                    }
                    accessibilityRole="button"
                    accessibilityLabel="Quitar foto"
                    hitSlop={8}
                    style={styles.photoDeleteBtn}
                  >
                    <X size={16} color={colors.textOnPrimary} strokeWidth={3} />
                  </Pressable>
                </View>
              ))}
              {totalPhotoCount < PHOTO_MAX ? (
                <Pressable
                  onPress={onPickPhotos}
                  disabled={photoBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Agregar fotos"
                  style={({ pressed }) => [
                    styles.photoCell,
                    styles.photoAddCell,
                    { opacity: photoBusy ? 0.5 : pressed ? 0.85 : 1 },
                  ]}
                >
                  <ImagePlus size={28} color={colors.primary} />
                  <Text style={styles.photoAddLabel}>Agregar</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.photoCounter}>
              {totalPhotoCount} de {PHOTO_MAX} seleccionadas
            </Text>
            {photoError ? (
              <View style={styles.hint}>
                <Text style={styles.hintText}>{photoError}</Text>
              </View>
            ) : null}
          </View>
        </BottomSheetModal>

        {/* ---- Pricing ---- */}
        <Card variant="default" padding="md" style={styles.card}>
          <Text style={styles.sectionTitle}>Precio</Text>
          <Input
            label="Precio por hora (USD)"
            value={pricePerHour}
            onChangeText={setPricePerHour}
            placeholder="0.00"
            keyboardType="decimal-pad"
            leftAdornment={<Text style={styles.adornmentText}>$</Text>}
          />
          <Text style={styles.fieldLabel}>Tiempo mínimo de reserva</Text>
          <View style={styles.chipRow}>
            {MIN_RESERVATION_OPTIONS.map((m) => (
              <Chip
                key={m}
                label={MIN_RESERVATION_LABELS[m]}
                selected={minReservation === m}
                onPress={() => setMinReservation(m)}
                size="sm"
              />
            ))}
          </View>
        </Card>

        {/* ---- Schedule summary ---- */}
        <Pressable
          onPress={() => scheduleSheetRef.current?.present()}
          accessibilityRole="button"
          accessibilityLabel="Editar horario"
        >
          <Card variant="default" padding="md" style={styles.card}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryLeft}>
                <Clock size={20} color={colors.textSecondary} />
                <Text style={styles.sectionTitle}>Horario</Text>
              </View>
              <View style={styles.summaryRight}>
                <Text style={styles.summaryDetail}>{scheduleSummary}</Text>
                <ChevronRight size={18} color={colors.textSecondary} />
              </View>
            </View>
          </Card>
        </Pressable>

        {/* ---- Schedule sheet ---- */}
        <BottomSheetModal
          ref={scheduleSheetRef}
          snapPoints={['75%']}
          enableDynamicSizing={false}
          backdropComponent={(p) => (
            <BottomSheetBackdrop {...p} appearsOnIndex={0} disappearsOnIndex={-1} />
          )}
          backgroundStyle={styles.sheetBg}
        >
          <View style={styles.sheetContent}>
            <Text style={styles.sheetTitle}>Horario</Text>
            {DAY_KEYS.map((k) => {
              const mode = modeForDay(schedule[k]);
              const custom = customRange[k];
              return (
                <View key={k} style={styles.dayRow}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayLabel}>{DAY_LABELS[k]}</Text>
                    {mode === 'always' ? (
                      <Text style={styles.dayStatus}>24hs</Text>
                    ) : mode === 'closed' ? (
                      <Text style={styles.dayStatus}>Cerrado</Text>
                    ) : null}
                  </View>
                  <View style={styles.dayChips}>
                    <Chip
                      label="Disponible"
                      selected={mode === 'always'}
                      onPress={() => onPickDayMode(k, 'always')}
                      size="sm"
                    />
                    <Chip
                      label="Personalizar"
                      selected={mode === 'custom'}
                      onPress={() => onPickDayMode(k, 'custom')}
                      size="sm"
                    />
                    <Chip
                      label="No disponible"
                      selected={mode === 'closed'}
                      onPress={() => onPickDayMode(k, 'closed')}
                      size="sm"
                    />
                  </View>
                  {mode === 'custom' && custom ? (
                    <View style={styles.customTimeRow}>
                      <Input
                        value={custom.from}
                        onChangeText={(v) => onChangeCustomTime(k, 'from', v)}
                        placeholder="HH:MM"
                        keyboardType="numbers-and-punctuation"
                        autoCorrect={false}
                        style={styles.customTimeInput}
                      />
                      <Text style={styles.customDash}>—</Text>
                      <Input
                        value={custom.to}
                        onChangeText={(v) => onChangeCustomTime(k, 'to', v)}
                        placeholder="HH:MM"
                        keyboardType="numbers-and-punctuation"
                        autoCorrect={false}
                        style={styles.customTimeInput}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </BottomSheetModal>

        {/* ---- Rules ---- */}
        <Card variant="default" padding="md" style={styles.card}>
          <Text style={styles.sectionTitle}>Reglas</Text>
          <Input
            label="Reglas del anfitrión (opcional)"
            value={rules}
            onChangeText={setRules}
            placeholder="Ej: estacionar en línea, no bloquear el garage..."
            maxLength={300}
          />
          <View style={styles.charCounter}>
            <Text style={styles.charCounterText}>{rules.length}/300</Text>
          </View>
        </Card>

        {/* ---- Mutation error ---- */}
        {mutationError ? (
          <View style={styles.hint}>
            <Text style={styles.hintText}>{mutationError.userMessage}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* ---- Sticky Guardar CTA ---- */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Button
          label="Guardar cambios"
          variant="primary"
          fullWidth
          size="lg"
          loading={isPending}
          disabled={isPending}
          onPress={onSave}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

/* ------------------------------------------------------------------ */
/* Loading skeleton                                                     */
/* ------------------------------------------------------------------ */

function EditChargerSkeleton({ topInset }: { topInset: number }): React.JSX.Element {
  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: topInset + spacing.sm }]}>
        <View style={styles.backButtonPlaceholder} />
        <Text style={styles.headerTitle} numberOfLines={1}>Editar cargador</Text>
      </View>
      <View style={styles.skeletonCenter}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                               */
/* ------------------------------------------------------------------ */

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

  skeletonCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: { gap: spacing.sm },

  sectionTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },

  charCounter: { alignItems: 'flex-end' },
  charCounterText: { ...typography.caption, color: colors.textSecondary },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  adornmentText: { ...typography.body, color: colors.textSecondary, fontWeight: '600' },

  /* ---- Photo grid ---- */
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoCell: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  photoThumb: { width: '100%', height: '100%' },
  photoDeleteBtn: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddCell: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  photoAddLabel: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  photoCounter: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },

  /* ---- Summary cards ---- */
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  summaryDetail: { ...typography.caption, color: colors.textSecondary },

  /* ---- Schedule ---- */
  dayRow: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayLabel: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  dayStatus: { ...typography.caption, color: colors.textSecondary },
  dayChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  customTimeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  customTimeInput: { flex: 1 },
  customDash: {
    ...typography.body,
    color: colors.textSecondary,
    paddingBottom: spacing.md,
  },

  /* ---- Error hint ---- */
  hint: {
    backgroundColor: colors.dangerSurface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
  },
  hintText: { ...typography.caption, color: colors.danger },

  /* ---- CTA bar ---- */
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

  /* ---- Bottom sheet ---- */
  sheetBg: { backgroundColor: colors.surface },
  sheetContent: { padding: spacing.lg, gap: spacing.base },
  sheetTitle: { ...typography.title, color: colors.textPrimary },

  /* ---- Skeleton ---- */
  backButtonPlaceholder: { width: 24, height: 24 },
  skeletonSpacerSm: { marginTop: spacing.sm },
});
