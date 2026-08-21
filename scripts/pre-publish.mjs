#!/usr/bin/env node
/**
 * pre-publish — full verification suite to run before publishing any
 * @chavajs/* package. Runs typecheck, tests, builds, dry-run packs,
 * and a local scaffold E2E (with and without docs) — all offline.
 *
 * Usage:
 *   node scripts/pre-publish.mjs
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './lib/build-utils.mjs';

const STEP = '\x1b[36m▸\x1b[0m';
const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
let passed = 0;
let failed = 0;

function run(label, cmd, opts = {}) {
  console.log(`${STEP} ${label}`);
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit', shell: true, timeout: 180_000, ...opts });
    console.log(`${PASS} ${label}\n`);
    passed++;
  } catch {
    console.error(`${FAIL} ${label}\n`);
    process.exit(1);
  }
}

function check(label, fn) {
  console.log(`${STEP} ${label}`);
  try {
    fn();
    console.log(`${PASS} ${label}\n`);
    passed++;
  } catch (err) {
    console.error(`${FAIL} ${label}: ${err.message}\n`);
    process.exit(1);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

// ── 1. Typecheck ──────────────────────────────────────────────────────────
console.log('\n\x1b[1m─── Phase 1: Typecheck ───\x1b[0m\n');
run('Typecheck starter', 'npm run typecheck');

// ── 2. Test suites ────────────────────────────────────────────────────────
console.log('\x1b[1m─── Phase 2: Test suites ───\x1b[0m\n');
run('Starter tests (211+)', 'npm test --prefix examples/starter');
run('Installer tests (6+)', 'npm test --prefix packages/installer');

// ── 3. Assemble + build ──────────────────────────────────────────────────
console.log('\x1b[1m─── Phase 3: Assemble + build ───\x1b[0m\n');
run('Assemble framework into examples/starter', 'node scripts/assemble-framework.mjs');
run('Build starter frontend (typecheck + vite build)', 'npm run build --prefix examples/starter');
run('Build @chavajs/core dist', 'node scripts/build-core-package.mjs');
run('Build @chavajs/installer dist', 'node scripts/build-installer-package.mjs');
run('Build @chavajs/cli dist', 'node scripts/build-cli-console.mjs');

// ── 4. Dry-run pack ──────────────────────────────────────────────────────
console.log('\x1b[1m─── Phase 4: Dry-run pack ───\x1b[0m\n');

const PACKAGES = ['@chavajs/core', '@chavajs/installer', '@chavajs/cli'];

for (const name of PACKAGES) {
  const distDir = join(ROOT, 'dist', name);
  const pkg = JSON.parse(readFileSync(join(distDir, 'package.json'), 'utf8'));
  console.log(`${STEP} ${name}@${pkg.version} — dry-run pack`);

  const output = execSync(`npm pack --dry-run`, {
    cwd: distDir,
    encoding: 'utf8',
    shell: true,
  });
  const files = output.split('\n').filter((l) => l.startsWith('npm notice')).length;
  console.log(`${PASS} ${name}@${pkg.version} — ${files} files\n`);
  passed++;

  if (name === '@chavajs/core') {
    assert(existsSync(join(distDir, 'docs')), 'dist/@chavajs/core must contain docs/');
    const docs = readdirSync(join(distDir, 'docs')).filter((f) => f.endsWith('.md'));
    assert(docs.length >= 23, `Expected >= 23 docs, got ${docs.length}`);
    console.log(`  ✓ ${docs.length} docs pages in dist\n`);
  }
}

// ── 5. Scaffold E2E — with docs ──────────────────────────────────────────
console.log('\x1b[1m─── Phase 5: Scaffold E2E (docs) ───\x1b[0m\n');

const tmpBase = mkdtempSync(join(tmpdir(), 'chava-prepub-'));
const appWithDocs = join(tmpBase, 'with-docs');
const installerBin = join(ROOT, 'dist', '@chavajs', 'installer', 'bin', 'chava.js');

console.log(`${STEP} Scaffolding with --docs`);
execSync(
  `node ${installerBin} new with-docs --framework ${ROOT} --docs --skip-install`,
  { cwd: tmpBase, stdio: 'inherit', shell: true },
);
console.log(`${PASS} Scaffold with --docs\n`);
passed++;

check('docs/ exists in scaffolded app', () => {
  assert(existsSync(join(appWithDocs, 'docs')), 'docs/ not found');
  const docs = readdirSync(join(appWithDocs, 'docs')).filter((f) => f.endsWith('.md'));
  assert(docs.length >= 23, `Expected >= 23 docs, got ${docs.length}`);
});

check('bin/chava.js exists', () => {
  assert(existsSync(join(appWithDocs, 'bin', 'chava.js')), 'bin/chava.js not found');
});

check('package.json has js bin', () => {
  const pkg = JSON.parse(readFileSync(join(appWithDocs, 'package.json'), 'utf8'));
  assert(pkg.bin?.js === 'bin/chava.js', 'missing js bin');
});

// Install + boot in the scaffolded app
console.log(`${STEP} npm install in scaffolded app`);
execSync('npm install --no-audit --no-fund', {
  cwd: appWithDocs,
  stdio: 'inherit',
  shell: true,
  timeout: 120_000,
});
console.log(`${PASS} npm install\n`);
passed++;

check('js route:list shows /docs routes', () => {
  const output = execSync('node bin/chava.js route:list', {
    cwd: appWithDocs,
    encoding: 'utf8',
    shell: true,
  });
  assert(output.includes('/docs'), 'missing /docs route');
  assert(output.includes('/docs/{page}'), 'missing /docs/{page} route');
});

// ── 6. Scaffold E2E — without docs ───────────────────────────────────────
console.log('\x1b[1m─── Phase 6: Scaffold E2E (no docs) ───\x1b[0m\n');

const appNoDocs = join(tmpBase, 'no-docs');

console.log(`${STEP} Scaffolding with --no-docs`);
execSync(
  `node ${installerBin} new no-docs --framework ${ROOT} --no-docs --skip-install`,
  { cwd: tmpBase, stdio: 'inherit', shell: true },
);
console.log(`${PASS} Scaffold with --no-docs\n`);
passed++;

check('docs/ does not exist', () => {
  assert(!existsSync(join(appNoDocs, 'docs')), 'docs/ should not exist with --no-docs');
});

// ── 7. Version check ─────────────────────────────────────────────────────
console.log('\x1b[1m─── Phase 7: Version consistency ───\x1b[0m\n');

check('all package versions match', () => {
  const versions = {};
  for (const name of PACKAGES) {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'packages', name.replace('@chavajs/', ''), 'package.json'), 'utf8'));
    versions[name] = pkg.version;
  }
  const coreVersion = versions['@chavajs/core'];
  for (const [name, version] of Object.entries(versions)) {
    assert(version === coreVersion, `${name}@${version} ≠ core@${coreVersion}`);
  }
  console.log(`  All packages at ${coreVersion}`);
});

// ── Cleanup ───────────────────────────────────────────────────────────────
rmSync(tmpBase, { recursive: true, force: true });

// ── Summary ───────────────────────────────────────────────────────────────
console.log('\n\x1b[1m─── Done ───\x1b[0m\n');
console.log(`${PASS} ${passed} checks passed`);
console.log(`\nReady to publish:`);
console.log(`  npm run publish:core && npm run publish:installer && npm run publish:cli`);
