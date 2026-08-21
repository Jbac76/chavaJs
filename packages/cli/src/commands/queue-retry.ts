import { Command } from 'commander';
import { join } from 'node:path';
import type { DatabaseManager } from '../../database/DatabaseManager';
import type { Row } from '../../database/types';
import type { QueueManager } from '../../queue/QueueManager';
import { Job, registerJob, registerJobsFrom } from '../../queue/Job';
import { CallQueuedListener } from '../../events/queue';
import { bootApp } from '../helpers/boot-app';

interface RetryOptions {
  id?: string;
  all?: boolean;
}

/**
 * Laravel's queue:retry — re-queue a failed job by ID or retry all failed jobs.
 */
export function queueRetryCommand(): Command {
  return new Command('queue:retry')
    .description('Retry a failed job')
    .option('--id <id>', 'The ID of the failed job to retry')
    .option('--all', 'Retry all failed jobs')
    .action(async (options: RetryOptions) => {
      const app = await bootApp();
      await app.bootstrap();
      await registerJobsFrom(join(app.basePathDir(), 'app', 'Jobs'));
      registerJob(CallQueuedListener);
      const db = app.make<DatabaseManager>('db');
      const manager = app.make<QueueManager>('queue');

      if (!options.id && !options.all) {
        console.log('  Specify --id <id> or --all to retry failed jobs.');
        return;
      }

      const whereClause = options.id ? { id: options.id } : {};
      const rows = (await db.table('failed_jobs')
        .where(whereClause)
        .orderBy('id')
        .get()) as Row[];

      if (rows.length === 0) {
        console.log('  No failed jobs found.');
        return;
      }

      let retried = 0;
      let failed = 0;

      for (const row of rows) {
        const payload = String(row.payload);
        try {
          const parsed = JSON.parse(payload) as { class: string; data: Record<string, unknown> };
          const job = await Job.fromPayloadAsync(parsed);
          await manager.push(job);
          await db.table('failed_jobs').where('id', row.id).delete();
          console.log(`  > Retried: ${job.constructor.name} (ID: ${row.id})`);
          retried++;
        } catch (error) {
          console.error(`  > Failed to retry job ${row.id}: ${error instanceof Error ? error.message : error}`);
          failed++;
        }
      }

      console.log(`\n  Retried ${retried} job(s).` + (failed > 0 ? ` ${failed} failed.` : ''));
    });
}

/**
 * Laravel's queue:flush — delete all failed jobs.
 */
export function queueFlushCommand(): Command {
  return new Command('queue:flush')
    .description('Delete all failed jobs')
    .action(async () => {
      const app = await bootApp();
      await app.bootstrap();
      const db = app.make<DatabaseManager>('db');

      await db.table('failed_jobs').truncate();
      console.log('  All failed jobs have been deleted.');
    });
}
