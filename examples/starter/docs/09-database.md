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

### Query clauses

```ts
DB.table('users')
  .select('id', 'name')
  .where('active', 1)
  .orWhere('admin', 1)
  .whereIn('role', ['admin', 'mod'])
  .whereNull('deleted_at')
  .whereBetween('age', [18, 65])
  .orderBy('created_at', 'desc')
  .limit(20)
  .offset(40)
  .get();

// joins
DB.table('posts').join('users', 'posts.user_id', '=', 'users.id').get();

// grouping / having
DB.table('orders')
  .select('user_id', DB.raw('COUNT(*) as total'))
  .groupBy('user_id')
  .having('total', '>', 5)
  .get();
```

### Aggregates & pagination

```ts
DB.table('users').count();
DB.table('users').min('age');
DB.table('users').max('age');
DB.table('users').sum('total');
DB.table('users').avg('rating');

const page = await DB.table('posts').paginate(10, 2); // { data, total, per_page, current_page, last_page }
```

## Transactions

```ts
await DB.transaction(async (tx) => {
  await tx.table('accounts').where('id', 1).decrement('balance', 100);
  await tx.table('accounts').where('id', 2).increment('balance', 100);
});
```

If the callback throws, everything rolls back. Use `DB.beginTransaction()` /
`DB.commit()` / `DB.rollback()` for manual control.

## Multiple connections

```ts
DB.connection('pg').table('users').get();
DB.getConnectionNames(); // the configured connection keys
```

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

## Next

- [Migrations](10-migrations) — versioned schema changes
- [Eloquent ORM](11-eloquent) — models on top of the query builder