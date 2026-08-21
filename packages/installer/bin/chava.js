#!/usr/bin/env node
/**
 * The `chava` installer entrypoint.
 *
 * This bootstrap registers tsx (TypeScript execution hooks) and then runs the
 * real installer CLI. It is intentionally thin — the installer does NOT bundle
 * the framework; `chava new` resolves @chavajs/core from the npm registry (or
 * a --framework checkout) at scaffold time.
 */
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

await import('tsx/esm');

const { run } = await import('../src/index.ts');

await run();