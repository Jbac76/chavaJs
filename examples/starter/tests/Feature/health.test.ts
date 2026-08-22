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
  await app.shutdown();
});

describe('Health endpoint (GET /up)', () => {
  it('returns 200 with ok status and passing checks', async () => {
    const response = await fetch(`${baseUrl}/up`);
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      status: string;
      uptimeSeconds: number;
      checks: Record<string, { status: string }>;
    };
    expect(body.status).toBe('ok');
    expect(body.checks.database?.status).toBe('ok');
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('echoes an X-Request-ID correlation header', async () => {
    const response = await fetch(`${baseUrl}/up`);
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });
});
