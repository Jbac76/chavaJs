import type { Request } from '../Request';
import type { Response } from '../Response';
import type { Config } from '../../config/Config';

/**
 * CORS handling — Laravel's HandleCors middleware equivalent.
 *
 * Applied globally in the HttpKernel before routing: allowed origins get the
 * full header set on every response, and preflight (OPTIONS) requests are
 * terminated early. Origins not listed receive no CORS headers, so the
 * browser blocks the response — the server itself never leaks data here.
 */

export interface CorsOptions {
  /** Allowed origins, or '*' to allow any origin (credentials then forbidden). */
  readonly allowed_origins: readonly string[] | '*';
  readonly allowed_methods: readonly string[];
  readonly allowed_headers: readonly string[];
  readonly supports_credentials: boolean;
  /** Preflight cache lifetime in seconds. */
  readonly max_age: number;
}

export const DEFAULT_CORS: CorsOptions = {
  allowed_origins: ['http://localhost:3000', 'http://localhost:5173'],
  allowed_methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowed_headers: ['Content-Type', 'Authorization', 'X-XSRF-TOKEN', 'Accept'],
  supports_credentials: true,
  max_age: 86400,
};

/** Resolve the merged CORS config (`config/cors.ts` over defaults). */
export function resolveCorsConfig(config?: Config): CorsOptions {
  if (!config) return DEFAULT_CORS;
  const user = config.get<Partial<CorsOptions>>('cors', {});
  return {
    allowed_origins: user.allowed_origins ?? DEFAULT_CORS.allowed_origins,
    allowed_methods: user.allowed_methods ?? DEFAULT_CORS.allowed_methods,
    allowed_headers: user.allowed_headers ?? DEFAULT_CORS.allowed_headers,
    supports_credentials: user.supports_credentials ?? DEFAULT_CORS.supports_credentials,
    max_age: user.max_age ?? DEFAULT_CORS.max_age,
  };
}

/** Whether an Origin header is present (i.e. this is a cross-origin-ish request). */
export function hasOrigin(request: Request): boolean {
  return request.header('origin') !== undefined;
}

/** Is this an OPTIONS preflight (needs the early 204 termination)? */
export function isPreflight(request: Request): boolean {
  return (
    request.method() === 'OPTIONS' &&
    request.header('access-control-request-method') !== undefined
  );
}

/**
 * Attach CORS headers to a raw ServerResponse when the origin is allowed.
 * Returns 'applied' | 'preflight' | 'none' — Kernel terminates on preflight.
 */
export function applyCors(
  request: Request,
  res: import('node:http').ServerResponse,
  config?: Config,
): 'applied' | 'preflight' | 'none' {
  const origin = request.header('origin');
  if (!origin) return 'none';

  const cors = resolveCorsConfig(config);
  const wildcard = cors.allowed_origins === '*';
  const allowed = wildcard || cors.allowed_origins.includes(origin);

  // Vary regardless of outcome so caches never serve one origin another's reply.
  res.setHeader('Vary', 'Origin');
  if (!allowed) return 'none';

  res.setHeader('Access-Control-Allow-Origin', wildcard ? '*' : origin);
  if (!wildcard && cors.supports_credentials) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', cors.allowed_methods.join(', '));
  res.setHeader('Access-Control-Allow-Headers', cors.allowed_headers.join(', '));
  res.setHeader('Access-Control-Max-Age', String(cors.max_age));

  return isPreflight(request) ? 'preflight' : 'applied';
}

/** Convenience for route-level middleware users: wrap a Response with CORS headers. */
export function corsResponse(request: Request, response: Response, config?: Config): Response {
  const cors = resolveCorsConfig(config);
  const origin = request.header('origin');
  if (!origin) return response;
  const wildcard = cors.allowed_origins === '*';
  if (!wildcard && !cors.allowed_origins.includes(origin)) return response;
  response.header('Access-Control-Allow-Origin', wildcard ? '*' : origin);
  if (!wildcard && cors.supports_credentials) {
    response.header('Access-Control-Allow-Credentials', 'true');
  }
  response.header('Access-Control-Allow-Methods', cors.allowed_methods.join(', '));
  response.header('Access-Control-Allow-Headers', cors.allowed_headers.join(', '));
  return response;
}
