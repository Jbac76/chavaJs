import type { ServerResponse } from 'node:http';

export interface CookieOptions {
  path?: string;
  domain?: string;
  maxAge?: number;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
}

interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

function serializeCookie(cookie: CookieToSet): string {
  const parts = [`${cookie.name}=${encodeURIComponent(cookie.value)}`];
  const options = cookie.options;
  parts.push(`Path=${options.path ?? '/'}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  return parts.join('; ');
}

/**
 * The chavaJs Response — mirrors Illuminate\Http\Response.
 * Controllers return a Response (or a plain value which the kernel wraps).
 */
export class Response {
  public statusCode = 200;
  public readonly headers: Record<string, string> = {};
  public body: string | Buffer | null = null;

  private readonly cookiesToSet: CookieToSet[] = [];

  public constructor(body: string | Buffer | null = null, status = 200) {
    this.body = body;
    this.statusCode = status;
  }

  public status(status: number): this {
    this.statusCode = status;
    return this;
  }

  public header(key: string, value: string): this {
    this.headers[key.toLowerCase()] = value;
    return this;
  }

  public withHeaders(headers: Record<string, string>): this {
    for (const [key, value] of Object.entries(headers)) this.header(key, value);
    return this;
  }

  public contentType(type: string): this {
    return this.header('content-type', type);
  }

  public json(data: unknown, status = 200): this {
    this.status(status).contentType('application/json; charset=utf-8');
    this.body = JSON.stringify(data);
    return this;
  }

  public html(html: string, status = 200): this {
    this.status(status).contentType('text/html; charset=utf-8');
    this.body = html;
    return this;
  }

  public send(body: string | Buffer, status = 200): this {
    this.status(status);
    this.body = body;
    return this;
  }

  public redirect(location: string, status = 302): this {
    this.status(status).header('location', location);
    return this;
  }

  public cookie(name: string, value: string, options: CookieOptions = {}): this {
    this.cookiesToSet.push({ name, value, options });
    return this;
  }

  /** Write this response to a Node ServerResponse. */
  public toNode(res: ServerResponse, _request?: unknown, _app?: unknown): void {
    res.statusCode = this.statusCode;
    for (const [key, value] of Object.entries(this.headers)) res.setHeader(key, value);
    const setCookie = this.cookiesToSet.map(serializeCookie);
    if (setCookie.length > 0) res.setHeader('set-cookie', setCookie);
    res.end(this.body ?? '');
  }

  // --------------------------------------------------------------- static

  public static json(data: unknown, status = 200): Response {
    return new Response().json(data, status);
  }

  public static html(html: string, status = 200): Response {
    return new Response().html(html, status);
  }

  public static redirect(location: string, status = 302): Response {
    return new Response().redirect(location, status);
  }

  public static noContent(status = 204): Response {
    return new Response(null, status);
  }
}
