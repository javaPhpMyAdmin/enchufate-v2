/**
 * Image compression helper — wraps `expo-image-manipulator`.
 *
 * Use case: the publish wizard accepts up to 5 photos via
 * `expo-image-picker`. Phone photos routinely run 4–12 MB at
 * 3000+ px, which is overkill for a 1600-px charger card preview
 * and blows past the 8 MB Supabase Storage per-object limit. The
 * wizard compresses each picked photo BEFORE storing the URI in
 * the publish store so the eventual upload to the `charger-photos`
 * bucket (PR-D's `usePublishCharger` mutation) is already
 * network-friendly.
 *
 * Pure function shape: input URI, output `{ uri, width, height, bytes }`.
 * No global state, no React, no side effects beyond the manipulator
 * write. Errors are wrapped in `AppError` so callers can use the
 * existing `<ErrorState />` shape and the `isNetworkError`/`retryable`
 * fields the rest of the app consumes.
 *
 * **Why `base64` for the size check**: `expo-image-manipulator`'s
 * result doesn't include a `bytes` field. We request `base64: true`
 * in the save options and convert the base64 length back to bytes
 * (`base64.length * 3 / 4`) so the `maxBytes` guard runs against
 * the actual compressed payload, not a guess.
 */
import * as ImageManipulator from 'expo-image-manipulator';

import { AppError } from '@/lib/error';

export interface CompressOptions {
  /** Max width in px. The image is scaled to this width keeping aspect ratio. Default `1600`. */
  maxWidth?: number;
  /** JPEG quality 0..1. Default `0.8`. Lower → smaller bytes, more artifacts. */
  quality?: number;
  /** Reject the result if its on-disk size exceeds this (in bytes). Default `8 MB`. */
  maxBytes?: number;
}

export interface CompressedImage {
  /** URI to the compressed image (a local file path; safe as `<Image source>`). */
  uri: string;
  /** Resulting image width in pixels. */
  width: number;
  /** Resulting image height in pixels. */
  height: number;
  /** Estimated on-disk size of the compressed image, in bytes. */
  bytes: number;
}

const DEFAULT_MAX_WIDTH = 1600;
const DEFAULT_QUALITY = 0.8;
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Compress a single image URI. Returns the new URI + dimensions +
 * byte size. Throws an `AppError` if the result exceeds `maxBytes`.
 */
export async function compressImage(
  uri: string,
  options: CompressOptions = {},
): Promise<CompressedImage> {
  const maxWidth = options.maxWidth ?? DEFAULT_MAX_WIDTH;
  const quality = options.quality ?? DEFAULT_QUALITY;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  let result: ImageManipulator.ImageResult;
  try {
    result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      // `base64: true` so we can measure the exact payload size for
      // the `maxBytes` guard. The base64 string is discarded after
      // the size check; the caller uses `result.uri` for rendering.
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
  } catch (e) {
    throw new AppError({
      code: 'image_compress_failed',
      message: e instanceof Error ? e.message : String(e),
      userMessage: 'No pudimos procesar la foto. Probá con otra imagen.',
      retryable: true,
    });
  }

  // The base64 payload is the JPEG data. We can compute the exact
  // byte count (modulo any base64 padding) without writing the
  // file to disk. The `uri` we return is the on-disk file written
  // by the manipulator; both have the same byte count.
  const bytes = result.base64 ? estimateBase64Bytes(result.base64) : 0;

  if (bytes > maxBytes) {
    throw new AppError({
      code: 'image_too_large',
      message: `Compressed image is ${bytes} bytes, exceeds ${maxBytes} bytes`,
      userMessage: 'La foto es demasiado pesada incluso después de comprimirla. Elegí una más liviana.',
      retryable: false,
    });
  }

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    bytes,
  };
}

/**
 * Approximate the binary byte count of a base64-encoded string.
 * Each 4 base64 characters encode 3 binary bytes; trailing `=`
 * padding characters represent fewer. The result is exact for
 * standard base64 (no whitespace), which is what
 * `expo-image-manipulator` returns.
 */
function estimateBase64Bytes(base64: string): number {
  // Strip any padding so we can use a clean ratio.
  const clean = base64.replace(/=+$/, '');
  // Each base64 char is 6 bits → 4 chars = 3 bytes.
  return Math.floor((clean.length * 3) / 4);
}
