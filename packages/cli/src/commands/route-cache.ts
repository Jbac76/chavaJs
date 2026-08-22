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

      const cachePayload = await router.exportCacheWithMeta();
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const cachePath = path.join(process.cwd(), 'bootstrap', 'route-cache.json');

      await fs.mkdir(path.dirname(cachePath), { recursive: true });
      await fs.writeFile(cachePath, JSON.stringify(cachePayload, null, 2));

      console.log(`Routes cached successfully (${cachePayload.routes.length} routes)`);
      console.log(`  → ${cachePath}`);
      console.log(`  fingerprint ${cachePayload.hash.slice(0, 12)}… (auto-invalidates when routes change)`);
    });
}
