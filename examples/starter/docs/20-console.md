# Console

The `js` command is your artisan — run it inside a project (or `npx js`; both
proxy to the app's own `bin/chava.js`). `node bin/chava.js <command>` works
too.

## Scaffolding

```bash
chava new my-app          # create a project (--docs / --no-docs)
js about                  # framework + app info
```

## Serving

```bash
js serve                  # run the dev server (default 8080, starts Vite)
js serve --port=3000
js serve --no-vite
```

## Routes

```bash
js route:list             # every route: method, URI, name, action
```

## Database

```bash
js migrate                # run pending migrations
js migrate:status         # migration / batch table
js migrate:rollback       # roll back the last batch
js migrate:reset          # roll back all batches
js migrate:fresh          # drop everything and re-migrate
js migrate:fresh --seed   # ...then seed
js migrate:refresh [--seed]
js db:seed                # run DatabaseSeeder
js db:seed --class=UserSeeder
js db:wipe                # drop every table
```

## Generators (`make:*`)

```bash
js make:model Post
js make:controller PostController
js make:controller PostController --invokable
js make:migration create_posts_table
js make:seeder PostSeeder
js make:factory PostFactory
js make:request StorePostRequest
js make:policy PostPolicy
js make:event PostCreated
js make:listener SendPostNotification
js make:job ProcessPost
js make:notification PostNotification
js make:mail PostMail
js make:middleware LogRequests
js make:test PostTest
```

## Queues & scheduling

```bash
js queue:work             # process queued jobs (foreground)
js queue:listen           # queue:work that reloads on app changes
js queue:failed           # list failed jobs from the failed_jobs table
js queue:retry --id=5     # retry a specific failed job
js queue:retry --all      # retry all failed jobs
js queue:flush            # delete all failed jobs
js schedule:run           # run due scheduled tasks (from cron)
js schedule:list          # list scheduled tasks + next runs
```

## Custom commands

```bash
js make:command SendReports --command=send:reports
```

This scaffolds a file at `app/Console/Commands/SendReportsCommand.ts` that
exports a function returning a `Command` instance. Every exported function
in `app/Console/Commands/` that returns a `Command` is automatically
registered at boot — no manual wiring needed.

```typescript
import { Command } from 'commander';

export function SendReportsCommand(): Command {
  return new Command('send:reports')
    .description('Send weekly reports')
    .action(async () => {
      console.log('  Sending reports...');
    });
}
```

## REPL

```bash
js tinker
```

A TypeScript REPL with the app booted — try `await User.find(1)`,
`Config.get('app.name')`, or `Route.getRoutes().length`. Any expression works,
and `await` is automatic.

## Not implemented (yet)

- `config:cache` / `route:cache` / `view:cache` — configuration, routes, and
  views are plain modules; there is nothing to cache.
- `storage:link` — no separate public disk.

## Next

- [Scheduling](18-scheduling) — running tasks on a timer
- [Deployment](22-deployment) — production setup