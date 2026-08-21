# @chavajs/cli

The **chava** console tool for [chavaJs](https://github.com/anomalyco/opencode) —
a full-stack TypeScript framework that replicates Laravel's architecture,
conventions, and developer experience in pure Node.js.

`@chavajs/cli` is the Artisan equivalent (`migrate`, `db:seed`, `make:*`,
`queue:work`, `schedule:run`, `tinker`, …) and bundles the framework itself,
so the console can run standalone. Every scaffolded app also carries this CLI
as `bin/chava.js` and exposes it as the **`js`** command.

> **Scaffolding is a separate concern:** `chava new` is provided by
> [`@chavajs/installer`](https://www.npmjs.com/package/@chavajs/installer),
> the Laravel Installer equivalent.

---

## Installation

Install globally:

```bash
npm i -g @chavajs/cli
```

This provides two commands:

- `js <command>` — the **`php artisan` equivalent**. Runs the current app's own
  bundled CLI (its exact framework version) from anywhere inside an app.
- `chava <command>` — the same console, running the globally installed copy.

Verify:

```bash
js --version   # inside an app: prints the app's framework version
chava --version   # 0.2.0
```

**Requirements:** Node.js ≥ 18.17.

> **Three ways to run the same CLI:**
>
> - **`js` inside an app** (recommended) — `js <command>`. The global `js`
>   finds the app's bundled `bin/chava.js` and runs it, so the app's exact
>   framework version is used. Every scaffolded app also declares its own `js`
>   bin, so `npx js <command>` works even without a global install.
> - **Globally as `chava`** — `chava <command>` after the install above. Any
>   command that boots an app (migrations, `serve`, generators) runs inside the
>   current directory, so `cd your-app` first.
> - **`js <command>`** — the raw entrypoint inside an app. The
>   `js` command is a thin alias of this.

---

## Quick start

```bash
npm i -g @chavajs/installer   # provides `chava new`
chava new blog
cd blog
js migrate
js db:seed
npm run dev          # → http://localhost:8080
```

---

## Commands

### Development server

#### `chava serve`

Boots the chavaJs application server and (by default) the Vite dev server for
HMR. If the preferred port is already in use, the server **automatically moves
to the next free port** and prints where it landed; Vite does the same from
5173, and the rendered HTML always points at the actual Vite port.

| Flag | Description |
| --- | --- |
| `-p, --port <port>` | Port to listen on (default `8080`; next free port used if taken) |
| `-H, --host <host>` | Host to bind to (default `127.0.0.1`) |
| `--no-vite` | Don't start the Vite dev server (serve the app only) |

Examples:

```bash
js serve
js serve --port 3000
js serve -H 0.0.0.0 --no-vite
```

Handles `SIGINT`/`SIGTERM` cleanly (closes the HTTP server and any child Vite
process) — safe to run under pm2/systemd.

> Tip: in development, `npm run dev` is the preferred entry point — it wires
> up Vite + the app server with the right environment.

### Routes

#### `chava route:list`

Prints every registered route as a table:

```
METHOD  URI                     NAME       ACTION              MIDDLEWARE
GET     /                       home       HomeController@index
GET     /dashboard              dashboard  DashboardController@index  auth
POST    /login                  login      AuthController@login  guest
GET     /users/{user}           users.show UserController@show  web
```

Columns: `METHOD`, `URI`, `NAME`, `ACTION`, `MIDDLEWARE`.

### Database

| Command | Description |
| --- | --- |
| `chava migrate` | Run pending migrations |
| `chava migrate:rollback` | Roll back the last migration batch |
| `chava migrate:reset` | Roll back every migration |
| `chava migrate:fresh` | Drop all tables and re-run every migration |
| `chava migrate:refresh` | Roll back every migration, then re-run them |
| `chava migrate:status` | Show each migration's status (`Pending` / `Ran (batch n)`) |
| `chava db:wipe` | Drop all tables without re-running migrations |
| `chava db:seed` | Seed the database (see below) |

`migrate:fresh` / `migrate:refresh` accept `--seed` (and `--seeder <class>`)
to re-seed afterwards:

```bash
js migrate
js migrate:status
js migrate:fresh        # wipe + re-run (dev only)
js migrate:fresh --seed # …and re-seed (DatabaseSeeder)
```

#### `chava db:seed`

Runs a seeder against the configured database.

| Flag | Description |
| --- | --- |
| `-c, --class <class>` | Seeder class to run (default `DatabaseSeeder`) |

```bash
js db:seed
js db:seed --class=UserSeeder
```

### Generators (`make:*`)

All generators create a file with a ready-to-edit stub in the conventional
location. Class-name suffixes (`Request`, `Policy`, `Job`, …) are added
automatically if you omit them.

| Command | Creates | Flags |
| --- | --- | --- |
| `chava make:model <name>` | `app/Models/<Name>.ts` | — |
| `chava make:migration <name>` | `database/migrations/<timestamp>_<name>.ts` | — |
| `chava make:factory [name]` | `database/factories/<Name>Factory.ts` | `--model <model>` (derived from the name by default) |
| `chava make:seeder [name]` | `database/seeders/<Name>Seeder.ts` | `--class <class>` |
| `chava make:request <name>` | `app/Http/Requests/<Name>Request.ts` | — |
| `chava make:policy <name>` | `app/Policies/<Name>Policy.ts` | — |
| `chava make:event <name>` | `app/Events/<Name>Event.ts` | — |
| `chava make:listener <name>` | `app/Listeners/<Name>Listener.ts` | — |
| `chava make:job <name>` | `app/Jobs/<Name>Job.ts` | — |
| `chava make:notification <name>` | `app/Notifications/<Name>Notification.ts` | — |
| `chava make:mail <name>` | `app/Mail/<Name>Mail.ts` | — |
| `chava make:controller <name>` | `app/Http/Controllers/<Name>Controller.ts` | `-r, --resource` · `-a, --api` · `-i, --invokable` |
| `chava make:middleware <name>` | `app/Http/Middleware/<Name>Middleware.ts` | — |
| `chava make:test <name>` | `tests/Feature/<Name>Test.ts` | `-u, --unit` (write to `tests/Unit/`) |

Controller flags:

- `-r, --resource` — full REST resource controller
  (`index/create/store/show/edit/update/destroy`) with plural URI conventions.
- `-a, --api` — API resource controller (no `create`/`edit` view methods).
- `-i, --invokable` — single-action controller with `__invoke()`.

Examples:

```bash
js make:model Post
js make:migration create_posts_table
js make:factory --model=User
js make:seeder UserSeeder
js make:controller PostController --resource
js make:controller AdminController --api
js make:controller HomeController --invokable
js make:middleware EnsureAdmin
js make:test StorePostTest
js make:test SomeUtil --unit
```

### Queues

The database queue driver consumes jobs from the `jobs` table (plus a
`failed_jobs` table for exhausted jobs). Jobs are auto-registered from
`app/Jobs/*.ts` when a worker boots, so serialized jobs pushed by the web
process rehydrate correctly.

| Command | Description |
| --- | --- |
| `chava queue:work` | Long-running worker that processes jobs |
| `chava queue:listen` | Supervisor that spawns a fresh worker per batch |

#### `chava queue:work`

| Flag | Description |
| --- | --- |
| `-c, --connection <connection>` | Queue connection (default: your config default) |
| `--queue <queue>` | Queue to consume (default `default`) |
| `--once` | Process a single job, then exit |
| `--stop-when-empty` | Process jobs until the queue is empty, then exit |
| `--sleep <seconds>` | Seconds to wait when the queue is empty (default `1`) |
| `--tries <n>` | Max attempts per job (default: each job's own `tries`) |

This command consumes the **database** queue — set `QUEUE_CONNECTION=database`
in your `.env`:

```bash
QUEUE_CONNECTION=database js queue:work
QUEUE_CONNECTION=database js queue:work --once      # CI / one-shot
QUEUE_CONNECTION=database js queue:work --tries 5
```

#### `chava queue:listen`

| Flag | Description |
| --- | --- |
| `-c, --connection <connection>` | Queue connection (default `database`) |
| `--queue <queue>` | Queue to listen on (default `default`) |
| `--tries <n>` | Max attempts per job (default per-job) |
| `--sleep <seconds>` | Seconds to wait when the queue is empty (default `1`) |

Unlike the long-running `queue:work`, each pass is a fresh
`queue:work --once` subprocess — changed job code is picked up without
restarting the supervisor.

### Scheduling

Scheduled tasks are declared in `routes/console.ts` via the `Schedule`
facade (`Schedule.call(...).everyMinute()`, `Schedule.job(...).dailyAt(...)`,
`Schedule.command(...).hourly()`).

| Command | Description |
| --- | --- |
| `chava schedule:run` | Run every scheduled task that is due right now |
| `chava schedule:list` | List every scheduled task + its cron expression |

```bash
js schedule:list
js schedule:run     # put on a system cron, every minute:
# * * * * * cd /srv/app && js schedule:run >> /dev/null 2>&1
```

### Tinker (REPL)

#### `chava tinker`

An interactive REPL with the whole application loaded — Laravel's `tinker`,
ported. TypeScript is stripped per line, expressions are awaited, and the
app's facades + every `app/Models/*` class are available as bare globals:

```bash
js tinker
```

```
chava> await User.count()
9
chava> user = await User.find(1)
User { id: 1, name: 'Admin User', email: 'admin@chava.dev', … }
chava> user.posts()          # relations work too
chava> DB.table('users').where('is_admin', 1).pluck('email')
chava> exit()
```

Globals: `app`, `App`, `Config`, `DB`, `Schema`, `Auth`, `Gate`, `Session`,
`Event`, `Queue`, `Mail`, `Notification`, `Schedule`, `Route`, `Inertia`,
`Hash`, `Model`, and every model class. Bare assignments (`user = ...`)
persist across lines; `const`/`let` are per-line.

> **Security:** like Laravel's tinker, this is a developer tool, not a
> sandbox — input runs with your host privileges. Never point it at untrusted
> input.

## Application info

#### `chava about`

Prints the app's name, environment, debug mode, framework version, Node
version, and configured database/session/queue/mail drivers:

```bash
js about
```

---

## Global flags

| Flag | Description |
| --- | --- |
| `--version` | Print the chavaJs framework version |
| `--help` | List every command |

```bash
chava --help
chava serve --help      # per-command help
```

---

## Environment variables the CLI cares about

The CLI reads the same `.env` as the app:

| Variable | Used by |
| --- | --- |
| `QUEUE_CONNECTION` | `queue:work` / `queue:listen` (set to `database`) |
| `DB_CONNECTION` / `DB_*` | `migrate*`, `db:seed`, `queue:work`, `tinker` |
| `SESSION_DRIVER` | `serve` (sessions) |
| `APP_URL` / `APP_ENV` / `APP_DEBUG` | `serve` and anything booting the app |

---

## Versioning

`@chavajs/cli` has its own independent version (it does not track the
framework's). Inside an app, `js --version` reports the
framework version the app was assembled with.

---

## License

MIT