import { beforeEach, describe, expect, it } from 'vitest';
import { Schema } from '../../src/facades';
import { Model } from '../../src/orm/Model';
import { freshApp } from '../helpers/db';
import { Post } from '../../app/Models/Post';
import { User } from '../../app/Models/User';

class Role extends Model {
  public static fillable: string[] = ['name'];
}

class Country extends Model {
  public static tableName = 'countries';
  public static fillable: string[] = ['name'];

  public posts() {
    return this.hasManyThrough(Post, User, 'country_id', 'user_id');
  }
}

class Image extends Model {
  public static tableName = 'images';
  public static fillable: string[] = ['path', 'imageable_type', 'imageable_id'];

  public imageable() {
    return this.morphTo('imageable');
  }
}

class Video extends Model {
  public static tableName = 'videos';
  public static fillable: string[] = ['url', 'watchable_type', 'watchable_id'];

  public watchable() {
    return this.morphTo('watchable');
  }
}

class PostWithImages extends Post {
  public static tableName = 'posts';
  public static morphClass = 'Post';

  public images() {
    return this.morphMany(Image, 'imageable');
  }
}

class UserWithImages extends User {
  public static tableName = 'users';
  public static morphClass = 'User';

  public images() {
    return this.morphMany(Image, 'imageable');
  }

  public videos() {
    return this.morphMany(Video, 'watchable');
  }
}

async function seedUser(name: string, email: string): Promise<User> {
  return (await User.create({ name, email, password: 'x' })) as User;
}

describe('Relations', () => {
  beforeEach(async () => {
    await freshApp();
    await Schema.table('users', (table) => {
      table.integer('country_id').nullable();
    });
    await Schema.create('roles', (table) => {
      table.id();
      table.string('name');
      table.timestamps();
    });
    await Schema.create('role_user', (table) => {
      table.id();
      table.foreignId('user_id').constrained('users');
      table.foreignId('role_id').constrained('roles');
    });
    await Schema.create('countries', (table) => {
      table.id();
      table.string('name');
      table.timestamps();
    });
    await Schema.create('images', (table) => {
      table.id();
      table.string('path');
      table.string('imageable_type');
      table.integer('imageable_id');
      table.timestamps();
    });
    await Schema.create('videos', (table) => {
      table.id();
      table.string('url');
      table.string('watchable_type');
      table.integer('watchable_id');
      table.timestamps();
    });
  });

  it('eager loads hasMany relations with with()', async () => {
    const user = await seedUser('Ada Lovelace', 'ada@example.com');
    await Post.create({ user_id: user.getKey(), title: 'First', body: 'Hello' });
    await Post.create({ user_id: user.getKey(), title: 'Second', body: 'World' });

    const users = (await User.with('posts').get()) as User[];
    expect(users).toHaveLength(1);

    const posts = users[0].getRelation('posts') as Post[];
    expect(posts).toHaveLength(2);
    expect(posts.map((post) => post.getAttribute('title'))).toEqual(['First', 'Second']);
  });

  it('lazy loads relations with load()', async () => {
    const user = await seedUser('Grace Hopper', 'grace@example.com');
    await Post.create({ user_id: user.getKey(), title: 'Compiler', body: 'COBOL' });

    const loaded = await User.find(user.getKey() as number);
    expect((loaded as User).getRelation('posts')).toBeUndefined();

    await (loaded as User).load('posts');
    expect((loaded as User).getRelation('posts')).toHaveLength(1);
  });

  it('resolves the owner with belongsTo', async () => {
    const user = await seedUser('Katherine Johnson', 'katherine@example.com');
    const post = (await Post.create({ user_id: user.getKey(), title: 'Orbits', body: 'Math' })) as Post;

    const owner = await post.user().first();
    expect(owner?.getAttribute('name')).toBe('Katherine Johnson');
  });

  it('eager loads belongsTo by foreign key, not by parent id', async () => {
    const first = await seedUser('First', 'first@example.com');
    const second = await seedUser('Second', 'second@example.com');
    const firstPost = (await Post.create({ user_id: first.getKey(), title: 'A', body: 'x' })) as Post;
    const secondPost = (await Post.create({ user_id: second.getKey(), title: 'B', body: 'y' })) as Post;

    const posts = (await Post.with('user').get()) as Post[];
    const byTitle = new Map(posts.map((p) => [p.getAttribute('title'), p]));

    const ownerOfFirst = (byTitle.get('A') as Post).getRelation('user') as { getAttribute(name: string): unknown };
    const ownerOfSecond = (byTitle.get('B') as Post).getRelation('user') as { getAttribute(name: string): unknown };
    expect(ownerOfFirst.getAttribute('name')).toBe('First');
    expect(ownerOfSecond.getAttribute('name')).toBe('Second');
    expect(firstPost.getKey()).not.toBe(secondPost.getKey());
  });

  it('creates related models through the relation', async () => {
    const user = await seedUser('Margaret Hamilton', 'margaret@example.com');
    await user.posts().create({ title: 'Apollo', body: 'Guidance' });

    const users = (await User.with('posts').get()) as User[];
    const posts = users[0].getRelation('posts') as Post[];
    expect(posts[0].getAttribute('title')).toBe('Apollo');
    expect(posts[0].getAttribute('user_id')).toBe(user.getKey());
  });

  it('honours fluent constraints on the relation query', async () => {
    const user = await seedUser('Linus Torvalds', 'linus@example.com');
    await user.posts().create({ title: 'Kernel', body: 'v1' });
    await user.posts().create({ title: 'Git', body: 'v2' });

    const filtered = (await user.posts().where('title', 'Git').get()) as Post[];
    expect(filtered).toHaveLength(1);
    expect(filtered[0].getAttribute('title')).toBe('Git');

    const limited = (await user.posts().orderByDesc('id').limit(1).get()) as Post[];
    expect(limited).toHaveLength(1);
    expect(limited[0].getAttribute('title')).toBe('Git');
  });

  it('attaches and hydrates belongsToMany with pivot data', async () => {
    const user = await seedUser('Alan Turing', 'alan@example.com');
    const admin = await Role.create({ name: 'admin' });
    const editor = await Role.create({ name: 'editor' });

    const relation = user.belongsToMany(Role, 'role_user', 'user_id', 'role_id');
    await relation.attach([admin.getKey(), editor.getKey()]);

    const roles = (await relation.get()) as Role[];
    expect(roles).toHaveLength(2);

    const pivot = (roles[0] as unknown as { getRelation(name: string): unknown }).getRelation('pivot');
    expect(pivot).toMatchObject({ user_id: user.getKey() });
  });

  it('detaches belongsToMany relations', async () => {
    const user = await seedUser('Dennis Ritchie', 'dennis@example.com');
    const admin = await Role.create({ name: 'admin' });
    const editor = await Role.create({ name: 'editor' });

    const relation = user.belongsToMany(Role, 'role_user', 'user_id', 'role_id');
    await relation.attach([admin.getKey(), editor.getKey()]);
    expect(await relation.count()).toBe(2);

    await relation.detach(admin.getKey());
    expect(await relation.count()).toBe(1);

    await relation.detach();
    expect(await relation.count()).toBe(0);
  });

  it('creates through belongsToMany with pivot entry', async () => {
    const user = await seedUser('Bjarne Stroustrup', 'bjarne@example.com');
    const relation = user.belongsToMany(Role, 'role_user', 'user_id', 'role_id');
    const role = await relation.create({ name: 'moderator' });

    expect(role.getAttribute('name')).toBe('moderator');
    expect(await relation.count()).toBe(1);
  });

  // --- hasManyThrough ---

  it('resolves hasManyThrough across an intermediate model', async () => {
    const country = (await Country.create({ name: 'Liechtenstein' })) as Country;
    const user1 = await seedUser('Alice', 'alice@example.com');
    const user2 = await seedUser('Bob', 'bob@example.com');

    user1.forceFill({ country_id: country.getKey() });
    await user1.save();
    user2.forceFill({ country_id: country.getKey() });
    await user2.save();

    await Post.create({ user_id: user1.getKey(), title: 'Alps', body: 'Scenic' });
    await Post.create({ user_id: user1.getKey(), title: 'Castles', body: 'Old' });
    await Post.create({ user_id: user2.getKey(), title: 'Skiing', body: 'Fast' });

    const posts = (await country.posts().get()) as Post[];
    expect(posts).toHaveLength(3);
    expect(posts.map((p) => p.getAttribute('title')).sort()).toEqual(['Alps', 'Castles', 'Skiing']);
  });

  it('eager loads hasManyThrough with with()', async () => {
    const country = (await Country.create({ name: 'Iceland' })) as Country;
    const user = await seedUser('Bjork', 'bjork@example.com');
    user.forceFill({ country_id: country.getKey() });
    await user.save();
    await Post.create({ user_id: user.getKey(), title: 'Volcanoes', body: 'Fire' });

    const countries = (await Country.with('posts').get()) as Country[];
    expect(countries).toHaveLength(1);

    const posts = countries[0].getRelation('posts') as Post[];
    expect(posts).toHaveLength(1);
    expect(posts[0].getAttribute('title')).toBe('Volcanoes');
  });

  it('returns empty array when no intermediate records exist', async () => {
    const country = (await Country.create({ name: 'Nowhere' })) as Country;
    const posts = (await country.posts().get()) as Post[];
    expect(posts).toHaveLength(0);
  });

  // --- morphMany / morphTo ---

  it('resolves morphMany from parent to children', async () => {
    const user = await seedUser('Author', 'author@example.com');
    const post = (await PostWithImages.create({ user_id: user.getKey(), title: 'Photos', body: '...' })) as PostWithImages;
    await Image.create({ path: 'a.jpg', imageable_type: 'Post', imageable_id: post.getKey() });
    await Image.create({ path: 'b.jpg', imageable_type: 'Post', imageable_id: post.getKey() });

    const images = (await post.images().get()) as Image[];
    expect(images).toHaveLength(2);
    expect(images.map((i) => i.getAttribute('path')).sort()).toEqual(['a.jpg', 'b.jpg']);
  });

  it('resolves morphTo from child back to parent', async () => {
    const user = await seedUser('Author', 'author@example.com');
    const post = (await PostWithImages.create({ user_id: user.getKey(), title: 'Cover', body: '...' })) as PostWithImages;
    const image = (await Image.create({
      path: 'cover.jpg',
      imageable_type: 'Post',
      imageable_id: post.getKey(),
    })) as Image;

    const owner = await image.imageable().first();
    expect(owner).toBeDefined();
    expect(owner?.getAttribute('title')).toBe('Cover');
  });

  it('eager loads morphMany with with()', async () => {
    const user = await seedUser('Author', 'author@example.com');
    const post = (await PostWithImages.create({ user_id: user.getKey(), title: 'Gallery', body: '...' })) as PostWithImages;
    await Image.create({ path: 'x.jpg', imageable_type: 'Post', imageable_id: post.getKey() });

    const posts = (await PostWithImages.with('images').get()) as PostWithImages[];
    expect(posts).toHaveLength(1);

    const images = posts[0].getRelation('images') as Image[];
    expect(images).toHaveLength(1);
    expect(images[0].getAttribute('path')).toBe('x.jpg');
  });

  it('eager loads morphTo across mixed parent types', async () => {
    const user = (await UserWithImages.create({ name: 'Photographer', email: 'photo@example.com', password: 'x' })) as UserWithImages;
    const post = (await PostWithImages.create({ user_id: user.getKey(), title: 'Blog', body: '...' })) as PostWithImages;

    // Trigger morph class registration (registers 'Post' and 'User' in the morph map)
    post.images();
    user.images();

    await Image.create({ path: 'post-img.jpg', imageable_type: 'Post', imageable_id: post.getKey() });
    await Image.create({ path: 'user-avatar.jpg', imageable_type: 'User', imageable_id: user.getKey() });

    const images = (await Image.with('imageable').get()) as Image[];
    expect(images).toHaveLength(2);

    const byPath = new Map(images.map((i) => [i.getAttribute('path'), i]));
    const postImg = byPath.get('post-img.jpg');
    const userImg = byPath.get('user-avatar.jpg');

    const owner1 = postImg?.getRelation('imageable') as { getAttribute(name: string): unknown } | undefined;
    const owner2 = userImg?.getRelation('imageable') as { getAttribute(name: string): unknown } | undefined;

    expect(owner1?.getAttribute('title')).toBe('Blog');
    expect(owner2?.getAttribute('name')).toBe('Photographer');
  });

  it('creates through morphMany', async () => {
    const user = await seedUser('Author', 'author@example.com');
    const post = (await PostWithImages.create({ user_id: user.getKey(), title: 'Snapshots', body: '...' })) as PostWithImages;
    const image = await post.images().create({ path: 'new.jpg' });

    expect(image.getAttribute('path')).toBe('new.jpg');
    expect(image.getAttribute('imageable_type')).toBe('Post');
    expect(image.getAttribute('imageable_id')).toBe(post.getKey());
  });

  it('returns empty array for morphMany with no children', async () => {
    const user = await seedUser('Author', 'author@example.com');
    const post = (await PostWithImages.create({ user_id: user.getKey(), title: 'Empty', body: '...' })) as PostWithImages;
    const images = (await post.images().get()) as Image[];
    expect(images).toHaveLength(0);
  });

  it('handles multiple morphMany relations on one model', async () => {
    const user = (await UserWithImages.create({ name: 'Multi', email: 'multi@example.com', password: 'x' })) as UserWithImages;
    await Image.create({ path: 'avatar.jpg', imageable_type: 'User', imageable_id: user.getKey() });
    await Video.create({ url: 'https://example.com/v1', watchable_type: 'User', watchable_id: user.getKey() });

    const images = (await user.images().get()) as Image[];
    const videos = (await user.videos().get()) as Video[];

    expect(images).toHaveLength(1);
    expect(images[0].getAttribute('path')).toBe('avatar.jpg');
    expect(videos).toHaveLength(1);
    expect(videos[0].getAttribute('url')).toBe('https://example.com/v1');
  });
});
