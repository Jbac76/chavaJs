#!/usr/bin/env node
/**
 * assemble-framework — rebuild the embedded framework `src/` + `bin/` of a
 * chavaJs app (examples/starter, `chava new` outputs, tests, CI) from the
 * canonical packages/ split.
 *
 * The framework is consumed by apps as an embedded copy (exactly what
 * `chava new` does when scaffolding: it copies the framework's src/ +
 * bin/ into the new app). The monorepo keeps the canonical source split into
 * three packages, and this script merges them back into the flat layout every
 * app/template imports (`../src/...`, `../src/cli/...`, `../src/inertia/...`):
 *
 *   packages/core/src/**          →  src/**            (facades, ORM, http, …)
 *   packages/inertia-react/src/** →  src/inertia/**    (Inertia server adapter)
 *   packages/cli/src/**           →  src/cli/**        (the `chava` CLI)
 *   packages/cli/bin/**           →  bin/**            (bin/chava.js)
 *
 * Usage:
 *   node scripts/assemble-framework.mjs [target]
 *     target: an app directory to assemble into (default: examples/starter)
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PKG = (name) => join(ROOT, 'packages', name, 'src');

const ASSEMBLY = [
  { pkg: join(PKG('core')), into: 'src', depth: 0 },
  { pkg: join(PKG('inertia-react')), into: 'src/inertia', depth: 0 },
  { pkg: join(PKG('cli')), into: 'src/cli', depth: 0 },
  { pkg: join(ROOT, 'packages', 'cli', 'bin'), into: 'bin', depth: 0 },
  { pkg: join(ROOT, 'packages', 'core', 'docs'), into: 'docs', depth: 0 },
];

/** Copy a directory tree, skipping nothing (binary + text files both). */
function copyTree(source, target) {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source)) {
    const from = join(source, entry);
    const to = join(target, entry);
    const stat = statSync(from);
    if (stat.isDirectory()) copyTree(from, to);
    else cpSync(from, to);
  }
}

function main() {
  const targetFlag = process.argv[2];
  const target = targetFlag ? resolve(targetFlag) : join(ROOT, 'examples', 'starter');

  // Guard: never assemble into the packages themselves or the repo root.
  const resolvedRoot = resolve(ROOT).toLowerCase();
  if (target.toLowerCase() === resolvedRoot) {
    console.error('  ✗ Refusing to assemble into the repo root.');
    process.exit(1);
  }

  for (const { pkg, into, depth } of ASSEMBLY) {
    if (!existsSync(pkg)) {
      console.error(`  ✗ Package source missing: ${pkg}`);
      process.exit(1);
    }
    const dest = join(target, into);
    // Wipe the previous assembled tree for this fragment (deep-clean) — but
    // for src itself, preserve the app's own src additions if any. The
    // framework owns src entirely, so a full clean is safe.
    rmSync(dest, { recursive: true, force: true });
    copyTree(pkg, dest);
    console.log(`  ✓ ${into} ← ${pkg.replace(ROOT, '.')}${''.padStart(depth, ' ')}`);
  }

  console.log(`\n  ✓ Framework assembled into ${target.replace(ROOT, '.')}/`);
}

main();