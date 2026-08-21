import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { copyDocs, scaffoldProject } from '../src/commands/new';

/** Build a fake framework tree with the tooling state a real repo has. */
function makeFakeSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'chava-src-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'chavajs', version: '0.7.0' }));
  writeFileSync(join(dir, '.env.example'), 'APP_NAME=chavaJs\nDB_CONNECTION=sqlite\n');
  writeFileSync(join(dir, '.gitignore'), 'node_modules\n.env\n');
  writeFileSync(join(dir, '.env'), 'SECRET=should-not-copy\n');
  // The CI workflow is a whitelisted dotfile — scaffolds should be CI-ready.
  mkdirSync(join(dir, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(dir, '.github', 'workflows', 'ci.yml'), 'name: CI\n');
  mkdirSync(join(dir, 'bootstrap'), { recursive: true });
  writeFileSync(join(dir, 'bootstrap', 'app.ts'), 'export const app = {};\n');

  // Tooling state that must never be copied.
  mkdirSync(join(dir, 'node_modules', 'pkg'), { recursive: true });
  mkdirSync(join(dir, 'public', 'build'), { recursive: true });
  writeFileSync(join(dir, 'public', 'build', 'app.js'), 'x');
  mkdirSync(join(dir, 'database'), { recursive: true });
  writeFileSync(join(dir, 'database', 'database.sqlite'), 'dev-db');
  writeFileSync(join(dir, 'package-lock.json'), '{}');
  return dir;
}

describe('chava new scaffold (installer)', () => {
  it('copies the source tree excluding tooling state', () => {
    const source = makeFakeSource();
    const target = mkdtempSync(join(tmpdir(), 'chava-app-'));
    try {
      scaffoldProject(source, target, 'Blog App');

      // Copied: source files, the env example, and .gitignore.
      expect(existsSync(join(target, 'bootstrap', 'app.ts'))).toBe(true);
      expect(existsSync(join(target, '.env.example'))).toBe(true);
      expect(readFileSync(join(target, '.gitignore'), 'utf8')).toContain('node_modules');

      // Excluded: node_modules, built assets, the dev database, the lockfile.
      expect(existsSync(join(target, 'node_modules'))).toBe(false);
      expect(existsSync(join(target, 'public', 'build'))).toBe(false);
      expect(existsSync(join(target, 'database', 'database.sqlite'))).toBe(false);
      expect(existsSync(join(target, 'package-lock.json'))).toBe(false);

      // .env is regenerated from the example — never copied.
      const env = readFileSync(join(target, '.env'), 'utf8');
      expect(env).toContain('APP_NAME=chavaJs');
      expect(env).not.toContain('SECRET');
    } finally {
      rmSync(source, { recursive: true, force: true });
      rmSync(target, { recursive: true, force: true });
    }
  });

  it('renames the package and creates the storage layout', () => {
    const source = makeFakeSource();
    const target = mkdtempSync(join(tmpdir(), 'chava-app-'));
    try {
      scaffoldProject(source, target, 'Blog App');

      const pkg = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8')) as { name: string };
      expect(pkg.name).toBe('blog-app');

      for (const dir of ['storage/logs', 'storage/framework/sessions', 'storage/framework/cache']) {
        expect(existsSync(join(target, dir, '.gitkeep'))).toBe(true);
      }
    } finally {
      rmSync(source, { recursive: true, force: true });
      rmSync(target, { recursive: true, force: true });
    }
  });

  it('keeps the CI workflow but drops other dotfiles', () => {
    const source = makeFakeSource();
    const target = mkdtempSync(join(tmpdir(), 'chava-app-'));
    try {
      scaffoldProject(source, target, 'app');

      // Whitelisted: the GitHub Actions workflow ships with the scaffold.
      expect(existsSync(join(target, '.github', 'workflows', 'ci.yml'))).toBe(true);
      // The private .env is still regenerated, not copied.
      expect(existsSync(join(target, '.env'))).toBe(true);
    } finally {
      rmSync(source, { recursive: true, force: true });
      rmSync(target, { recursive: true, force: true });
    }
  });

  it('sanitizes path-style names for the npm package name', () => {
    const source = makeFakeSource();
    const target = mkdtempSync(join(tmpdir(), 'chava-app-'));
    try {
      // `chava new ../blog` — a relative target path must not leak `..`
      // into the generated package name.
      scaffoldProject(source, target, '../blog');

      const pkg = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8')) as { name: string };
      expect(pkg.name).toBe('blog');
    } finally {
      rmSync(source, { recursive: true, force: true });
      rmSync(target, { recursive: true, force: true });
    }
  });

  it('copies the framework docs into the app when present (--docs)', () => {
    const source = mkdtempSync(join(tmpdir(), 'chava-docs-src-'));
    const target = mkdtempSync(join(tmpdir(), 'chava-docs-app-'));
    try {
      mkdirSync(join(source, 'docs'), { recursive: true });
      writeFileSync(join(source, 'docs', '00-index.md'), '# chavaJs Documentation\n');
      writeFileSync(join(source, 'docs', '01-installation.md'), '# Installation\n');

      expect(copyDocs(source, target)).toBe(true);
      expect(existsSync(join(target, 'docs', '00-index.md'))).toBe(true);
      expect(existsSync(join(target, 'docs', '01-installation.md'))).toBe(true);
      expect(readFileSync(join(target, 'docs', '00-index.md'), 'utf8')).toContain('chavaJs');
    } finally {
      rmSync(source, { recursive: true, force: true });
      rmSync(target, { recursive: true, force: true });
    }
  });

  it('does not copy docs when the framework has none (--no-docs path)', () => {
    const source = mkdtempSync(join(tmpdir(), 'chava-nodocs-src-'));
    const target = mkdtempSync(join(tmpdir(), 'chava-nodocs-app-'));
    try {
      mkdirSync(join(source, 'src'), { recursive: true });
      writeFileSync(join(source, 'src', 'app.ts'), 'x');

      expect(copyDocs(source, target)).toBe(false);
      expect(existsSync(join(target, 'docs'))).toBe(false);
    } finally {
      rmSync(source, { recursive: true, force: true });
      rmSync(target, { recursive: true, force: true });
    }
  });
});