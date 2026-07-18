/**
 * AppError — typed error surface for the whole app.
 *
 * Every Supabase / network / unknown error that bubbles up from a
 * feature hook is normalized to an `AppError` before it reaches the
 * UI. This gives the UI layer a stable shape to read (`code`,
 * `userMessage`, `isNetworkError`) so the right `<ErrorState />`
 * variant renders without the hook having to know about UI.
 *
 * Field set is a superset of the design contract (`design.md §4.5`):
 *   - `code`, `message`, `isAuthError`, `isNetworkError`, `retryable`
 *   - plus `userMessage` (Rioplatense voseo, safe to show) and
 *     `httpStatus` for API-level errors.
 *
 * The `message` field (inherited from `Error`) keeps the technical
 * detail for logs and Sentry. `userMessage` is what the UI displays.
 */
export class AppError extends Error {
  readonly code: string;
  readonly userMessage: string;
  readonly httpStatus?: number;
  readonly isAuthError: boolean;
  readonly isNetworkError: boolean;
  readonly retryable: boolean;

  constructor(opts: {
    code: string;
    message: string;
    userMessage: string;
    httpStatus?: number;
    isAuthError?: boolean;
    isNetworkError?: boolean;
    retryable?: boolean;
  }) {
    super(opts.message);
    this.name = 'AppError';
    this.code = opts.code;
    this.userMessage = opts.userMessage;
    if (opts.httpStatus !== undefined) {
      this.httpStatus = opts.httpStatus;
    }
    this.isAuthError = opts.isAuthError ?? false;
    this.isNetworkError = opts.isNetworkError ?? false;
    this.retryable = opts.retryable ?? false;
  }
}

/** Type guard: narrows `unknown` to `AppError` for callers. */
export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/**
 * Rioplatense voseo defaults for user-facing error copy.
 *
 * Tone: warm, direct, no jargon. These are intentionally short —
 * the UI wraps them in `<ErrorState title="..." body={error.userMessage} />`
 * and a retry button when `error.retryable` is true.
 */
const USER_MESSAGES = {
  chargersLoad: 'No pudimos cargar los cargadores. Intentá de nuevo.',
  chargerLoad: 'No pudimos cargar este cargador. Intentá de nuevo.',
  signIn: 'No pudimos iniciar sesión. Revisá tu correo y contraseña.',
  signUp: 'No pudimos crear tu cuenta. Intentá de nuevo en unos minutos.',
  signOut: 'No pudimos cerrar la sesión. Intentá de nuevo.',
  network: 'Sin conexión. Revisá tu internet e intentá de nuevo.',
  unauthorized: 'Esta acción necesita que inicies sesión.',
  forbidden: 'No tenés permiso para hacer esto.',
  notFound: 'No encontramos lo que buscás.',
  rateLimit: 'Hiciste demasiados intentos. Esperá un momento e intentá de nuevo.',
  generic: 'Ocurrió un error inesperado. Intentá de nuevo.',
} as const;

/**
 * Normalize any error into an `AppError`. Safe to call with `unknown`
 * (e.g. inside a `try`/`catch`) — the worst case is a generic
 * `AppError` with the Rioplatense generic message.
 *
 * Recognized shapes:
 *   - `AuthError` from `@supabase/auth-js` (has `name: 'AuthError'`
 *     or `status` 400/401).
 *   - `PostgrestError` from `@supabase/postgrest-js` (has `code`,
 *     `details`, `hint`, `message`).
 *   - `StorageError` from `@supabase/storage-js` (has
 *     `name: 'StorageError'`).
 *   - `TypeError` with `message` matching the network failure pattern
 *     (Fetch API surfaces these as "Network request failed" on RN).
 *   - Anything else → generic AppError, `retryable: true`.
 */
export function normalizeSupabaseError(error: unknown): AppError {
  // Already an AppError: pass through.
  if (isAppError(error)) {
    return error;
  }

  // Null / undefined: treat as a generic recoverable failure.
  if (error == null) {
    return new AppError({
      code: 'unknown',
      message: 'Unknown error (null/undefined)',
      userMessage: USER_MESSAGES.generic,
      retryable: true,
    });
  }

  // Plain Error / anything with a `message` string.
  if (typeof error === 'object' && 'message' in error) {
    const e = error as {
      name?: string;
      message?: string;
      code?: string | number;
      status?: number;
      details?: string;
    };

    const name = e.name ?? '';
    const message = typeof e.message === 'string' ? e.message : String(e.message ?? '');
    const httpStatus = typeof e.status === 'number' ? e.status : undefined;
    const errorCode = e.code != null ? String(e.code) : name || 'unknown';

    // Auth errors (Supabase AuthError, 401, 403).
    if (name === 'AuthError' || name === 'AuthApiError' || name === 'AuthSessionMissingError') {
      const isUnauthorized = httpStatus === 401 || name === 'AuthSessionMissingError';
      return new AppError({
        code: errorCode,
        message,
        userMessage: isUnauthorized ? USER_MESSAGES.unauthorized : USER_MESSAGES.signIn,
        httpStatus,
        isAuthError: true,
        retryable: !isUnauthorized,
      });
    }

    // Forbidden (403) — auth context is fine, but RLS said no.
    if (httpStatus === 403) {
      return new AppError({
        code: errorCode,
        message,
        userMessage: USER_MESSAGES.forbidden,
        httpStatus,
        isAuthError: false,
        retryable: false,
      });
    }

    // Rate limit (429).
    if (httpStatus === 429) {
      return new AppError({
        code: errorCode,
        message,
        userMessage: USER_MESSAGES.rateLimit,
        httpStatus,
        isAuthError: false,
        retryable: true,
      });
    }

    // Not found (404).
    if (httpStatus === 404) {
      return new AppError({
        code: errorCode,
        message,
        userMessage: USER_MESSAGES.notFound,
        httpStatus,
        isAuthError: false,
        retryable: false,
      });
    }

    // Network — RN's fetch surfaces failures as TypeError with this
    // signature; web fetch surfaces them as `TypeError: Failed to fetch`.
    if (name === 'TypeError' && /network|fetch/i.test(message)) {
      return new AppError({
        code: 'network',
        message,
        userMessage: USER_MESSAGES.network,
        isNetworkError: true,
        retryable: true,
      });
    }

    // PostgrestError — has `details` and `hint` fields. We surface
    // the message but keep the Rioplatense user-facing copy stable.
    if ('details' in e || 'hint' in e) {
      return new AppError({
        code: errorCode,
        message,
        userMessage: USER_MESSAGES.generic,
        httpStatus,
        retryable: httpStatus === undefined || httpStatus >= 500,
      });
    }

    // StorageError.
    if (name === 'StorageError') {
      return new AppError({
        code: errorCode,
        message,
        userMessage: USER_MESSAGES.generic,
        httpStatus,
        retryable: true,
      });
    }

    // Anything else with a status 5xx → server-side, retryable.
    if (httpStatus !== undefined && httpStatus >= 500) {
      return new AppError({
        code: errorCode,
        message,
        userMessage: USER_MESSAGES.generic,
        httpStatus,
        retryable: true,
      });
    }

    // Fallback for other Error-shaped objects.
    return new AppError({
      code: errorCode,
      message,
      userMessage: USER_MESSAGES.generic,
      httpStatus,
      retryable: true,
    });
  }

  // Non-object, non-null error (string, number, etc.) — treat as generic.
  return new AppError({
    code: 'unknown',
    message: String(error),
    userMessage: USER_MESSAGES.generic,
    retryable: true,
  });
}
