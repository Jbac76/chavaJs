# Testing

Tests run with Vitest. New projects ship `tests/Unit` (isolated units) and
`tests/Feature` (the full booted app over HTTP) alongside a complete suite of
framework tests.

```bash
npm test                  # run everything
npm run test -- tests/Feature
npx vitest run tests/Feature/http.test.ts
```

## Feature tests

Boot the real application and make requests against a live server — the
pattern used by the framework's own suite:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { app } from '../../bootstrap/app';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  await app.bootstrap();
  server = await app.serve(0, '127.0.0.1');
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe('HTTP kernel', () => {
  it('returns the Inertia HTML shell for /', async () => {
    const response = await fetch(`${baseUrl}/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<div id="app"');
  });

  it('returns 404 for unknown routes', async () => {
    const response = await fetch(`${baseUrl}/nope`);
    expect(response.status).toBe(404);
  });
});
```

For Inertia JSON assertions, send `X-Inertia: true` headers and parse the page
payload.

## Unit tests

Test a class directly — models, the container, the validator, the query
builder all work standalone:

```ts
import { describe, expect, it } from 'vitest';
import { Validator } from '../../src/validation/Validator';

describe('Validator', () => {
  it('validates required and email', async () => {
    const validator = Validator.make({ email: 'not-an-email' }, { email: 'required|email' });
    expect(await validator.fails()).toBe(true);
    expect(validator.errors()).toHaveProperty('email');
  });
});
```

## Database in tests

Use SQLite `:memory:` by pointing `DB_DATABASE=:memory:` (the default test
setup), then migrate:

```ts
process.env.DB_CONNECTION = 'sqlite';
process.env.DB_DATABASE = ':memory:';
process.env.SESSION_DRIVER = 'array';
process.env.APP_KEY = 'test-key-0123456789abcdef0123456789abcdef';

import { Migrator } from '../../src/database/Migrator';
import { currentApp } from '../../src/foundation/registry';

beforeAll(async () => {
  await new Migrator(currentApp()).fresh();
});
```

### The test helper

The starter ships a `tests/helpers/db.ts` with reusable helpers:

```ts
import { freshApp } from '../helpers/db';

beforeEach(async () => {
  await freshApp(); // boots a fresh app + migrates
});
```

### Using factories

Factories (see [Seeding](12-seeding)) make fixtures fast:

```ts
import { User } from '../../app/Models/User';

const user = await User.create({ name: 'Alice', email: 'alice@example.com', password: 'secret' });
```

## Testing HTTP requests

Set up Inertia headers for most requests:

```ts
async function apiRequest(method: string, path: string, jar: CookieJar, data = {}) {
  const headers = {
    'X-Inertia': 'true',
    'X-Inertia-Version': '1.0.0',
    ...(jar.cookie ? { Cookie: jar.cookie } : {}),
  };
  const response = await fetch(`${baseUrl}${path}`, { method, headers });
  return { status: response.status, body: await response.json() };
}
```

### Testing POST/PUT/DELETE with CSRF

```ts
// GET the page first to establish a session + CSRF token
const init = await fetch(`${baseUrl}/login`, { headers });
const csrf = extractCsrf(init);

// POST with the CSRF token
const response = await fetch(`${baseUrl}/login`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-CSRF-TOKEN': csrf,
    Cookie: jar.cookie,
  },
  body: new URLSearchParams({ email, password }).toString(),
  redirect: 'manual',
});
```

## Testing validation

```ts
import { Validator } from '../../src/validation/Validator';

it('rejects invalid email', async () => {
  const v = Validator.make({ email: 'bad' }, { email: 'required|email' });
  expect(await v.fails()).toBe(true);
  expect(v.errorsFirst().email).toBeDefined();
});

it('passes valid data', async () => {
  const v = Validator.make({ email: 'ok@example.com' }, { email: 'required|email' });
  expect(await v.passes()).toBe(true);
  expect(v.validated()).toEqual({ email: 'ok@example.com' });
});
```

## Testing the Gate

```ts
import { Gate } from '../../src/auth/Gate';
import { User } from '../../app/Models/User';

it('allows admins to manage users', async () => {
  const app = await freshApp();
  const admin = await User.create({ name: 'Admin', email: 'a@test.com', password: 'x', is_admin: true });
  const gate = app.make<Gate>('gate');
  gate.define('manage-users', (user) => user?.getAttribute('is_admin') === true);

  expect(await gate.forUser(admin).allows('manage-users')).toBe(true);
});

it('throws AuthorizationException when denied', async () => {
  const app = await freshApp();
  const member = await User.create({ name: 'Member', email: 'm@test.com', password: 'x', is_admin: false });
  const gate = app.make<Gate>('gate');
  gate.define('manage-users', (user) => user?.getAttribute('is_admin') === true);

  await expect(gate.forUser(member).authorize('manage-users')).rejects.toThrow();
});
```

## Testing the session

```ts
it('stores and retrieves session data', async () => {
  const store = request.session();
  store.put('key', 'value');
  expect(store.get('key')).toBe('value');
  expect(store.has('key')).toBe(true);
  store.forget('key');
  expect(store.has('key')).toBe(false);
});
```

## Browser tests

`tests/Browser` runs Playwright specs against the Vite dev server for true
end-to-end coverage (`npm run test:browser`).

## Generated tests

`js make:test WidgetTest` scaffolds a feature test file ready to fill in.

## Common patterns

### beforeEach / afterEach

```ts
import { beforeEach, describe, expect, it } from 'vitest';

describe('Model', () => {
  beforeEach(async () => {
    await freshApp();
  });

  it('creates a record', async () => {
    const user = await User.create({ name: 'Test', email: 't@t.com', password: 'x' });
    expect(user.id).toBeDefined();
  });
});
```

### Asserting JSON responses

```ts
const response = await fetch(`${baseUrl}/api/users`);
const data = await response.json();
expect(response.status).toBe(200);
expect(data).toHaveProperty('data');
expect(Array.isArray(data.data)).toBe(true);
```

### Asserting redirects

```ts
const response = await fetch(`${baseUrl}/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-TOKEN': csrf },
  body: new URLSearchParams({ email: 'a@b.com', password: 'secret' }).toString(),
  redirect: 'manual',
});
expect(response.status).toBe(302);
expect(response.headers.get('location')).toContain('/dashboard');
```

## Next

- [Seeding](12-seeding) — factories for fixtures
- [Deployment](22-deployment) — shipping the app
