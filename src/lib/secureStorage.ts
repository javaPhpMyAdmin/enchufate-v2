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
 * The shape matches `SupportedStorage = PromisifyMethods<Pick<Storage,
 * 'getItem' | 'setItem' | 'removeItem'>>` (see
 * `node_modules/@supabase/auth-js/dist/module/lib/types.d.ts`) so we
 * can pass `secureStorage` directly to `createClient(url, key, { auth:
 * { storage: secureStorage } })`.
 */
import * as SecureStore from 'expo-secure-store';

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
  if (await isSecureStoreAvailable()) {
    return SecureStore.getItemAsync(key);
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    webWarn('getItem');
    return window.localStorage.getItem(key);
  }
  return null;
}

export async function setItem(key: string, value: string): Promise<void> {
  if (await isSecureStoreAvailable()) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    webWarn('setItem');
    window.localStorage.setItem(key, value);
    return;
  }
}

export async function removeItem(key: string): Promise<void> {
  if (await isSecureStoreAvailable()) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
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
