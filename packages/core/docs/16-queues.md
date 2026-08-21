# Queues

Queues defer slow work — emails, webhooks, report generation — to background
workers. chavaJs mirrors Laravel: jobs extend `Job`, define `handle()`, and are
pushed with the `Queue` facade.

## Creating a job

```bash
js make:job SendWelcomeEmail
```

```ts
// app/Jobs/SendWelcomeEmail.ts
import { Job } from '../../src/queue/Job';
import { User } from '../../app/Models/User';

export class SendWelcomeEmail extends Job {
  public tries = 3;
  public backoff = 3;
  public queue = 'default';

  public constructor(public readonly user: User) {
    super();
  }

  public async handle(): Promise<void> {
    // Send the email using event.user.email
  }
}
```

## Job options

| Property | Description |
|----------|-------------|
| `queue` | The queue name to dispatch to (default: `default`) |
| `tries` | Max attempts before the job is marked as failed (default: `undefined` = infinite) |
| `backoff` | Seconds to wait between retries |
| `timeout` | Seconds before the job is killed (default: `60`) |
| `connection` | Queue connection to use (overrides `QUEUE_CONNECTION`) |

```ts
export class ProcessReport extends Job {
  public queue = 'reports';
  public tries = 5;
  public backoff = 10;
  public timeout = 120;

  public async handle(): Promise<void> {
    // long-running work
  }
}
```

## Dispatching

```ts
import { Queue } from '../src/facades';

await Queue.push(new SendWelcomeEmail(user));       // run now (or queue it)
await Queue.later(60, new SendWelcomeEmail(user));  // delayed 60s
```

Models are serialized as class + key and re-retrieved when the job runs, so a
job stays valid even if the object changes between dispatch and execution.

## Running the worker

```bash
js queue:work      # process jobs in a foreground worker
js queue:listen    # same, restarting on app file changes
```

### Worker options

| Command | Description |
|---------|-------------|
| `js queue:work` | Process jobs until the process is stopped |
| `js queue:work --once` | Process one job then exit |
| `js queue:work --stop-when-empty` | Process all jobs then exit |
| `js queue:listen` | Restart the worker when app files change |
| `js queue:failed` | List all failed jobs |
| `js queue:retry {id}` | Retry a specific failed job by ID |
| `js queue:flush` | Delete all failed jobs |

## Queue connections

`config/queue.ts` selects the driver (`QUEUE_CONNECTION`):

| Driver | Purpose |
| --- | --- |
| `sync` | run jobs inline — default for local + tests |
| `database` | jobs table + `js queue:work` |
| `redis` | Redis list — needs the `redis` driver config |

The database driver creates its own `jobs` table on first use and exposes
`Queue.connection('database')` for the worker.

## Failed jobs

A job that exhausts its `tries` is dropped (with the exception logged).
View failed jobs:

```bash
js queue:failed
# ID  Connection  Queue  Payload  Exception  Failed At
# 1   database    default {...}  Timeout...  2026-01-15 10:30:00
```

Retry or flush:

```bash
js queue:retry 1          # retry job with ID 1
js queue:retry all        # retry all failed jobs
js queue:flush            # delete all failed jobs
```

## Queued events

Listeners that extend `ShouldQueue` (see [Events](15-events)) are dispatched
as jobs automatically:

```ts
export class SendWelcomeNotification extends ShouldQueue {
  public static queue = 'default';
  public static tries = 3;
}
```

## Next

- [Mail & Notifications](17-mail-notifications) — typical queued work
- [Scheduling](18-scheduling) — recurring tasks
