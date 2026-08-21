#!/usr/bin/env node
/**
 * The `chava` CLI entrypoint.
 *
 * This bootstrap registers tsx (TypeScript execution hooks) and then runs the
 * real CLI, so every command — including dynamic imports of .ts route/config
 * files — works without a build step.
 *
 * Layout-aware: the framework is consumed as an *assembled copy* (src/ + bin/
 * inside an app, or inside the standalone @chavajs/cli package), and its
 * relative imports assume that merged layout. The monorepo keeps the canonical
 * source split across packages/*, which is not runnable in place — so this bin
 * assembles the packages into a `.chava-stage/` directory inside the checkout
 * and runs the CLI from there (the same merge `chava new` performs for a new
 * app). Everything else runs straight from `../src/cli/index.ts`.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

/**
 * Merge the packages into the flat `src/` + `bin/` layout the CLI and apps
 * import. Mirrors `scripts/assemble-framework.mjs` / `chava new`.
 */
const FRAMEWORK_ASSEMBLY = [
  { pkg: 'core', frag: 'src', into: ['src'] },
  { pkg: 'inertia-react', frag: 'src', into: ['src', 'inertia'] },
  { pkg: 'cli', frag: 'src', into: ['src', 'cli'] },
  { pkg: 'cli', frag: 'bin', into: ['bin'] },
];

function copyTree(source, target) {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const from = join(source, entry);
    const to = join(target, entry);
    const stat = statSync(from);
    if (stat.isDirectory()) copyTree(from, to);
    else cpSync(from, to);
  }
}

/** Build a runnable assembled copy of the framework inside the checkout. */
function assembleStage(repoRoot) {
  const stage = join(repoRoot, '.chava-stage');
  rmSync(stage, { recursive: true, force: true });
  for (const { pkg, frag, into } of FRAMEWORK_ASSEMBLY) {
    copyTree(join(repoRoot, 'packages', pkg, frag), join(stage, ...into));
  }
  return stage;
}

const hasAssembledSrc = existsSync(join(root, 'src', 'foundation', 'Application.ts'));
const isMonorepo =
  !hasAssembledSrc && existsSync(join(resolve(root, '..', '..'), 'packages', 'core', 'src', 'foundation', 'Application.ts'));

let entry;
if (isMonorepo) {
  // The canonical packages are not runnable in place — run from an assembled stage.
  const repoRoot = resolve(root, '..', '..');
  entry = pathToFileURL(join(assembleStage(repoRoot), 'src', 'cli', 'index.ts')).href;
} else {
  // Assembled app or standalone package: the CLI lives at src/cli/.
  const assembledEntry = join(here, '..', 'src', 'cli', 'index.ts');
  if (!existsSync(assembledEntry)) {
    console.error('✗ Could not locate the chava CLI (src/cli/index.ts). This bin must run from an assembled app, the standalone @chavajs/cli package, or a chavaJs checkout.');
    process.exit(1);
  }
  entry = '../src/cli/index.ts';
}

try {
  await import('tsx/esm');
} catch {
  console.error(
    "✗ Cannot find 'tsx'. Run 'npm install' in this app directory first,\n  or install tsx globally with 'npm i -g tsx'."
  );
  process.exit(1);
}

const { run } = await import(entry);

await run();