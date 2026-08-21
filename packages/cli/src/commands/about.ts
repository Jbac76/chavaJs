import { Command } from 'commander';
import { Config } from '../../config/Config';
import { Application } from '../../foundation/Application';
import { bootApp } from '../helpers/boot-app';

export function aboutCommand(): Command {
  return new Command('about')
    .description('Display basic information about the application')
    .action(async () => {
      const app = await bootApp();
      await app.bootstrap();
      const config = app.make<Config>('config');

      const rows: Array<[string, string]> = [
        ['Application', String(config.get('app.name', 'chavaJs'))],
        ['Environment', String(config.get('app.env', 'local'))],
        ['Debug Mode', config.get('app.debug', false) ? 'ON' : 'OFF'],
        ['Framework Version', Application.version],
        ['Node Version', process.version],
        ['Database', String(config.get('database.default', 'sqlite'))],
        ['Session Driver', String(config.get('session.driver', 'file'))],
        ['Queue Connection', String(config.get('queue.default', 'sync'))],
        ['Mail', String(config.get('mail.default', 'log'))],
        ['Timezone', String(config.get('app.timezone', 'UTC'))],
      ];

      console.log('');
      for (const [label, value] of rows) {
        console.log(`  ${label.padEnd(20)} ${value}`);
      }
      console.log('');
    });
}