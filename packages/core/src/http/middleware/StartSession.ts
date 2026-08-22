import type { Application } from '../../foundation/Application';
import { Config } from '../../config/Config';
import type { Request } from '../Request';
import type { Response } from '../Response';
import type { NextFunction } from '../types';
import { SessionManager } from '../../session/SessionManager';
import type { SessionStore } from '../../session/SessionStore';
import { resolveSigningKey, signValue, verifySignature } from '../../session/signature';

import type { CookieOptions } from '../Response';

export interface SessionCookie {
  name: string;
  value: string;
  options: CookieOptions;
}

/** Build the signed session cookie for a store (shared with the exception handler). */
export function sessionCookieFor(app: Application, store: SessionStore): SessionCookie {
  const config = app.make<Config>('config');
  const sameSite = config.get<string>('session.same_site', 'lax');
  return {
    name: config.get('session.cookie', 'chava_session'),
    value: signValue(store.getId(), resolveSigningKey(config.get('app.key'))),
    options: {
      httpOnly: config.get('session.http_only', true),
      secure: config.get('session.secure', false),
      sameSite: sameSite === 'strict' || sameSite === 'none' ? sameSite : 'lax',
      path: '/',
      maxAge: Number(config.get('session.lifetime', 120)) * 60,
    },
  };
}

/**
 * Laravel's StartSession middleware. Loads the session from the signed
 * `chava_session` cookie, attaches it to the request, runs the rest of the
 * stack, then persists the session and writes the cookie back — even when
 * the pipeline throws (validation redirects need the cookie to survive).
 */
export class StartSession {
  public constructor(private readonly app: Application) {}

  public async handle(request: Request, next: NextFunction): Promise<Response> {
    const config = this.app.make<Config>('config');
    const cookieName = config.get('session.cookie', 'chava_session');
    const key = resolveSigningKey(config.get('app.key'));

    const manager = this.app.make<SessionManager>('session');
    const signed = request.cookie(cookieName);
    const id = signed ? verifySignature(signed, key) : undefined;
    const store = manager.store(id ?? undefined);
    // Server-side idle expiry uses the same lifetime as the cookie.
    store.configure(Number(config.get('session.lifetime', 120)) || 0);
    store.load();
    request.setSession(store);

    // Remember the previous URL for redirect()->back().
    if (request.method() === 'GET') {
      store.setPreviousUrl(request.fullUrl());
    }

    let response: Response;
    try {
      response = await next();
    } finally {
      store.save();
    }

    const cookie = sessionCookieFor(this.app, store);
    response.cookie(cookie.name, cookie.value, cookie.options);
    return response;
  }
}
