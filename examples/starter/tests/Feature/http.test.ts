import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { Router } from '../../src/http/Router';
import type { Request } from '../../src/http/Request';
import { app } from '../../bootstrap/app';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  await app.bootstrap();
  server = await app.serve(0, '127.0.0.1');
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('HTTP kernel', () => {
  it('returns the Inertia HTML shell for a plain browser request to /', async () => {
    const response = await fetch(`${baseUrl}/`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('<div id="app"');
    expect(html).toContain('data-page=');
    expect(html).toContain('chavaJs');
  });

  it('returns the Inertia JSON payload for X-Inertia requests', async () => {
    const response = await fetch(`${baseUrl}/`, {
      headers: { 'X-Inertia': 'true', 'X-Inertia-Version': '1.0.0' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('x-inertia')).toBe('true');
    const page = (await response.json()) as { component: string; props: Record<string, unknown>; url: string; version: string };
    expect(page.component).toBe('Home');
    expect(page.url).toBe('/');
    expect(page.props.welcome).toBeDefined();
    expect(page.props.app).toMatchObject({ name: 'chavaJs', env: 'local' });
  });

  it('responds 409 with X-Inertia-Location on version mismatch', async () => {
    const response = await fetch(`${baseUrl}/about`, {
      headers: { 'X-Inertia': 'true', 'X-Inertia-Version': 'stale-version' },
    });
    expect(response.status).toBe(409);
    expect(response.headers.get('x-inertia-location')).toBe('/about');
  });

  it('serves the api group with JSON responses', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  it('returns 404 for unknown routes', async () => {
    const response = await fetch(`${baseUrl}/does-not-exist`, {
      headers: { 'X-Inertia': 'true' },
    });
    expect(response.status).toBe(404);
  });

  it('returns 405 with the Allow header for wrong methods', async () => {
    const response = await fetch(`${baseUrl}/`, { method: 'POST' });
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toContain('GET');
  });

  it('resolves async controller methods', async () => {
    class AsyncController {
      public async index(request: Request) {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { ok: true, method: request.method() };
      }
    }
    const router = app.make<Router>('router');
    router.get('/async-test', [AsyncController, 'index']);

    const response = await fetch(`${baseUrl}/async-test`, {
      headers: { accept: 'application/json' },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, method: 'GET' });
  });

  it('dispatches single-action (__invoke) controllers', async () => {
    // Laravel: make:controller --invokable → a class with __invoke() only.
    class InvokableController {
      public async __invoke(request: Request) {
        return { ok: true, via: '__invoke', method: request.method() };
      }
    }
    const router = app.make<Router>('router');
    router.get('/invoke-test', InvokableController);

    const response = await fetch(`${baseUrl}/invoke-test`, {
      headers: { accept: 'application/json' },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, via: '__invoke', method: 'GET' });
  });
});
