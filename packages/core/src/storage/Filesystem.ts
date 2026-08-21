import type { FileStats } from './types';

export interface Filesystem {
  /** Read the contents of a file. */
  get(path: string): Promise<string>;
  /** Read the contents of a file as a Buffer. */
  getBuffer(path: string): Promise<Buffer>;
  /** Write content to a file, creating directories as needed. */
  put(path: string, content: Buffer | string, options?: { visibility?: 'public' | 'private' }): Promise<void>;
  /** Check if a file exists. */
  exists(path: string): Promise<boolean>;
  /** Delete a file. */
  delete(path: string): Promise<boolean>;
  /** Get the file size and modification date. */
  stat(path: string): Promise<FileStats>;
  /** Create a directory (recursive). */
  makeDirectory(path: string): Promise<void>;
  /** Delete a directory (recursive). */
  deleteDirectory(path: string): Promise<void>;
  /** List files in a directory. */
  files(directory?: string): Promise<string[]>;
  /** List all files recursively. */
  allFiles(directory?: string): Promise<string[]>;
  /** Copy a file. */
  copy(from: string, to: string): Promise<void>;
  /** Move/rename a file. */
  move(from: string, to: string): Promise<void>;
  /** Get the URL for a file (local: relative path, S3: presigned URL). */
  url(path: string): string;
  /** Get the absolute path on disk. */
  path(path: string): string;
  /** Get the disk name. */
  getName(): string;
}
