export interface DiskConfig {
  driver: 'local' | 's3';
  root: string;
  url?: string;
  visibility?: 'public' | 'private';
}

export interface FileVisibility {
  visibility: 'public' | 'private';
}

export interface FileContent {
  content: Buffer | string;
  options?: { visibility?: 'public' | 'private' };
}

export interface FileStats {
  size: number;
  lastModified: Date;
  isFile: boolean;
  isDirectory: boolean;
}
