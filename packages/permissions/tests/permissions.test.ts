import { describe, expect, it } from 'vitest';
import { Registrar } from '../src/core/Registrar';
import { MemoryStore } from '../src/adapters/MemoryStore';
import { createHasRoles } from '../src/core/HasRoles';
import { createAuthorizer } from '../src/authorizer';
import { compileWildcard } from '../src/core/Wildcard';
import {
  PermissionDoesNotExistError,
  RoleDoesNotExistError,
} from '../src/core/errors';

async function freshRegistrar(): Promise<Registrar> {
  const registrar = new Registrar(new MemoryStore());
  await registrar.warmUp();
  return registrar;
}

describe('Registrar basics (Spatie findOrCreate semantics)', () => {
  it('createPermission is idempotent', async () => {
    const registrar = await freshRegistrar();
    const first = await registrar.createPermission({ name: 'posts.edit' });
    const second = await registrar.createPermission({ name: 'posts.edit' });
    expect(second.id).toBe(first.id);
    expect(registrar.allPermissions()).toHaveLength(1);
  });

  it('getPermission throws PermissionDoesNotExistError for unknown names', async () => {
    const registrar = await freshRegistrar();
    expect(() => registrar.getPermission('nope')).toThrowError(PermissionDoesNotExistError);
    expect(() => registrar.getRole('nope')).toThrowError(RoleDoesNotExistError);
  });
});

describe('HasRoles — full Spatie behavior matrix', () => {
  async function setup() {
    const authz = await createAuthorizer();
    const { registrar } = authz;
    await registrar.createPermission({ name: 'posts.view' });
    await registrar.createPermission({ name: 'posts.edit' });
    await registrar.createPermission({ name: 'posts.delete' });
    await registrar.createPermission({ name: 'admin.access' });
    await registrar.createRole({ name: 'writer' });
    const writer = registrar.findRole('writer')!;
    await registrar.syncRolePermissions(writer.id, ['posts.view', 'posts.edit']);
    return authz;
  }

  it('hasPermissionTo via role, and false without grants', async () => {
    const authz = await setup();
    const user = authz.user({ id: 1, modelType: 'users' });
    expect(user.hasPermissionTo('posts.view')).toBe(false);
    await user.assignRole('writer');
    expect(user.hasRole('writer')).toBe(true);
    expect(user.hasPermissionTo('posts.view')).toBe(true);
    expect(user.hasPermissionTo('posts.delete')).toBe(false);
  });

  it('direct permissions merge with role permissions (getAllPermissions dedupes)', async () => {
    const authz = await setup();
    const user = authz.user({ id: 2, modelType: 'users' });
    await user.assignRole('writer');
    await user.givePermissionTo('posts.delete');
    const all = user.getAllPermissions().map((permission) => permission.name).sort();
    expect(all).toEqual(['posts.delete', 'posts.edit', 'posts.view']);
    // Granting an already-inherited permission does not duplicate.
    await user.givePermissionTo('posts.view');
    expect(user.getAllPermissions()).toHaveLength(3);
  });

  it('revokePermissionTo only removes direct grants', async () => {
    const authz = await setup();
    const user = authz.user({ id: 3, modelType: 'users' });
    await user.assignRole('writer');           // has posts.view via role
    await user.givePermissionTo('posts.delete');
    await user.revokePermissionTo('posts.delete');
    expect(user.hasPermissionTo('posts.delete')).toBe(false);
    expect(user.hasPermissionTo('posts.view')).toBe(true); // role grant intact
  });

  it('syncRoles replaces the entire role set', async () => {
    const authz = await setup();
    await authz.registrar.createRole({ name: 'editor' });
    const user = authz.user({ id: 4, modelType: 'users' });
    await user.assignRole('writer');
    await user.syncRoles('editor');
    expect(user.getRoleNames()).toEqual(['editor']);
  });

  it('syncPermissions replaces the direct set entirely', async () => {
    const authz = await setup();
    const user = authz.user({ id: 5, modelType: 'users' });
    await user.givePermissionTo('posts.view', 'admin.access');
    await user.syncPermissions('admin.access');
    expect(user.getPermissionNames()).toEqual(['admin.access']);
  });

  it('hasAnyPermission / hasAllPermissions / hasAnyRole / hasAllRoles', async () => {
    const authz = await setup();
    const user = authz.user({ id: 6, modelType: 'users' });
    await user.assignRole('writer');
    expect(user.hasAnyPermission('posts.delete', 'posts.view')).toBe(true);
    expect(user.hasAllPermissions('posts.view', 'posts.edit')).toBe(true);
    expect(user.hasAllPermissions('posts.view', 'posts.delete')).toBe(false);
    expect(user.hasAnyRole('editor', 'writer')).toBe(true);
    expect(user.hasAllRoles('editor', 'writer')).toBe(false);
  });

  it('unknown permission name in a check that exists nowhere returns false, not throw', async () => {
    const authz = await setup();
    const user = authz.user({ id: 7, modelType: 'users' });
    expect(user.hasPermissionTo('ghost.thing')).toBe(false);
  });
});

describe('Wildcard permissions (Spatie WildcardPermission semantics)', () => {
  it('compiles matchers correctly', () => {
    expect(compileWildcard('*')('anything.at.all')).toBe(true);
    expect(compileWildcard('posts.*')('posts.edit')).toBe(true);
    expect(compileWildcard('posts.*')('comments.edit')).toBe(false);
    expect(compileWildcard('posts.view')('posts.view')).toBe(true);
    expect(compileWildcard('posts.view')('posts.edit')).toBe(false);
  });

  it('a wildcard grant satisfies concrete checks through roles', async () => {
    const authz = await createAuthorizer();
    await authz.registrar.createPermission({ name: 'posts.*' });
    await authz.registrar.createRole({ name: 'author' });
    const author = authz.registrar.findRole('author')!;
    await authz.registrar.syncRolePermissions(author.id, ['posts.*']);

    const user = authz.user({ id: 8, modelType: 'users' });
    await user.assignRole('author');
    expect(user.hasPermissionTo('posts.edit')).toBe(true);
    expect(user.hasPermissionTo('posts.delete.deep')).toBe(true);
    expect(user.hasPermissionTo('comments.edit')).toBe(false);
  });
});

describe('Guard separation', () => {
  it('roles carry guardName from creation options', async () => {
    const authz = await createAuthorizer({ guardName: 'api' });
    const role = await authz.registrar.createRole({ name: 'api-admin' });
    expect(role.guardName).toBe('api');
  });
});

describe('createHasRoles mixin reuse (framework-agnostic core)', () => {
  it('works on plain objects with any modelType', async () => {
    const authz = await createAuthorizer();
    await authz.registrar.createPermission({ name: 'reports.view' });
    const subject = createHasRoles({ id: 'abc', modelType: 'service-accounts' }, authz.registrar);
    await subject.givePermissionTo('reports.view');
    expect(subject.hasPermissionTo('reports.view')).toBe(true);
  });
});
