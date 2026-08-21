import { User } from '../Models/User';
import { Policy } from '../../src/auth/Policy';

/**
 * Laravel policy for the User model. Abilities receive (user, target) —
 * the current user and the model being acted on.
 */
export class UserPolicy extends Policy {
  public viewAny(user: User): boolean {
    return true;
  }

  public view(user: User, target: User): boolean {
    return user.getKey() === target.getKey() || user.getAttribute('is_admin') === true;
  }

  public update(user: User, target: User): boolean {
    return user.getKey() === target.getKey() || user.getAttribute('is_admin') === true;
  }

  public delete(user: User, target: User): boolean {
    return user.getKey() === target.getKey() || user.getAttribute('is_admin') === true;
  }
}
