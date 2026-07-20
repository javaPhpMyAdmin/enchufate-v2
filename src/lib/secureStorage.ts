/**
 * Token storage adapter — bridges `expo-secure-store` to the
 * `SupportedStorage` interface that `@supabase/auth-js` expects.
 *
 * On iOS this stores values in the **Keychain**; on Android it uses
 * **EncryptedSharedPreferences**. On web (`expo-secure-store` is
 * unavailable there) we fall back to `window.localStorage` and log a
 * warning — the fallback is intentional so the same client module
 * loads under `pnpm start --web` during dev, but it is NOT safe for
 * production auth tokens. Document this when the web build ships.
 *
 * **Android size limit**: SecureStore on Android enforces a 2048-byte
 * limit per value. Supabase sessions with Google OAuth tokens often
 * exceed this. The adapter falls back to `AsyncStorage` for values
 * that don't fit, keeping SecureStore for smaller keys. This is safe
 * because the session is transient (JWT-signed, auto-refreshed) and
 * the fallback only fires when SecureStore physically can't hold it.
 *
 * The shape matches `SupportedStorage = PromisifyMethods<Pick<Storage,
 * 'getItem' | 'setItem' | 'removeItem'>>` (see
 * `node_modules/@supabase/auth-js/dist/module/lib/types.d.ts`) so we
 * can pass `secureStorage` directly to `createClient(url, key, { auth:
 * { storage: secureStorage } })`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/** Android SecureStore per-value size limit (bytes). */
const SECURE_STORE_LIMIT = 2000;

/** Prefix used for fallback keys in AsyncStorage. */
const AS_KEY_PREFIX = '__supabase_fallback__';

let availabilityCache: boolean | null = null;

/**
 * `expo-secure-store` exposes `isAvailableAsync()` which returns
 * `false` on web and throws on platforms where the module is not
 * linked (rare; the Expo SDK 50+ autolinking handles this). We
 * cache the result so we don't pay the bridge call on every
 * getItem/setItem.
 */
async function isSecureStoreAvailable(): Promise<boolean> {
  if (availabilityCache !== null) return availabilityCache;
  try {
    availabilityCache = await SecureStore.isAvailableAsync();
  } catch {
    availabilityCache = false;
  }
  return availabilityCache;
}

function webWarn(method: string): void {
  // eslint-disable-next-line no-console
  console.warn(
    `[secureStorage] expo-secure-store unavailable; using localStorage.${method} (web only). ` +
      'Do not ship this build to production — tokens are not encrypted.',
  );
}

export async function getItem(key: string): Promise<string | null> {
  // 1. Try SecureStore first.
  if (await isSecureStoreAvailable()) {
    const value = await SecureStore.getItemAsync(key);
    if (value !== null) return value;
  }

  // 2. Fall back to AsyncStorage (value was stored there because it
  //    exceeded the SecureStore size limit).
  try {
    const fallbackKey = AS_KEY_PREFIX + key;
    const value = await AsyncStorage.getItem(fallbackKey);
    if (value !== null) return value;
  } catch {
    // AsyncStorage unavailable or corrupted entry.
  }

  // 3. Web fallback.
  if (typeof window !== 'undefined' && window.localStorage) {
    webWarn('getItem');
    return window.localStorage.getItem(key);
  }

  return null;
}

export async function setItem(key: string, value: string): Promise<void> {
  // If the value fits in SecureStore, use it directly.
  if ((await isSecureStoreAvailable()) && value.length <= SECURE_STORE_LIMIT) {
    await SecureStore.setItemAsync(key, value);
    // Clean up any leftover fallback entry.
    try {
      await AsyncStorage.removeItem(AS_KEY_PREFIX + key);
    } catch { /* best-effort */ }
    return;
  }

  // Value exceeds SecureStore limit or SecureStore is unavailable.
  // Store in AsyncStorage with the fallback prefix.
  if (await isSecureStoreAvailable()) {
    try {
      await AsyncStorage.setItem(AS_KEY_PREFIX + key, value);
    } catch {
      // Last resort: try SecureStore anyway (may work on iOS where
      // there's no hard limit).
      await SecureStore.setItemAsync(key, value);
    }
    return;
  }

  // Web fallback.
  if (typeof window !== 'undefined' && window.localStorage) {
    webWarn('setItem');
    window.localStorage.setItem(key, value);
    return;
  }
}

export async function removeItem(key: string): Promise<void> {
  if (await isSecureStoreAvailable()) {
    await SecureStore.deleteItemAsync(key);
  }
  // Also remove any fallback entry.
  try {
    await AsyncStorage.removeItem(AS_KEY_PREFIX + key);
  } catch { /* best-effort */ }

  if (typeof window !== 'undefined' && window.localStorage) {
    webWarn('removeItem');
    window.localStorage.removeItem(key);
    return;
  }
}

/**
 * Adapter object — pass this to `createClient` as `auth.storage`.
 * The `isServer: false` flag tells `@supabase/auth-js` that values
 * read from this storage should be treated as authentic (it is
 * `true` for the SSR `cookie` storage, where the request could have
 * been tampered with upstream).
 */
export const secureStorage = {
  getItem,
  setItem,
  removeItem,
  isServer: false,
};
