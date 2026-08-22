import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import { URL } from 'node:url';
import { currentApp } from '../foundation/registry';
import type { Config } from '../config/Config';
import type { Model } from '../orm/Model';
import type { SessionStore } from '../session/SessionStore';
import type { AuthManager } from '../auth/AuthManager';
import { ValidationException, RuntimeException } from '../support/exceptions';
import { getPath, isPlainRecord } from '../support/dot';
import { Validator } from '../validation/Validator';
import type { FormRequest } from '../validation/FormRequest';
import { Response } from './Response';
import { parseMultipart } from './multipart';

const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10 MB

export class UploadedFile {  /** The original client filename (Laravel: getClientOriginalName()). */
  public readonly name: string;
  /** The MIME type sent by the client. */
  public readonly type: string;
  /** Size in bytes. */
  public readonly size: number;
  /** The file contents (held in memory; Laravel writes a temp file instead). */
  public readonly content: Buffer;
  /** Set when the file was written with `store()` — the relative path. */
  public tempPath?: string;

  public constructor(data: { name: string; type: string; size: number; content: Buffer }) {
    this.name = data.name;
    this.type = data.type;
    this.size = data.size;
    this.content = data.content;
  }

  /** Laravel: $file->getClientOriginalName(). */
  public getClientOriginalName(): string {
    return this.name;
  }

  /** Laravel: $file->getClientMimeType(). */
  public getClientMimeType(): string {
    return this.type;
  }

  /** Laravel: $file->getSize(). */
  public getSize(): number {
    return this.size;
  }

  /**
   * Store the file under `storage/app/<directory>` and return the relative
   * path (Laravel: $file->store('avatars')). The name is a UUID with the
  /**
   * Store the file under `storage/app/<directory>` and return the relative
   * path (Laravel: $file->store('avatars')). The name is a UUID with a
   * sanitized extension preserved.
   *
   * Server-side validation runs before anything touches disk:
   *  - MIME type must be in the allow-list (`options.allowedMimes` overrides
   *    `uploads.allowed_mimes` config; default: images + PDF — SVG excluded
   *    because served SVG can execute script),
   *  - size cap via `options.maxSizeBytes` / `uploads.max_size_bytes`
   *    (default 10 MB),
   *  - the client-supplied extension is stripped to bare alphanumerics so it
   *    can never introduce path segments or double extensions.
   */
  public store(
    directory: string,
    options: { allowedMimes?: readonly string[]; maxSizeBytes?: number } = {},
  ): string {
    // Validate BEFORE resolving the app so bad uploads fail fast and cheaply.
    const runValidation = (allowed: readonly string[], maxSizeBytes: number): void => {
      if (allowed.length > 0 && !allowed.includes(this.type)) {
        const reason = `File type "${this.type}" is not allowed. Allowed types: ${allowed.join(', ')}.`;
        throw new ValidationException({ file: [reason] }, reason);
      }
      if (this.size > maxSizeBytes) {
        const reason = `File is too large. Maximum size is ${Math.floor(maxSizeBytes / 1024)} KB.`;
        throw new ValidationException({ file: [reason] }, reason);
      }
    };

    // Fast path: fully explicit options need no application context.
    const explicitAllowed = options.allowedMimes;
    const explicitMax = options.maxSizeBytes;
    if (explicitAllowed !== undefined && explicitMax !== undefined) {
      runValidation(explicitAllowed, explicitMax);
    }

    const app = currentApp();
    let config: Config | undefined;
    try {
      config = app.make<Config>('config');
    } catch {
      // Config unavailable in edge contexts — fall back to built-in defaults.
    }

    runValidation(
      explicitAllowed
        ?? config?.get<readonly string[]>('uploads.allowed_mimes')
        ?? DEFAULT_ALLOWED_MIMES,
      explicitMax ?? config?.get<number>('uploads.max_size_bytes') ?? MAX_BODY_SIZE,
    );

    const rawExtension = this.name.includes('.') ? this.name.split('.').pop()! : '';
    const safeExtension = rawExtension.replace(/[^A-Za-z0-9]/g, '').slice(0, 10);
    const filename = `${randomUUID().replaceAll('-', '')}${safeExtension ? `.${safeExtension}` : ''}`;
    const relative = `${directory.replace(/^\/+|\/+$/g, '')}/${filename}`;
    const fullPath = app.storagePath('app', ...relative.split('/'));
    mkdirSync(fullPath.replace(/[/\\][^/\\]+$/, ''), { recursive: true });
    writeFileSync(fullPath, this.content);
    this.tempPath = relative;
    return relative;
  }
}

/** Default upload MIME allow-list (SVG deliberately excluded — XSS vector). */
const DEFAULT_ALLOWED_MIMES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
];

const SPOOFABLE_METHODS = new Set(['PUT', 'PATCH', 'DELETE']);

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const pair of header.split(';')) {
    const index = pair.indexOf('=');
    if (index > 0) {
      const key = pair.slice(0, index).trim();
      try {
        cookies[key] = decodeURIComponent(pair.slice(index + 1).trim());
      } catch {
        cookies[key] = pair.slice(index + 1).trim();
      }
    }
  }
  return cookies;
}

/**
 * The chavaJs Request — mirrors Illuminate\Http\Request:
 *   request.input('name'), request.only([...]), request.expectsJson(), ...
 */
export class Request {
  public readonly id: string = randomUUID();
  private readonly httpMethod: string;
  public readonly originalUrl: string;
  public readonly url: URL;
  public readonly headers: IncomingMessage['headers'];
  public readonly cookies: Record<string, string>;
  public readonly query: Record<string, string | string[]>;
  public readonly body: Record<string, unknown>;
  public readonly rawBody: Buffer;
  public readonly files: Record<string, UploadedFile | UploadedFile[]>;
  public readonly ip: string | undefined;

  private readonly allValues: Record<string, unknown>;
  private sessionStore: SessionStore | undefined;

  private constructor(data: {
    method: string;
    originalUrl: string;
    url: URL;
    headers: IncomingMessage['headers'];
    cookies: Record<string, string>;
    query: Record<string, string | string[]>;
    body: Record<string, unknown>;
    rawBody: Buffer;
    files: Record<string, UploadedFile | UploadedFile[]>;
    ip: string | undefined;
  }) {
    this.httpMethod = data.method;
    this.originalUrl = data.originalUrl;
    this.url = data.url;
    this.headers = data.headers;
    this.cookies = data.cookies;
    this.query = data.query;
    this.body = data.body;
    this.rawBody = data.rawBody;
    this.files = data.files;
    this.ip = data.ip;
    this.allValues = { ...data.query, ...data.body };
  }

  /** Build a Request from a Node.js IncomingMessage (async: reads the body). */
  public static async fromNode(req: IncomingMessage): Promise<Request> {
    const method = (req.method ?? 'GET').toUpperCase();
    const originalUrl = req.url ?? '/';
    const url = new URL(originalUrl, 'http://chava.local');
    const query = buildQuery(url);
    const rawBody = await readBody(req, method);
    const contentType = req.headers['content-type'];
    const body = parseBody(contentType, rawBody);
    const files = parseFiles(contentType, rawBody);

    // Laravel's `_method` form-field spoofing.
    const resolvedMethod = resolveMethod(method, body, query);

    return new Request({
      method: resolvedMethod,
      originalUrl,
      url,
      headers: req.headers,
      cookies: parseCookies(req.headers.cookie),
      query,
      body,
      rawBody,
      files,
      ip: req.socket?.remoteAddress,
    });
  }

  // ------------------------------------------------------------- payload

  /** Get an input value (query or body) by name, supporting dot notation. */
  public input<T = unknown>(key: string, fallback?: T): T {
    return getPath(this.allValues, key, fallback) as T;
  }

  public get<T = unknown>(key: string, fallback?: T): T {
    return this.input<T>(key, fallback);
  }

  public all(): Record<string, unknown> {
    return { ...this.allValues };
  }

  public only(...keys: string[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      const value = this.input(key);
      if (value !== undefined) out[key] = value;
    }
    return out;
  }

  public except(...keys: string[]): Record<string, unknown> {
    const out = { ...this.allValues };
    for (const key of keys) delete out[key];
    return out;
  }

  public has(key: string): boolean {
    return this.input(key) !== undefined;
  }

  public filled(key: string): boolean {
    const value = this.input(key);
    return value !== undefined && value !== null && value !== '';
  }

  /** A single uploaded file (Laravel: $request->file('avatar')). */
  public file(key: string): UploadedFile | undefined {
    const value = this.files[key];
    return Array.isArray(value) ? value[0] : value;
  }

  /** All files for a key (Laravel: $request->file('photos') for multi). */
  public filesFor(key: string): UploadedFile[] {
    const value = this.files[key];
    if (Array.isArray(value)) return value;
    return value ? [value] : [];
  }

  /** Whether the request has an uploaded file for the key (Laravel: hasFile). */
  public hasFile(key: string): boolean {
    return this.filesFor(key).length > 0;
  }

  /** Every uploaded file, keyed by field name (Laravel: allFiles()). */
  public allFiles(): Record<string, UploadedFile | UploadedFile[]> {
    return this.files;
  }

  // --------------------------------------------------------------- request

  public method(): string {
    return this.httpMethod;
  }

  /** Correlation id for log aggregation (review 4.1). Set by the kernel. */
  private requestIdValue: string | undefined;

  public requestId(): string | undefined {
    return this.requestIdValue;
  }

  public setRequestId(id: string): void {
    this.requestIdValue = id;
  }

  public isMethod(method: string): boolean {
    return this.httpMethod === method.toUpperCase();
  }

  public path(): string {
    return this.url.pathname;
  }

  /** Full URL including the query string (used by the Inertia protocol). */
  public fullUrl(): string {
    return this.url.pathname + this.url.search;
  }

  public is(path: string): boolean {
    const segments = path.split('/').filter(Boolean);
    const current = this.path().split('/').filter(Boolean);
    if (segments.length !== current.length) return false;
    return segments.every((segment, index) => segment === '*' || segment === current[index]);
  }

  // -------------------------------------------------------------- headers

  public header(key: string, fallback?: string): string | undefined {
    const value = this.headers[key.toLowerCase()];
    if (Array.isArray(value)) return value[0] ?? fallback;
    return value ?? fallback;
  }

  public bearerToken(): string | undefined {
    const authorization = this.header('authorization');
    if (!authorization) return undefined;
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : undefined;
  }

  public cookie(key: string, fallback?: string): string | undefined {
    return this.cookies[key] ?? fallback;
  }

  // ------------------------------------------------------------- content

  public wantsJson(): boolean {
    return (this.header('accept') ?? '').includes('application/json');
  }

  public expectsJson(): boolean {
    // Laravel: expectsJson() is ajax() + accepts-any-content-type, or wantsJson().
    // Inertia requests are NOT JSON (they Accept text/html) — they get
    // redirects and the errors prop, exactly like Laravel + Inertia.
    return (
      this.wantsJson() ||
      ((this.header('x-requested-with') ?? '').toLowerCase().includes('xmlhttprequest') &&
        !this.isInertia())
    );
  }

  public isInertia(): boolean {
    return this.header('x-inertia') === 'true';
  }

  /** Validate the request payload with Laravel-style rules or a FormRequest. */
  public async validate(
    rules: Record<string, string> | (new (...args: never[]) => FormRequest),
    messages: Record<string, string> = {},
  ): Promise<Record<string, unknown>> {
    if (typeof rules === 'function') {
      // Form Request class → resolve from the container and validate.
      const form = currentApp().make<FormRequest>(rules);
      form.withRequest(this);
      return form.validated();
    }
    const validator = Validator.make(this.all(), rules, messages);
    if (await validator.fails()) {
      throw new ValidationException(validator.errors());
    }
    return validator.validated();
  }

  /** The session store attached by the StartSession middleware. */
  public session(): SessionStore | undefined {
    return this.sessionStore;
  }

  /** Attach the session store (called by StartSession). */
  public setSession(store: SessionStore): void {
    this.sessionStore = store;
  }

  /** The authenticated user (Laravel: $request->user()). */
  public async user(guard?: string): Promise<Model | null> {
    return currentApp().make<AuthManager>('auth').user(guard);
  }

  /** The authenticated user's key (Laravel: $request->user()?->id). */
  public async userId(guard?: string): Promise<unknown> {
    const user = await this.user(guard);
    return user?.getKey() ?? null;
  }

  /** Redirect to the previous URL (Laravel: redirect()->back()). */
  public back(): Response {
    return Response.redirect(this.header('referer') ?? this.session()?.previousUrl() ?? '/');
  }

  // --------------------------------------------------------------- static

  public static create(method: string, url: string, headers: Record<string, string> = {}, body: Record<string, unknown> = {}): Request {
    return new Request({
      method: resolveMethod(method.toUpperCase(), body, {}),
      originalUrl: url,
      url: new URL(url, 'http://chava.local'),
      headers,
      cookies: parseCookies(headers.cookie),
      query: Object.fromEntries(new URL(url, 'http://chava.local').searchParams.entries()),
      body,
      rawBody: Buffer.alloc(0),
      files: {},
      ip: '127.0.0.1',
    });
  }
}

function resolveMethod(
  method: string,
  body: Record<string, unknown>,
  query: Record<string, string | string[]>,
): string {
  const spoofed = body['_method'] ?? query['_method'];
  if (typeof spoofed === 'string' && SPOOFABLE_METHODS.has(spoofed.toUpperCase())) {
    return spoofed.toUpperCase();
  }
  return method;
}

function buildQuery(url: URL): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of url.searchParams.entries()) {
    const existing = query[key];
    if (existing === undefined) {
      query[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      query[key] = [existing, value];
    }
  }
  return query;
}

async function readBody(req: IncomingMessage, method: string): Promise<Buffer> {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return Buffer.alloc(0);

  // Reject early if Content-Length exceeds the limit — avoids buffering the
  // entire body into memory before failing.
  const contentLength = Number(req.headers['content-length'] ?? 0);
  if (contentLength > MAX_BODY_SIZE) {
    // Consume the stream so Node doesn't leak the socket.
    req.resume();
    throw new RuntimeException(`Request body exceeds the ${MAX_BODY_SIZE / 1024 / 1024} MB limit.`);
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_BODY_SIZE) {
      throw new RuntimeException(`Request body exceeds the ${MAX_BODY_SIZE / 1024 / 1024} MB limit.`);
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function parseBody(contentTypeHeader: string | undefined, raw: Buffer): Record<string, unknown> {
  if (raw.length === 0) return {};
  const contentType = contentTypeHeader?.split(';')[0].trim().toLowerCase() ?? '';
  if (contentType === 'application/json') {
    try {
      const parsed: unknown = JSON.parse(raw.toString('utf8'));
      return isPlainRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  if (contentType === 'application/x-www-form-urlencoded') {
    return Object.fromEntries(new URLSearchParams(raw.toString('utf8')).entries());
  }
  if (contentType === 'multipart/form-data') {
    // Fields come from the multipart body; files are handled by parseFiles().
    return parseMultipart(contentTypeHeader ?? '', raw).fields;
  }
  return {};
}

function parseFiles(contentTypeHeader: string | undefined, raw: Buffer): Record<string, UploadedFile | UploadedFile[]> {
  const contentType = contentTypeHeader?.split(';')[0].trim().toLowerCase() ?? '';
  if (contentType !== 'multipart/form-data' || raw.length === 0) return {};
  const parsed = parseMultipart(contentTypeHeader ?? '', raw);
  const files: Record<string, UploadedFile | UploadedFile[]> = {};
  for (const file of parsed.files) {
    const uploaded = new UploadedFile({
      name: file.filename ?? file.name,
      type: file.contentType ?? 'application/octet-stream',
      size: file.content.length,
      content: file.content,
    });
    const existing = files[file.name];
    if (existing === undefined) {
      files[file.name] = uploaded;
    } else if (Array.isArray(existing)) {
      existing.push(uploaded);
    } else {
      files[file.name] = [existing, uploaded];
    }
  }
  return files;
}
