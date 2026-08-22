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
import { spawn, spawnSync } from 'node:child_process';
import { Command } from 'commander';
import { fetchCore } from '../core';
import {
  printLogo,
  printCongrats,
  Progress,
  ProgressBar,
  Spinner,
  summaryBox,
  divider,
  info,
  success,
  warn,
  error,
  selectOption,
  selectYesNo,
} from '../ui';

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
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code !== 'EBUSY' && code !== 'EPERM' && code !== 'EACCES') throw err;
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

// ------------------------------------------------------------------ install

function installDeps(targetDir: string, packageManager: string, onProgress?: (percent: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    let cmd: string;
    if (packageManager === 'yarn') {
      cmd = 'yarn';
    } else if (packageManager === 'pnpm') {
      // pnpm v9+ returns exit 1 for ERR_PNPM_IGNORED_BUILDS even when
      // packages are installed — pass --ignore-scripts to avoid the error,
      // then run a postinstall to fetch native binaries (esbuild etc.).
      cmd = 'pnpm install --ignore-scripts && pnpm rebuild';
    } else {
      cmd = 'npm install --loglevel error';
    }

    const child = spawn(cmd, {
      cwd: targetDir,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'], // Capture stdout and stderr
    });

    let buffer = '';
    let lastProgress = 0;
    const progressKeywords = ['package', 'fetch', 'download', 'extract', 'install', 'resolve', 'link'];

    const processOutput = (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      // Estimate progress based on output activity
      if (onProgress && lines.length > 0) {
        // Increment progress gradually with each line of output
        for (const line of lines) {
          const lowerLine = line.toLowerCase();
          if (progressKeywords.some(kw => lowerLine.includes(kw))) {
            lastProgress = Math.min(lastProgress + 2, 90);
            onProgress(lastProgress);
          }
        }
      }
    };

    if (child.stdout) child.stdout.on('data', processOutput);
    if (child.stderr) child.stderr.on('data', processOutput);

    child.on('close', (code) => {
      if (onProgress && code === 0) {
        onProgress(100);
      }
      resolve(code === 0);
    });
    child.on('error', () => resolve(false));
  });
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
      throw new Error(`--framework path [${opts.framework}] is not a chavaJs checkout.`);
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
  const spinner = new Spinner(`Resolving @chavajs/core@${opts.coreVersion ?? 'latest'} from npm`);
  spinner.start();
  const pkgRoot = await fetchCore(opts.coreVersion);
  spinner.stop();
  return { repoRoot: null, pkgRoot };
}

async function collectOptions(options: NewOptions): Promise<Required<Pick<NewOptions, 'name' | 'database' | 'packageManager'>> & { withAuth: boolean; includeDocs: boolean }> {
  const interactive = stdin.isTTY;

  let name = options.name;
  let database = options.database;
  let withAuth = options.auth;
  let includeDocs = options.docs;
  let packageManager = options.packageManager;

  if (!name) {
    if (!interactive) { error('Please provide an application name: chava new <name>'); process.exit(1); }
    const rl = createInterface({ input: stdin, output: stdout });
    name = (await rl.question('  Application name: ')).trim();
    rl.close();
  }
  if (!name) { error('An application name is required.'); process.exit(1); }

  console.log();

  if (!database) {
    database = interactive
      ? await selectOption('Database engine', DB_ENGINES, 0)
      : 'sqlite';
  }
  if (!DB_ENGINES.includes(database)) {
    error(`Unknown database engine [${database}]. Choose: ${DB_ENGINES.join(', ')}`);
    process.exit(1);
  }

  if (withAuth === undefined) {
    withAuth = interactive
      ? await selectYesNo('Include authentication UI (login / register / dashboard)?', true)
      : true;
  }

  if (includeDocs === undefined) {
    includeDocs = interactive
      ? await selectYesNo('Include framework documentation (served at /docs)?', true)
      : true;
  }

  if (!packageManager) {
    packageManager = interactive
      ? await selectOption('Package manager', PACKAGE_MANAGERS, 0)
      : 'npm';
  }
  if (!PACKAGE_MANAGERS.includes(packageManager)) {
    error(`Unknown package manager [${packageManager}]. Choose: ${PACKAGE_MANAGERS.join(', ')}`);
    process.exit(1);
  }

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

  // Show logo and summary
  printLogo();
  summaryBox({ name, database, auth: withAuth, docs: includeDocs, packageManager });

  // Progress steps
  const steps = [
    'Scaffolding framework core',
    'Copying starter template',
    includeDocs ? 'Copying framework docs' : null,
    'Configuring database',
    'Setting up authentication',
    'Creating storage layout',
    'Writing configuration',
  ].filter(Boolean) as string[];

  if (!opts.skipInstall) {
    steps.push(`Installing dependencies with ${packageManager}`);
  }

  const progress = new Progress(steps);
  progress.start();

  // 1. Framework core.
  if (standalone) {
    copyTree(join(pkgRoot, 'src'), join(targetDir, 'src'));
    const binDir = join(pkgRoot, 'bin');
    if (existsSync(binDir)) copyTree(binDir, join(targetDir, 'bin'));
  } else {
    assembleFramework(repoRoot as string, targetDir);
  }
  progress.step();

  // 2. The maintained starter template.
  if (hasTemplate) {
    copyTree(templateDir, targetDir);
  } else {
    copyProjectTree(process.cwd(), targetDir);
  }
  progress.step();

  // 2b. Framework documentation (served at /docs when opted in).
  if (includeDocs) {
    const docsSource = standalone ? pkgRoot : join(repoRoot as string, 'packages', 'core');
    copyDocs(docsSource, targetDir);
    progress.step();
  }

  // 3. Apply choices — database config.
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
  progress.step();

  // 4. Auth toggle: strip the auth UI, controllers and routes.
  if (!withAuth) {
    for (const rel of AUTH_PATHS) {
      rmSync(join(targetDir, rel), { recursive: true, force: true });
    }
    const noauthRoutes = join(templateDir, 'routes', 'web.noauth.ts');
    if (existsSync(noauthRoutes)) {
      writeFileSync(join(targetDir, 'routes', 'web.ts'), readFileSync(noauthRoutes));
    }
    // Auth-free nav: no Users link, no login/register/dashboard entries.
    const noauthLayout = join(templateDir, 'resources', 'js', 'Layouts', 'AppLayout.noauth.tsx');
    if (existsSync(noauthLayout)) {
      writeFileSync(join(targetDir, 'resources', 'js', 'Layouts', 'AppLayout.tsx'), readFileSync(noauthLayout));
    }
    // Home page: drop the "Browse seeded users" CTA — /users does not exist
    // in auth-free scaffolds.
    const homePage = join(targetDir, 'resources', 'js', 'Pages', 'Home.tsx');
    if (existsSync(homePage)) {
      const source = readFileSync(homePage, 'utf8');
      const usersButton = /\n\s*<Button asChild size="lg" variant="outline">\s*\n\s*<Link href="\/users">Browse seeded users<\/Link>\s*\n\s*<\/Button>/;
      if (usersButton.test(source)) {
        writeFileSync(homePage, source.replace(usersButton, ''));
      }
    }
  }
  progress.step();

  // 5. Storage layout for the fresh app.
  for (const dir of STORAGE_DIRS) {
    mkdirSync(join(targetDir, 'storage', ...dir.split('/')), { recursive: true });
    writeFileSync(join(targetDir, 'storage', ...dir.split('/'), '.gitkeep'), '');
  }
  rmSync(join(targetDir, 'database', 'database.sqlite'), { force: true });
  progress.step();

  // 6. Final config step (already done above, just complete the step).
  progress.step();

  // 7. Install dependencies (unless --skip-install).
  if (!opts.skipInstall) {
    // Clear the Progress active line so ProgressBar renders cleanly.
    progress.clear();
    const progressBar = new ProgressBar(packageManager);
    progressBar.start();

    // Track real progress during installation
    const installed = await installDeps(targetDir, packageManager, (percent) => {
      progressBar.updateProgress(percent);
    });

    progressBar.stop(installed);
    console.log();
    if (!installed) {
      error('Dependency installation failed');
      console.log();
      info(`Retry: cd ${name} && ${packageManager} install`);
      console.log();
      return;
    }

    // Auth scaffolds are database-backed — migrate now so pages like /users
    // work out of the box (auth-free scaffolds skip migration entirely).
    let migrated = false;
    if (withAuth) {
      const tty = process.stdout.isTTY;
      if (tty) process.stdout.write('  ●  Running database migrations…');
      else console.log('  Running database migrations…');
      const mig = spawnSync('npm run migrate', { cwd: targetDir, shell: true, stdio: 'pipe', encoding: 'utf8' });
      if (mig.status === 0) {
        migrated = true;
        if (tty) {
          process.stdout.write('\r\x1b[K');
          console.log('  ✓  Database migrated.');
        } else {
          console.log('  ✓  Database migrated.');
        }
      } else {
        if (tty) process.stdout.write('\r\x1b[K');
        warn('Migration failed — run `js migrate` inside the app to retry.');
      }
    }
  } else {
    progress.step();
    if (withAuth) {
      info('Run `js migrate` after installing dependencies.');
    }
  }

  // Show congrats
  printCongrats(name, includeDocs);
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
