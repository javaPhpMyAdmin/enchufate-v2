/**
 * Review form — `/review/[reservationId]`.
 *
 * Route-level screen where the renter leaves a star rating + optional
 * text review for a completed reservation. Gated by CHARGER_REVIEWS.
 *
 * Flow:
 *   1. Fetch reservation via useReservation
 *   2. Validate eligibility via useReviewEligibility
 *   3. User picks stars + optional text
 *   4. Submit via useCreateReview
 *   5. Navigate back on success
 */
import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Icon } from '@/components/atoms/Icon';
import { ErrorState } from '@/components/molecules/ErrorState';
import { LoadingState } from '@/components/molecules/LoadingState';
import { useCreateReview } from '@/features/reviews/hooks/useCreateReview';
import { useReviewEligibility } from '@/features/reviews/hooks/useReviewEligibility';
import { useResolvedAddress } from '@/features/chargers/hooks/useResolvedAddress';
import { useReservation } from '@/features/reservations/hooks/useReservation';
import { isFeatureEnabled } from '@/lib/features';
import { colors, radius, spacing, typography } from '@/theme';

import { StarPicker } from '@/features/reviews/components/StarPicker';

const MAX_TEXT_LENGTH = 1000;

export default function ReviewFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ reservationId?: string }>();
  const reservationId =
    typeof params.reservationId === 'string' ? params.reservationId : null;

  const reservation = useReservation(reservationId);
  const eligibility = useReviewEligibility(reservationId);
  const { createReview, isPending, error: createError } = useCreateReview();

  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');

  const r = reservation.data;

  // Resolve the charger address to human-readable form. Some chargers
  // were published before reverse geocoding was reliable, so their
  // `address` field contains raw coordinates — this hook detects that
  // and geocodes them. Must live ABOVE the early returns (hooks rule).
  const resolvedAddress = useResolvedAddress(
    r?.charger_address ?? '',
    r?.charger_lat ?? -34.9,
    r?.charger_lng ?? -56.2,
  );

  // NOTE: this useCallback lives ABOVE the early returns. Hooks must
  // run unconditionally on every render — placing them after a return
  // changes the hook count between renders ("Rendered more hooks than
  // during the previous render").
  const handleSubmit = useCallback(async () => {
    if (!r) return;

    if (rating < 1 || rating > 5) {
      Alert.alert('Calificación requerida', 'Elegí una calificación del 1 al 5.');
      return;
    }

    const trimmedText = text.trim();
    if (trimmedText.length > MAX_TEXT_LENGTH) {
      Alert.alert('Texto demasiado largo', `Máximo ${MAX_TEXT_LENGTH} caracteres.`);
      return;
    }

    try {
      await createReview({
        reservationId: r.id,
        chargerId: r.charger_id,
        rating,
        text: trimmedText.length > 0 ? trimmedText : null,
      });
      Alert.alert('¡Reseña enviada!', 'Gracias por tu opinión.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      // Error is surfaced via createError below; the Alert in the
      // parent render will pick it up on the next render cycle.
    }
  }, [rating, text, createReview, r, router]);

  // --- Feature gate ---
  if (!isFeatureEnabled('CHARGER_REVIEWS')) {
    return (
      <View style={styles.flex}>
        <ErrorState
          title="No disponible"
          body="Las reseñas no están disponibles en este momento."
          onRetry={() => router.back()}
          retryLabel="Volver"
        />
      </View>
    );
  }

  // --- Route guard ---
  if (!reservationId) {
    return (
      <View style={styles.flex}>
        <ErrorState
          title="Reserva no encontrada"
          body="El enlace que seguiste no apunta a una reserva válida."
          onRetry={() => router.replace('/(tabs)' as never)}
          retryLabel="Volver al inicio"
        />
      </View>
    );
  }

  // --- Loading ---
  if (reservation.isLoading || eligibility.isLoading) {
    return <LoadingState label="Cargando..." />;
  }

  // --- Error ---
  if (reservation.error) {
    return (
      <ErrorState
        body={reservation.error.userMessage}
        onRetry={() => reservation.refetch()}
        retryLabel="Reintentar"
      />
    );
  }

  if (!r) {
    return (
      <ErrorState
        title="Reserva no encontrada"
        body="No encontramos esta reserva."
        onRetry={() => router.replace('/(tabs)' as never)}
        retryLabel="Volver al inicio"
      />
    );
  }

  // --- Not eligible ---
  if (eligibility.data && !eligibility.data.canReview) {
    return (
      <View style={styles.flex}>
        <ErrorState
          title="Ya dejaste una reseña"
          body="No podés dejar más de una reseña por reserva."
          onRetry={() => router.back()}
          retryLabel="Volver"
        />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Icon icon={ChevronLeft} size="lg" color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Dejar reseña
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Charger info */}
        <Card variant="default" padding="md" style={styles.card}>
          <Text style={styles.chargerTitle} numberOfLines={2}>
            {r.charger_title}
          </Text>
          <Text style={styles.chargerAddress} numberOfLines={1}>
            {resolvedAddress.data ?? r.charger_address}
          </Text>
        </Card>

        {/* Rating picker */}
        <Card variant="default" padding="md" style={styles.card}>
          <Text style={styles.label}>Calificación</Text>
          <StarPicker value={rating} onChange={setRating} size="lg" />
        </Card>

        {/* Text input */}
        <Card variant="default" padding="md" style={styles.card}>
          <Text style={styles.label}>
            Comentario (opcional)
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Contanos tu experiencia..."
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={MAX_TEXT_LENGTH}
            textAlignVertical="top"
            style={styles.textInput}
          />
          <Text style={styles.charCount}>
            {text.length}/{MAX_TEXT_LENGTH}
          </Text>
        </Card>

        {/* Error from mutation */}
        {createError ? (
          <Text style={styles.errorText}>{createError.userMessage}</Text>
        ) : null}

        {/* Submit */}
        <Button
          label={isPending ? 'Enviando...' : 'Enviar reseña'}
          variant="primary"
          fullWidth
          size="lg"
          onPress={handleSubmit}
          disabled={isPending}
          style={styles.submitButton}
        />
      </ScrollView>
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

  card: { gap: spacing.sm },
  chargerTitle: { ...typography.title, color: colors.textPrimary },
  chargerAddress: { ...typography.body, color: colors.textSecondary },

  label: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },

  textInput: {
    ...typography.body,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 100,
    backgroundColor: colors.surface,
  },
  charCount: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'right',
  },

  errorText: {
    ...typography.body,
    color: colors.danger,
    textAlign: 'center',
  },

  submitButton: { marginTop: spacing.sm },
});
