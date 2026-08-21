import type { ChildProcess } from 'node:child_process';
import type { Server } from 'node:http';
import { Command } from 'commander';
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

      const shutdown = (signal: string): void => {
        console.log(`\n  INFO  ${signal} received — shutting down.`);
        server?.close();
        viteChild?.kill();
        process.exit(0);
      };
      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));
    });
}
