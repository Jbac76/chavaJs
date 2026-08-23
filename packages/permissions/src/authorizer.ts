import { Registrar } from './core/Registrar';
import { createHasRoles, HasRolesApi } from './core/HasRoles';
import { MemoryStore } from './adapters/MemoryStore';
import type { Authorizable } from './core/types';

/**
 * One-call setup for any JavaScript/TypeScript application:
 *
 *   const authz = await createAuthorizer();          // memory store
 *   const user  = authz.user({ id: 1, modelType: 'users' });
 *   await user.assignRole('writer');
 *   user.hasPermissionTo('posts.edit');              // -> boolean
 *
 * Pass a custom store adapter for persistence (file/sql/custom).
 */
export interface Authorizer {
  registrar: Registrar;
  /** Attach the full HasRoles API to a subject. */
  user(model: Authorizable): HasRolesApi;
  refresh(): Promise<void>;
}

export interface CreateAuthorizerOptions {
  store?: ConstructorParameters<typeof Registrar>[0];
  guardName?: string;
  onEvent?: Parameters<Registrar['warmUp']>;
}

export async function createAuthorizer(options: {
  store?: InstanceType<typeof MemoryStore> | any;
  guardName?: string;
} = {}): Promise<Authorizer> {
  const registrar = new Registrar(options.store ?? new MemoryStore(), {}, options.guardName ?? 'web');
  await registrar.warmUp();
  return {
    registrar,
    user: (model: Authorizable) => createHasRoles(model, registrar),
    refresh: () => registrar.warmUp(),
  };
}
