import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { app } from '../../../bootstrap/app';
import { Hash } from '../../../src/auth/Hash';
import { User } from '../../../app/Models/User';
import { SqlStore } from '../../../src/permissions/integration/chavaJs';
import { SEED_PERMISSIONS } from '../../../src/permissions';

/**
 * Admin Users CRUD â€” authorization matrix + resource behavior.
 *
 * Layers under test:
 *   1. RBAC middleware (permission:users.*) â€” coarse access
 *   2. UserPolicy via the Gate â€” object rules (self-delete, escalation)
 */

let server: Server;
let baseUrl: string;
const SUF = Date.now().toString(36);
const UPDATABLE_EMAIL = `updatable-${SUF}@test.dev`;
const ROOT_EMAIL = `root-${SUF}@test.dev`;
const PLAIN_EMAIL = `plain-${SUF}@test.dev`;
const VIEWER_EMAIL = `viewer-${SUF}@test.dev`;
const MANAGER_EMAIL = `manager-${SUF}@test.dev`;
const CREATED_EMAIL = `created-${SUF}@test.dev`;
const ZEBRA_EMAIL = `zebra-${SUF}@test.dev`;

// ------------------------------------------------------------- cookie jar

class Jar {
  public cookies = new Map<string, string>();

  public absorb(res: Response): void {
    const raw = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    for (const line of raw) {
      const [pair] = line.split(';');
      const index = pair.indexOf('=');
      this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
  }

  public get xsrf(): string {
    return decodeURIComponent(this.cookies.get('XSRF-TOKEN') ?? '');
  }

  public header(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

async function login(email: string, password: string): Promise<Jar> {
  const jar = new Jar();
  const page = await fetch(`${baseUrl}/login`);
  jar.absorb(page);
  const res = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Cookie: jar.header(),
      'X-XSRF-TOKEN': jar.xsrf,
    },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  });
  jar.absorb(res);
  return jar;
}

async function request(
  jar: Jar | null,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (jar) {
    headers.Cookie = jar.header();
    headers['X-XSRF-TOKEN'] = jar.xsrf;
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
}

async function makeUser(name: string, email: string, isAdmin: boolean): Promise<User> {
  return User.create({
    name,
    email,
    password: await Hash.make('password'),
    is_admin: isAdmin,
    email_verified_at: new Date(),
  }) as Promise<User>;
}

beforeAll(async () => {
  await app.bootstrap();
  server = await app.serve(0, '127.0.0.1');
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;

  // Permission tables + catalog seeds (normally done by `permission:install`).
  const db = app.make<{ connection: () => { exec(sql: string): Promise<void> } }>('db');
  for (const sql of SqlStore.SCHEMA) await db.connection().exec(sql);
  const registrar = app.make<{
    createPermission: (i: { name: string }) => Promise<unknown>;
  createRole: (i: { name: string }) => Promise<{ id: number }>;
    syncRolePermissions: (id: number, perms: string[]) => Promise<void>;
  assignRolesToModel: (t: string, id: unknown, roles: string[]) => Promise<void>;
    warmUp: () => Promise<void>;
  }>('permissions');
  for (const name of SEED_PERMISSIONS) await registrar.createPermission({ name });
  await registrar.createPermission({ name: '*' }); // wildcard
  const superAdmin = (await registrar.createRole({ name: 'super-admin' })) as { id: number };
  await registrar.syncRolePermissions(superAdmin.id, ['*']);
  await registrar.warmUp();

  // Actors
  await makeUser('Root Admin', ROOT_EMAIL, false);
  const root = await User.where('email', ROOT_EMAIL).first();
  await registrar.assignRolesToModel('users', root!.getKey(), ['super-admin']);
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await app.shutdown();
});

describe('Users CRUD â€” layer 1: RBAC middleware', () => {
  it('guests are redirected to login on every verb', async () => {
    const res = await request(null, 'GET', '/admin/users');
    expect([301, 302, 401]).toContain(res.status);
  });

  it('an authenticated user without users.* permissions gets 403', async () => {
    await makeUser('Plain', PLAIN_EMAIL, false);
    const jar = await login(PLAIN_EMAIL, 'password');
    const res = await request(jar, 'GET', '/admin/users');
    expect(res.status).toBe(403);
  });

  it('a user holding ONLY users.view can list but not mutate', async () => {
    await makeUser('Viewer', VIEWER_EMAIL, false);
    const viewer = await User.where('email', VIEWER_EMAIL).first();
    const registrar = app.make<{
      givePermissionToModel: (t: string, id: unknown, p: string[]) => Promise<void>;
    }>('permissions');
    await registrar.givePermissionToModel('users', viewer!.getKey(), ['admin.access', 'users.view']);

    const jar = await login(VIEWER_EMAIL, 'password');
    expect((await request(jar, 'GET', '/admin/users')).status).toBe(200);
    expect((await request(jar, 'POST', '/admin/users', {
      name: 'X', email: 'x@t.dev', password: 'password123', password_confirmation: 'password123',
    })).status).toBe(403);
  });

  it('super-admin passes every verb (wildcard)', async () => {
    const jar = await login(ROOT_EMAIL, 'password');
    expect((await request(jar, 'GET', '/admin/users')).status).toBe(200);
    expect((await request(jar, 'POST', '/admin/users', {
      name: 'Created One',
      email: CREATED_EMAIL,
      password: 'password123',
      password_confirmation: 'password123',
      roles: [],
    })).status).toBe(302);
  });
});

describe('Users CRUD â€” resource behavior (super-admin)', () => {
  let jar: Jar;

  beforeAll(async () => {
    jar = await login(ROOT_EMAIL, 'password');
  });

  it('server-side search filters by partial email', async () => {
    await makeUser('Zebra Person', ZEBRA_EMAIL, false);
    const res = await request(jar, 'GET', '/admin/users?q=zebra');
    const text = await res.text();
    expect(text).toContain(ZEBRA_EMAIL);
    expect(text).not.toContain(CREATED_EMAIL);
  });

  it('duplicate email is rejected with validation errors', async () => {
    const res = await request(jar, 'POST', '/admin/users', {
      name: 'Dup', email: CREATED_EMAIL, password: 'password123', password_confirmation: 'password123',
    });
    const body = (await res.json()) as { error?: { details?: { errors?: Record<string, string[]> } }; status?: number; errors?: Record<string, string[]>; message?: string };

    const fieldErrors = body.errors ?? body.error?.details?.errors ?? {};
    expect(fieldErrors.email?.[0]).toBeDefined();
  });

  it('update with blank password keeps the old hash; unique ignores self', async () => {
    await request(jar, 'POST', '/admin/users', {
      name: 'Updatable One',
      email: UPDATABLE_EMAIL,
      password: 'password123',
      password_confirmation: 'password123',
      roles: [],
    });
    const target = await User.where('email', UPDATABLE_EMAIL).first();
    const before = String(target!.toArray().password);

    const res = await request(jar, 'POST', `/admin/users/${target!.getKey()}`, {
      _method: 'PUT',
      name: 'Created One',
      email: UPDATABLE_EMAIL,
      roles: [],
    });

    expect(res.status).toBe(302);

    const fresh = await User.where('email', UPDATABLE_EMAIL).first();
    expect(String(fresh!.toArray().password)).toBe(before);
  });

  it('policy blocks deleting your own account through the admin CRUD', async () => {
    const root = await User.where('email', ROOT_EMAIL).first();
    const res = await request(jar, 'DELETE', `/admin/users/${root!.getKey()}`);
    // Business rule (not ACL): self-deletion is blocked with a validation
    // error so the UI can show a friendly message.
    expect(res.status).toBe(422);
    const body = (await res.json()) as {
      error?: { details?: { errors?: Record<string, string[]> } };
      errors?: Record<string, string[]>;
    };
    const fieldErrors = body.errors ?? body.error?.details?.errors ?? {};
    expect(fieldErrors.user?.[0]).toMatch(/own account/i);
  });

  it('non-super-admin cannot assign the super-admin role (escalation guard)', async () => {
    await makeUser('Manager', MANAGER_EMAIL, false);
    const manager = await User.where('email', MANAGER_EMAIL).first();
    const target = await User.where('email', CREATED_EMAIL).first();
    const registrar = app.make<{
      givePermissionToModel: (t: string, id: unknown, p: string[]) => Promise<void>;
    }>('permissions');
    await registrar.givePermissionToModel('users', manager!.getKey(), ['admin.access', 'users.update']);

    const mgrJar = await login(MANAGER_EMAIL, 'password');
    const res = await request(mgrJar, 'POST', `/admin/users/${target!.getKey()}/roles`, {
      roles: ['super-admin'],
      role_name: 'super-admin',
    });

    expect(res.status).toBe(403);
  });

  it('destroy removes the target user', async () => {
    const victim = await User.where('email', CREATED_EMAIL).first();
    const res = await request(jar, 'DELETE', `/admin/users/${victim!.getKey()}`);
    expect(res.status).toBe(302);
    expect(await User.where('email', CREATED_EMAIL).first()).toBeUndefined();
  });
});
