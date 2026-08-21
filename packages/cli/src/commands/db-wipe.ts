import { Command } from 'commander';
import { Migrator } from '../../database/Migrator';
import { bootApp } from '../helpers/boot-app';

export function dbWipeCommand(): Command {
  return new Command('db:wipe')
    .description('Drop all tables without re-running migrations (then run js migrate)')
    .action(async () => {
      const app = await bootApp();
      await app.bootstrap();
      const migrator = new Migrator(app);
      await migrator.wipe();
      console.log('  Database wiped. Run `js migrate` to rebuild.');
    });
}