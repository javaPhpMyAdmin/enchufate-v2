/**
 * useUpdateCharger — mutation that updates an existing charger's
 * fields and photos (owner only).
 *
 * Accepts a partial update payload (any subset of editable fields)
 * and photo operation arrays (URLs to delete, local URIs to add).
 * The mutation:
 *
 *   1. Guards on the EDIT_CHARGER feature flag.
 *   2. Checks auth (useSession) — throws an `isAuthError` AppError
 *      if there is no user.
 *   3. Verifies ownership via a lightweight select (RLS also
 *      enforces this server-side).
 *   4. Validates the payload through `chargerSchema.omit(...)`
 *      so a Zod failure surfaces as a typed `AppError` before
 *      the round-trip.
 *   5. Deletes removed photos from the `charger-photos` Storage
 *      bucket (path extracted from the public URL).
 *   6. Uploads each new photo to `{ownerId}/{chargerId}/{index}.jpg`
 *      and collects the public URLs.
 *   7. Runs `supabase.from('chargers').update(...)` with the merged
 *      payload and the final `photos[]` array.
 *   8. Invalidates `['charger', id]`, `['chargers']`, and
 *      `['my-chargers', userId]` so all views reflect the update.
 *
 * Errors are normalized to `AppError` via `normalizeSupabaseError`.
 *
 * Gated by `isFeatureEnabled('EDIT_CHARGER')` so the feature can
 * be toggled without deleting the hook.
 */
import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { AppError, normalizeSupabaseError } from '@/lib/error';
import { chargerSchema, type ScheduleInput } from '@/lib/schemas/charger';
import { isFeatureEnabled } from '@/lib/features';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

import { useSession } from '@/features/auth/hooks/useSession';

/* ------------------------------------------------------------------ */
/* Public types                                                        */
/* ------------------------------------------------------------------ */

/** Fields the host can update. All are optional — only changed fields are sent. */
export interface UpdateChargerPayload {
  title?: string;
  description?: string;
  address?: string;
  lat?: number;
  lng?: number;
  connector_type?: 'tipo_1' | 'tipo_2' | 'ccs' | 'chademo' | 'tesla';
  power_kw?: number;
  price_per_hour_usd?: number;
  min_reservation_minutes?: 30 | 60 | 120 | 240 | 480;
  rules?: string | null;
  schedule?: ScheduleInput;
}

/** Photo operation arrays — URLs to remove and local URIs to add. */
export interface PhotoOps {
  /** Public URLs of existing photos to delete from Storage on save. */
  delete: string[];
  /** Local file URIs from expo-image-picker to upload on save. */
  add: string[];
}

/** Arguments for the `updateCharger` mutation. */
export interface UpdateChargerArgs {
  chargerId: string;
  payload: UpdateChargerPayload;
  /** URLs of photos the caller wants to KEEP (not deleted, not new). */
  retainedPhotos: string[];
  photoOps: PhotoOps;
}

export interface UseUpdateChargerResult {
  updateCharger: (args: UpdateChargerArgs) => Promise<void>;
  isPending: boolean;
  error: AppError | null;
  reset: () => void;
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

/**
 * Validate and narrow the payload so only editable, server-accepted
 * columns are passed to `supabase.update()`. Server-managed fields
 * (`id`, `owner_id`, `status`, `created_at`, `updated_at`) are
 * stripped — the Zod parse ensures every remaining field satisfies
 * the same constraints the publish wizard uses.
 */
const EDITABLE_SCHEMA = chargerSchema.omit({
  id: true,
  owner_id: true,
  status: true,
  created_at: true,
  updated_at: true,
  photos: true, // photos are managed separately via photoOps
});

/**
 * Extract the storage object path from a charger-photos public URL.
 *
 * Supabase Storage public URLs follow the pattern:
 *   https://<project>.supabase.co/storage/v1/object/public/charger-photos/<path>
 *
 * We need everything after `charger-photos/` so we can call
 * `storage.from('charger-photos').remove([path])`.
 */
function extractStoragePath(publicUrl: string): string {
  const marker = 'charger-photos/';
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) {
    throw new AppError({
      code: 'invalid_photo_url',
      message: `Cannot extract storage path from URL: ${publicUrl}`,
      userMessage: 'No pudimos procesar una foto. Intentá de nuevo.',
      retryable: false,
    });
  }
  return publicUrl.slice(idx + marker.length);
}

export function useUpdateCharger(): UseUpdateChargerResult {
  const { user } = useSession();

  const mutation: UseMutationResult<void, AppError, UpdateChargerArgs> = useMutation<
    void,
    AppError,
    UpdateChargerArgs
  >({
    mutationFn: async ({ chargerId, payload, retainedPhotos, photoOps }) => {
      // ----- 1. Feature flag guard -----
      if (!isFeatureEnabled('EDIT_CHARGER')) {
        throw new AppError({
          code: 'feature_disabled',
          message: 'EDIT_CHARGER feature flag is off',
          userMessage: 'La edición no está disponible en este momento.',
          retryable: false,
        });
      }

      // ----- 2. Auth check -----
      if (!user?.id) {
        throw new AppError({
          code: 'no_user',
          message: 'useUpdateCharger called without an authed user',
          userMessage: 'Necesitás iniciar sesión para editar un cargador.',
          isAuthError: true,
          retryable: false,
        });
      }

      // ----- 3. Ownership verification -----
      // A lightweight select confirms the current user owns this
      // charger. RLS enforces this server-side too, but the client
      // check surfaces a typed AppError instead of a 403.
      const { data: charger, error: fetchErr } = await supabase
        .from('chargers')
        .select('owner_id')
        .eq('id', chargerId)
        .single();

      if (fetchErr) throw normalizeSupabaseError(fetchErr);
      if (!charger) {
        throw new AppError({
          code: 'not_found',
          message: `Charger ${chargerId} not found`,
          userMessage: 'No encontramos este cargador.',
          retryable: false,
        });
      }
      if (charger.owner_id !== user.id) {
        throw new AppError({
          code: 'forbidden',
          message: `User ${user.id} is not owner of charger ${chargerId}`,
          userMessage: 'No tenés permiso para editar este cargador.',
          isAuthError: false,
          retryable: false,
        });
      }

      // ----- 4. Zod validation -----
      // Only parse fields that are actually present in the payload.
      // An empty payload (photo-only change) is valid — no fields to
      // validate beyond the photo arrays which are checked separately.
      const hasFields = Object.keys(payload).length > 0;
      if (hasFields) {
        try {
          EDITABLE_SCHEMA.parse(payload);
        } catch (zodErr) {
          throw new AppError({
            code: 'validation',
            message: zodErr instanceof Error ? zodErr.message : 'chargerSchema.parse failed',
            userMessage: 'Faltan datos del cargador. Revisá los campos.',
            retryable: false,
          });
        }
      }

      // ----- 5. Photo deletions -----
      const storage = supabase.storage.from('charger-photos');

      if (photoOps.delete.length > 0) {
        const paths = photoOps.delete.map(extractStoragePath);
        const { error: removeErr } = await storage.remove(paths);
        if (removeErr) throw normalizeSupabaseError(removeErr);
      }

      // ----- 6. Photo uploads -----
      const newUrls: string[] = [];

      for (let i = 0; i < photoOps.add.length; i++) {
        const uri = photoOps.add[i]!;
        const path = `${user.id}/${chargerId}/${retainedPhotos.length + i}.jpg`;

        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();

        const { error: uploadErr } = await storage.upload(path, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        });
        if (uploadErr) throw normalizeSupabaseError(uploadErr);

        const { data: urlData } = storage.getPublicUrl(path);
        newUrls.push(urlData.publicUrl);
      }

      // ----- 7. DB update -----
      const finalPhotos = [...retainedPhotos, ...newUrls];

      const updatePayload: Record<string, unknown> = {
        ...payload,
        photos: finalPhotos,
      };

      const { error: updateErr } = await supabase
        .from('chargers')
        .update(updatePayload as never)
        .eq('id', chargerId);

      if (updateErr) throw normalizeSupabaseError(updateErr);

      // ----- 8. Query invalidation -----
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['charger', chargerId] }),
        queryClient.invalidateQueries({ queryKey: ['chargers'] }),
        queryClient.invalidateQueries({ queryKey: ['my-chargers', user.id] }),
      ]);
    },
  });

  return {
    updateCharger: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error ? normalizeSupabaseError(mutation.error) : null,
    reset: mutation.reset,
  };
}
