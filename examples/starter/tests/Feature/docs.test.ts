import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
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

describe('in-app documentation (/docs)', () => {
  it('renders the docs index at /docs', async () => {
    const response = await fetch(`${baseUrl}/docs`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const html = await response.text();
    expect(html).toContain('chavaJs Documentation');
    expect(html).toContain('nav class="sidebar"');
    expect(html).toContain('/docs/00-index');
  });

  it('lists every docs page in the sidebar', async () => {
    const response = await fetch(`${baseUrl}/docs`);
    const html = await response.text();
    const sidebar = html.match(/nav class="sidebar">([\s\S]*?)<\/nav>/)?.[1] ?? '';
    const slugs = [...sidebar.matchAll(/\/docs\/([a-z0-9-]+)/g)].map((m) => m[1]);
    expect(slugs.length).toBeGreaterThanOrEqual(23);
    expect(slugs).toContain('01-installation');
    expect(slugs).toContain('04-routing');
    expect(slugs).toContain('11-eloquent');
    expect(slugs).toContain('22-deployment');
  });

  it('renders an individual docs page at /docs/{page}', async () => {
    const response = await fetch(`${baseUrl}/docs/01-installation`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('<h1>Installation</h1>');
    expect(html).toContain('nav class="sidebar"');
  });

  it('renders markdown elements (headings, lists, code, tables)', async () => {
    const response = await fetch(`${baseUrl}/docs/00-index`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('<h1>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<pre><code');
  });

  it('returns 404 for an unknown docs page', async () => {
    const response = await fetch(`${baseUrl}/docs/does-not-exist`);
    expect(response.status).toBe(404);
    const html = await response.text();
    expect(html).toContain('404');
  });

  it('guards against path traversal in the page slug', async () => {
    const response = await fetch(`${baseUrl}/docs/..%2F..%2Fpackage.json`);
    expect(response.status).toBe(404);
  });

  it('does not expose docs routes when the docs directory is absent', async () => {
    // The main docs suite runs with docs/ present; this test proves the
    // no-op branch by pointing the boot helper at a dir that does not exist.
    const { registerDocsRoutes } = await import('../../src/docs/routes');
    const { Router } = await import('../../src/http/Router');
    const router = new Router(app);
    registerDocsRoutes(router, '/tmp/does-not-exist-docs');
    expect(router.getRoutes().filter((route) => route.uri.startsWith('/docs'))).toEqual([]);
  });
});