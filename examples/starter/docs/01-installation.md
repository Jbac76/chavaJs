# Installation

## Requirements

- Node.js `>= 18.17`

## Installing the CLI

chavaJs ships a single global CLI package that provides two commands:

```bash
npm install -g @chavajs/cli
```

- `chava` — scaffold new applications
- `js` — run artisan-style commands inside an application

Both are thin proxies: `js` walks up from your current directory, finds your
application's own `bin/chava.js`, and executes it with your project's exact
framework version — the same trick that lets `npx js` work with no global
install at all.

## Creating your first project

```bash
chava new my-app
cd my-app
npm install
```

`chava new` asks whether to include the framework documentation in your
project. Answer yes and you get a `docs/` directory served at `/docs`; use
`--no-docs` to skip it for a lean project (or `--docs` to force it on).

## Running the app

Start the development server:

```bash
npm run dev
```

This boots the chavaJs server (default port `8080`) and the Vite dev server.
Visit `http://localhost:8080`. Your app runs on the `web` and `api` route
groups from `routes/web.ts` and `routes/api.ts`.

## What you get

```
my-app/
├── bin/                 # chava + js executables (the app's own CLI)
├── bootstrap/app.ts     # Application configuration (providers, middleware)
├── app/                 # your code: Controllers, Models, Providers, ...
├── config/              # typed config: app, database, auth, session, queue, mail, frontend
├── database/            # migrations + seeders
├── docs/                # this documentation (when opted in)
├── routes/              # web.ts + api.ts route definitions
├── resources/js/        # React + Inertia front end
├── storage/             # local sqlite database, logs, sessions
└── tests/               # vitest unit + feature tests
```

## Next steps

- [Configuration](02-configuration) — `.env` and `config/*`
- [Routing](04-routing) — the request lifecycle
- [Console](20-console) — every `js` command

## Import styles

chavaJs supports two ways to import framework code:

### Framework-as-source (default)

Every `chava new` app includes the framework source directly in `src/`. Import
via relative paths:

```ts
import { Route } from '../src/facades';
import { Model } from '../../src/orm/Model';
import { Controller } from '../../../src/http/Controller';
```

This is the standard pattern — no build step, full source maps, instant
feedback. The `../src/...` imports are intentional and correct.

### Package import

If you prefer npm-style imports, `@chavajs/core` supports both:

```ts
// Barrel import (all facades + common classes)
import { Route, Model, Controller, Job } from '@chavajs/core';

// Deep import (specific module)
import { Model } from '@chavajs/core/orm/Model';
import { Job } from '@chavajs/core/queue/Job';
import { Validator } from '@chavajs/core/validation/Validator';
```

This works when `@chavajs/core` is installed as a dependency. The package
exports TypeScript source directly — no compilation needed when using `tsx` or
a bundler that handles `.ts` files.