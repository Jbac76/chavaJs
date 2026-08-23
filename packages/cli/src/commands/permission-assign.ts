import { Command } from 'commander';
import { bootApp } from '../helpers/boot-app';

/**
 * js permission:assign <role> <user>
 * Grants a role to a user. `<user>` is a numeric id or an email address.
 * This is the intended way to bootstrap your first admin.
 */
export function permissionAssignCommand(): Command {
  return new Command('permission:assign')
    .description('Assign a role to a user (id or email) - e.g. permission:assign super-admin 1')
    .argument('<role>', 'the role name')
    .argument('<user>', 'user id or email')
    .action(async (roleName: string, userRef: string) => {
      const app = await bootApp();
      await app.bootstrap();

      const registrar = app.make<{
        getRole: (name: string) => { id: number; name: string };
        assignRolesToModel: (type: string, id: number | string, roles: string[]) => Promise<void>;
      }>('permissions');

      const roleRecord = registrar.getRole(roleName); // throws RoleDoesNotExistError if unknown

      // Resolve the user by id or email through the User model.
      const userModelModule = await import('../../../app/Models/User').catch(() => null);
      if (!userModelModule) {
        console.error('User model not found at app/Models/User - run inside an app directory.');
        process.exitCode = 1;
        return;
      }
      const { User } = userModelModule as { User: { find: (id: string) => Promise<{ getKey(): number | string } | null>; where: (col: string, op: string, val: string) => { first: () => Promise<{ getKey(): number | string } | null> } | null } };

      let target = null as { getKey(): number | string } | null;
      if (/^\d+$/.test(userRef)) {
        target = await User.find(userRef);
      } else {
        const found = await (User as unknown as {
          query: () => { where: (col: string, op: string, val: string) => { first: () => Promise<{ getKey(): number | string } | null> } };
        }).query().where('email', '=', userRef).first();
        target = found ?? null;
      }
      if (!target) {
        console.error(`User "${userRef}" not found.`);
        process.exitCode = 1;
        return;
      }

      await registrar.assignRolesToModel('users', target.getKey(), [roleRecord.name]);
      console.log(`Assigned role "${roleRecord.name}" to user #${target.getKey()}.`);
      console.log('Sign in and visit /admin.');
    });
}
