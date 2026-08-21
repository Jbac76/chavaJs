# Database

chavaJs supports three engines out of the box — SQLite, Postgres, and MySQL —
through a Laravel-style database manager and query builder.

## Connections

`config/database.ts` defines the default connection plus named connections
for each engine, driven by `.env`:

```ts
Config.get('database.default'); // 'sqlite' | 'pg' | 'mysql'
```

SQLite needs nothing (the file is created on demand). For Postgres or MySQL,
install the driver (`npm i pg` / `npm i mysql2`) and set the env variables:

```
DB_CONNECTION=pg
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=chava
DB_USERNAME=postgres
DB_PASSWORD=
```

### Named connections

```ts
DB.connection('pg').table('users').get();
DB.getConnectionNames(); // ['sqlite', 'pg', 'mysql']
```

## The query builder

Use the `DB` facade for direct queries — fluent, Laravel-identical:

```ts
import { DB } from '../src/facades';

const users = await DB.table('users').where('active', 1).orderBy('name').get();
const first = await DB.table('users').where('id', 1).first();
const count = await DB.table('users').count();

await DB.table('users').insert({ name: 'Ada', email: 'ada@example.com' });
await DB.table('users').where('id', 1).update({ active: 1 });
await DB.table('users').where('id', 1).delete();
```

### Selecting columns

```ts
DB.table('users').select('id', 'name').get();
DB.table('users').select('id', 'name').addSelect('email').get();
DB.table('users').distinct().get();
```

### Where clauses

```ts
// Basic where (column, operator, value)
DB.table('users').where('active', 1).get();

// Or where
DB.table('users').where('active', 1).orWhere('admin', 1).get();

// Negated where
DB.table('users').where('role', '!=', 'guest').get();

// Where in / not in
DB.table('users').whereIn('role', ['admin', 'mod']).get();
DB.table('users').orWhereIn('role', ['admin', 'mod']).get();
DB.table('users').whereNotIn('role', ['banned']).get();

// Where null / not null
DB.table('users').whereNull('deleted_at').get();
DB.table('users').orWhereNull('email').get();
DB.table('users').whereNotNull('email').get();

// Where between / not between
DB.table('users').whereBetween('age', [18, 65]).get();
DB.table('users').whereNotBetween('age', [0, 12]).get();

// Where column (column-to-column comparison)
DB.table('posts').whereColumn('updated_at', '>', 'created_at').get();

// Object shorthand (all keys must match)
DB.table('users').where({ active: 1, role: 'admin' }).get();

// Nested callback (where grouping)
DB.table('users')
  .where('active', 1)
  .where((q) => q.where('role', 'admin').orWhere('role', 'mod'))
  .get();
```

### Joins

```ts
// Inner join
DB.table('posts').join('users', 'posts.user_id', '=', 'users.id').get();

// Left join
DB.table('posts').leftJoin('users', 'posts.user_id', '=', 'users.id').get();

// Right join
DB.table('posts').rightJoin('users', 'posts.user_id', '=', 'users.id').get();

// Cross join (Cartesian product)
DB.table('colors').crossJoin('sizes').get();
```

### Grouping & having

```ts
DB.table('orders')
  .select('user_id', 'COUNT(*) as total')
  .groupBy('user_id')
  .having('total', '>', 5)
  .get();
```

### Ordering

```ts
DB.table('users').orderBy('name').get();           // asc (default)
DB.table('users').orderBy('name', 'desc').get();   // desc
DB.table('users').orderByDesc('name').get();        // shorthand
DB.table('users').latest().get();                   // ORDER BY created_at DESC
DB.table('users').oldest().get();                   // ORDER BY created_at ASC
DB.table('users').inRandomOrder().get();            // RANDOM() / RAND()
```

### Limit & offset

```ts
DB.table('users').limit(10).get();
DB.table('users').take(10).get();                   // alias for limit

DB.table('users').offset(20).get();
DB.table('users').skip(20).get();                   // alias for offset
```

### Retrieval

```ts
const rows = await DB.table('users').get();           // all matching rows
const first = await DB.table('users').first();        // first row or undefined
const user = await DB.table('users').firstOrFail();   // first row or throw NotFoundException

const count = await DB.table('users').count();
const minAge = await DB.table('users').min('age');
const maxAge = await DB.table('users').max('age');
const total = await DB.table('users').sum('balance');
const avgRating = await DB.table('users').avg('rating');

const email = await DB.table('users').where('id', 1).value('email');    // single value
const emails = await DB.table('users').pluck('email');                   // array of values

const exists = await DB.table('users').where('active', 1).exists();
const empty = await DB.table('users').where('banned', 1).doesntExist();
```

### Conditional clauses

Use `when()` to conditionally apply a clause — the callback only runs when
the condition is truthy:

```ts
DB.table('users')
  .when(role, (q, role) => q.where('role', role))
  .when(search, (q, s) => q.where('name', 'like', `%${s}%`))
  .get();
```

Pass a third callback as fallback when the condition is falsy:

```ts
DB.table('users')
  .when(active, (q) => q.where('active', 1), (q) => q.whereNull('deleted_at'))
  .get();
```

### Chunking large results

Process large result sets in batches to avoid memory issues:

```ts
await DB.table('users').chunk(100, (users, page) => {
  for (const user of users) {
    // process user
  }
});

// Return false from the callback to stop early
await DB.table('users').chunk(100, (users, page) => {
  if (page > 5) return false;
  // process users
});
```

### Aggregates & pagination

```ts
DB.table('users').count();
DB.table('users').min('age');
DB.table('users').max('age');
DB.table('users').sum('total');
DB.table('users').avg('rating');

const page = await DB.table('posts').paginate(10, 2);
// { data: [...], current_page: 2, last_page: 5, per_page: 10, total: 50, from: 11, to: 20 }
```

## Writing data

### Insert

```ts
// Single row
await DB.table('users').insert({ name: 'Ada', email: 'ada@example.com' });

// Multiple rows
await DB.table('users').insert([
  { name: 'Ada', email: 'ada@example.com' },
  { name: 'Grace', email: 'grace@example.com' },
]);

// Insert and return the new ID
const id = await DB.table('users').insertGetId({ name: 'Ada', email: 'ada@example.com' });
```

### Upsert

Insert a row, or update it if the unique constraint is violated:

```ts
// INSERT ... ON CONFLICT DO UPDATE
await DB.table('users').upsert(
  [{ name: 'Ada', email: 'ada@example.com', role: 'admin' }],
  ['email'],               // columns that define uniqueness
  ['name', 'role']         // columns to update on conflict (optional — defaults to all)
);
```

### Update

```ts
await DB.table('users').where('id', 1).update({ active: 1 });

// Increment / decrement
await DB.table('users').where('id', 1).increment('login_count');        // +1
await DB.table('users').where('id', 1).increment('login_count', 5);    // +5
await DB.table('users').where('id', 1).decrement('balance', 100);      // -100
```

### Delete

```ts
await DB.table('users').where('id', 1).delete();
await DB.table('users').truncate();   // DELETE FROM users (all rows)
```

### To SQL (debugging)

Inspect the compiled query without executing it:

```ts
const { sql, bindings } = DB.table('users').where('active', 1).toSql();
// { sql: 'SELECT * FROM users WHERE active = ?', bindings: [1] }
```

### Cloning the builder

```ts
const query = DB.table('users').where('active', 1);
const query2 = query.clone().where('role', 'admin');
// Original query is not affected
```

## Transactions

Transactions are called on the **connection**, not the `DB` facade:

```ts
const conn = DB.connection();
await conn.transaction(async (tx) => {
  await tx.table('accounts').where('id', 1).decrement('balance', 100);
  await tx.table('accounts').where('id', 2).increment('balance', 100);
});
```

If the callback throws, everything rolls back. Nested transactions use
savepoints automatically.

## Schema

The `Schema` facade manages tables — see [Migrations](10-migrations):

```ts
await Schema.create('teams', (table) => {
  table.id();
  table.string('name');
  table.timestamps();
});
await Schema.hasTable('teams');       // boolean
await Schema.hasColumn('teams', 'name');
await Schema.dropIfExists('teams');
```

## Complete API reference

| Category | Methods |
|----------|---------|
| **Select** | `select`, `addSelect`, `distinct` |
| **Joins** | `join`, `leftJoin`, `rightJoin`, `crossJoin` |
| **Where** | `where`, `orWhere`, `whereNot`, `whereIn`, `orWhereIn`, `whereNotIn`, `whereNull`, `orWhereNull`, `whereNotNull`, `whereBetween`, `whereNotBetween`, `whereColumn` |
| **Order** | `orderBy`, `orderByDesc`, `latest`, `oldest`, `inRandomOrder` |
| **Limit** | `limit`, `take`, `offset`, `skip` |
| **Retrieval** | `get`, `first`, `firstOrFail`, `value`, `pluck`, `exists`, `doesntExist` |
| **Aggregate** | `count`, `min`, `max`, `sum`, `avg` |
| **Pagination** | `paginate`, `chunk` |
| **Write** | `insert`, `insertGetId`, `upsert`, `update`, `increment`, `decrement` |
| **Delete** | `delete`, `forceDelete`, `truncate` |
| **Conditional** | `when` |
| **Eager load** | `with` |
| **Soft deletes** | `withTrashed`, `onlyTrashed` |
| **Debug** | `toSql`, `clone` |

## Next

- [Migrations](10-migrations) — versioned schema changes
- [Eloquent ORM](11-eloquent) — models on top of the query builder
