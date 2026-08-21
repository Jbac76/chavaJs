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
import { Migrator } from '../../src/database/Migrator';
import { currentApp } from '../../src/foundation/registry';

beforeAll(async () => {
  await new Migrator(currentApp()).fresh();
});
```

Factories (see [Seeding](12-seeding)) make fixtures fast:

```ts
const user = await makeUser({ email: 'test@example.com' });
```

## Browser tests

`tests/Browser` runs Playwright specs against the Vite dev server for true
end-to-end coverage (`npm run test:browser`).

## Generated tests

`js make:test WidgetTest` scaffolds a feature test file ready to fill in.

## Next

- [Seeding](12-seeding) — factories for fixtures
- [Deployment](22-deployment) — shipping the app