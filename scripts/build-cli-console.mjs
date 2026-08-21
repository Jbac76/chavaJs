#!/usr/bin/env node
/**
 * build-cli-console — build the publishable standalone `@chavajs/cli` console
 * package into `dist/@chavajs/cli`.
 *
 * The console is consumed two ways:
 *   - from a chavaJs checkout (dev): the bin assembles the packages into a
 *     `.chava-stage/` and runs the CLI from there;
 *   - as a globally-installed npm package (`npm i -g @chavajs/cli`): the
 *     package is self-contained — it ships the assembled framework `src/` +
 *     `bin/`, using only relative imports.
 *
 * This script produces that standalone package from the canonical `packages/`
 * split (the same merge `chava new` performs for a new app). The starter
 * `template/` is NOT included — scaffolding lives in `@chavajs/installer`:
 *
 *   packages/core/src/**          →  src/**            (facades, ORM, http, …)
 *   packages/inertia-react/src/** →  src/inertia/**    (Inertia server adapter)
 *   packages/cli/src/**           →  src/cli/**        (the `chava` CLI)
 *   packages/cli/bin/**           →  bin/**            (bin/chava.js)
 *
 * Usage:
 *   node scripts/build-cli-console.mjs [target]
 *     target: output directory (default: dist/@chavajs/cli)
 */
import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { copyTree, DIST, guardTarget, PKG, readJson, ROOT, writeJson } from './lib/build-utils.mjs';

const ASSEMBLY = [
  { pkg: join(PKG('core'), 'src'), into: ['src'] },
  { pkg: join(PKG('inertia-react'), 'src'), into: ['src', 'inertia'] },
  { pkg: join(PKG('cli'), 'src'), into: ['src', 'cli'] },
  { pkg: join(PKG('cli'), 'bin'), into: ['bin'] },
];

function main() {
  const target = process.argv[2] ? join(process.cwd(), process.argv[2]) : DIST('@chavajs/cli');
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

  // The README published to the npm page for the package.
  const cliReadme = join(PKG('cli'), 'README.md');
  if (existsSync(cliReadme)) {
    cpSync(cliReadme, join(target, 'README.md'));
    console.log('  ✓ README.md ← ./packages/cli/README.md');
  }

  const srcPkg = readJson(join(PKG('cli'), 'package.json'));
  writeJson(join(target, 'package.json'), {
    name: '@chavajs/cli',
    version: srcPkg.version,
    description: srcPkg.description,
    type: 'module',
    license: 'MIT',
    bin: srcPkg.bin,
    engines: { node: '>=18.17.0' },
    files: ['bin', 'src'],
    keywords: srcPkg.keywords,
    dependencies: {
      '@faker-js/faker': '10.5.0',
      commander: '12.1.0',
      dotenv: '16.6.1',
      tsx: '^4.23.11',
      typescript: '^5.7.3',
    },
    peerDependencies: {
      pg: '>=8.0.0',
      mysql2: '>=3.0.0',
    },
    peerDependenciesMeta: {
      pg: { optional: true },
      mysql2: { optional: true },
    },
  });
  console.log('  ✓ package.json (@chavajs/cli, bin.chava + bin.js)');

  writeFileSync(join(target, '.npmignore'), '# Publishing controlled by files field in package.json\n');
  console.log('  ✓ .npmignore');

  console.log(`\n  ✓ Standalone @chavajs/cli built into ${target.replace(ROOT, '.')}/`);
  console.log('  Try: npm i -g ./dist/@chavajs/cli');
}

main();