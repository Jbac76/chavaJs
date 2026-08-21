import type { User } from '../Models/User';

/**
 * Dispatched when a user registers — Laravel's UserRegistered event, ported.
 *
 *   await Event.dispatch(new UserRegistered(user));
 */
export class UserRegistered {
  public constructor(public readonly user: User) {}
}
