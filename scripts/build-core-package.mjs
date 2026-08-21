#!/usr/bin/env node
/**
 * build-core-package — build the publishable `@chavajs/core` framework
 * distribution into `dist/@chavajs/core`.
 *
 * The framework is consumed as an *assembled copy* (Laravel's vendor/
 * model): the installer (`@chavajs/installer`) downloads this package and
 * merges it into an app's `src/` + `bin/`, then overlays the starter
 * `template/`. This script produces that distribution from the canonical
 * `packages/` split:
 *
 *   packages/core/src/**          →  src/**            (facades, ORM, http, …)
 *   packages/inertia-react/src/** →  src/inertia/**    (Inertia server adapter)
 *   packages/cli/src/**           →  src/cli/**        (the `chava` CLI)
 *   packages/cli/bin/**           →  bin/**            (bin/chava.js)
 *   packages/cli/template/**      →  template/**       (starter app scaffold)
 *
 * Usage:
 *   node scripts/build-core-package.mjs [target]
 *     target: output directory (default: dist/@chavajs/core)
 */
import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { copyTree, DIST, guardTarget, PKG, readJson, ROOT, writeJson } from './lib/build-utils.mjs';

const ASSEMBLY = [
  { pkg: join(PKG('core'), 'src'), into: ['src'] },
  { pkg: join(PKG('inertia-react'), 'src'), into: ['src', 'inertia'] },
  { pkg: join(PKG('cli'), 'src'), into: ['src', 'cli'] },
  { pkg: join(PKG('cli'), 'bin'), into: ['bin'] },
  { pkg: join(PKG('core'), 'docs'), into: ['docs'] },
];

function main() {
  const target = process.argv[2] ? join(process.cwd(), process.argv[2]) : DIST('@chavajs/core');
  guardTarget(target);

  rmSync(target, { recursive: true, force: true });

  for (const { pkg, into } of ASSEMBLY) {
    if (!existsSync(pkg)) {
      console.error(`  ✗ Package source missing: ${pkg}`);
      process.exit(1);
    }
    copyTree(pkg, join(target, ...into));
    console.log(`  ✓ ${into.join('/')} ← ${pkg.replace(ROOT, '.')}`);
  }

  // Starter template the `new` command overlays onto a fresh app.
  copyTree(join(PKG('cli'), 'template'), join(target, 'template'));
  console.log('  ✓ template ← ./packages/cli/template');

  // The README published to the npm page for the package.
  const coreReadme = join(PKG('core'), 'README.md');
  if (existsSync(coreReadme)) {
    cpSync(coreReadme, join(target, 'README.md'));
    console.log('  ✓ README.md ← ./packages/core/README.md');
  }

  const srcPkg = readJson(join(PKG('core'), 'package.json'));
  writeJson(join(target, 'package.json'), {
    name: '@chavajs/core',
    version: srcPkg.version,
    description: srcPkg.description,
    type: 'module',
    license: 'MIT',
    bin: { chava: 'bin/chava.js' },
    engines: { node: '>=18.17.0' },
    files: ['bin', 'src', 'template', 'docs'],
    keywords: srcPkg.keywords,
    dependencies: {
      '@faker-js/faker': '10.5.0',
      commander: '12.1.0',
      dotenv: '16.6.1',
      tsx: '^4.23.11',
      typescript: '^5.7.3',
    },
    peerDependencies: srcPkg.peerDependencies,
    peerDependenciesMeta: srcPkg.peerDependenciesMeta,
  });
  console.log('  ✓ package.json (@chavajs/core, bin.chava)');

  writeFileSync(join(target, '.npmignore'), '# Publishing controlled by files field in package.json\n');
  console.log('  ✓ .npmignore');

  console.log(`\n  ✓ @chavajs/core distribution built into ${target.replace(ROOT, '.')}/`);
  console.log('  Fetchable by: chava new <name>');
}

main();