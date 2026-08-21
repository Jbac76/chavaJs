import type { Request } from './Request';
import type { Response } from './Response';
import type { MiddlewareFunction } from './types';

/**
 * Laravel's Pipeline: runs middleware in order, each calling `next()` to
 * continue down the stack, finally reaching the destination (the controller).
 */
export class Pipeline {
  public constructor(private readonly middleware: MiddlewareFunction[]) {}

  public async run(
    request: Request,
    destination: () => Response | Promise<Response>,
  ): Promise<Response> {
    let index = 0;
    const next = async (): Promise<Response> => {
      const middleware = this.middleware[index++];
      if (!middleware) return destination();
      return middleware(request, next);
    };
    return next();
  }
}
