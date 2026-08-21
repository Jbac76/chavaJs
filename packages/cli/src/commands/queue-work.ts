import { Command } from 'commander';
import { join } from 'node:path';
import { bootApp } from '../helpers/boot-app';
import type { DatabaseDriver } from '../../queue/drivers/DatabaseDriver';
import type { QueueManager } from '../../queue/QueueManager';
import { Job, registerJob, registerJobsFrom } from '../../queue/Job';
import { CallQueuedListener } from '../../events/queue';

interface QueueWorkOptions {
  connection?: string;
  queue?: string;
  once?: boolean;
  stopWhenEmpty?: boolean;
  sleep?: string;
  tries?: string;
}

/**
 * Laravel's queue:work — consumes jobs from the database queue, running each
 * job's handle(), with retries/backoff and failed-jobs tracking.
 */
export function queueWorkCommand(): Command {
  return new Command('queue:work')
    .description('Process jobs from the queue')
    .option('-c, --connection <connection>', 'The queue connection (default: config default)')
    .option('--queue <queue>', 'The queue to consume', 'default')
    .option('--once', 'Process a single job then exit')
    .option('--stop-when-empty', 'Process jobs until the queue is empty, then exit')
    .option('--sleep <seconds>', 'Seconds to wait when the queue is empty', '1')
    .option('--tries <n>', 'Max attempts per job (default: per-job tries)', '0')
    .action(async (options: QueueWorkOptions) => {
      const app = await bootApp();
      await app.bootstrap();
      // Register every job class so serialized payloads can be rehydrated
      // (Laravel autoloads job classes in the worker process) — plus the
      // framework's queued-listener job (ShouldQueue listeners).
      await registerJobsFrom(join(app.basePathDir(), 'app', 'Jobs'));
      registerJob(CallQueuedListener);
      const manager = app.make<QueueManager>('queue');
      const driver = manager.connection(options.connection);

      if (!isDatabaseDriver(driver)) {
        console.log('  queue:work consumes the database queue. Switch QUEUE_CONNECTION=database to use it.');
        return;
      }

      const triesOverride = parseInt(options.tries ?? '0', 10);
      const sleepSeconds = parseInt(options.sleep ?? '1', 10);
      const queueName = options.queue ?? 'default';
      let processed = 0;

      while (true) {
        const popped = await driver.pop(queueName);
        if (popped === null) {
          if (options.once || options.stopWhenEmpty) break;
          await sleep(sleepSeconds * 1000);
          continue;
        }
        await processPopped(driver, popped.id, popped.payload, popped.attempts, triesOverride);
        processed++;
        if (options.once) break;
      }

      console.log(`  Queue finished — processed ${processed} job(s).`);
    });
}

async function processPopped(
  driver: DatabaseDriver,
  id: number | string,
  payload: string,
  attempts: number,
  triesOverride: number,
): Promise<void> {
  let job: Job;
  try {
    const parsed = JSON.parse(payload) as { class: string; data: Record<string, unknown> };
    job = await Job.fromPayloadAsync(parsed);
  } catch (error) {
    console.error(`  > Failed to deserialize job: ${error instanceof Error ? error.message : error}`);
    await driver.fail(id, payload, Number.MAX_SAFE_INTEGER, error);
    return;
  }
  if (triesOverride > 0) job.tries = triesOverride;

  const started = Date.now();
  try {
    await job.handle();
    await driver.delete(id);
    console.log(`  > Processed: ${job.constructor.name} (${(Date.now() - started).toFixed(0)}ms)`);
  } catch (error) {
    console.error(`  > Failed: ${job.constructor.name} — ${error instanceof Error ? error.message : error}`);
    // Pass the effective tries (honours a --tries override from the CLI).
    await driver.fail(id, payload, attempts, error, job.tries);
  }
}

function isDatabaseDriver(driver: unknown): driver is DatabaseDriver {
  return typeof driver === 'object' && driver !== null && 'pop' in driver && 'fail' in driver;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
