import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Signed-value helpers for the session cookie. The cookie value is
 * `<id>.<hmac-sha256(id, appKey)>` — the client can read the id but cannot
 * forge one, mirroring Laravel's encrypted session cookie (we sign rather
 * than encrypt, since the id itself isn't secret).
 */
export function signValue(value: string, key: string): string {
  const signature = createHmac('sha256', key).update(value).digest('hex');
  return `${value}.${signature}`;
}

/** Verify a signed value; returns the original value or null when tampered. */
export function verifySignature(signed: string, key: string): string | null {
  const lastDot = signed.lastIndexOf('.');
  if (lastDot <= 0) return null;
  const value = signed.slice(0, lastDot);
  const signature = signed.slice(lastDot + 1);
  const expected = createHmac('sha256', key).update(value).digest('hex');
  const a = Buffer.from(signature, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? value : null;
}

/** A stable per-process fallback key when APP_KEY is not configured. */
export function resolveSigningKey(configuredKey: string | undefined): string {
  if (configuredKey && configuredKey.length > 0) return configuredKey;
  return process.env.CHAVA_SESSION_KEY ?? (process.env.CHAVA_SESSION_KEY = randomBytes(32).toString('hex'));
}

/** Constant-time string comparison (used by the CSRF middleware). */
export function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
