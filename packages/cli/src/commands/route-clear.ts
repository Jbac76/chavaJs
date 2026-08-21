import { Command } from 'commander';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export function routeClearCommand(): Command {
  return new Command('route:clear')
    .description('Clear the cached route table')
    .action(async () => {
      const cachePath = path.join(process.cwd(), 'bootstrap', 'route-cache.json');

      try {
        await fs.unlink(cachePath);
        console.log('Route cache cleared.');
      } catch {
        console.log('No route cache to clear.');
      }
    });
}
