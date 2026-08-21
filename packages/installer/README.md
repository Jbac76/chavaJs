# @chavajs/installer

The **chavaJs installer** — the Laravel Installer equivalent for
[chavaJs](https://github.com/anomalyco/opencode), the Laravel-equivalent
full-stack framework for Node.js.

This package is intentionally **thin**: it does not bundle the framework. When
you run `chava new`, it downloads `@chavajs/core` from the npm registry
(cached under `~/.chava/core/`), scaffolds a ready-to-run app from it, and
installs dependencies.

## Installation

```bash
npm i -g @chavajs/installer
```

**Requirements:** Node.js ≥ 18.17.

## Usage

```bash
chava new blog
cd blog
js migrate
js db:seed
npm run dev          # → http://localhost:8080
```

`js` is the app's Artisan-equivalent command (`php artisan` → `js`). It works
bare once you also `npm i -g @chavajs/cli`, or as `npx js <command>` inside the
app without any global install.

When run in an interactive terminal, `chava new` prompts for:

1. **Database engine** — `sqlite` (default), `postgres`, or `mysql`
2. **Authentication UI** — include the login/register/dashboard pages?
3. **Framework documentation** — include the docs, served at `localhost/docs`?
4. **Package manager** — `npm` (default), `pnpm`, or `yarn`

### Flags

| Flag | Description |
| --- | --- |
| `--database <engine>` | Skip the prompt: `sqlite` \| `postgres` \| `mysql` (default `sqlite`) |
| `--auth` / `--no-auth` | Skip the prompt: include or omit the authentication UI |
| `--docs` / `--no-docs` | Skip the prompt: include or omit the framework documentation (default: include) |
| `--package-manager <pm>` | Skip the prompt: `npm` \| `pnpm` \| `yarn` (default `npm`) |
| `--skip-install` | Scaffold files only; don't run the package manager |
| `--framework <path>` | Assemble the framework from a chavaJs checkout at `<path>` instead of downloading it |
| `--core-version <version>` | Pin the `@chavajs/core` version to download (default `latest`) |

### Where the framework comes from

The installer resolves the framework source in this order:

1. `--framework <path>` — a chavaJs checkout (assembles from `packages/*`).
2. A chavaJs checkout the installer is running inside (monorepo dev / CI —
   no network needed).
3. The npm registry — `@chavajs/core@latest`, downloaded once and cached by
   version under `~/.chava/core/`, so repeat scaffolds are offline.

Postgres apps get the `pg` driver installed; MySQL apps get `mysql2`. The
generated `.env` is pre-configured for the chosen engine.

## What a scaffolded app looks like

```
blog/
├── bin/chava.js        # the chava CLI, bundled into the app
├── src/                # the framework, assembled (not an npm dependency)
├── bootstrap/app.ts    # application configuration
├── config/             # app, database, auth, session, queue, mail, frontend
├── routes/             # web.ts, api.ts, console.ts
├── app/                # controllers, requests, models, policies, events, …
├── database/           # migrations, factories, seeders
├── resources/          # the Inertia React app + email templates
├── storage/            # sessions, logs
└── tests/              # Unit + Feature (Vitest) + Browser (Playwright)
```

Every scaffolded app carries its own copy of the console CLI
(`bin/chava.js`, exposed as the `js` command), so a global install of
`@chavajs/cli` is optional.

## Related packages

- `@chavajs/core` — the framework distribution (what this installer fetches).
- `@chavajs/cli` — the console CLI for running commands inside an app.

## License

MIT