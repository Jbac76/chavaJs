import { join } from 'node:path';
import { Command } from 'commander';
import { classWithSuffix, pascal, write } from '../helpers/generators';

const COMMAND_STUB = (className: string, commandName: string): string => `import { Command } from 'commander';

/**
 * ${className} — a custom chavaJs CLI command.
 *
 * Register it automatically: any function exported from app/Console/Commands/
 * that returns a Command is picked up by the CLI at boot.
 */
export function ${className}(): Command {
  return new Command('${commandName}')
    .description('A custom command')
    .action(async () => {
      console.log('  Hello from ${commandName}!');
    });
}
`;

export function makeCommandCommand(): Command {
  return new Command('make:command')
    .description('Create a new custom CLI command')
    .argument('<name>', 'The command name (e.g. SendReports)')
    .option('--command <name>', 'The CLI command name (e.g. send:reports)')
    .action(async (name: string, options: { command?: string }) => {
      const className = classWithSuffix(name, 'Command');
      const commandName = options.command ?? name.toLowerCase().replace(/([a-z])([A-Z])/g, '$1:$2');
      write(join(process.cwd(), 'app', 'Console', 'Commands', `${className}.ts`), COMMAND_STUB(className, commandName));
    });
}
