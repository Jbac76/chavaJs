import { Command } from 'commander';
import type { Route } from '../../http/Route';
import type { Router } from '../../http/Router';
import { bootApp } from '../helpers/boot-app';

interface RouteRow {
  method: string;
  uri: string;
  name: string;
  action: string;
  middleware: string;
}

export function routeListCommand(): Command {
  return new Command('route:list')
    .description('List all registered routes')
    .action(async () => {
      const app = await bootApp();
      await app.bootstrap();
      const router = app.make<Router>('router');

      const rows: RouteRow[] = router.getRoutes().map((route: Route) => ({
        method: route.methods.join('|'),
        uri: route.uri,
        name: route.getName() ?? '',
        action: route.describe(),
        middleware: route.getMiddleware().join(', '),
      }));

      if (rows.length === 0) {
        console.log('No routes registered.');
        return;
      }

      const widths = {
        method: Math.max(...rows.map((row) => row.method.length), 'METHOD'.length),
        uri: Math.max(...rows.map((row) => row.uri.length), 'URI'.length),
        name: Math.max(...rows.map((row) => row.name.length), 'NAME'.length),
        action: Math.max(...rows.map((row) => row.action.length), 'ACTION'.length),
        middleware: Math.max(...rows.map((row) => row.middleware.length), 'MIDDLEWARE'.length),
      };

      const header = ['METHOD', 'URI', 'NAME', 'ACTION', 'MIDDLEWARE']
        .map((label, index) => label.padEnd(Object.values(widths)[index]))
        .join('  ');

      console.log(header);
      console.log('-'.repeat(header.length));
      for (const row of rows) {
        console.log(
          [row.method, row.uri, row.name, row.action, row.middleware]
            .map((cell, index) => cell.padEnd(Object.values(widths)[index]))
            .join('  '),
        );
      }
    });
}
