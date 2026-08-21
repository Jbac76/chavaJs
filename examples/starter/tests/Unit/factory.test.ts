import { beforeEach, describe, expect, it } from 'vitest';
import { freshApp } from '../helpers/db';
import { PostFactory } from '../../database/factories/PostFactory';
import { UserFactory } from '../../database/factories/UserFactory';
import { Post } from '../../app/Models/Post';
import { User } from '../../app/Models/User';

describe('Factories', () => {
  beforeEach(async () => {
    await freshApp();
  });

  it('builds a model without persisting (make)', async () => {
    const user = UserFactory.new().make();

    expect(String(user.getAttribute('name'))).toBeTruthy();
    expect(user.exists()).toBe(false);
    expect(await User.count()).toBe(0);
  });

  it('persists a single model (create)', async () => {
    const user = await UserFactory.new().create();
    expect((user as User).exists()).toBe(true);
    expect(await User.count()).toBe(1);
  });

  it('persists many models with count() and applies state overrides', async () => {
    const users = (await UserFactory.new().count(3).state({ is_admin: true }).create()) as User[];

    expect(users).toHaveLength(3);
    for (const user of users) {
      expect(user.getAttribute('is_admin')).toBe(true);
    }
    expect(await User.count()).toBe(3);
  });

  it('associates related models through for()', async () => {
    const user = await User.create({ name: 'Ada', email: 'ada@example.com', password: 'x' });
    await PostFactory.new().count(2).for(user).create();

    expect(await Post.count()).toBe(2);
    expect(await Post.where('user_id', user.getKey()).count()).toBe(2);
  });

  it('persists many models explicitly with createMany()', async () => {
    const user = await User.create({ name: 'Ada', email: 'ada@example.com', password: 'x' });
    const posts = (await PostFactory.new().for(user).createMany(2)) as Post[];
    expect(posts).toHaveLength(2);
    expect(await Post.count()).toBe(2);
  });
});
