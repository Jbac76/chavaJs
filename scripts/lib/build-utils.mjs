// Shared helpers for the package build scripts under scripts/.
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PKG = (name) => join(ROOT, 'packages', name);
export const DIST = (name) => join(ROOT, 'dist', name);

/** Copy a directory tree, skipping `node_modules` and `.git`. */
export function copyTree(source, target) {
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

export function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

/** Guard: never build into the repo root or the packages tree. */
export function guardTarget(target) {
  const resolvedRoot = resolve(ROOT).toLowerCase();
  const resolvedTarget = resolve(target).toLowerCase();
  if (resolvedTarget === resolvedRoot || resolvedTarget.startsWith(resolvedRoot + '\\packages')) {
    console.error('  ✗ Refusing to build a package into the repo/packages.');
    process.exit(1);
  }
}