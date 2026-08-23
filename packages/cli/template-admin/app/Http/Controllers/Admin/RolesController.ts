import { Inertia } from '../../../../src/facades';
import { Controller } from '../../../../src/http/Controller';
import { Request } from '../../../../src/http/Request';
import { ValidationException } from '../../../../src/support/exceptions';
import { currentApp } from '../../../../src/foundation/registry';

interface RegistrarLike {
  allRoles: () => Array<{ id: number; name: string; permissionIds: Set<number> }>;
  allPermissions: () => Array<{ id: number; name: string }>;
  permissionById: (id: number) => { name: string } | undefined;
  syncRolePermissions: (roleId: number, permissions: string[]) => Promise<void>;
}

export class AdminRolesController extends Controller {
  /** GET /admin/roles — the permission matrix (roles x permissions). */
  public async index(request: Request) {
    void request;
    const registrar = currentApp().make<RegistrarLike>('permissions');
    const allPermissions = registrar.allPermissions().map((permission) => permission.name);

    const roles = registrar.allRoles().map((role) => ({
      id: role.id,
      name: role.name,
      permissions: [...role.permissionIds]
        .map((id) => registrar.permissionById(id)?.name)
        .filter((name): name is string => name !== undefined),
    }));

    return Inertia.render('Admin/Roles/Index', { permissions: allPermissions, roles });
  }

  /** POST /admin/roles/{role}/permissions - transactional matrix save. */
  public async syncPermissions(request: Request, roleId: string) {
    const permissions = request.input('permissions');
    if (!Array.isArray(permissions)) {
      throw new ValidationException({ permissions: ['Expected an array of permission names.'] });
    }
    const registrar = currentApp().make<RegistrarLike>('permissions');
    const known = new Set(registrar.allPermissions().map((permission) => permission.name));
    for (const name of permissions) {
      if (!known.has(String(name))) {
        throw new ValidationException({ permissions: [`Unknown permission "${String(name)}".`] });
      }
    }
    await registrar.syncRolePermissions(Number(roleId), permissions.map(String));
    return Inertia.redirect('/admin/roles');
  }
}
