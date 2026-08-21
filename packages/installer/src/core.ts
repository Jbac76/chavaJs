import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { x as extractTar } from 'tar';

const REGISTRY = 'https://registry.npmjs.org';

interface CoreMeta {
  version: string;
  dist: { tarball: string };
}

/** Resolve the published @chavajs/core metadata for a version ('latest' works). */
export async function resolveCoreMeta(version = 'latest'): Promise<CoreMeta> {
  const res = await fetch(`${REGISTRY}/@chavajs%2fcore/${version}`, {
    headers: { accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Could not resolve @chavajs/core@${version} on the npm registry (HTTP ${res.status}).`);
  }
  const meta = (await res.json()) as CoreMeta;
  if (!meta?.dist?.tarball) {
    throw new Error(`@chavajs/core@${version} has no downloadable tarball.`);
  }
  return meta;
}

/**
 * Download @chavajs/core from the npm registry into a version-keyed cache
 * (`~/.chava/core/<version>`) and return its directory. Reuses the cache when
 * the version is already present — repeat scaffolds are offline.
 */
export async function fetchCore(version = 'latest'): Promise<string> {
  const meta = await resolveCoreMeta(version);
  const cacheRoot = join(homedir(), '.chava', 'core');
  const cached = join(cacheRoot, meta.version);

  if (existsSync(join(cached, 'src', 'foundation', 'Application.ts'))) return cached;

  mkdirSync(cacheRoot, { recursive: true });

  const res = await fetch(meta.dist.tarball);
  if (!res.ok) {
    throw new Error(`Failed to download @chavajs/core tarball (HTTP ${res.status}).`);
  }

  const tmp = join(cacheRoot, `.tmp-${meta.version}-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });

  try {
    const tgz = join(tmp, 'core.tgz');
    writeFileSync(tgz, Buffer.from(await res.arrayBuffer()));

    const unpacked = join(tmp, 'unpacked');
    mkdirSync(unpacked, { recursive: true });
    // npm tarballs wrap everything in a top-level `package/` dir — strip it.
    await extractTar({ file: tgz, cwd: unpacked, strip: 1 });

    if (!existsSync(join(unpacked, 'src', 'foundation', 'Application.ts'))) {
      throw new Error('Downloaded @chavajs/core does not look like a framework package (missing src/foundation/Application.ts).');
    }

    rmSync(cached, { recursive: true, force: true });
    renameSync(unpacked, cached);
    return cached;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}