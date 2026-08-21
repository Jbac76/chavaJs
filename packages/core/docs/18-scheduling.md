# Scheduling

Recurring tasks are defined in `routes/console.ts` with the `Schedule` facade
and run from a single cron entry. Laravel's scheduler, ported.

## Defining scheduled tasks

```ts
// routes/console.ts
import { Schedule } from '../src/facades';

Schedule.call(() => {
  console.log('Cleanup running…');
}, 'weekly-cleanup').weekly();

Schedule.job(new SendReportsJob()).dailyAt('02:00');
Schedule.command('chava db:wipe').weeklyOn(0, '04:00'); // every Sunday 4am
```

## Task types

| Method | Description |
|--------|-------------|
| `Schedule.call(callback, name?)` | Run a closure on schedule |
| `Schedule.job(job, name?)` | Dispatch a job instance |
| `Schedule.command(command, name?)` | Run an artisan-style command |

## Frequency methods

| Method | Meaning |
| --- | --- |
| `cron('* * * * *')` | any 5-field expression |
| `everyMinute()` | `* * * * *` |
| `everyTwoMinutes()` | `*/2 * * * *` |
| `everyFiveMinutes()` | `*/5 * * * *` |
| `everyTenMinutes()` | `*/10 * * * *` |
| `everyFifteenMinutes()` | `*/15 * * * *` |
| `everyThirtyMinutes()` | `*/30 * * * *` |
| `hourly()` | top of the hour |
| `hourlyAt(30)` | at minute 30 |
| `daily()` | once a day at midnight |
| `dailyAt('13:00')` | once a day at 1:00 PM |
| `twiceDaily(1, 13)` | at 1:00 AM and 1:00 PM |
| `weekly()` | once a week (Sunday) |
| `weeklyOn(1, '08:30')` | Monday at 8:30 AM |
| `monthly()` | once a month (1st at midnight) |
| `monthlyOn(1, '10:00')` | 1st of month at 10:00 AM |
| `yearly()` | January 1st at midnight |

## Conditional scheduling

Only run a task when a condition is true:

```ts
Schedule.call(() => {
  // runs only in production
}, 'prod-cleanup').daily().when(() => process.env.APP_ENV === 'production');
```

## Timezone support

```ts
Schedule.call(() => {
  // runs at 3:00 AM Eastern
}, 'us-cleanup').dailyAt('03:00').timezone('America/New_York');
```

## Chaining frequency modifiers

Combine modifiers for more complex schedules:

```ts
// weekdays at 9am
Schedule.command('reports:generate').dailyAt('09:00').weekdays();

// every hour between 9am and 5pm
Schedule.call(() => checkQueue(), 'queue-monitor')
  .cron('0 9-17 * * 1-5');
```

## Running the scheduler

Add one line to your server's cron (or a scheduled task on Windows):

```bash
* * * * * cd /path/to/your-app && js schedule:run >> /dev/null 2>&1
```

`js schedule:run` executes every task whose schedule matches the current
minute. List what's scheduled (and its human-readable next run) with:

```bash
js schedule:list
```

## Notes

- Tasks run inside your app's process (same framework version, config, and
  database), so jobs and commands work exactly as they do from the console.
- Only one process should run `js schedule:run` (from cron); a second one
  would duplicate work.

## Next

- [Console](20-console) — commands you can schedule
- [Queues](16-queues) — background jobs referenced by tasks
