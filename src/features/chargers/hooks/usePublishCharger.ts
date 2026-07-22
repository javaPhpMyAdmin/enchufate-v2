/**
 * usePublishCharger — mutation that finalizes the publish wizard.
 *
 * Reads the full `publishStore` state, validates the combined draft
 * with `chargerSchema.parse(...)`, uploads the photos to Supabase
 * Storage at `{ownerId}/{chargerId}/{index}.jpg`, then inserts the
 * charger row. On success invalidates the relevant query keys and
 * resets the store.
 *
 * Photo upload: each compressed URI from the publish store is fetched
 * as a blob and uploaded to the `charger-photos` bucket. The public
 * URL is stored in the charger record's `photos` array.
 *
 * Errors are normalized to `AppError` via `normalizeSupabaseError`.
 * The validation case is special-cased so a `chargerSchema.parse`
 * failure surfaces as a typed `AppError` instead of leaking a Zod
 * error to the UI.
 *
 * Gated by `isFeatureEnabled('PUBLISH')` so the wizard can be
 * killed in one place without deleting the hook.
 */
import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { AppError, normalizeSupabaseError } from '@/lib/error';
import { chargerSchema } from '@/lib/schemas/charger';
import { isFeatureEnabled } from '@/lib/features';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { usePublishStore } from '@/stores/publishStore';

import { useSession } from '@/features/auth/hooks/useSession';
import { File as ExpoFile } from 'expo-file-system';

/** UUID v4 generator — no `crypto.randomUUID` dependency (Hermes). */
function uuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface UsePublishChargerResult {
  publish: () => Promise<{ chargerId: string }>;
  isPending: boolean;
  error: AppError | null;
}

export function usePublishCharger(): UsePublishChargerResult & {
  reset: () => void;
} {
  const router = useRouter();
  const { user } = useSession();
  const resetWizard = usePublishStore((s) => s.resetWizard);

  const mutation: UseMutationResult<{ chargerId: string }, AppError, void> = useMutation<
    { chargerId: string },
    AppError,
    void
  >({
    mutationFn: async () => {
      if (!isFeatureEnabled('PUBLISH')) {
        throw new AppError({
          code: 'feature_disabled',
          message: 'PUBLISH feature flag is off',
          userMessage: 'La publicación no está disponible en este momento.',
          retryable: false,
        });
      }
      if (!user?.id) {
        throw new AppError({
          code: 'no_user',
          message: 'usePublishCharger called without an authed user',
          userMessage: 'Necesitás iniciar sesión para publicar.',
          isAuthError: true,
          retryable: false,
        });
      }

      // ----- 1. Snapshot the full draft from the store -----
      const draft = usePublishStore.getState();
      const loc = draft.location;
      if (!loc || loc.lat === null || loc.lng === null) {
        // Defensive — validateStep2 should keep the Siguiente CTA
        // disabled on step 7 if step 2 was never completed. This is
        // a backstop in case the user mutates the store directly.
        throw new AppError({
          code: 'validation',
          message: 'publishStore.location is incomplete',
          userMessage: 'Faltan datos de la ubicación. Volvé al paso 2.',
          retryable: false,
        });
      }

      // ----- 2. Validate the combined draft against the Zod schema -----
      // We build the full payload (no `id` / `owner_id` / `status` /
      // timestamps — those are server-managed) and parse it through
      // `chargerSchema` so the client and the server share the same
      // constraints. A parse failure throws a `kind: 'validation'`
      // AppError instead of leaking the Zod error.
      const payload = {
        title: draft.name,
        description: draft.description,
        address: loc.address,
        lat: loc.lat,
        lng: loc.lng,
        connector_type: draft.connector_type as
          | 'tipo_1'
          | 'tipo_2'
          | 'ccs'
          | 'chademo'
          | 'tesla',
        power_kw: draft.power_kw as number,
        price_per_hour_usd: draft.pricing.price_per_hour_usd as number,
        min_reservation_minutes: draft.pricing.min_reservation_minutes,
        photos: draft.photos,
        rules: draft.rules.trim().length === 0 ? null : draft.rules,
        schedule: draft.schedule,
      };
      try {
        chargerSchema
          .omit({ id: true, owner_id: true, status: true, created_at: true, updated_at: true })
          .parse(payload);
      } catch (zodErr) {
        throw new AppError({
          code: 'validation',
          message: zodErr instanceof Error ? zodErr.message : 'chargerSchema.parse failed',
          userMessage: 'Faltan datos del cargador. Revisá los pasos anteriores.',
          retryable: false,
        });
      }

      // ----- 3. Photo upload -----
      // Generate a UUID v4 for the charger id. We need it before the
      // insert because the storage path uses it. Hermes doesn't have
      // `crypto.randomUUID`, so we generate one manually.
      const chargerId = uuidV4();
      const publicUrls: string[] = [];
      const storage = supabase.storage.from('charger-photos');

      for (let i = 0; i < draft.photos.length; i++) {
        const uri = draft.photos[i]!;
        const path = `${user.id}/${chargerId}/${i}.jpg`;

        // expo-file-system v57: File implements Blob, read as ArrayBuffer
        // directly. The old readAsStringAsync is removed.
        const file = new ExpoFile(uri);
        const arrayBuffer = await file.arrayBuffer();

        const { error: uploadErr } = await storage.upload(path, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        });
        if (uploadErr) throw normalizeSupabaseError(uploadErr);

        const { data: urlData } = storage.getPublicUrl(path);
        publicUrls.push(urlData.publicUrl);
      }

      // ----- 4. Charger insert -----
      const { error: insertErr } = await supabase.from('chargers').insert({
        id: chargerId,
        owner_id: user.id,
        title: payload.title,
        description: payload.description,
        address: payload.address,
        lat: payload.lat,
        lng: payload.lng,
        connector_type: payload.connector_type,
        power_kw: payload.power_kw,
        price_per_hour_usd: payload.price_per_hour_usd,
        min_reservation_minutes: payload.min_reservation_minutes,
        photos: publicUrls,
        rules: payload.rules,
        schedule: payload.schedule as unknown as Record<string, unknown>,
      });
      if (insertErr) throw normalizeSupabaseError(insertErr);

      // ----- 5. Side effects on success -----
      // Invalidate the charger list + the host's own list so the
      // new card appears on the next refetch, then wipe the draft
      // and navigate to the success screen.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['chargers'] }),
        queryClient.invalidateQueries({ queryKey: ['my-chargers', user.id] }),
      ]);
      resetWizard();

      return { chargerId };
    },
    onSuccess: () => {
      router.replace('/publish/success' as never);
    },
  });

  return {
    publish: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error ? normalizeSupabaseError(mutation.error) : null,
    reset: mutation.reset,
  };
}
