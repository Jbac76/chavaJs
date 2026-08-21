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

## Frequency methods

| Method | Meaning |
| --- | --- |
| `cron('* * * * *')` | any 5-field expression |
| `everyMinute()` | `* * * * *` |
| `everyTwoMinutes()` / `everyFiveMinutes()` / `everyTenMinutes()` / `everyFifteenMinutes()` / `everyThirtyMinutes()` | `*/n * * * *` |
| `hourly()` / `hourlyAt(30)` | top of the hour / at minute 30 |
| `daily()` / `dailyAt('13:00')` / `twiceDaily(1, 13)` | once or twice a day |
| `weekly()` / `weeklyOn(1, '08:30')` | weekly (day 0-6, Sunday=0) |
| `monthly()` / `monthlyOn(1, '10:00')` | monthly |
| `yearly()` | Jan 1 |

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