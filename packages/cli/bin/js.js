#!/usr/bin/env node
/**
 * The `js` command — the chavaJs equivalent of Laravel's `php artisan`.
 *
 * Runs the *current app's* own bundled CLI (bin/chava.js), so the app's exact
 * framework version is used. It walks up from the current directory to find
 * that file, so `js <command>` works from anywhere inside an app.
 *
 * How `js` is made available:
 *  - Globally — `npm i -g @chavajs/cli` provides a bare `js` command.
 *  - Per app — every scaffolded app declares its own `js` bin, so
 *    `npx js <command>` works without a global install.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';

function findAppCli(start) {
  let dir = start;
  for (;;) {
    const candidate = join(dir, 'bin', 'chava.js');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const cli = findAppCli(process.cwd());

if (!cli) {
  console.error(
    '✗ No chavaJs app found. Run `js <command>` from inside an app directory (one with bin/chava.js), e.g. `js migrate`.'
  );
  process.exit(1);
}

const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], { stdio: 'inherit' });

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});

child.on('error', (err) => {
  console.error(`✗ Failed to start the chava CLI: ${err.message}`);
  process.exit(1);
});