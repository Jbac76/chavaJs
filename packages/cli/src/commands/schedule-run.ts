import { Command } from 'commander';
import { bootApp } from '../helpers/boot-app';
import type { Scheduler } from '../../scheduling/Scheduler';

/** Laravel's schedule:run — run every task that is due right now. */
export function scheduleRunCommand(): Command {
  return new Command('schedule:run')
    .description('Run the scheduled tasks that are due')
    .action(async () => {
      const app = await bootApp();
      await app.bootstrap();
      const scheduler = app.make<Scheduler>('schedule');
      const ran = await scheduler.runDue();
      if (ran === 0) console.log('  No scheduled tasks are due.');
    });
}

/** Laravel's schedule:list — list every scheduled task and its frequency. */
export function scheduleListCommand(): Command {
  return new Command('schedule:list')
    .description('List all scheduled tasks')
    .action(async () => {
      const app = await bootApp();
      await app.bootstrap();
      const scheduler = app.make<Scheduler>('schedule');
      if (scheduler.events.length === 0) {
        console.log('  No scheduled tasks registered in routes/console.ts.');
        return;
      }
      for (const event of scheduler.events) {
        console.log(`  ${event.getExpression().padEnd(14)} ${event.getDescription()}`);
      }
    });
}
