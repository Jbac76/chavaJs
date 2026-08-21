process.env.DB_CONNECTION = 'sqlite';
process.env.DB_DATABASE = ':memory:';
process.env.SESSION_DRIVER = 'array';
process.env.MAIL_MAILER = 'array';
process.env.APP_KEY = 'test-key-0123456789abcdef0123456789abcdef';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { Migrator } from '../../src/database/Migrator';
import { Event, Mail } from '../../src/facades';
import { app } from '../../bootstrap/app';
import { User } from '../../app/Models/User';
import { UserRegistered } from '../../app/Events/UserRegistered';
import { DatabaseNotification } from '../../src/notifications/Notifiable';

let server: Server;
let baseUrl: string;

interface CookieJar {
  cookie: string | null;
  csrf: string;
}

interface FetchResult {
  status: number;
  location: string | null;
  cookies: string[];
}

async function request(method: 'GET' | 'POST', path: string, jar: CookieJar, data: Record<string, string> = {}): Promise<FetchResult> {
  const headers: Record<string, string> = {
    'X-Inertia': 'true',
    'X-Inertia-Version': '1.0.0',
    ...(jar.cookie ? { Cookie: jar.cookie } : {}),
  };
  let body: string | undefined;
  if (method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    headers['X-CSRF-TOKEN'] = jar.csrf;
    body = new URLSearchParams(data).toString();
  }
  const response = await fetch(`${baseUrl}${path}`, { method, headers, body, redirect: 'manual' });
  const setCookie = response.headers.getSetCookie();
  return { status: response.status, location: response.headers.get('location'), cookies: setCookie ?? [] };
}

function updateJar(jar: CookieJar, result: FetchResult): void {
  for (const setCookie of result.cookies) {
    const [pair] = setCookie.split(';');
    const [name] = pair.split('=');
    if (name === 'chava_session') jar.cookie = pair;
    if (name === 'XSRF-TOKEN') jar.csrf = decodeURIComponent(pair.slice('XSRF-TOKEN='.length));
  }
}

/** Fresh guest session with a valid CSRF token (GET /login). */
async function newSession(): Promise<CookieJar> {
  const jar: CookieJar = { cookie: null, csrf: '' };
  const result = await request('GET', '/login', jar);
  updateJar(jar, result);
  return jar;
}

beforeAll(async () => {
  await app.bootstrap();
  const migrator = new Migrator(app);
  await migrator.fresh();
  server = await app.serve(0, '127.0.0.1');
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('Events + notifications end-to-end (Phase 5)', () => {
  it('auto-discovers the listener and delivers mail + database notifications on register', async () => {
    const jar = await newSession();
    const result = await request('POST', '/register', jar, {
      name: 'Incoming',
      email: 'incoming@chava.dev',
      password: 'password',
      password_confirmation: 'password',
    });
    expect(result.status).toBe(302);
    expect(result.location).toBe('/dashboard');

    // The database channel stored one notification for the new user.
    const notifications = (await DatabaseNotification.query().get()) as DatabaseNotification[];
    expect(notifications).toHaveLength(1);
    const stored = notifications[0];
    expect(stored.getAttribute('type')).toBe('WelcomeNotification');
    expect(stored.getAttribute('notifiable_type')).toBe('User');
    const payload = stored.getAttribute('data') as Record<string, unknown>;
    expect(payload.title).toBe('Welcome to chavaJs!');

    // The mail channel sent the WelcomeMail to the configured transport.
    const sent = Mail.sent();
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe('Welcome to chavaJs!');
    expect(sent[0].to[0].address).toBe('incoming@chava.dev');
  });

  it('dispatches UserRegistered manually and reaches the same listener', async () => {
    const user = (await User.create({
      name: 'Direct',
      email: 'direct@chava.dev',
      password: 'x',
    })) as User;

    await Event.dispatch(new UserRegistered(user));

    const notifications = (await DatabaseNotification.query()
      .where('notifiable_id', user.getKey())
      .get()) as DatabaseNotification[];
    expect(notifications).toHaveLength(1);
    expect(notifications[0].getAttribute('type')).toBe('WelcomeNotification');
  });
});
