/**
 * usePublishCharger — mutation that finalizes the publish wizard.
 *
 * Reads the full `publishStore` state, validates the combined draft
 * with `chargerSchema.parse(...)`, uploads the photos to Supabase
 * Storage at `{ownerId}/{chargerId}/{index}.jpg`, then inserts the
 * charger row. On success invalidates the relevant query keys and
 * resets the store.
 *
 * **Phase 6 PR-D (this commit — MOCK data path)**:
 *   - The hook signature is the same as the real Phase 7 swap
 *     (`publish(): Promise<{ chargerId: string }>`, plus
 *     `isPending` + `error: AppError | null`).
 *   - Photo upload is simulated with a 400ms `setTimeout` per
 *     photo (the real path is in the `// TODO Phase 7` comment
 *     below — `fetch(uri).then(r => r.blob())` →
 *     `supabase.storage.from('charger-photos').upload(path, blob)`).
 *   - The insert is simulated with a 400ms `setTimeout` that
 *     returns a freshly-generated `chargerId` (the real path is
 *     `supabase.from('chargers').insert({ host_id, ...payload, photos: publicUrls })`).
 *   - The `publicUrls` array carries the URIs as-is; the real
 *     path will replace each entry with the public URL Supabase
 *     returns.
 *
 * Errors are normalized to `AppError` via `normalizeSupabaseError`
 * (defensive — the mock never errors today). The `kind: 'validation'`
 * case is special-cased so a `chargerSchema.parse` failure surfaces
 * as a typed `AppError` instead of leaking a Zod error to the UI.
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
import { usePublishStore } from '@/stores/publishStore';

import { useSession } from '@/features/auth/hooks/useSession';

const UPLOAD_DELAY_MS = 400;
const INSERT_DELAY_MS = 400;

/** Generates a v4-ish id without depending on `crypto.randomUUID` (older RN). */
function generateChargerId(): string {
  const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoRef?.randomUUID) {
    return cryptoRef.randomUUID();
  }
  // Fallback: timestamp + random — not RFC 4122 compliant but
  // unique enough for a local mock.
  return `mock-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

      // ----- 3. Photo upload (MOCK) -----
      // For each photo URI we simulate a 400ms upload and accumulate
      // the URI as-is in the `publicUrls` array. The real path will
      // fetch the file as a blob and call supabase.storage.from(...).
      const chargerId = generateChargerId();
      const publicUrls: string[] = [];
      for (const uri of draft.photos) {
        // TODO Phase 7: replace mock with real upload
        //   const blob = await fetch(uri).then((r) => r.blob());
        //   const path = `${user.id}/${chargerId}/${index}.jpg`;
        //   const { error: uploadErr } = await supabase.storage
        //     .from('charger-photos')
        //     .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        //   if (uploadErr) throw normalizeSupabaseError(uploadErr);
        //   publicUrls.push(supabase.storage.from('charger-photos').getPublicUrl(path).data.publicUrl);
        await new Promise((r) => setTimeout(r, UPLOAD_DELAY_MS));
        publicUrls.push(uri);
      }

      // ----- 4. Charger insert (MOCK) -----
      // The mock returns the generated id after 400ms. The real
      // path will insert and throw `normalizeSupabaseError` on failure.
      // TODO Phase 7: replace mock with real insert
      //   const { error: insertErr } = await supabase
      //     .from('chargers')
      //     .insert({ host_id: user.id, ...payload, photos: publicUrls });
      //   if (insertErr) throw normalizeSupabaseError(insertErr);
      await new Promise((r) => setTimeout(r, INSERT_DELAY_MS));

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
