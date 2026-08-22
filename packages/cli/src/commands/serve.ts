import type { ChildProcess } from 'node:child_process';
import type { Server } from 'node:http';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import type { Router } from '../../http/Router';
import { bootApp } from '../helpers/boot-app';
import { maybeStartVite } from '../helpers/vite';

interface ServeOptions {
  port?: string;
  host?: string;
  vite?: boolean;
}

export function serveCommand(): Command {
  return new Command('serve')
    .description('Serve the application on the chavaJs development server')
    .option('-p, --port <port>', 'The port to listen on (default: 8080; the next free port is used if taken)', '8080')
    .option('-H, --host <host>', 'The host the server should bind to', '127.0.0.1')
    .option('--no-vite', 'Do not start the Vite dev server')
    .action(async (options: ServeOptions) => {
      const app = await bootApp();
      await app.bootstrap();

      // Production route cache (Laravel: config route_cache). Local always
      // registers fresh; prod loads the cached table, auto-invalidating when
      // the routes directory hash no longer matches.
      if (!app.isLocal()) {
        const cachePath = join(app.basePathDir(), 'bootstrap', 'route-cache.json');
        if (existsSync(cachePath)) {
          const router = app.make<Router>('router');
          const loaded = await router.loadCache(cachePath);
          if (loaded) console.log('  > Using cached routes.');
        }
      }

      let viteChild: ChildProcess | null = null;
      if (options.vite !== false) {
        viteChild = await maybeStartVite(app);
      }

      const host = options.host ?? '127.0.0.1';
      const preferred = parseInt(options.port ?? '8080', 10);
      let port = preferred;
      let server: Server | null = null;
      for (;;) {
        try {
          server = await app.serve(port, host);
          break;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error;
          if (port === preferred) console.log(`  > Port ${preferred} is in use — starting on the next free port…`);
          port += 1;
        }
      }

      let shuttingDown = false;
      const shutdown = (signal: string): void => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`\n  INFO  ${signal} received — draining connections…`);

        // Force-exit safety net: never hang a deploy longer than 30s.
        const forced = setTimeout(() => {
          console.error('  WARN  Forced shutdown (connections did not drain in 30s).');
          process.exit(1);
        }, 30_000);
        forced.unref();

        // Stop accepting new connections; wait for in-flight requests.
        server?.close(async () => {
          await app.shutdown();
          viteChild?.kill();
          console.log('  INFO  Shutdown complete.');
          process.exit(0);
        });

        // server.close() callback never fires while keep-alive sockets are
        // open — drop idle keep-alive clients after a short grace period.
        setTimeout(() => {
          server?.closeIdleConnections?.();
        }, 2_000).unref();
      };
      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));
    });
}
