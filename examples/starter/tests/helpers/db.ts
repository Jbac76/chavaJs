import { Application } from '../../src/foundation/Application';
import { Migrator } from '../../src/database/Migrator';

/**
 * Boot a fresh chavaJs application and run the real database/migrations/*.
 *
 * - Default: in-memory SQLite (`DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`)
 *   — fast, no services.
 * - Matrix mode: when `TEST_ALL_DRIVERS=1` with `DB_CONNECTION=pg` or
 *   `DB_CONNECTION=mysql`, boots against the configured server (host/port/
 *   database/user/pass come from the environment). The whole Vitest suite can
 *   then run against Postgres or MySQL:
 *
 *     TEST_ALL_DRIVERS=1 DB_CONNECTION=pg npm test
 *     TEST_ALL_DRIVERS=1 DB_CONNECTION=mysql npm test
 *
 * Each call creates a new Application, so the container/facades point at an
 * isolated database.
 */
export async function freshApp(): Promise<Application> {
  const connection = process.env.DB_CONNECTION ?? 'sqlite';
  process.env.DB_CONNECTION = connection;
  if (connection === 'sqlite' && !process.env.DB_DATABASE) {
    process.env.DB_DATABASE = ':memory:';
  }
  const app = new Application({ basePath: process.cwd() });
  await app.bootstrap();
  const migrator = new Migrator(app);
  await migrator.fresh();
  return app;
}

/** Drop all tables and re-run every migration. */
export async function resetDb(app: Application): Promise<void> {
  const migrator = new Migrator(app);
  await migrator.fresh();
}
