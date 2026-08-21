import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

/**
 * Password hashing — Laravel's Hash::make() / Hash::check(), powered by
 * node:crypto's scrypt (no bcrypt native dependency).
 *
 *   const hash = await Hash.make('secret');
 *   await Hash.check('secret', hash); // true
 */
export const Hash = {
  async make(value: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derived = await scrypt(value, salt, 64);
    return `scrypt$${salt}$${derived.toString('hex')}`;
  },

  async check(value: string, stored: string): Promise<boolean> {
    const [scheme, salt, hashHex] = stored.split('$');
    if (scheme !== 'scrypt' || !salt || !hashHex) return false;
    try {
      const candidate = await scrypt(value, salt, 64);
      const expected = Buffer.from(hashHex, 'hex');
      return candidate.length === expected.length && timingSafeEqual(candidate, expected);
    } catch {
      return false;
    }
  },
};

/** SHA-256 hex digest (used for personal access tokens). */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
