import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Command } from 'commander';
import { Application } from '../foundation/Application';
import { aboutCommand } from './commands/about';
import { dbSeedCommand } from './commands/db-seed';
import { dbWipeCommand } from './commands/db-wipe';
import {
  makeFactoryCommand,
  makeMigrationCommand,
  makeModelCommand,
  makePolicyCommand,
  makeRequestCommand,
  makeSeederCommand,
} from './commands/make';
import { makeCommandCommand } from './commands/make-command';
import {
  makeEventCommand,
  makeJobCommand,
  makeListenerCommand,
  makeMailCommand,
  makeNotificationCommand,
} from './commands/make-more';
import { makeControllerCommand, makeMiddlewareCommand, makeTestCommand } from './commands/make-more2';
import {
  migrateCommand,
  migrateFreshCommand,
  migrateRefreshCommand,
  migrateResetCommand,
  migrateRollbackCommand,
  migrateStatusCommand,
} from './commands/migrate';
import { queueFailedCommand } from './commands/queue-failed';
import { queueListenCommand } from './commands/queue-listen';
import { queueFlushCommand, queueRetryCommand } from './commands/queue-retry';
import { queueWorkCommand } from './commands/queue-work';
import { routeListCommand } from './commands/route-list';
import { routeCacheCommand } from './commands/route-cache';
import { routeClearCommand } from './commands/route-clear';
import { scheduleListCommand, scheduleRunCommand } from './commands/schedule-run';
import { serveCommand } from './commands/serve';
import { tinkerCommand } from './commands/tinker';

export async function run(): Promise<void> {
  const program = new Command();
  program
    .name('chava')
    .description('chavaJs — the Laravel-equivalent framework for Node.js')
    .version(Application.version);

  program.addCommand(aboutCommand());
  program.addCommand(serveCommand());
  program.addCommand(routeListCommand());
  program.addCommand(routeCacheCommand());
  program.addCommand(routeClearCommand());
  program.addCommand(migrateCommand());
  program.addCommand(migrateRollbackCommand());
  program.addCommand(migrateFreshCommand());
  program.addCommand(migrateResetCommand());
  program.addCommand(migrateRefreshCommand());
  program.addCommand(migrateStatusCommand());
  program.addCommand(dbSeedCommand());
  program.addCommand(dbWipeCommand());
  program.addCommand(makeModelCommand());
  program.addCommand(makeMigrationCommand());
  program.addCommand(makeFactoryCommand());
  program.addCommand(makeSeederCommand());
  program.addCommand(makeRequestCommand());
  program.addCommand(makePolicyCommand());
  program.addCommand(makeEventCommand());
  program.addCommand(makeListenerCommand());
  program.addCommand(makeJobCommand());
  program.addCommand(makeNotificationCommand());
  program.addCommand(makeMailCommand());
  program.addCommand(makeControllerCommand());
  program.addCommand(makeMiddlewareCommand());
  program.addCommand(makeTestCommand());
  program.addCommand(queueWorkCommand());
  program.addCommand(queueListenCommand());
  program.addCommand(queueFailedCommand());
  program.addCommand(queueRetryCommand());
  program.addCommand(queueFlushCommand());
  program.addCommand(makeCommandCommand());
  program.addCommand(scheduleRunCommand());
  program.addCommand(scheduleListCommand());
  program.addCommand(tinkerCommand());

  // Auto-discover custom commands from app/Console/Commands/*.ts
  await registerUserCommands(program);

  await program.parseAsync(process.argv);
}

/**
 * Scan app/Console/Commands/ for exported functions that return a Command
 * instance and register them (Laravel: custom artisan command registration).
 */
async function registerUserCommands(program: Command): Promise<void> {
  const commandsDir = join(process.cwd(), 'app', 'Console', 'Commands');
  let files: string[];
  try {
    files = readdirSync(commandsDir).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));
  } catch {
    return; // no app/Console/Commands directory
  }
  for (const file of files) {
    try {
      const mod = (await import(pathToFileURL(join(commandsDir, file)).href)) as Record<string, unknown>;
      for (const value of Object.values(mod)) {
        if (typeof value === 'function') {
          const cmd = (value as () => unknown)();
          if (cmd instanceof Command) {
            program.addCommand(cmd);
          }
        }
      }
    } catch (error) {
      console.error(`  Failed to load command ${file}: ${error instanceof Error ? error.message : error}`);
    }
  }
}
