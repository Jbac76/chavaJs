# Migrations

Migrations are versioned schema changes, exactly like Laravel: each file in
`database/migrations` runs once, in order, and records its batch.

## Creating migrations

```bash
js make:migration create_users_table
js make:migration add_votes_to_users_table
```

`create_..._table` and `add_..._to_..._table` names are recognized and
pre-filled appropriately (create vs alter).

```ts
// database/migrations/2024_01_01_000000_create_users_table.ts
import { Schema } from '../../src/facades';

export async function up(): Promise<void> {
  await Schema.create('users', (table) => {
    table.id();
    table.string('name');
    table.string('email').unique();
    table.string('password');
    table.timestamps();
  });
}

export async function down(): Promise<void> {
  await Schema.dropIfExists('users');
}
```

## The Blueprint

Column types:

```ts
table.id();                  // bigint auto-increment PK
table.increments('seq');     // int auto-increment
table.bigIncrements('seq');
table.string('name', 255);
table.text('bio');
table.integer('age');
table.tinyInteger('flag');
table.bigInteger('count');
table.float('score');
table.double('value');
table.decimal('price', 10, 2);
table.boolean('active');
table.date('published_on');
table.dateTime('starts_at');
table.time('opens_at');
table.timestamp('deleted_at');
table.timestamps();          // created_at + updated_at
table.softDeletes();         // deleted_at
table.json('settings');
table.jsonb('settings');
table.uuid('id');
table.binary('data');
table.enum('role', ['admin', 'user']);
table.foreignId('user_id');  // unsigned bigint FK column
table.rememberToken();       // remember_token
```

Modifiers chain after any type:

```ts
table.string('email').nullable();          // allow NULL
table.integer('age').default(18);          // default value
table.bigInteger('count').unsigned();      // unsigned
table.string('slug').unique();             // unique constraint
table.string('code').index();              // plain index
table.foreignId('user_id').constrained();  // FK → users.id
table.foreignId('category_id')
  .constrained('categories')               // explicit table
  .references('id').on('categories');      // fully explicit
```

Composite indexes and foreign keys:

```ts
table.index(['user_id', 'status']);
table.uniqueConstraint(['email', 'tenant_id']);
table.foreign('user_id').references('id').on('users');
```

## Altering tables

Add columns or indexes to an existing table:

```ts
export async function up(): Promise<void> {
  await Schema.table('users', (table) => {
    table.string('avatar_url').nullable();
    table.boolean('active').default(true);
  });
}
```

## Running migrations

```bash
js migrate                  # run pending migrations
js migrate:status           # list every migration + batch
js migrate:rollback         # roll back the last batch
js migrate:reset            # roll back all batches
js migrate:fresh            # drop all tables, re-run everything
js migrate:fresh --seed     # ...then run the seeders
js migrate:refresh          # rollback + migrate again
js migrate:refresh --seed
```

`migrate:fresh` (and `refresh`) recreate the schema — great for local
development. In production prefer `js migrate`; there is no `--force` prompt
guard, so back up first.

## Next

- [Database](09-database) — connections & the query builder
- [Eloquent ORM](11-eloquent) — models on top of migrations