import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Command } from 'commander';
import type { Seeder } from '../../database/Seeder';
import { bootApp } from '../helpers/boot-app';

interface SeedOptions {
  class?: string;
}

export async function runSeeder(className = 'DatabaseSeeder'): Promise<void> {
  const entry = pathToFileURL(join(process.cwd(), 'database', 'seeders', `${className}.ts`)).href;
  const module = (await import(entry)) as Record<string, unknown>;
  // Accept both a default export and a named export matching the class name.
  const candidate = module.default ?? module[className];
  if (typeof candidate !== 'function') {
    throw new Error(`Seeder [${className}] not found in database/seeders/.`);
  }
  const seeder = new (candidate as new () => Seeder)();
  await seeder.run();
}

export function dbSeedCommand(): Command {
  return new Command('db:seed')
    .description('Seed the database with records')
    .option('-c, --class <class>', 'The seeder class to run', 'DatabaseSeeder')
    .action(async (options: SeedOptions) => {
      const app = await bootApp();
      await app.bootstrap();
      await runSeeder(options.class ?? 'DatabaseSeeder');
      console.log('  Database seeded successfully.');
    });
}
