/**
 * The Playwright web server (Dusk-equivalent): boots chavaJs on a dedicated
 * test database so browser specs never touch the dev database.
 *
 *   node --import tsx tests/Browser/e2e-server.ts
 */
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
process.env.DB_DATABASE = 'database/playwright.sqlite';
process.env.APP_KEY = 'playwright-key-0123456789abcdef0123456789abcdef';
// Boot in production so the HTML shell loads the built assets
// (public/build/manifest.json) instead of Vite dev-server scripts on :5173 —
// the Playwright webServer does not start the Vite dev server.
process.env.APP_ENV = 'production';

rmSync(join(root, 'database', 'playwright.sqlite'), { force: true });
execSync('node bin/chava.js migrate:fresh', { cwd: root, stdio: 'inherit' });
execSync('node bin/chava.js db:seed', { cwd: root, stdio: 'inherit' });

const { app } = await import('../../bootstrap/app');
await app.bootstrap();
await app.serve(4173, '127.0.0.1');
console.log('  chavaJs E2E server on http://127.0.0.1:4173');

// Keep the process alive until Playwright tears the server down.
await new Promise(() => {});
