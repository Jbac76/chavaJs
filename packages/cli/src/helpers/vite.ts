import { spawn, type ChildProcess } from 'node:child_process';
import { createConnection } from 'node:net';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Application } from '../../foundation/Application';
import { Config } from '../../config/Config';

function isPortOpen(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host });
    socket.setTimeout(800);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The first free port at or above `start` (probed with a TCP connection). */
export async function findFreePort(start: number, host = '127.0.0.1'): Promise<number> {
  let port = start;
  for (;;) {
    if (!(await isPortOpen(port, host))) return port;
    port += 1;
  }
}

/** Locate the Vite binary, walking up to a hoisted (workspace) node_modules. */
function resolveViteBin(app: Application): string {
  const name = process.platform === 'win32' ? 'vite.cmd' : 'vite';
  let dir = app.basePathDir();
  for (;;) {
    const candidate = join(dir, 'node_modules', '.bin', name);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return join(app.basePathDir(), 'node_modules', '.bin', name);
}

/**
 * Start the Vite dev server if it is not already running, so `chava serve`
 * gives asset hot-reload out of the box (like Laravel's `npm run dev`).
 *
 * The preferred port (config `frontend.vite_port`, default 5173) is never
 * assumed to be ours just because something is listening on it — a stale
 * Vite from another app would serve the wrong modules and blank the page.
 * If the port is taken, Vite moves to the next free port, and the Inertia
 * renderer is pointed at the port actually bound.
 */
export async function maybeStartVite(app: Application): Promise<ChildProcess | null> {
  const config = app.make<Config>('config');
  const preferred = Number(config.get('frontend.vite_port', 5173));
  const port = await findFreePort(preferred);

  if (port !== preferred) {
    console.log(`  > Vite port ${preferred} is in use — starting Vite on port ${port} instead.`);
  }

  // Point the Inertia renderer at the Vite server actually running.
  config.set('frontend', {
    ...(config.get('frontend') as Record<string, unknown>),
    vite_port: port,
    vite_url: `http://localhost:${port}`,
  });

  const child = spawn(resolveViteBin(app), ['--port', String(port), '--strictPort'], {
    cwd: app.basePathDir(),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  child.on('error', (error: Error) => {
    console.warn(`  ! Could not start the Vite dev server (${error.message}). Run "npm run vite" manually.`);
  });

  for (let i = 0; i < 50; i++) {
    if (await isPortOpen(port)) {
      console.log(`  > Vite dev server ready at http://localhost:${port}`);
      return child;
    }
    await sleep(200);
  }
  console.warn('  ! Vite dev server did not become ready in time.');
  return child;
}
