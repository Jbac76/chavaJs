#!/usr/bin/env node
/**
 * build-installer-package — build the publishable `@chavajs/installer` package
 * into `dist/@chavajs/installer`.
 *
 * The installer is deliberately thin: it does NOT bundle the framework. Its
 * only command, `chava new`, resolves @chavajs/core from the npm registry (or
 * a --framework checkout) at scaffold time. It ships just the bootstrap bin
 * and the installer source:
 *
 *   packages/installer/bin/** →  bin/**   (bin/chava.js)
 *   packages/installer/src/** →  src/**   (the installer CLI)
 *
 * Usage:
 *   node scripts/build-installer-package.mjs [target]
 *     target: output directory (default: dist/@chavajs/installer)
 */
import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { copyTree, DIST, guardTarget, PKG, readJson, ROOT, writeJson } from './lib/build-utils.mjs';

function main() {
  const target = process.argv[2] ? join(process.cwd(), process.argv[2]) : DIST('@chavajs/installer');
  guardTarget(target);

  rmSync(target, { recursive: true, force: true });

  for (const frag of ['bin', 'src']) {
    const from = join(PKG('installer'), frag);
    if (!existsSync(from)) {
      console.error(`  ✗ Package source missing: ${from}`);
      process.exit(1);
    }
    copyTree(from, join(target, frag));
    console.log(`  ✓ ${frag} ← ${from.replace(ROOT, '.')}`);
  }

  // The README published to the npm page for the package.
  const readme = join(PKG('installer'), 'README.md');
  if (existsSync(readme)) {
    cpSync(readme, join(target, 'README.md'));
    console.log('  ✓ README.md ← ./packages/installer/README.md');
  }

  const srcPkg = readJson(join(PKG('installer'), 'package.json'));
  writeJson(join(target, 'package.json'), {
    name: '@chavajs/installer',
    version: srcPkg.version,
    description: srcPkg.description,
    type: 'module',
    license: 'MIT',
    bin: srcPkg.bin,
    engines: { node: '>=18.17.0' },
    files: ['bin', 'src'],
    keywords: srcPkg.keywords,
    dependencies: srcPkg.dependencies,
  });
  console.log('  ✓ package.json (@chavajs/installer, bin.chava)');

  writeFileSync(join(target, '.npmignore'), '# Publishing controlled by files field in package.json\n');
  console.log('  ✓ .npmignore');

  console.log(`\n  ✓ Thin @chavajs/installer built into ${target.replace(ROOT, '.')}/`);
  console.log('  Try: npm i -g ./dist/@chavajs/installer && chava new blog');
}

main();