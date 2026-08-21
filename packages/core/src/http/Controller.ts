import { currentApp } from '../foundation/registry';
import type { Gate } from '../auth/Gate';

/**
 * Base controller class. Extend it like Laravel:
 *
 *   export class UserController extends Controller {
 *     public index(request: Request) { ... }
 *     public async destroy(request: Request, user: User) {
 *       await this.authorize('delete', user);   // throws 403 when denied
 *       ...
 *     }
 *   }
 */
export abstract class Controller {
  /** Authorize an ability against the current user (Laravel: $this->authorize()). */
  protected async authorize(ability: string, ...args: unknown[]): Promise<void> {
    const gate = currentApp().make<Gate>('gate');
    await gate.authorize(ability, ...args);
  }
}
