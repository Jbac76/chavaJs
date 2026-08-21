# Seeding

Seeders fill your database with test or starter data. They live in
`database/seeders` and are created with `js make:seeder`.

## Writing seeders

```ts
// database/seeders/UserSeeder.ts
import { Seeder } from '../../src/database/Seeder';
import { User } from '../../app/Models/User';

export class UserSeeder extends Seeder {
  public async run(): Promise<void> {
    await User.create({ name: 'Ada Lovelace', email: 'ada@example.com' });
    await User.create({ name: 'Alan Turing', email: 'alan@example.com' });
  }
}
```

Models make seeding natural; for raw inserts use the query builder:

```ts
import { DB } from '../../src/facades';
await DB.table('roles').insert({ name: 'admin' });
```

## Running seeders

```bash
js db:seed                  # run DatabaseSeeder
js db:seed --class=UserSeeder
```

`migrate:fresh` and `migrate:refresh` accept `--seed` (or `--seeder=Name`) so
you get a clean, populated database:

```bash
js migrate:fresh --seed
js migrate:fresh --seeder=UserSeeder
js migrate:refresh --seed
```

## Factories

Factories generate model instances with fake data (`js make:factory`):

```ts
// database/factories/UserFactory.ts
import { faker } from '@faker-js/faker';
import { User } from '../../app/Models/User';

export function defineUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: faker.person.fullName(),
    email: faker.internet.email(),
    password: 'secret',
    ...overrides,
  };
}

export async function makeUser(overrides = {}): Promise<User> {
  return User.create(defineUser(overrides));
}

export async function makeUsers(count: number, overrides = {}): Promise<User[]> {
  const users: User[] = [];
  for (let i = 0; i < count; i++) users.push(await makeUser(overrides));
  return users;
}
```

```ts
// Use it in a seeder or tests
const user = await makeUser({ name: 'Grace Hopper' });
const many = await makeUsers(25);
```

## The database seeder

`database/seeders/DatabaseSeeder.ts` is the entry point run by `js db:seed`.
Call your other seeders from it:

```ts
export class DatabaseSeeder extends Seeder {
  public async run(): Promise<void> {
    await new UserSeeder().run();
    await new PostSeeder().run();
  }
}
```

## Next

- [Eloquent ORM](11-eloquent) — models you seed
- [Testing](21-testing) — seeding test databases