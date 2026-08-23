import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { x as extractTar } from 'tar';

const REGISTRY = 'https://registry.npmjs.org';

interface PkgMeta {
  version: string;
  dist: { tarball: string };
}

/** Resolve published npm package metadata for a given name and version. */
async function resolvePkgMeta(name: string, version = 'latest'): Promise<PkgMeta> {
  const encoded = name.replace('/', '%2f');
  const res = await fetch(`${REGISTRY}/${encoded}/${version}`, {
    headers: { accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Could not resolve ${name}@${version} on the npm registry (HTTP ${res.status}).`);
  }
  const meta = (await res.json()) as PkgMeta;
  if (!meta?.dist?.tarball) {
    throw new Error(`${name}@${version} has no downloadable tarball.`);
  }
  return meta;
}

/** Recursively copy a directory tree, skipping node_modules and .git. */
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

/** Download an npm tarball, extract it, and return the unpacked directory. */
async function downloadPkg(name: string, version: string, dest: string): Promise<void> {
  const meta = await resolvePkgMeta(name, version);
  const res = await fetch(meta.dist.tarball);
  if (!res.ok) {
    throw new Error(`Failed to download ${name}@${version} tarball (HTTP ${res.status}).`);
  }
  const tgz = join(dest, 'pkg.tgz');
  writeFileSync(tgz, Buffer.from(await res.arrayBuffer()));
  // npm tarballs wrap everything in a top-level `package/` dir — strip it.
  await extractTar({ file: tgz, cwd: dest, strip: 1 });
}

/**
 * Resolve the published @chavajs/core metadata for a version ('latest' works).
 * Kept as a public alias for backward compat.
 */
export async function resolveCoreMeta(version = 'latest'): Promise<PkgMeta> {
  return resolvePkgMeta('@chavajs/core', version);
}

/**
 * Download @chavajs/core and @chavajs/cli from the npm registry into a
 * version-keyed cache (`~/.chava/core/<version>`) and return its directory.
 *
 * The core package provides `src/` (framework) and `docs/`. The CLI package
 * provides `src/cli/` (CLI source) and `bin/` (entry points). Both are merged
 * into the same cached directory so the scaffolded app has the complete layout.
 *
 * Reuses the cache when the version is already present — repeat scaffolds are
 * offline.
 */
export async function fetchCore(version = 'latest'): Promise<string> {
  const meta = await resolvePkgMeta('@chavajs/core', version);
  const cacheRoot = join(homedir(), '.chava', 'core');
  const cached = join(cacheRoot, meta.version);

  // Already cached with CLI + inertia adapter + commands parity? Return early.
  // The permission-assign marker catches caches built from older @chavajs/cli
  // tarballs that lack newer commands — those get rebuilt automatically.
  if (
    existsSync(join(cached, 'src', 'foundation', 'Application.ts')) &&
    existsSync(join(cached, 'src', 'cli', 'index.ts')) &&
    existsSync(join(cached, 'src', 'inertia', 'HtmlRenderer.ts')) &&
    existsSync(join(cached, 'src', 'cli', 'commands', 'permission-assign.ts'))
  ) {
    return cached;
  }

  mkdirSync(cacheRoot, { recursive: true });

  const tmp = join(cacheRoot, `.tmp-${meta.version}-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });

  try {
    // 1. Download and extract @chavajs/core.
    const coreDir = join(tmp, 'core');
    mkdirSync(coreDir, { recursive: true });
    await downloadPkg('@chavajs/core', version, coreDir);

    if (!existsSync(join(coreDir, 'src', 'foundation', 'Application.ts'))) {
      throw new Error('Downloaded @chavajs/core does not look like a framework package (missing src/foundation/Application.ts).');
    }

    // 2. Download and extract @chavajs/cli, merge into core layout.
    const cliDir = join(tmp, 'cli');
    mkdirSync(cliDir, { recursive: true });
    await downloadPkg('@chavajs/cli', 'latest', cliDir);

    // Merge: cli/src/ → core/src/cli/
    const cliSrc = join(cliDir, 'src');
    if (existsSync(cliSrc)) {
      copyTree(cliSrc, join(coreDir, 'src', 'cli'));
    }

    // Merge: cli/bin/ → core/bin/
    const cliBin = join(cliDir, 'bin');
    if (existsSync(cliBin)) {
      copyTree(cliBin, join(coreDir, 'bin'));
    }

    // Merge: cli/template/ → core/template/
    const cliTemplate = join(cliDir, 'template');
    if (existsSync(cliTemplate)) {
      copyTree(cliTemplate, join(coreDir, 'template'));
    }

    // Merge: cli/template-admin/ → core/template-admin/ (admin overlay).
    const cliAdmin = join(cliDir, 'template-admin');
    if (existsSync(join(cliAdmin, 'routes', 'admin.ts'))) {
      copyTree(cliAdmin, join(coreDir, 'template-admin'));
    }

    // 3. Download and extract @chavajs/inertia-react, merge into core layout.
    //    Mirrors the monorepo assembly: inertia-react/src/** → src/inertia/**.
    try {
      const inertiaDir = join(tmp, 'inertia');
      mkdirSync(inertiaDir, { recursive: true });
      await downloadPkg('@chavajs/inertia-react', meta.version, inertiaDir).catch(async () => downloadPkg('@chavajs/inertia-react', 'latest', inertiaDir));
      const inertiaSrc = join(inertiaDir, 'src');
      if (existsSync(join(inertiaSrc, 'HtmlRenderer.ts'))) {
        copyTree(inertiaSrc, join(coreDir, 'src', 'inertia'));
      }
    } catch {
      // Older registries may not carry the adapter — scaffold still works for
      // API-only apps; InertiaServiceProvider will surface a clear error.
    }

    // 4. Download chava-permissions (roles & permissions) → src/permissions/.
    try {
      const permDir = join(tmp, 'permissions');
      mkdirSync(permDir, { recursive: true });
      await downloadPkg('chava-permissions', meta.version, permDir).catch(async () => downloadPkg('chava-permissions', 'latest', permDir));
      const permSrc = join(permDir, 'src');
      if (existsSync(join(permSrc, 'core', 'Registrar.ts'))) {
        copyTree(permSrc, join(coreDir, 'src', 'permissions'));
      }
    } catch {
      // Optional package — scaffold still works without it.
    }

    rmSync(cached, { recursive: true, force: true });
    renameSync(coreDir, cached);
    return cached;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
