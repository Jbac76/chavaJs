process.env.DB_CONNECTION = 'sqlite';
process.env.DB_DATABASE = ':memory:';
process.env.SESSION_DRIVER = 'array';
process.env.APP_KEY = 'test-key-0123456789abcdef0123456789abcdef';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { Migrator } from '../../src/database/Migrator';
import { Hash } from '../../src/auth/Hash';
import { app } from '../../bootstrap/app';
import { User } from '../../app/Models/User';

let server: Server;
let baseUrl: string;

interface CookieJar {
  cookie: string | null;
  csrf: string;
}

interface FetchResult {
  status: number;
  location: string | null;
  body: Record<string, unknown>;
  cookies: string[];
}

async function request(
  method: 'GET' | 'POST',
  path: string,
  jar: CookieJar,
  data: Record<string, string> = {},
  extraHeaders: Record<string, string> = {},
): Promise<FetchResult> {
  const headers: Record<string, string> = {
    'X-Inertia': 'true',
    'X-Inertia-Version': '1.0.0',
    ...(jar.cookie ? { Cookie: jar.cookie } : {}),
    ...extraHeaders,
  };
  // Note: X-Inertia-Version must match config/frontend.ts version (1.0.0).
  let body: string | undefined;
  if (method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    headers['X-CSRF-TOKEN'] = extraHeaders['X-CSRF-TOKEN'] ?? jar.csrf;
    body = new URLSearchParams(data).toString();
  }
  const response = await fetch(`${baseUrl}${path}`, { method, headers, body, redirect: 'manual' });
  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    parsed = { raw: text };
  }
  const setCookie = response.headers.getSetCookie();
  return {
    status: response.status,
    location: response.headers.get('location'),
    body: parsed,
    cookies: setCookie ?? [],
  };
}

function updateJar(jar: CookieJar, result: FetchResult): void {
  for (const setCookie of result.cookies) {
    const [pair] = setCookie.split(';');
    const [name] = pair.split('=');
    if (name === 'chava_session') jar.cookie = pair;
    // Login/logout migrate the session (new id + CSRF token), so refresh the
    // token from the response cookie exactly like the browser would.
    if (name === 'XSRF-TOKEN') jar.csrf = decodeURIComponent(pair.slice('XSRF-TOKEN='.length));
  }
}

/** Fresh guest session: GET /login to capture the session cookie + CSRF token. */
async function newSession(): Promise<CookieJar> {
  const jar: CookieJar = { cookie: null, csrf: '' };
  const result = await request('GET', '/login', jar);
  updateJar(jar, result);
  const props = (result.body.props as Record<string, unknown> | undefined) ?? {};
  const csrf = props.csrf_token;
  jar.csrf = typeof csrf === 'string' ? csrf : '';
  expect(jar.cookie).toBeTruthy();
  expect(jar.csrf).not.toBe('');
  return jar;
}

async function loginAs(email: string): Promise<CookieJar> {
  const jar = await newSession();
  const result = await request('POST', '/login', jar, { email, password: 'password' });
  expect(result.status).toBe(302);
  expect(result.location).toBe('/dashboard');
  updateJar(jar, result);
  return jar;
}

beforeAll(async () => {
  await app.bootstrap();
  const migrator = new Migrator(app);
  await migrator.fresh();

  // Seed: one admin + one member, both with password 'password'.
  const hashed = await Hash.make('password');
  await User.create({ name: 'Admin', email: 'admin@chava.dev', password: hashed, is_admin: true });
  await User.create({ name: 'Member', email: 'member@chava.dev', password: hashed, is_admin: false });

  server = await app.serve(0, '127.0.0.1');
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('Authentication (Phase 4) HTTP endpoints', () => {
  it('registers a new user and redirects to the dashboard', async () => {
    const jar = await newSession();
    const result = await request('POST', '/register', jar, {
      name: 'New User',
      email: 'new@chava.dev',
      password: 'password',
      password_confirmation: 'password',
    });
    expect(result.status).toBe(302);
    expect(result.location).toBe('/dashboard');
    updateJar(jar, result);

    const dashboard = await request('GET', '/dashboard', jar);
    expect(dashboard.status).toBe(200);
    const auth = (dashboard.body.props as { auth?: { user?: { email?: string } } }).auth;
    expect(auth?.user?.email).toBe('new@chava.dev');
  });

  it('rejects a duplicate email via the unique rule (redirect back + shared errors)', async () => {
    const jar = await newSession();
    const result = await request('POST', '/register', jar, {
      name: 'Duplicate',
      email: 'admin@chava.dev',
      password: 'password',
      password_confirmation: 'password',
    });
    // Laravel + Inertia: validation failures redirect back; the errors are
    // flashed into the session and shared as the `errors` prop.
    expect(result.status).toBe(302);
    updateJar(jar, result);

    const page = await request('GET', '/register', jar);
    const errors = (page.body.props as { errors?: Record<string, string[]> }).errors ?? {};
    // RegisterRequest's custom message for the unique rule.
    expect(errors.email?.[0]).toContain('already registered');
  });

  it('logs in with valid credentials', async () => {
    const jar = await loginAs('member@chava.dev');
    const dashboard = await request('GET', '/dashboard', jar);
    expect(dashboard.status).toBe(200);
  });

  it('fails login with wrong credentials (redirect back + shared errors)', async () => {
    const jar = await newSession();
    const result = await request('POST', '/login', jar, { email: 'member@chava.dev', password: 'wrong-password' });
    expect(result.status).toBe(302);
    updateJar(jar, result);

    const page = await request('GET', '/login', jar);
    const errors = (page.body.props as { errors?: Record<string, string[]> }).errors ?? {};
    expect(errors.email?.[0]).toContain('credentials');
  });

  it('redirects guests away from /dashboard (auth middleware)', async () => {
    const result = await request('GET', '/dashboard', { cookie: null, csrf: '' });
    expect(result.status).toBe(302);
    expect(result.location).toBe('/login');
  });

  it('redirects authenticated users away from /login (guest middleware)', async () => {
    const jar = await loginAs('member@chava.dev');
    const result = await request('GET', '/login', jar);
    expect(result.status).toBe(302);
    expect(result.location).toBe('/dashboard');
  });

  it('logs out and clears the session', async () => {
    const jar = await loginAs('member@chava.dev');
    const logout = await request('POST', '/logout', jar, {});
    expect(logout.status).toBe(302);
    updateJar(jar, logout);
    const dashboard = await request('GET', '/dashboard', jar);
    expect(dashboard.status).toBe(302);
    expect(dashboard.location).toBe('/login');
  });

  it('rotates the session id and CSRF token on login (fixation protection)', async () => {
    const jar = await newSession();
    const oldSessionId = decodeURIComponent(String(jar.cookie).split('=')[1]);
    const oldToken = jar.csrf;

    const result = await request('POST', '/login', jar, { email: 'member@chava.dev', password: 'password' });
    expect(result.status).toBe(302);
    updateJar(jar, result);

    // Both the session id and the CSRF token must differ after login.
    const newSessionId = decodeURIComponent(String(jar.cookie).split('=')[1]);
    expect(newSessionId).not.toBe(oldSessionId);
    expect(jar.csrf).not.toBe(oldToken);
    expect(jar.csrf.length).toBeGreaterThan(10);
  });

  it('blocks state-changing requests without a valid CSRF token (419)', async () => {
    const jar = await newSession();
    const result = await request('POST', '/login', jar, { email: 'member@chava.dev', password: 'password' }, { 'X-CSRF-TOKEN': 'bad-token' });
    expect(result.status).toBe(419);
  });

  it('sets an XSRF-TOKEN cookie and accepts it back as X-XSRF-TOKEN (browser flow)', async () => {
    // Regression: Laravel Breeze relies on the XSRF-TOKEN cookie — Inertia's
    // axios client echoes it as the X-XSRF-TOKEN header. No manual header.
    const jar = await newSession();
    const xsrfCookie = jar.cookie ?? '';
    expect(xsrfCookie.startsWith('chava_session=')).toBe(true);

    // The session token travels as a non-httpOnly cookie named XSRF-TOKEN.
    const sessionResult = await request('GET', '/login', jar);
    const xsrf = sessionResult.cookies
      .map((c) => c.split(';')[0])
      .find((pair) => pair.startsWith('XSRF-TOKEN='));
    expect(xsrf).toBeTruthy();
    const tokenValue = decodeURIComponent(String(xsrf).split('=')[1]);
    expect(tokenValue.length).toBeGreaterThan(10);

    // Sending it back via X-XSRF-TOKEN (what axios does) passes CSRF.
    const result = await request(
      'POST',
      '/login',
      jar,
      { email: 'member@chava.dev', password: 'wrong-password' },
      { 'X-XSRF-TOKEN': tokenValue },
    );
    expect(result.status).toBe(302); // not 419 — token was accepted
  });

  it('issues an API token and accesses /api/user with it (auth:api)', async () => {
    const jar = await loginAs('member@chava.dev');

    const issued = await request('POST', '/api/tokens', jar, { name: 'CLI' });
    expect(issued.status).toBe(201);
    const token = issued.body.token;
    expect(typeof token).toBe('string');

    const user = await request('GET', '/api/user', { cookie: null, csrf: '' }, {}, { Authorization: `Bearer ${token as string}` });
    expect(user.status).toBe(200);
    const data = (user.body.data as { email?: string } | undefined) ?? {};
    expect(data.email).toBe('member@chava.dev');
  });

  it('rejects a bad API token (401)', async () => {
    const user = await request('GET', '/api/user', { cookie: null, csrf: '' }, {}, { Authorization: 'Bearer not-a-real-token' });
    expect(user.status).toBe(401);
  });

  it('enforces the UserPolicy: members cannot delete other users (403)', async () => {
    const jar = await loginAs('member@chava.dev');
    // Member tries to delete admin (id 1) — must be forbidden.
    const result = await request('POST', '/users/1', jar, { _method: 'DELETE' });
    expect(result.status).toBe(403);
  });

  it('allows deleting your own account (UserPolicy delete)', async () => {
    const jar = await loginAs('member@chava.dev');
    const result = await request('POST', '/users/2', jar, { _method: 'DELETE' });
    expect(result.status).toBe(302); // redirect back after soft delete
  });
});
