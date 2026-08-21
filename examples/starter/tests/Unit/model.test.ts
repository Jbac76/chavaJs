import { beforeEach, describe, expect, it } from 'vitest';
import { freshApp } from '../helpers/db';
import { Post } from '../../app/Models/Post';
import { User } from '../../app/Models/User';

describe('Model', () => {
  beforeEach(async () => {
    await freshApp();
  });

  it('creates and finds a user, applying casts and hidden attributes', async () => {
    const user = await User.create({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'secret',
      is_admin: true,
    });

    expect(user.getKey()).toBe(1);
    expect(user.wasRecentlyCreated()).toBe(true);

    const found = await User.find(1);
    expect(found).toBeDefined();
    expect(found?.getAttribute('name')).toBe('Ada Lovelace');
    expect(found?.getAttribute('is_admin')).toBe(true);

    const data = found?.toArray() as Record<string, unknown>;
    expect(data.password).toBeUndefined();
    expect(data.is_admin).toBe(true);
  });

  it('respects fillable mass-assignment protection', async () => {
    const user = await User.create({
      name: 'Grace Hopper',
      email: 'grace@example.com',
      password: 'x',
      id: 500,
    });

    // `id` is not fillable, so the DB auto-increments instead.
    expect(user.getKey()).not.toBe(500);
    expect(await User.find(500)).toBeUndefined();
  });

  it('updates only dirty attributes', async () => {
    const user = await User.create({
      name: 'Old Name',
      email: 'old@example.com',
      password: 'x',
    });
    user.name = 'New Name';
    await user.save();

    const found = await User.find(1);
    expect(found?.getAttribute('name')).toBe('New Name');
    expect(found?.getAttribute('email')).toBe('old@example.com');
  });

  it('supports update() with fillable filtering and query-builder updates', async () => {
    await User.create({ name: 'A', email: 'a@example.com', password: 'x' });
    await User.where('email', 'a@example.com').update({ name: 'B' });
    expect((await User.find(1))?.getAttribute('name')).toBe('B');
  });

  it('soft deletes by default and can restore', async () => {
    const user = await User.create({ name: 'C', email: 'c@example.com', password: 'x' });

    expect(await user.delete()).toBe(true);
    expect(user.trashed()).toBe(true);

    // The global scope excludes trashed rows…
    expect(await User.count()).toBe(0);
    expect(await User.find(1)).toBeUndefined();
    // …but withTrashed() / onlyTrashed() reveal them.
    expect(await User.withTrashed().count()).toBe(1);
    expect(await User.onlyTrashed().count()).toBe(1);

    await user.restore();
    expect(user.trashed()).toBe(false);
    expect(await User.count()).toBe(1);
  });

  it('keeps user wheres when toggling the soft-delete scope', async () => {
    const user = await User.create({ name: 'Filtered', email: 'filter@example.com', password: 'x' });
    await user.delete();

    // withTrashed() must drop the scope but keep the email filter.
    expect(await User.where('email', 'filter@example.com').withTrashed().count()).toBe(1);
    expect(await User.where('email', 'other@example.com').withTrashed().count()).toBe(0);
    expect(await User.where('email', 'filter@example.com').count()).toBe(0);
  });

  it('runs model observers on create/update/delete', async () => {
    const events: string[] = [];
    User.on('created', () => events.push('created'));
    User.on('updated', () => events.push('updated'));
    User.on('deleting', () => events.push('deleting'));

    const user = await User.create({ name: 'D', email: 'd@example.com', password: 'x' });
    user.name = 'D2';
    await user.save();
    await user.delete();

    expect(events).toEqual(['created', 'updated', 'deleting']);
  });

  it('supports paginate and chunk', async () => {
    for (let i = 1; i <= 5; i++) {
      await User.create({ name: `User ${i}`, email: `u${i}@example.com`, password: 'x' });
    }

    const page = await User.orderBy('id').paginate(2, 1);
    expect(page.total).toBe(5);
    expect(page.per_page).toBe(2);
    expect(page.last_page).toBe(3);
    expect(page.data).toHaveLength(2);
    expect(page.from).toBe(1);
    expect(page.to).toBe(2);

    const names: string[] = [];
    await User.orderBy('id').chunk(2, (items) => {
      for (const item of items) names.push(String((item as User).getAttribute('name')));
    });
    expect(names).toHaveLength(5);
  });

  it('supports firstOrCreate and updateOrCreate', async () => {
    const attributes = { email: 'dup@example.com' };
    const first = await User.firstOrCreate(attributes, { name: 'First', password: 'x' });
    const second = await User.firstOrCreate(attributes, { name: 'Second', password: 'x' });

    expect(first.getKey()).toBe(second.getKey());

    const updated = await User.updateOrCreate(attributes, { name: 'Renamed' });
    expect(updated.getAttribute('name')).toBe('Renamed');
    expect(await User.count()).toBe(1);
  });

  it('hydrates posts through a hasMany relation instance', async () => {
    const user = (await User.create({ name: 'E', email: 'e@example.com', password: 'x' })) as User;
    await user.posts().create({ title: 'Hello', body: 'World' });

    expect(await Post.count()).toBe(1);
    expect((await Post.first())?.getAttribute('user_id')).toBe(user.getKey());
  });
});
