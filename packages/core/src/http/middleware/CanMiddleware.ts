import type { Application } from '../../foundation/Application';
import { currentRouteParams } from '../../foundation/request-context';
import type { Request } from '../Request';
import type { Response } from '../Response';
import type { NextFunction } from '../types';
import type { Gate } from '../../auth/Gate';

/**
 * Laravel's Authorize middleware (alias `can`) — `can:update,user`.
 * Route parameters are resolved from the current request (model binding),
 * so `can:update,user` authorizes against the bound `{user}` model.
 */
export class CanMiddleware {
  public constructor(private readonly app: Application) {}

  public async handle(request: Request, next: NextFunction, ability: string, ...params: string[]): Promise<Response> {
    const gate = this.app.make<Gate>('gate');
    const routeParams = currentRouteParams();
    const args = params.map((param) => {
      // A bare route-param name resolves to the bound model (e.g. {user}).
      return routeParams[param] ?? param;
    });
    await gate.authorize(ability, ...args);
    return next();
  }
}
