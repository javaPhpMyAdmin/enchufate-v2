/**
 * TanStack Query — AsyncStorage persister.
 *
 * Mirrors the React Query cache into `@react-native-async-storage/async-storage`
 * so the user sees a non-empty inbox / reservation list the moment the JS
 * bundle finishes loading, even before the first network round-trip lands.
 *
 * **Why a persister?** The mock data path resolves in 200ms so the
 * perceived benefit is small, but the real path (Phase 7+) hits Supabase
 * over the network — the persister keeps the last-known list visible
 * during that window. For the messaging screen, the persisted cache
 * also covers the "opened the app offline" edge case (the user can
 * read the last batch of messages until connectivity returns).
 *
 * **Why a 24-hour `maxAge`** — most app sessions are continuous; the
 * persister only matters after a cold start. 24h covers the realistic
 * "phone was off overnight" gap. Anything older is safer to refetch
 * from the server (the SQL RLS could have changed in the meantime).
 *
 * **Storage key** namespaced with the app slug so we never collide with
 * other React Query caches on the same device.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

import { queryClient } from '@/lib/queryClient';

const STORAGE_KEY = 'enchufate-v2-query-cache';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * AsyncStorage-backed persister for the shared `queryClient`.
 *
 * The returned object is consumed by `persistQueryClient(...)` in
 * `app/_layout.tsx` (mounted once, on app boot). The persister
 * itself is just a `{ getItem, setItem, removeItem }` shim around
 * the `AsyncStorage` singleton.
 */
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: STORAGE_KEY,
  throttleTime: 1000,
});

/**
 * How long a cached entry stays "fresh" before being discarded on
 * the next boot. Exported so the wiring in `app/_layout.tsx` and
 * the persister agree on the same value.
 */
export const QUERY_CACHE_MAX_AGE_MS = MAX_AGE_MS;
