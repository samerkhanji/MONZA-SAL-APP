/**
 * Validates the shape of a VAPID public key used by web-push.
 *
 * A P-256 VAPID public key is 65 raw bytes (1 uncompressed-point prefix + 32 X
 * + 32 Y), which encodes to exactly 87 URL-safe base64 characters (no padding).
 * Anything else is malformed; checking this at the boundary surfaces config
 * mistakes as a clean 503 rather than letting `webpush.setVapidDetails` throw
 * inside the request handler on every POST.
 */
const URL_SAFE_BASE64 = /^[A-Za-z0-9_-]+$/;
const VAPID_PUBLIC_KEY_LENGTH = 87;

export function isLikelyValidVapidPublicKey(key: string): boolean {
  if (typeof key !== "string") return false;
  if (key.length !== VAPID_PUBLIC_KEY_LENGTH) return false;
  return URL_SAFE_BASE64.test(key);
}
