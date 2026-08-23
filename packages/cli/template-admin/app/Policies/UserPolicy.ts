import { User } from '../Models/User';
import { Policy } from '../../src/auth/Policy';
import { currentApp } from '../../src/foundation/registry';

/**
 * Laravel policy for the User model — composed with chava-permissions RBAC.
 *
 * Layering:
 *   1. permission:* middleware  -> coarse verb access (users.view/create/...)
 *   2. THIS policy              -> object-level rules via the Gate
 *   3. Gate bridge (1.3.x)      -> super-admin wildcard `*` satisfies
 *      ability checks automatically
 *
 * Abilities receive (user, target) — the actor and the acted-on model.
 */
export class UserPolicy extends Policy {
  public viewAny(_user: User): boolean {
    return true;
  }

  public view(user: User, target: User): boolean {
    if (user.getKey() === target.getKey()) return true;
    return this.isAdmin(user) || this.hasPermission(user, 'users.view');
  }

  /** Super-admin accounts may only be edited by super-admins. */
  public update(user: User, target: User): boolean {
    if (this.isSuperAdmin(target)) return this.isSuperAdmin(user);
    return (
      user.getKey() === target.getKey() ||
      this.isAdmin(user) ||
      this.hasPermission(user, 'users.update')
    );
  }

  public delete(user: User, target: User): boolean {
    // Escalation guard first: a non-super-admin can never remove a super-admin.
    if (this.isSuperAdmin(target) && !this.isSuperAdmin(user)) return false;
    // Self-deletion stays allowed at the POLICY layer (account settings);
    // the admin CRUD controller adds its own friendly business-rule block.
    if (user.getKey() === target.getKey()) return true;
    return this.isAdmin(user) || this.hasPermission(user, 'users.delete');
  }

  /**
   * Privilege-escalation guard: only super-admins may grant or revoke the
   * super-admin role on anyone.
   */
  public assignRole(user: User, _target: User, roleName?: string): boolean {
    if (roleName !== 'super-admin') {
      return this.isAdmin(user) || this.hasPermission(user, 'users.update');
    }
    return this.isSuperAdmin(user);
  }

  // ------------------------------------------------------------- internals

  private isAdmin(user: User): boolean {
    return user.getAttribute('is_admin') === true;
  }

  private isSuperAdmin(model: unknown): boolean {
    const roles = (model as { getRoleNames?: () => string[] }).getRoleNames;
    return typeof roles === 'function' && (model as unknown as { getRoleNames(): string[] }).getRoleNames().includes('super-admin');
  }

  private hasPermission(user: User, name: string): boolean {
    try {
      const registrar = currentApp().make<{ hasPermissionTo: (t: string, id: number | string, n: string) => boolean }>('permissions');
      return registrar.hasPermissionTo('users', user.getKey() as number | string, name);
    } catch {
      return false;
    }
  }
}
