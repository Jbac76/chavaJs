import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Filesystem } from '../Filesystem';
import type { FileStats } from '../types';

export class LocalDisk implements Filesystem {
  private readonly root: string;

  public constructor(
    private readonly name: string,
    config: { root: string; visibility?: 'public' | 'private' },
  ) {
    this.root = path.resolve(config.root);
  }

  public getName(): string {
    return this.name;
  }

  public async get(filePath: string): Promise<string> {
    return fs.readFile(this.fullPath(filePath), 'utf-8');
  }

  public async getBuffer(filePath: string): Promise<Buffer> {
    return fs.readFile(this.fullPath(filePath));
  }

  public async put(
    filePath: string,
    content: Buffer | string,
    _options?: { visibility?: 'public' | 'private' },
  ): Promise<void> {
    const full = this.fullPath(filePath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content);
  }

  public async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(this.fullPath(filePath));
      return true;
    } catch {
      return false;
    }
  }

  public async delete(filePath: string): Promise<boolean> {
    try {
      await fs.unlink(this.fullPath(filePath));
      return true;
    } catch {
      return false;
    }
  }

  public async stat(filePath: string): Promise<FileStats> {
    const s = await fs.stat(this.fullPath(filePath));
    return {
      size: s.size,
      lastModified: s.mtime,
      isFile: s.isFile(),
      isDirectory: s.isDirectory(),
    };
  }

  public async makeDirectory(dirPath: string): Promise<void> {
    await fs.mkdir(this.fullPath(dirPath), { recursive: true });
  }

  public async deleteDirectory(dirPath: string): Promise<void> {
    await fs.rm(this.fullPath(dirPath), { recursive: true, force: true });
  }

  public async files(directory = ''): Promise<string[]> {
    const dir = this.fullPath(directory);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile()).map((e) => e.name);
  }

  public async allFiles(directory = ''): Promise<string[]> {
    const dir = this.fullPath(directory);
    const results: string[] = [];
    const walk = async (d: string): Promise<void> => {
      const entries = await fs.readdir(d, { withFileTypes: true });
      for (const entry of entries) {
        const rel = path.relative(this.root, path.join(d, entry.name));
        if (entry.isFile()) {
          results.push(rel);
        } else if (entry.isDirectory()) {
          await walk(path.join(d, entry.name));
        }
      }
    };
    await walk(dir);
    return results;
  }

  public async copy(from: string, to: string): Promise<void> {
    await fs.copyFile(this.fullPath(from), this.fullPath(to));
  }

  public async move(from: string, to: string): Promise<void> {
    await fs.rename(this.fullPath(from), this.fullPath(to));
  }

  public url(filePath: string): string {
    return `/storage/${filePath}`;
  }

  public path(filePath: string): string {
    return this.fullPath(filePath);
  }

  private fullPath(filePath: string): string {
    return path.join(this.root, filePath);
  }
}
