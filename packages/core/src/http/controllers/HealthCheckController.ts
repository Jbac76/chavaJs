import type { Request } from '../Request';
import type { Response } from '../Response';
import { currentApp } from '../../foundation/registry';

/**
 * GET /up — the Laravel 11 health endpoint equivalent.
 *
 * Returns 200 with per-service check results when the app is healthy, 503
 * when any mandatory check fails. Kept dependency-light: database ping +
 * cache read + process uptime.
 */

type HealthStatus = 'ok' | 'fail';

interface HealthCheck {
  status: HealthStatus;
  message?: string;
}

async function checkDatabase(): Promise<HealthCheck> {
  try {
    const db = currentApp().make<{
      connection: () => { query: (sql: string) => Promise<unknown[]> };
    }>('db');
    await db.connection().query('SELECT 1');
    return { status: 'ok' };
  } catch (error) {
    return { status: 'fail', message: error instanceof Error ? error.message : String(error) };
  }
}

async function checkCache(): Promise<HealthCheck> {
  try {
    const cache = currentApp().make<{ has: (key: string) => Promise<boolean> }>('cache');
    await cache.has('health:probe');
    return { status: 'ok' };
  } catch {
    // Cache is optional (not bound in some contexts) — absence isn't failure.
    return { status: 'ok', message: 'cache not bound' };
  }
}

export class HealthCheckController {
  public async up(request: Request): Promise<Response> {
    void request;

    const started = Date.now();
    const checks = {
      database: await checkDatabase(),
      cache: await checkCache(),
    };

    // Lazy-load Response to avoid circular imports at module load time.
    const { Response } = await import('../Response');

    const failed = Object.values(checks).filter((check) => check.status === 'fail');
    const payload = {
      status: failed.length === 0 ? 'ok' : 'degraded',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - started,
      checks,
    };

    return failed.length === 0 ? Response.json(payload, 200) : Response.json(payload, 503);
  }
}
