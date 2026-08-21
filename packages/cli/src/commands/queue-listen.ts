import { spawn } from 'node:child_process';
import { Command } from 'commander';

export interface ListenOptions {
  connection?: string;
  queue?: string;
  tries?: string;
  sleep?: string;
}

/**
 * Laravel's `queue:listen` — a supervisor that keeps an eye on the queue and
 * spawns a fresh worker (`queue:work --once`) for each batch. Because every
 * pass is a new process, changed job code is picked up without restarting —
 * the whole point of `queue:listen` vs the long-running `queue:work`.
 */

/** argv for one worker pass — `chava queue:work --once` with the options. */
export function workerPassArgv(options: ListenOptions): string[] {
  const argv = ['bin/chava.js', 'queue:work', '--once'];
  if (options.connection) argv.push('--connection', options.connection);
  if (options.queue) argv.push('--queue', options.queue);
  if (options.tries && options.tries !== '0') argv.push('--tries', options.tries);
  return argv;
}

/** Spawn one worker pass; resolves when the child exits. */
export function runWorkerPass(options: ListenOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, workerPassArgv(options), {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
    child.on('close', () => resolve());
    child.on('error', reject);
  });
}

export function queueListenCommand(): Command {
  return new Command('queue:listen')
    .description('Listen to a given queue — spawns a fresh worker per batch')
    .option('-c, --connection <connection>', 'The queue connection', 'database')
    .option('--queue <queue>', 'The queue to listen on', 'default')
    .option('--tries <n>', 'Max attempts per job', '0')
    .option('--sleep <seconds>', 'Seconds to wait when the queue is empty', '1')
    .action(async (options: ListenOptions) => {
      console.log(`  Listening on queue [${options.queue}]...`);
      const sleepSeconds = Number(options.sleep ?? '1') * 1000;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        await runWorkerPass(options);
        await new Promise((resolve) => setTimeout(resolve, sleepSeconds));
      }
    });
}
