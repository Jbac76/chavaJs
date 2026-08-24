
/**
 * Shared HTTP test helpers: cookie jar + CSRF-aware login for feature tests
 * that exercise authenticated routes over real fetch() calls.
 */

export class Jar {
  public cookies = new Map<string, string>();

  public absorb(res: { headers: { getSetCookie?: () => string[] } }): void {
    const raw = res.headers.getSetCookie?.() ?? [];
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

export interface AuthContext {
  jar: Jar;
  /** fetch() with the session cookie + CSRF header attached. */
  request(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: Record<string, unknown>,
    accept?: string,
  ): Promise<Response>;
}

/**
 * Login as an existing user and return an authenticated context.
 * `redirect: manual` everywhere so we can assert on status codes ourselves.
 */
export async function login(baseUrl: string, email: string, password: string): Promise<AuthContext> {
  const jar = new Jar();

  // Prime the cookie jar with the XSRF token + anonymous session.
  const page = await fetch(`${baseUrl}/login`);
  jar.absorb({ headers: page.headers });

  const post = async (body: Record<string, unknown>): Promise<Response> =>
    fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Cookie: jar.header(),
        'X-XSRF-TOKEN': jar.xsrf,
      },
      body: JSON.stringify(body),
      redirect: 'manual',
    });

  let res = await post({ email, password });
  jar.absorb({ headers: res.headers });
  if (res.status === 419) {
    // Token rotated on a prior request in this suite — retry once with fresh jar.
    const fresh = await fetch(`${baseUrl}/login`);
    jar.absorb({ headers: fresh.headers });
    res = await post({ email, password });
    jar.absorb({ headers: res.headers });
  }
  if (res.status !== 302 && res.status !== 200) {
    throw new Error(`Login failed for ${email}: HTTP ${res.status}`);
  }

  const ctx: AuthContext = {
    jar,
    async request(method, path, body, accept = 'application/json') {
      const headers: Record<string, string> = {
        Cookie: jar.header(),
        Accept: accept,
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (method !== 'GET') headers['X-XSRF-TOKEN'] = jar.xsrf;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'manual',
      });
      jar.absorb({ headers: response.headers });
      return response;
    },
  };
  return ctx;
}
