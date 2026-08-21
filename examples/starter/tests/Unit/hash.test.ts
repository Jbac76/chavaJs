import { describe, expect, it } from 'vitest';
import { Hash, sha256 } from '../../src/auth/Hash';

describe('Hash (Phase 4)', () => {
  it('hashes and verifies a password', async () => {
    const hash = await Hash.make('secret-password');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await Hash.check('secret-password', hash)).toBe(true);
  });

  it('rejects wrong passwords and garbage input', async () => {
    const hash = await Hash.make('right');
    expect(await Hash.check('wrong', hash)).toBe(false);
    expect(await Hash.check('right', 'not-a-hash')).toBe(false);
    expect(await Hash.check('right', '')).toBe(false);
  });

  it('produces unique hashes for the same password', async () => {
    const a = await Hash.make('same');
    const b = await Hash.make('same');
    expect(a).not.toBe(b);
  });

  it('sha256 produces hex digests', () => {
    expect(sha256('hello')).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256('hello')).not.toBe(sha256('world'));
  });
});
