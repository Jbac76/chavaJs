import { Command } from 'commander';
import { Migrator } from '../../database/Migrator';
import { bootApp } from '../helpers/boot-app';
import { runSeeder } from './db-seed';

export function migrateCommand(): Command {
  return new Command('migrate')
    .description('Run the database migrations')
    .option('-d, --database <connection>', 'The database connection to use')
    .action(async (options: { database?: string }) => {
      const app = await bootApp();
      await app.bootstrap();
      const migrator = new Migrator(app, options.database);
      const run = await migrator.run();
      if (run.length === 0) console.log('  Nothing to migrate.');
      console.log(`\n  Database migration complete. Ran ${run.length} migration(s).`);
    });
}

export function migrateRollbackCommand(): Command {
  return new Command('migrate:rollback')
    .description('Roll back the last database migration batch')
    .option('-d, --database <connection>', 'The database connection to use')
    .action(async (options: { database?: string }) => {
      const app = await bootApp();
      await app.bootstrap();
      const migrator = new Migrator(app, options.database);
      const rolledBack = await migrator.rollback();
      if (rolledBack.length === 0) console.log('  Nothing to roll back.');
      console.log(`\n  Rolled back ${rolledBack.length} migration(s).`);
    });
}

export function migrateFreshCommand(): Command {
  return new Command('migrate:fresh')
    .description('Drop all tables and re-run all migrations')
    .option('-d, --database <connection>', 'The database connection to use')
    .option('--seed', 'Seed the database after running the migrations')
    .option('--seeder <class>', 'The seeder class to run (with --seed)', 'DatabaseSeeder')
    .action(async (options: { database?: string; seed?: boolean; seeder?: string }) => {
      const app = await bootApp();
      await app.bootstrap();
      const migrator = new Migrator(app, options.database);
      const run = await migrator.fresh();
      console.log(`\n  Database reset complete. Ran ${run.length} migration(s).`);
      if (options.seed === true || typeof options.seeder === 'string') {
        await runSeeder(options.seeder ?? 'DatabaseSeeder');
        console.log('  Database seeded successfully.');
      }
    });
}

export function migrateResetCommand(): Command {
  return new Command('migrate:reset')
    .description('Roll back all migrations')
    .option('-d, --database <connection>', 'The database connection to use')
    .action(async (options: { database?: string }) => {
      const app = await bootApp();
      await app.bootstrap();
      const migrator = new Migrator(app, options.database);
      const reset = await migrator.reset();
      if (reset.length === 0) console.log('  Nothing to roll back.');
      else console.log(`  Rolled back ${reset.length} migration(s).`);
    });
}

export function migrateRefreshCommand(): Command {
  return new Command('migrate:refresh')
    .description('Roll back all migrations, then re-run them')
    .option('-d, --database <connection>', 'The database connection to use')
    .option('--seed', 'Seed the database after running the migrations')
    .option('--seeder <class>', 'The seeder class to run (with --seed)', 'DatabaseSeeder')
    .action(async (options: { database?: string; seed?: boolean; seeder?: string }) => {
      const app = await bootApp();
      await app.bootstrap();
      const migrator = new Migrator(app, options.database);
      const reset = await migrator.reset();
      if (reset.length === 0) console.log('  Nothing to roll back.');
      else console.log(`  Rolled back ${reset.length} migration(s).`);
      const run = await migrator.run();
      console.log(`\n  Database refreshed. Ran ${run.length} migration(s).`);
      if (options.seed === true || typeof options.seeder === 'string') {
        await runSeeder(options.seeder ?? 'DatabaseSeeder');
        console.log('  Database seeded successfully.');
      }
    });
}

export function migrateStatusCommand(): Command {
  return new Command('migrate:status')
    .description('Show the status of each migration')
    .option('-d, --database <connection>', 'The database connection to use')
    .action(async (options: { database?: string }) => {
      const app = await bootApp();
      await app.bootstrap();
      const migrator = new Migrator(app, options.database);
      const rows = await migrator.status();
      for (const row of rows) {
        const status = row.batch === null ? 'Pending' : `Ran (batch ${row.batch})`;
        console.log(`  ${status.padEnd(18)} ${row.migration}`);
      }
    });
}
