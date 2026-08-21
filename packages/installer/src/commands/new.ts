import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Command } from 'commander';
import { fetchCore } from '../core';

/**
 * `chava new <name>` — the Laravel Installer equivalent for chavaJs.
 *
 *   chava new blog
 *   chava new blog --database=postgres --no-auth --package-manager=pnpm
 *
 * Scaffolds a ready-to-run starter app. The framework is *not* bundled with
 * the installer — it is resolved at scaffold time from one of:
 *   - `--framework <path>`   a chavaJs checkout (assembled from packages/*);
 *   - a chavaJs checkout the installer is running inside (the monorepo dev /
 *     CI workflow — no network needed);
 *   - the npm registry       `@chavajs/core@latest` (or `--core-version`),
 *     downloaded into `~/.chava/core/<version>` and reused for repeat runs.
 *
 * The resolved framework's assembled `src/` + `bin/` and the starter template
 * (`template/`, owned by the @chavajs/core package) are copied into the new
 * app, choices are applied (database/auth/package-manager), and dependencies
 * are installed.
 */

const DB_ENGINES = ['sqlite', 'postgres', 'mysql'];
const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn'];

/** The npm package for a DB engine (installed as an app dependency). */
const ENGINE_PACKAGES: Record<string, string | null> = { sqlite: null, postgres: 'pg', mysql: 'mysql2' };

/** App paths removed when scaffolding with --no-auth. */
const AUTH_PATHS = [
  'resources/js/Pages/Auth',
  'resources/js/Pages/Dashboard.tsx',
  'app/Http/Controllers/AuthController.ts',
  'app/Http/Controllers/DashboardController.ts',
  'app/Http/Requests/LoginRequest.ts',
  'app/Http/Requests/RegisterRequest.ts',
  'app/Listeners/SendWelcomeNotification.ts',
  'app/Notifications/WelcomeNotification.ts',
  'app/Mail/WelcomeMail.ts',
  'app/Events/UserRegistered.ts',
];

/** Runtime storage directories created empty in the scaffold. */
const STORAGE_DIRS = ['logs', 'framework/sessions', 'framework/cache', 'app'];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '-')
    // Leading/trailing dots and dashes are invalid in npm package names.
    .replace(/^[._-]+/, '')
    .replace(/[._-]+$/, '');
}

/**
 * Copy a directory tree, skipping `node_modules` and `.git`. */
function copyTree(source: string, target: string): void {
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

/**
 * Copy the framework's `docs/` directory into an app when it exists. Returns
 * whether docs were copied. The unit-tested public API.
 */
export function copyDocs(sourceRoot: string, targetDir: string): boolean {
  const docsSource = join(sourceRoot, 'docs');
  if (!existsSync(docsSource)) return false;
  copyTree(docsSource, join(targetDir, 'docs'));
  return true;
}

/**
 * Merge the three packages into the flat `src/` + `bin/` layout every app
 * imports:
 *
 *   packages/core/src/**          →  src/**            (facades, ORM, http, …)
 *   packages/inertia-react/src/** →  src/inertia/**    (Inertia server adapter)
 *   packages/cli/src/**           →  src/cli/**        (the `chava` CLI)
 *   packages/cli/bin/**           →  bin/**            (bin/chava.js)
 */
const FRAMEWORK_ASSEMBLY = [
  { pkg: ['core', 'src'], into: ['src'] },
  { pkg: ['inertia-react', 'src'], into: ['src', 'inertia'] },
  { pkg: ['cli', 'src'], into: ['src', 'cli'] },
  { pkg: ['cli', 'bin'], into: ['bin'] },
];

function assembleFramework(repoRoot: string, targetDir: string): void {
  for (const { pkg, into } of FRAMEWORK_ASSEMBLY) {
    copyTree(join(repoRoot, 'packages', ...pkg), join(targetDir, ...into));
  }
}

/** Relative paths (dirs or files) never copied by the legacy clone fallback. */
const CLONE_EXCLUDED = [
  'node_modules',
  '.git',
  'storage',
  'public/build',
  '.env',
  'package-lock.json',
  'database/database.sqlite',
];

function isExcluded(rel: string): boolean {
  return CLONE_EXCLUDED.some((excluded) => rel === excluded || rel.startsWith(`${excluded}/`));
}

/**
 * Clone the current application tree, skipping tooling state. Used when the
 * framework copy has no bundled template. A manual walk so the destination may
 * live inside the source.
 */
export function copyProjectTree(sourceDir: string, targetDir: string): void {
  const walk = (src: string, dest: string): void => {
    const rel = src === sourceDir ? '' : src.slice(sourceDir.length + 1).replaceAll('\\', '/');
    const stat = statSync(src);
    if (stat.isDirectory()) {
      mkdirSync(dest, { recursive: true });
      for (const entry of readdirSync(src)) {
        const childSrc = join(src, entry);
        if (childSrc === targetDir || childSrc.startsWith(`${targetDir}${sep}`)) continue;

        const childRel = childSrc.slice(sourceDir.length + 1).replaceAll('\\', '/');
        if (isExcluded(childRel)) continue;

        const name = basename(childSrc);
        if (name.startsWith('.') && name !== '.env.example' && name !== '.gitignore' && name !== '.github') continue;

        walk(childSrc, join(dest, entry));
      }
      return;
    }
    if (stat.isFile()) {
      mkdirSync(dirname(dest), { recursive: true });
      try {
        cpSync(src, dest);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== 'EBUSY' && code !== 'EPERM' && code !== 'EACCES') throw error;
        console.warn(`  ! skipped locked file (${code}): ${rel}`);
      }
    }
  };

  walk(sourceDir, targetDir);
}

/**
 * Copy-style scaffold: clone `sourceDir` (skipping tooling state), apply the
 * app name, regenerate `.env` from the example, and lay down the storage
 * layout. The unit-tested public API.
 */
export function scaffoldProject(sourceDir: string, targetDir: string, name: string): void {
  copyProjectTree(sourceDir, targetDir);

  const pkgPath = join(targetDir, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name: string };
    pkg.name = slugify(name) || 'chavajs-app';
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  }

  const envExample = join(targetDir, '.env.example');
  if (existsSync(envExample)) writeFileSync(join(targetDir, '.env'), readFileSync(envExample));

  for (const dir of STORAGE_DIRS) {
    mkdirSync(join(targetDir, 'storage', ...dir.split('/')), { recursive: true });
    writeFileSync(join(targetDir, 'storage', ...dir.split('/'), '.gitkeep'), '');
  }
}

// ------------------------------------------------------------------ prompts

async function promptChoice(rl: ReturnType<typeof createInterface>, question: string, options: string[], fallback: string): Promise<string> {
  for (;;) {
    const answer = (await rl.question(`${question} [${options.join(' | ')}] (${fallback}): `)).trim().toLowerCase();
    if (answer === '') return fallback;
    if (options.includes(answer)) return answer;
    console.log(`  (choose one of: ${options.join(', ')})`);
  }
}

async function promptYesNo(rl: ReturnType<typeof createInterface>, question: string, fallback: boolean): Promise<boolean> {
  for (;;) {
    const answer = (await rl.question(`${question} [y/N]: `)).trim().toLowerCase();
    if (answer === '') return fallback;
    if (['y', 'yes'].includes(answer)) return true;
    if (['n', 'no'].includes(answer)) return false;
    console.log('  (y / n)');
  }
}

// ------------------------------------------------------------------ install

function installDeps(targetDir: string, packageManager: string): void {
  const command = packageManager === 'npm' ? 'npm' : packageManager;
  const args = packageManager === 'yarn' ? [] : ['install'];
  const result = spawnSync(command, args, { cwd: targetDir, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.error('\n  ✗ Dependency installation failed. You can retry manually:');
    console.error(`    cd ${basename(targetDir)} && ${command} ${args.join(' ')}`);
    process.exit(1);
  }
}

// ------------------------------------------------------------------ scaffold

interface NewOptions {
  name?: string;
  database?: string;
  auth?: boolean;
  docs?: boolean;
  packageManager?: string;
  skipInstall?: boolean;
  framework?: string;
  coreVersion?: string;
}

/**
 * Locate the framework source + starter template:
 *  1. `--framework <path>` — a chavaJs checkout (packages/* layout);
 *  2. a checkout the installer is running inside (monorepo dev/CI, offline);
 *  3. the npm registry (`@chavajs/core`, downloaded + cached).
 */
async function resolveSourceRoots(opts: NewOptions): Promise<{ repoRoot: string | null; pkgRoot: string }> {
  if (opts.framework) {
    const checkout = resolve(opts.framework);
    if (!existsSync(join(checkout, 'packages', 'core', 'src', 'foundation', 'Application.ts'))) {
      throw new Error(`--framework path [${opts.framework}] is not a chavaJs checkout (no packages/core/src/foundation/Application.ts).`);
    }
    return { repoRoot: checkout, pkgRoot: join(checkout, 'packages', 'cli') };
  }

  // Running inside a checkout? Walk up from this module.
  for (let dir = dirname(fileURLToPath(import.meta.url)); ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'packages', 'core', 'src', 'foundation', 'Application.ts'))) {
      return { repoRoot: dir, pkgRoot: join(dir, 'packages', 'cli') };
    }
    const parent = dirname(dir);
    if (parent === dir) break;
  }

  // Otherwise download the framework from the registry.
  console.log(`  Resolving @chavajs/core@${opts.coreVersion ?? 'latest'} from the npm registry…`);
  const pkgRoot = await fetchCore(opts.coreVersion);
  return { repoRoot: null, pkgRoot };
}

async function collectOptions(options: NewOptions): Promise<Required<Pick<NewOptions, 'name' | 'database' | 'packageManager'>> & { withAuth: boolean; includeDocs: boolean }> {
  const interactive = stdin.isTTY;
  const rl = interactive ? createInterface({ input: stdin, output: stdout }) : null;

  let name = options.name;
  let database = options.database;
  let withAuth = options.auth;
  let includeDocs = options.docs;
  let packageManager = options.packageManager;

  if (!name) {
    if (!rl) { console.error('  ✗ Please provide an application name: chava new <name>'); process.exit(1); }
    name = (await rl.question('Application name: ')).trim();
  }
  if (!name) { console.error('  ✗ An application name is required.'); process.exit(1); }

  if (!database) database = rl ? await promptChoice(rl, 'Database engine', DB_ENGINES, 'sqlite') : 'sqlite';
  if (!DB_ENGINES.includes(database)) {
    console.error(`  ✗ Unknown database engine [${database}]. Choose: ${DB_ENGINES.join(', ')}`);
    process.exit(1);
  }

  if (withAuth === undefined) withAuth = rl ? await promptYesNo(rl, 'Include the authentication UI (login / register / dashboard)?', true) : true;

  if (includeDocs === undefined) includeDocs = rl ? await promptYesNo(rl, 'Include the framework documentation (served at /docs)?', true) : true;

  if (!packageManager) packageManager = rl ? await promptChoice(rl, 'Package manager', PACKAGE_MANAGERS, 'npm') : 'npm';
  if (!PACKAGE_MANAGERS.includes(packageManager)) {
    console.error(`  ✗ Unknown package manager [${packageManager}]. Choose: ${PACKAGE_MANAGERS.join(', ')}`);
    process.exit(1);
  }

  rl?.close();
  return { name, database, withAuth, includeDocs, packageManager };
}

async function scaffoldNewApp(opts: NewOptions): Promise<void> {
  const { name, database, withAuth, includeDocs, packageManager } = await collectOptions(opts);

  const { repoRoot, pkgRoot } = await resolveSourceRoots(opts);
  const standalone = repoRoot === null;
  const templateDir = join(pkgRoot, 'template');
  const hasTemplate = existsSync(join(templateDir, 'package.json'));
  const targetDir = resolve(process.cwd(), name);

  if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
    throw new Error(`Directory [${name}] already exists and is not empty.`);
  }

  console.log(`\n  Scaffolding chavaJs app [${name}] (${database}, ${withAuth ? 'auth' : 'no auth'}, ${includeDocs ? 'docs' : 'no docs'}, ${packageManager})…`);

  // 1. Framework core.
  if (standalone) {
    copyTree(join(pkgRoot, 'src'), join(targetDir, 'src'));
    copyTree(join(pkgRoot, 'bin'), join(targetDir, 'bin'));
  } else {
    assembleFramework(repoRoot as string, targetDir);
  }

  if (hasTemplate) {
    // 2. The maintained starter template.
    copyTree(templateDir, targetDir);
  } else {
    // No bundled template — clone the current application.
    copyProjectTree(process.cwd(), targetDir);
  }

  // 2b. Framework documentation (served at /docs when opted in).
  if (includeDocs) {
    // The framework root that carries the docs/: the @chavajs/core dist (which
    // ships a top-level docs/) or the canonical packages/core in a checkout.
    const docsSource = standalone ? pkgRoot : join(repoRoot as string, 'packages', 'core');
    if (copyDocs(docsSource, targetDir)) {
      console.log('  ✓ docs ← framework documentation (served at /docs)');
    }
  }

  // 3. Apply choices.
  const pkg = JSON.parse(readFileSync(join(targetDir, 'package.json'), 'utf8')) as {
    name: string;
    dependencies: Record<string, string>;
  };
  pkg.name = slugify(name) || 'chavajs-app';
  if (database !== 'sqlite' && ENGINE_PACKAGES[database]) {
    pkg.dependencies[ENGINE_PACKAGES[database] as string] = ENGINE_PACKAGES[database] === 'pg' ? '8.23.0' : '3.23.2';
  }
  writeFileSync(join(targetDir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);

  const envExample = readFileSync(join(targetDir, '.env.example'), 'utf8')
    .replace(/^DB_CONNECTION=.*$/m, `DB_CONNECTION=${database === 'postgres' ? 'pg' : database}`)
    .replace(/^DB_DATABASE=.*$/m, `DB_DATABASE=${database === 'sqlite' ? 'database/database.sqlite' : 'chava'}`);
  writeFileSync(join(targetDir, '.env.example'), envExample);
  writeFileSync(join(targetDir, '.env'), envExample);

  // 4. Auth toggle: strip the auth UI, controllers and routes.
  if (!withAuth) {
    for (const rel of AUTH_PATHS) {
      rmSync(join(targetDir, rel), { recursive: true, force: true });
    }
    const noauthRoutes = join(templateDir, 'routes', 'web.noauth.ts');
    if (existsSync(noauthRoutes)) {
      writeFileSync(join(targetDir, 'routes', 'web.ts'), readFileSync(noauthRoutes));
    }
  }

  // 5. Storage layout for the fresh app.
  for (const dir of STORAGE_DIRS) {
    mkdirSync(join(targetDir, 'storage', ...dir.split('/')), { recursive: true });
    writeFileSync(join(targetDir, 'storage', ...dir.split('/'), '.gitkeep'), '');
  }
  rmSync(join(targetDir, 'database', 'database.sqlite'), { force: true });

  console.log(`\n  ✓ chavaJs app [${name}] scaffolded into ./${name}`);

  // 6. Install dependencies (unless --skip-install).
  if (!opts.skipInstall) {
    console.log(`\n  Installing dependencies with ${packageManager}…\n`);
    installDeps(targetDir, packageManager);
  }

  console.log(`
  Next steps:
    cd ${name}
    js migrate
    js db:seed
    npm run dev                  → http://localhost:8080${includeDocs ? '  (framework docs at /docs)' : ''}

  \`js\` is your app's Artisan-equivalent command — it works bare with a
  global @chavajs/cli install, or as \`npx js <command>\` inside the app.
`);
}

export function newProjectCommand(): Command {
  return new Command('new')
    .description('Create a new chavaJs application (Laravel installer equivalent)')
    .argument('[name]', 'The application directory name (e.g. blog)')
    .option('--database <engine>', `database engine: ${DB_ENGINES.join(' | ')} (default: sqlite)`)
    .option('--auth', 'include the authentication UI')
    .option('--no-auth', 'omit the authentication UI')
    .option('--docs', 'include the framework documentation (served at /docs)')
    .option('--no-docs', 'omit the framework documentation')
    .option('--package-manager <pm>', `package manager: ${PACKAGE_MANAGERS.join(' | ')} (default: npm)`)
    .option('--skip-install', "don't run the package manager after scaffolding")
    .option('--framework <path>', 'chavaJs checkout to assemble the framework from')
    .option('--core-version <version>', '@chavajs/core version to download (default: latest)')
    .action((name: string | undefined, options: Record<string, unknown>) =>
      scaffoldNewApp({
        name,
        database: options.database as string | undefined,
        auth: options.auth as boolean | undefined,
        docs: options.docs as boolean | undefined,
        packageManager: options.packageManager as string | undefined,
        skipInstall: options.skipInstall as boolean | undefined,
        framework: options.framework as string | undefined,
        coreVersion: options.coreVersion as string | undefined,
      }),
    );
}