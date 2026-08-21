process.env.DB_CONNECTION = 'sqlite';
process.env.DB_DATABASE = ':memory:';

import { describe, expect, it } from 'vitest';
import { Gate } from '../../src/auth/Gate';
import { AuthorizationException } from '../../src/support/exceptions';
import { User } from '../../app/Models/User';
import { UserPolicy } from '../../app/Policies/UserPolicy';
import { freshApp } from '../helpers/db';

describe('Gate (Phase 4)', () => {
  it('define() gates a plain ability for a bound user', async () => {
    const app = await freshApp();
    const admin = await User.create({ name: 'Admin', email: 'a@chava.dev', password: 'x', is_admin: true });
    const member = await User.create({ name: 'Member', email: 'm@chava.dev', password: 'x', is_admin: false });

    const gate = app.make<Gate>('gate');
    gate.define('manage-users', (user) => user?.getAttribute('is_admin') === true);

    expect(await gate.forUser(admin).allows('manage-users')).toBe(true);
    expect(await gate.forUser(member).allows('manage-users')).toBe(false);
    expect(await gate.forUser(member).denies('manage-users')).toBe(true);
  });

  it('authorize() throws AuthorizationException when denied', async () => {
    const app = await freshApp();
    const member = await User.create({ name: 'Member', email: 'm2@chava.dev', password: 'x', is_admin: false });
    const gate = app.make<Gate>('gate');
    gate.define('manage-users', (user) => user?.getAttribute('is_admin') === true);

    await expect(gate.forUser(member).authorize('manage-users')).rejects.toBeInstanceOf(AuthorizationException);
  });

  it('checks multiple abilities via check()/any()/none()', async () => {
    const app = await freshApp();
    const admin = await User.create({ name: 'Admin', email: 'a2@chava.dev', password: 'x', is_admin: true });
    const gate = app.make<Gate>('gate');
    gate.define('one', () => true);
    gate.define('two', (user) => user?.getAttribute('is_admin') === true);

    expect(await gate.forUser(admin).check(['one', 'two'])).toBe(true);
    expect(await gate.forUser(admin).any(['nope', 'two'])).toBe(true);
    expect(await gate.forUser(admin).none(['nope'])).toBe(true);
  });

  it('resolves abilities through a registered policy', async () => {
    const app = await freshApp();
    const alice = await User.create({ name: 'Alice', email: 'alice@chava.dev', password: 'x', is_admin: false });
    const bob = await User.create({ name: 'Bob', email: 'bob@chava.dev', password: 'x', is_admin: false });
    const admin = await User.create({ name: 'Admin', email: 'a3@chava.dev', password: 'x', is_admin: true });

    const gate = app.make<Gate>('gate');
    gate.policy(User, UserPolicy);

    // Users can delete themselves; admins can delete anyone.
    expect(await gate.forUser(alice).allows('delete', alice)).toBe(true);
    expect(await gate.forUser(alice).allows('delete', bob)).toBe(false);
    expect(await gate.forUser(admin).allows('delete', bob)).toBe(true);
    expect(await gate.forUser(admin).allows('view', bob)).toBe(true);
    expect(await gate.forUser(alice).allows('view', bob)).toBe(false);
  });

  it('before() callbacks can override every ability', async () => {
    const app = await freshApp();
    const admin = await User.create({ name: 'Admin', email: 'a4@chava.dev', password: 'x', is_admin: true });
    const gate = app.make<Gate>('gate');
    gate.define('anything', () => false);
    gate.before((user) => (user?.getAttribute('is_admin') === true ? true : undefined));
    expect(await gate.forUser(admin).allows('anything')).toBe(true);
  });
});
