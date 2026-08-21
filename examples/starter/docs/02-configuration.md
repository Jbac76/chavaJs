# Configuration

All configuration lives in two places, exactly like Laravel: a `.env` file for
environment-specific secrets and a typed `config/*` directory for structure.

## Environment variables

Copy `.env.example` to `.env` (the installer does this for you). Values are
read through the `Env` facade:

```ts
import { Env } from '../src/config/Env';

Env.get('APP_NAME', 'chavaJs');  // string, optional default
Env.bool('APP_DEBUG', false);    // "1" | "true" | "yes" | "on" → true
Env.number('DB_PORT', 5432);     // numeric
Env.has('APP_KEY');              // boolean
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_NAME` | `chavaJs` | Shown in the layout and `about` |
| `APP_ENV` | `production` | `local` enables Vite; `production` serves `build/` |
| `APP_DEBUG` | `false` | Verbose error pages / stack traces |
| `APP_URL` | `http://localhost:8080` | Canonical app URL |
| `APP_KEY` | `` | Encryption/signing key (set a random value in production) |
| `DB_CONNECTION` | `sqlite` | `sqlite`, `pg`, or `mysql` |
| `DB_DATABASE` | `database/database.sqlite` | File path (sqlite) or database name |
| `DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_PASSWORD` / `DB_SSL` | — | Postgres & MySQL connection |
| `QUEUE_CONNECTION` | `sync` | `sync`, `database`, or `redis` |
| `MAIL_MAILER` | `log` | `log`, `array`, or `smtp` |
| `MAIL_FROM_ADDRESS` / `MAIL_FROM_NAME` | `hello@chava.dev` | Default From |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_USERNAME` / `MAIL_PASSWORD` | — | SMTP transport |
| `VITE_URL` / `VITE_PORT` | `http://localhost:5173` / `5173` | Vite dev server |

## The config repository

Each file in `config/` exports a typed object, merged into the repository by
its filename. Read values with dot notation through the `Config` facade:

```ts
import { Config } from '../src/facades';

Config.get('app.name');            // 'chavaJs'
Config.get('database.default');    // 'sqlite'
Config.get('mail.default');        // 'log'
Config.get('app.nope', 'fallback'); // fallback
Config.has('app.key');             // boolean
```

You can also grab the `Config` service from the container:
`app.make<Config>('config')`.

## Config files

- **`config/app.ts`** — name, env, debug, url, key, timezone.
- **`config/database.ts`** — the default connection plus named `connections`
  for `sqlite`, `pg`, and `mysql` (all pre-configured from env).
- **`config/auth.ts`** — guards and the user model.
- **`config/session.ts`** — session driver and cookie settings.
- **`config/queue.ts`** — default queue + `sync`/`database`/`redis` connections.
- **`config/mail.ts`** — default mailer + `log`/`array`/`smtp` transports and `from`.
- **`config/frontend.ts`** — Inertia server settings (asset URLs, versions).

## Adding your own config

Create `config/analytics.ts`:

```ts
export default {
  enabled: true,
  endpoint: 'https://analytics.example.com',
};
```

Then read it anywhere with `Config.get('analytics.endpoint')`.

## Next

- [Architecture](03-architecture) — how the app boots
- [Database](09-database) — connections in depth