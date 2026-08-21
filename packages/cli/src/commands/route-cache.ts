import { Command } from 'commander';
import type { Router } from '../../http/Router';
import { bootApp } from '../helpers/boot-app';

export function routeCacheCommand(): Command {
  return new Command('route:cache')
    .description('Cache the current route table for faster boot')
    .action(async () => {
      const app = await bootApp();
      await app.bootstrap();
      const router = app.make<Router>('router');

      const routes = router.exportCache();
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const cachePath = path.join(process.cwd(), 'bootstrap', 'route-cache.json');

      await fs.mkdir(path.dirname(cachePath), { recursive: true });
      await fs.writeFile(cachePath, JSON.stringify(routes, null, 2));

      console.log(`Routes cached successfully (${routes.length} routes)`);
      console.log(`  → ${cachePath}`);
    });
}
