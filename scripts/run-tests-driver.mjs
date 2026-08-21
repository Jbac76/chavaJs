#!/usr/bin/env node
/**
 * run-tests-driver — run the starter's Vitest suite against a specific
 * database driver, portably (no cross-env needed on Windows).
 *
 * Usage:
 *   node scripts/run-tests-driver.mjs postgres
 *   node scripts/run-tests-driver.mjs mysql
 *
 * Maps to TEST_ALL_DRIVERS=1 DB_CONNECTION=pg|mysql vitest run in
 * examples/starter, then forwards a failing exit code.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STARTER = join(ROOT, 'examples', 'starter');
const DRIVER_MAP = { postgres: 'pg', mysql: 'mysql2', pg: 'pg', mysql: 'mysql' };

const raw = process.argv[2];
const driver = DRIVER_MAP[raw];
if (!driver) {
  console.error('  ✗ Usage: node scripts/run-tests-driver.mjs <postgres|mysql>');
  process.exit(1);
}

const vitest = join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'vitest.cmd' : 'vitest');
const result = spawnSync(
  vitest,
  ['run'],
  {
    cwd: STARTER,
    env: { ...process.env, TEST_ALL_DRIVERS: '1', DB_CONNECTION: driver },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

process.exit(result.status ?? 1);