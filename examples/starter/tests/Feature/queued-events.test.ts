// The register flow must never break when mail is slow or down: with the
// database connection, the welcome notification is *enqueued*, not delivered
// inline. Set before any import of config/queue.ts (ESM module cache).
process.env.QUEUE_CONNECTION = 'database';
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
import { DatabaseNotification } from '../../src/notifications/Notifiable';
import { Job } from '../../src/queue/Job';
import type { QueueManager } from '../../src/queue/QueueManager';
import type { DatabaseDriver } from '../../src/queue/drivers/DatabaseDriver';
import type { DatabaseManager } from '../../src/database/DatabaseManager';
import { CallQueuedListener } from '../../src/events/queue';

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

describe('Queued welcome notification (ShouldQueue)', () => {
  it('enqueues the listener on register and delivers only when a worker runs it', async () => {
    const jar = await newSession();
    const result = await request('POST', '/register', jar, {
      name: 'Queued Inbox',
      email: 'inbox@chava.dev',
      password: 'password',
      password_confirmation: 'password',
    });
    expect(result.status).toBe(302);
    expect(result.location).toBe('/dashboard');

    // Nothing delivered inside the request — no mail, no notification row.
    expect(Mail.sent()).toHaveLength(0);
    expect(await DatabaseNotification.query().count()).toBe(0);

    // Exactly one CallQueuedListener job is waiting.
    const jobs = (await app.make<DatabaseManager>('db').table('jobs').get()) as Array<Record<string, unknown>>;
    expect(jobs).toHaveLength(1);
    const payload = JSON.parse(String(jobs[0].payload)) as { class: string };
    expect(payload.class).toBe('CallQueuedListener');

    // A worker (queue:work) pops, rehydrates and runs the job…
    const driver = app.make<QueueManager>('queue').connection() as DatabaseDriver;
    const popped = await driver.pop('default');
    expect(popped).not.toBeNull();
    const job = Job.deserialize<CallQueuedListener>(popped!.payload);
    expect(job.listener).toBe('SendWelcomeNotification');
    await job.handle();
    await driver.delete(popped!.id);

    // …and only then are the notification and the mail delivered.
    const notifications = (await DatabaseNotification.query().get()) as DatabaseNotification[];
    expect(notifications).toHaveLength(1);
    expect(notifications[0].getAttribute('type')).toBe('WelcomeNotification');
    expect(Mail.sent()).toHaveLength(1);
    expect(Mail.sent()[0].subject).toBe('Welcome to chavaJs!');
    expect(Mail.sent()[0].to[0].address).toBe('inbox@chava.dev');
  });
});
