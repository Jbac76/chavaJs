import { describe, expect, it } from 'vitest';
import { Application } from '../../src/foundation/Application';
import { Migrator } from '../../src/database/Migrator';
import { Schema } from '../../src/facades';

async function boot(): Promise<Application> {
  // Default sqlite in-memory; respect DB_CONNECTION for the driver matrix.
  process.env.DB_CONNECTION = process.env.DB_CONNECTION ?? 'sqlite';
  process.env.DB_DATABASE = process.env.DB_CONNECTION === 'sqlite' ? ':memory:' : process.env.DB_DATABASE;
  const app = new Application({ basePath: process.cwd() });
  await app.bootstrap();
  return app;
}

describe('Migrator', () => {
  it('creates tables with the Blueprint API', async () => {
    await boot();
    await Schema.create('things', (table) => {
      table.id();
      table.string('title');
      table.text('body');
      table.integer('views').default(0);
      table.boolean('published').default(true);
      table.decimal('price', 8, 2);
      table.enum('status', ['draft', 'published']);
      table.timestamps();
    });

    expect(await Schema.hasTable('things')).toBe(true);
    expect(await Schema.hasColumn('things', 'views')).toBe(true);
    expect(await Schema.hasColumn('things', 'published')).toBe(true);
    await Schema.dropIfExists('things');
    expect(await Schema.hasTable('things')).toBe(false);
  });

  it('runs pending migrations, tracks batches and reports status', async () => {
    const app = await boot();
    const migrator = new Migrator(app);

    const ran = await migrator.run();
    expect(ran).toContain('2026_01_01_000000_create_users_table');
    expect(ran).toContain('2026_01_02_000000_create_posts_table');
    expect(ran).toContain('2026_02_01_000000_create_personal_access_tokens_table');
    expect(ran).toContain('2026_02_02_000000_create_jobs_table');
    expect(ran).toContain('2026_02_03_000000_create_notifications_table');

    // A second run migrates nothing new.
    expect(await migrator.run()).toHaveLength(0);

    const status = await migrator.status();
    expect(status).toHaveLength(5);
    for (const row of status) expect(row.batch).toBe(1);
  });

  it('rolls back the last batch in reverse order', async () => {
    const app = await boot();
    const migrator = new Migrator(app);
    await migrator.run();

    const rolledBack = await migrator.rollback();
    expect(rolledBack).toHaveLength(5);
    expect(rolledBack[0]).toContain('create_notifications_table');

    const status = await migrator.status();
    for (const row of status) expect(row.batch).toBeNull();
    expect(await Schema.hasTable('posts')).toBe(false);
  });

  it('migrate:fresh drops everything and re-runs', async () => {
    const app = await boot();
    const migrator = new Migrator(app);
    await migrator.run();

    // Seed some data, then migrate:fresh wipes and rebuilds.
    await app.make<import('../../src/database/DatabaseManager').DatabaseManager>('db')
      .table('users')
      .insert({ name: 'Temp', email: 'temp@example.com', password: 'x' });

    await migrator.fresh();
    expect(
      await app.make<import('../../src/database/DatabaseManager').DatabaseManager>('db')
        .table('users')
        .count(),
    ).toBe(0);
    expect(await Schema.hasTable('users')).toBe(true);
  });
});
