// The register flow runs the welcome notification through the default sync
// queue, so it lands immediately — perfect for exercising the inbox.
process.env.DB_CONNECTION = 'sqlite';
process.env.DB_DATABASE = ':memory:';
process.env.SESSION_DRIVER = 'array';
process.env.MAIL_MAILER = 'array';
process.env.APP_KEY = 'test-key-0123456789abcdef0123456789abcdef';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { Migrator } from '../../src/database/Migrator';
import { app } from '../../bootstrap/app';
import { DatabaseNotification } from '../../src/notifications/Notifiable';
import { User } from '../../app/Models/User';
import { WelcomeNotification } from '../../app/Notifications/WelcomeNotification';

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
  body: string;
}

async function request(
  method: 'GET' | 'POST',
  path: string,
  jar: CookieJar,
  data: Record<string, string> = {},
  isInertia = true,
): Promise<FetchResult> {
  const headers: Record<string, string> = {
    ...(isInertia ? { 'X-Inertia': 'true', 'X-Inertia-Version': '1.0.0' } : {}),
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
  return {
    status: response.status,
    location: response.headers.get('location'),
    cookies: setCookie ?? [],
    body: await response.text(),
  };
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
  const result = await request('GET', '/login', jar, {}, false);
  updateJar(jar, result);
  return jar;
}

function pageBody(result: FetchResult): { component: string; props: Record<string, unknown> } {
  return JSON.parse(result.body) as { component: string; props: Record<string, unknown> };
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

describe('Notification inbox (Phase 7)', () => {
  it('lists a newly-registered user\u2019s welcome notification as unread', async () => {
    const jar = await newSession();
    const register = await request('POST', '/register', jar, {
      name: 'Inboxer',
      email: 'inboxer@chava.dev',
      password: 'password',
      password_confirmation: 'password',
    });
    expect(register.status).toBe(302);
    updateJar(jar, register);

    const page = await request('GET', '/notifications', jar);
    expect(page.status).toBe(200);
    const body = pageBody(page);
    expect(body.component).toBe('Notifications/Index');
    expect(body.props.unreadCount).toBe(1);

    const notifications = body.props.notifications as Array<{ id: string; type: string; read_at: string | null }>;
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe('WelcomeNotification');
    expect(notifications[0].read_at).toBeNull();

    // The nav badge count is shared with every page.
    expect((body.props.auth as { unreadNotifications: number }).unreadNotifications).toBe(1);
  });

  it('marks a single notification read via the Notifiable API', async () => {
    const jar = await newSession();
    const register = await request('POST', '/register', jar, {
      name: 'Reader',
      email: 'reader@chava.dev',
      password: 'password',
      password_confirmation: 'password',
    });
    updateJar(jar, register); // login rotates the session + CSRF token

    const first = await request('GET', '/notifications', jar);
    const notifications = pageBody(first).props.notifications as Array<{ id: string }>;
    const id = notifications[0].id;

    const markRead = await request('POST', `/notifications/${id}/read`, jar);
    expect(markRead.status).toBe(302);

    const after = await request('GET', '/notifications', jar);
    const body = pageBody(after);
    expect(body.props.unreadCount).toBe(0);
    const updated = (body.props.notifications as Array<{ id: string; read_at: string | null }>)[0];
    expect(updated.id).toBe(id);
    expect(updated.read_at).not.toBeNull();
  });

  it('rejects marking another user\u2019s notification as read', async () => {
    const other = (await User.create({
      name: 'Other',
      email: 'other@chava.dev',
      password: 'secret',
    })) as User;
    await other.notify(new WelcomeNotification());
    const otherNotification = (await DatabaseNotification.query()
      .where('notifiable_id', other.getKey())
      .first()) as DatabaseNotification;

    const jar = await newSession();
    const register = await request('POST', '/register', jar, {
      name: 'Owner',
      email: 'owner@chava.dev',
      password: 'password',
      password_confirmation: 'password',
    });
    updateJar(jar, register); // login rotates the session + CSRF token

    const forbidden = await request('POST', `/notifications/${String(otherNotification.getKey())}/read`, jar);
    expect(forbidden.status).toBe(403);

    // The other user's notification is untouched.
    const fresh = (await DatabaseNotification.findOrFail(otherNotification.getKey())) as DatabaseNotification;
    expect(fresh.getAttribute('read_at')).toBeNull();
  });

  it('marks all notifications read at once', async () => {
    const jar = await newSession();
    const register = await request('POST', '/register', jar, {
      name: 'Bulk',
      email: 'bulk@chava.dev',
      password: 'password',
      password_confirmation: 'password',
    });
    updateJar(jar, register); // login rotates the session + CSRF token
    // A second notification for the same user (mail channel is irrelevant).
    const user = (await User.query().where('email', 'bulk@chava.dev').first()) as User;
    await user.notify(new WelcomeNotification());

    const before = await request('GET', '/notifications', jar);
    expect(pageBody(before).props.unreadCount).toBe(2);

    const markAll = await request('POST', '/notifications/read-all', jar);
    expect(markAll.status).toBe(302);

    const after = await request('GET', '/notifications', jar);
    expect(pageBody(after).props.unreadCount).toBe(0);
  });
});
