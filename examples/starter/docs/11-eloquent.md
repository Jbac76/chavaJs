# Eloquent ORM

chavaJs ships a faithful Eloquent port — models are classes extending `Model`,
one per table, with fillable/guarded mass-assignment protection, casts,
timestamps, soft deletes, events, and every core relation type.

## Defining models

```ts
import { Model } from '../../src/orm/Model';

export class User extends Model {
  public static tableName = 'users';
  public static fillable = ['name', 'email', 'password'];
  public static hidden = ['password'];
  public static casts = { email_verified_at: 'datetime' };
}
```

Static config mirrors Laravel's properties:

| Property | Default | Purpose |
| --- | --- | --- |
| `tableName` | snake_case plural of class | table name |
| `primaryKey` | `'id'` | key column |
| `keyType` | `'int'` | `'int'` or `'string'` |
| `incrementing` | `true` | auto-increment keys |
| `timestamps` | `true` | maintain `created_at` / `updated_at` |
| `softDeletes` | `false` | soft-delete via `deleted_at` |
| `fillable` | `[]` | mass-assignable columns |
| `guarded` | `[]` | never mass-assignable |
| `hidden` | `[]` | omitted from serialization |
| `casts` | `{}` | attribute casters |

## Retrieving models

```ts
const user = await User.find(1);
const user = await User.findOrFail(1);       // throws when missing
const first = await User.first();
await User.firstOrFail();
const all = await User.all();
const page = await User.paginate(15, 1);
await User.chunk(100, (users) => { /* ... */ });
```

Query builder chains are available both statically and on instances:

```ts
const admins = await User.where('active', 1)
  .whereIn('role', ['admin', 'mod'])
  .orderBy('name')
  .limit(10)
  .get();

const total = await User.count();
const max = await User.max('age');
```

> **`where()` operator default:** `where('age', 18)` uses `=` implicitly —
> the two-argument form is equality. Pass the operator explicitly for
> comparisons: `where('age', '>=', 18)`.
const latest = await User.latest().take(5).get();
```

## Inserts & updates

```ts
const user = await User.create({ name: 'Ada', email: 'ada@example.com' });

const user = new User({ name: 'Ada' });
user.email = 'ada@example.com';
await user.save();

await user.update({ name: 'Ada Lovelace' });

const user = await User.firstOrCreate({ email: 'ada@example.com' }, { name: 'Ada' });
await User.updateOrCreate({ email: 'ada@example.com' }, { name: 'Ada' });

await user.delete();         // soft-deletes when softDeletes is on
await user.restore();        // restore a trashed row
await user.forceDelete();    // hard delete regardless
```

Mass assignment respects `fillable` / `guarded`; `forceFill()` bypasses them.

## Casts

`casts` accepts `'boolean'`, `'int'`/`'integer'`, `'float'`, `'string'`,
`'json'`/`'array'`/`'object'`, and `'datetime'`/`'date'`:

```ts
public static casts = {
  active: 'boolean',
  settings: 'json',
  email_verified_at: 'datetime',
};
```

Accessors return the cast value; mutators convert on assignment.

## Relationships

chavaJs supports every Eloquent relation type. Define them as instance
methods on your model — the return value is the relation object.

### One-to-many (hasMany)

```ts
export class User extends Model {
  public posts() {
    return this.hasMany(Post);            // foreign key: user_id
  }
}

export class Post extends Model {
  public user() {
    return this.belongsTo(User);
  }
}
```

Conventions: the foreign key defaults to `snakeCase(ModelName)_id`.
Override with `this.hasMany(Post, 'author_id')`.

### One-to-one (hasOne)

```ts
export class User extends Model {
  public profile() {
    return this.hasOne(Profile);
  }
}
```

### Inverse (belongsTo)

```ts
export class Post extends Model {
  public user() {
    return this.belongsTo(User);          // foreign key: user_id
  }
  public author() {
    return this.belongsTo(User, 'author_id');  // custom FK
  }
}
```

### Many-to-many (belongsToMany)

Requires a pivot table. Convention: alphabetical singular names joined
by `_` (e.g. `role_user`).

```ts
export class User extends Model {
  public roles() {
    return this.belongsToMany(Role);      // pivot: role_user
  }
  public teams() {
    return this.belongsToMany(
      Team,
      'team_user',           // custom pivot table
      'user_id',             // foreign pivot key
      'team_id',             // related pivot key
    );
  }
}
```

Pivot columns are available as a `pivot` property on each related model:

```ts
const roles = await user.roles().get();
roles[0].getRelation('pivot');
// { user_id: 1, role_id: 3, ... }
```

### Has-many-through

Access a distant relation through an intermediate model (e.g. Country →
User → Post):

```ts
export class Country extends Model {
  public posts() {
    return this.hasManyThrough(Post, User);  // country → user → post
  }
}
```

Key convention:
- `User` has `country_id` (firstKey — intermediate FK)
- `Post` has `user_id` (secondKey — related FK)

Override: `this.hasManyThrough(Post, User, 'country_id', 'user_id')`.

### Polymorphic (morphMany / morphTo)

A single parent type that can own many children of different kinds:

```ts
// Migration: imageable_type, imageable_id
export class Image extends Model {
  public imageable() {
    return this.morphTo('imageable');
  }
}

export class Post extends Model {
  public images() {
    return this.morphMany(Image, 'imageable');
  }
}

export class User extends Model {
  public avatars() {
    return this.morphMany(Image, 'imageable');
  }
}
```

```ts
await post.images().create({ path: '/img.jpg' });
const images = await post.images().get();
const owner = await image.imageable();     // resolves Post or User
```

The parent class is auto-registered via the morph map when you call
`morphMany()`.

## Querying relationships

### Constrained queries

```ts
const published = await user.posts().where('published', true).get();
const recent = await user.posts().latest().limit(5).get();
```

All builder methods work: `where`, `whereIn`, `orderBy`, `limit`,
`offset`, `select`, `count`, `exists`, etc.

### Create through a relation

Automatically sets the foreign key:

```ts
await user.posts().create({ title: 'Hello', body: 'World' });
// INSERT INTO posts (user_id, title, body) VALUES (1, 'Hello', 'World')
```

### Save an existing model

```ts
const post = new Post({ title: 'Hello' });
await user.posts().save(post);  // sets user_id and saves
```

### Exists / count

```ts
const hasPosts = await user.posts().exists();
const count = await user.posts().count();
```

## Eager loading

Avoids the N+1 query problem by loading all relations in one query:

```ts
const posts = await Post.with('user', 'user.profile').get();
```

Lazy-load on an existing instance:

```ts
await post.load('comments', 'tags');
```

Nested eager loading works with dot notation:

```ts
const users = await User.with('posts', 'posts.comments').get();
```

## Soft deletes

```ts
export class Post extends Model {
  public static softDeletes = true;
}

await post.delete();             // sets deleted_at
await post.trashed();            // boolean
await post.restore();
const all = await Post.withTrashed().get();
const only = await Post.onlyTrashed().get();
```

## Model events

```ts
User.on('creating', (user) => { user.api_token = generateToken(); });
User.on('created', (user) => { /* after insert */ });
```

Events: `retrieved`, `creating`, `created`, `updating`, `updated`, `saving`,
`saved`, `deleting`, `deleted`, `restoring`, `restored`. Observers bundle
multiple handlers:

```ts
export class UserObserver {
  public created(user: User) { /* ... */ }
  public deleting(user: User) { /* ... */ }
}
User.observe(new UserObserver());
```

See [Events](15-events) for decoupling via the event dispatcher.

## Serialization

```ts
user.toArray();
user.toJSON();       // respects `hidden`, casts, relations
```

## Next

- [Seeding](12-seeding) — filling the database
- [Database](09-database) — the query builder underneath