/**
 * Publish wizard — step 4: photos.
 *
 * Lets the host pick up to 5 photos via `expo-image-picker`'s
 * native library (`launchImageLibraryAsync` with
 * `allowsMultipleSelection: true` and `selectionLimit: 5 - current`).
 * Picked photos are compressed via `compressImage` (in
 * `src/lib/imageUpload.ts`) BEFORE being stored in `publishStore`,
 * so the eventual upload to Supabase Storage in PR-D's
 * `usePublishCharger` mutation is already network-friendly.
 *
 * **Layout**: 2-column grid where each cell is either:
 *   - an "+ Agregar" tile (when the slot is empty), or
 *   - a `Pressable` thumbnail (when a photo is selected) with a
 *     red `X` delete button pinned to the top-right corner.
 * The grid is 2 columns because 2×N squares render cleanly on
 * phone screens (a 3-column grid would shrink each tile below the
 * 88pt minimum touch target the `X` button needs).
 *
 * **Live counter**: "N de 5 seleccionadas" updates as the user
 * picks / deletes photos. The Siguiente CTA in
 * `<PublishWizardNav />` stays disabled until `validateStep4`
 * returns valid (≥1 photo).
 *
 * **Error handling**: a single `error` state captures both the
 * picker cancel and the `compressImage` `AppError`. The picker
 * cancellation is silent (we don't show an error for it — that's
 * the user's choice to back out), but a compression failure
 * surfaces a `danger`-tinted hint with the voseo copy from
 * `AppError.userMessage`.
 */
import { useCallback, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isAppError } from '@/lib/error';
import { compressImage } from '@/lib/imageUpload';
import {
  PUBLISH_PHOTOS_MAX,
  usePublishStore,
  validateStep4,
  type PublishStep,
} from '@/stores/publishStore';
import { colors, radius, spacing, typography } from '@/theme';

/** Spacing between grid cells. Kept as a token so the column gap stays consistent. */
const GRID_GAP = spacing.sm;

export default function PublishStep4Photos(): React.JSX.Element {
  const insets = useSafeAreaInsets();

  // On mount, make sure the store's `step` matches the route. The
  // layout's useEffect also does this; the screen-level sync keeps
  // things correct if the user lands here via a stale deep link.
  const step = usePublishStore((s) => s.step);
  const setStep = usePublishStore((s) => s.setStep);
  if (step !== (4 as PublishStep)) setStep(4);

  const photos = usePublishStore((s) => s.photos);
  const setPhotos = usePublishStore((s) => s.setPhotos);

  // Local "is the picker open / compression running" flag — used
  // to disable the Agregar tile so the user can't double-tap and
  // fire two pickers at once.
  const [busy, setBusy] = useState(false);
  // Local error state — set by the picker or by `compressImage`.
  // `null` means "no error to show". Picker cancellation is a no-op
  // (we don't surface it as an error — that's the user's choice).
  const [error, setError] = useState<string | null>(null);

  const onPickPhotos = useCallback(async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const remaining = PUBLISH_PHOTOS_MAX - photos.length;
      if (remaining <= 0) return;

      // `selectionLimit: remaining` so the user can't pick more
      // than we have room for. The OS picker enforces this on
      // iOS 14+ and Android (expo-image-picker 17.x).
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 1, // we re-encode in `compressImage`; keep the picker raw
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return; // user backed out — silent, no error
      }

      // Compress every picked photo BEFORE mutating the store. If
      // any compression throws, we leave the store untouched and
      // surface the error to the user (no half-applied state).
      const compressed = await Promise.all(
        result.assets.map((asset) =>
          compressImage(asset.uri, {
            maxWidth: 1600,
            quality: 0.8,
            maxBytes: 8 * 1024 * 1024,
          }),
        ),
      );

      setPhotos([...photos, ...compressed.map((c) => c.uri)]);
    } catch (e) {
      // `compressImage` already throws `AppError`. The picker
      // surface doesn't throw — it returns a `canceled` result.
      // Anything else is unexpected, so we wrap it generically.
      if (isAppError(e)) {
        setError(e.userMessage);
      } else {
        setError('No pudimos agregar las fotos. Intentá de nuevo.');
      }
    } finally {
      setBusy(false);
    }
  }, [busy, photos, setPhotos]);

  const onDeletePhoto = useCallback(
    (index: number) => {
      setError(null);
      setPhotos(photos.filter((_, i) => i !== index));
    },
    [photos, setPhotos],
  );

  const validation = validateStep4({ photos });

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Subí hasta 5 fotos</Text>
          <Text style={styles.subtitle}>
            Mostrale a los demás cómo es tu cargador.
          </Text>
        </View>

        <View style={styles.grid}>
          {photos.map((uri, index) => (
            <View key={`${uri}-${index}`} style={[styles.cell, styles.cellPhoto]}>
              <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
              <Pressable
                onPress={() => onDeletePhoto(index)}
                accessibilityRole="button"
                accessibilityLabel="Quitar foto"
                hitSlop={8}
                style={styles.deleteBtn}
              >
                <X size={16} color={colors.textOnPrimary} strokeWidth={3} />
              </Pressable>
            </View>
          ))}
          {photos.length < PUBLISH_PHOTOS_MAX ? (
            <Pressable
              onPress={onPickPhotos}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Agregar fotos"
              style={({ pressed }) => [
                styles.cell,
                styles.cellAdd,
                { opacity: busy ? 0.5 : pressed ? 0.85 : 1 },
              ]}
            >
              <ImagePlus size={28} color={colors.primary} />
              <Text style={styles.addLabel}>Agregar</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.counter}>
          {photos.length} de {PUBLISH_PHOTOS_MAX} seleccionadas
        </Text>

        {!validation.valid ? (
          <View style={styles.hint}>
            {validation.errors.map((msg) => (
              <Text key={msg} style={styles.hintText}>
                {msg}
              </Text>
            ))}
          </View>
        ) : null}

        {error ? (
          <View style={styles.hint}>
            <Text style={styles.hintText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: {
    padding: spacing.base,
    gap: spacing.base,
  },
  header: { gap: spacing.xs },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  cell: {
    // 2 columns: each cell is roughly half the available width minus the gap.
    // We use `width: '48%'` (not 50%) so the gap doesn't push the second
    // column onto a new line on phones with even pixel widths.
    width: '48%',
    aspectRatio: 1,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  cellPhoto: {
    backgroundColor: colors.surface,
  },
  cellAdd: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  deleteBtn: {
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
  addLabel: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  counter: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  hint: {
    backgroundColor: colors.dangerSurface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
  },
  hintText: { ...typography.caption, color: colors.danger },
});
