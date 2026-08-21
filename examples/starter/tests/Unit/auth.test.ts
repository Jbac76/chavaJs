process.env.DB_CONNECTION = 'sqlite';
process.env.DB_DATABASE = ':memory:';

import { describe, expect, it } from 'vitest';
import { runWithRequestContext } from '../../src/foundation/request-context';
import { Request } from '../../src/http/Request';
import { SessionStore } from '../../src/session/SessionStore';
import { ArraySessionHandler } from '../../src/session/handlers';
import { EloquentUserProvider } from '../../src/auth/UserProvider';
import { SessionGuard } from '../../src/auth/SessionGuard';
import { Hash } from '../../src/auth/Hash';
import { User } from '../../app/Models/User';
import { freshApp } from '../helpers/db';

async function withSession<T>(fn: (request: Request) => Promise<T>): Promise<T> {
  const store = SessionStore.create('test-session', new ArraySessionHandler());
  store.load();
  const request = Request.create('GET', '/');
  request.setSession(store);
  return runWithRequestContext(request, {}, () => fn(request));
}

describe('Auth guards (Phase 4)', () => {
  it('EloquentUserProvider retrieves users by id and credentials', async () => {
    const app = await freshApp();
    const password = await Hash.make('secret');
    await User.create({ name: 'Taylor', email: 't@chava.dev', password, is_admin: false });

    const provider = new EloquentUserProvider(User);
    const byId = await provider.retrieveById(1);
    expect(byId?.getAttribute('email')).toBe('t@chava.dev');

    const byCredentials = await provider.retrieveByCredentials({ email: 't@chava.dev', password: 'whatever' });
    expect(byCredentials?.getAttribute('name')).toBe('Taylor');

    const validated = byCredentials
      ? await provider.validateCredentials(byCredentials, { email: 't@chava.dev', password: 'secret' })
      : false;
    expect(validated).toBe(true);

    const wrong = byCredentials
      ? await provider.validateCredentials(byCredentials, { email: 't@chava.dev', password: 'nope' })
      : true;
    expect(wrong).toBe(false);
  });

  it('SessionGuard logs in, remembers the user, and logs out', async () => {
    await freshApp();
    const password = await Hash.make('secret');
    await User.create({ name: 'Taylor', email: 't2@chava.dev', password, is_admin: false });

    const guard = new SessionGuard('web', new EloquentUserProvider(User));
    expect(await guard.check()).toBe(false);

    await withSession(async (request) => {
      expect(await guard.guest()).toBe(true);

      const ok = await guard.attempt({ email: 't2@chava.dev', password: 'secret' });
      expect(ok).toBe(true);
      expect(await guard.check()).toBe(true);
      expect(await guard.id()).toBe(1);
      // The session keeps the hashed login key and regenerates its id.
      expect(request.session()?.all().login_web_undefined).toBeUndefined();
      const loginKey = Object.keys(request.session()?.all() ?? {}).find((k) => k.startsWith('login_web_')) ?? '';
      expect(loginKey).not.toBe('');
      expect(request.session()?.get(loginKey)).toBe(1);
      expect(request.session()?.getId()).not.toBe('test-session'); // regenerated

      guard.logout();
      expect(await guard.check()).toBe(false);
    });
  });

  it('SessionGuard rejects bad credentials', async () => {
    await freshApp();
    const password = await Hash.make('secret');
    await User.create({ name: 'Taylor', email: 't3@chava.dev', password, is_admin: false });

    const guard = new SessionGuard('web', new EloquentUserProvider(User));
    await withSession(async () => {
      expect(await guard.attempt({ email: 't3@chava.dev', password: 'wrong' })).toBe(false);
      expect(await guard.check()).toBe(false);
    });
  });

  it('SessionGuard returns null for a missing session user', async () => {
    await freshApp();
    const guard = new SessionGuard('web', new EloquentUserProvider(User));
    await withSession(async () => {
      expect(await guard.user()).toBeNull();
    });
  });
});
