import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Strict regex: 64-char lowercase hex (32 random bytes). */
const SESSION_ID_RE = /^[0-9a-f]{64}$/;

/**
 * Laravel's session driver contract — read/write a session payload by id.
 * Implementations: FileSessionHandler (default) and ArraySessionHandler
 * (in-memory, used by tests and the `array` driver).
 */
export interface SessionHandler {
  read(id: string): Record<string, unknown> | null;
  write(id: string, data: Record<string, unknown>): void;
  destroy(id: string): void;
}

function assertValidSessionId(id: string): void {
  if (!SESSION_ID_RE.test(id)) {
    throw new Error(`Invalid session id: "${id}". Expected 64-char lowercase hex.`);
  }
}

/** File driver — JSON files under storage/framework/sessions. */
export class FileSessionHandler implements SessionHandler {
  public constructor(private readonly directory: string) {}

  public read(id: string): Record<string, unknown> | null {
    assertValidSessionId(id);
    const path = this.pathFor(id);
    if (!existsSync(path)) return null;
    try {
      const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
      return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  public write(id: string, data: Record<string, unknown>): void {
    assertValidSessionId(id);
    mkdirSync(this.directory, { recursive: true });
    writeFileSync(this.pathFor(id), JSON.stringify(data), 'utf8');
  }

  public destroy(id: string): void {
    assertValidSessionId(id);
    try {
      rmSync(this.pathFor(id), { force: true });
    } catch {
      // ignore missing files
    }
  }

  private pathFor(id: string): string {
    return join(this.directory, `${id}.json`);
  }
}

/** Array driver — in-memory map (tests, single-process dev). */
export class ArraySessionHandler implements SessionHandler {
  private readonly store = new Map<string, Record<string, unknown>>();

  public read(id: string): Record<string, unknown> | null {
    return this.store.get(id) ?? null;
  }

  public write(id: string, data: Record<string, unknown>): void {
    this.store.set(id, { ...data });
  }

  public destroy(id: string): void {
    this.store.delete(id);
  }
}
