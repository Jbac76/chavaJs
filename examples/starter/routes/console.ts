import { Schedule } from '../src/facades';

/**
 * Console routes — Laravel's routes/console.php equivalent. Tasks are
 * registered with the fluent frequency API and run by `chava schedule:run`
 * (invoked from cron). `chava schedule:list` shows everything registered.
 */
Schedule.command('chava route:list').everyMinute();
Schedule.call(() => {
  console.log('  [schedule] heartbeat — the scheduler is alive.');
}).everyMinute();

// Queue a job every hour (runs only when the expression is due):
// Schedule.job(new SendWelcomeEmailJob(1)).hourly();
//
// Time-constrained frequency windows:
// Schedule.call(cleanup).between('01:00', '05:00').dailyAt('03:00');

export {};
