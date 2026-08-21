import { createRequire } from 'node:module';
import { Command } from 'commander';
import { newProjectCommand } from './commands/new';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

export async function run(): Promise<void> {
  const program = new Command();
  program
    .name('chava')
    .description('chavaJs installer — the Laravel Installer equivalent. Scaffolds a new chavaJs application.')
    .version(version);

  program.addCommand(newProjectCommand());

  await program.parseAsync(process.argv);
}