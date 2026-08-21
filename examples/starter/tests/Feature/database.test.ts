// Default sqlite in-memory; respect DB_CONNECTION for the driver matrix.
process.env.DB_CONNECTION = process.env.DB_CONNECTION ?? 'sqlite';
process.env.DB_DATABASE = process.env.DB_CONNECTION === 'sqlite' ? ':memory:' : process.env.DB_DATABASE;

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { Migrator } from '../../src/database/Migrator';
import { DatabaseSeeder } from '../../database/seeders/DatabaseSeeder';
import { app } from '../../bootstrap/app';

let server: Server;
let baseUrl: string;

interface InertiaPage {
  component: string;
  url: string;
  props: {
    users?: {
      data: Array<Record<string, unknown>>;
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
      from: number | null;
      to: number | null;
    };
    user?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

beforeAll(async () => {
  await app.bootstrap();
  const migrator = new Migrator(app);
  await migrator.fresh();
  await new DatabaseSeeder().run();
  server = await app.serve(0, '127.0.0.1');
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('Database (Phase 3) HTTP endpoints', () => {
  it('seeds users with posts through factories', async () => {
    const page = await fetchInertia('/users');
    const users = page.props.users;
    expect(users?.total).toBe(8);
    expect(users?.data).toHaveLength(8);
  });

  it('lists users eager-loaded with their posts', async () => {
    const page = await fetchInertia('/users');
    expect(page.component).toBe('Users/Index');

    const first = page.props.users?.data[0] as Record<string, unknown>;
    expect(first).toBeDefined();
    expect(first.name).toBeTruthy();
    expect(first.password).toBeUndefined();
    expect((first.posts as unknown[]).length).toBe(2);
  });

  it('paginates the users index', async () => {
    const page = await fetchInertia('/users?page=1');
    expect(page.props.users).toMatchObject({
      current_page: 1,
      per_page: 10,
      last_page: 1,
      from: 1,
      to: 8,
    });
  });

  it('shows a single user with posts through route model binding', async () => {
    const page = await fetchInertia('/users/1');
    expect(page.component).toBe('Users/Show');
    expect(page.props.user?.name).toBeTruthy();
    expect((page.props.user?.posts as unknown[]).length).toBe(2);
  });

  it('returns 404 when the model binding misses', async () => {
    const response = await fetch(`${baseUrl}/users/9999`, {
      headers: { 'X-Inertia': 'true' },
    });
    expect(response.status).toBe(404);
  });

  it('returns the Inertia HTML shell for a plain request to /users', async () => {
    const response = await fetch(`${baseUrl}/users`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('data-page=');
  });
});

async function fetchInertia(path: string): Promise<InertiaPage> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'X-Inertia': 'true', 'X-Inertia-Version': '1.0.0' },
  });
  expect(response.status).toBe(200);
  return (await response.json()) as InertiaPage;
}
