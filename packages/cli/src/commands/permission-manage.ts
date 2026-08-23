import { Command } from 'commander';
import { bootApp } from '../helpers/boot-app';

export function permissionShowCommand(): Command {
  return new Command('permission:show')
    .description('List all roles with their permissions')
    .action(async () => {
      const app = await bootApp();
      await app.bootstrap();
      const registrar = app.make<{
        allRoles: () => Array<{ id: number; name: string; permissionIds: Set<number> }>;
        permissionById: (id: number) => { name: string } | undefined;
      }>('permissions');
      const roles = registrar.allRoles();
      if (roles.length === 0) {
        console.log('No roles defined yet. Create one with `js permission:create role <name>`.');
        return;
      }
      for (const role of roles) {
        const names = [...role.permissionIds]
          .map((id) => registrar.permissionById(id)?.name ?? `#${id}`)
          .join(', ');
        console.log(`  ${role.name.padEnd(24)} ${names || '(no permissions)'}`);
      }
    });
}

export function permissionCreateCommand(): Command {
  return new Command('permission:create')
    .description('Create a permission or a role (Spatie findOrCreate semantics)')
    .argument('<type>', '"permission" or "role"')
    .argument('<name>', 'the name (wildcards allowed for permissions, e.g. posts.*)')
    .action(async (type: string, name: string) => {
      const app = await bootApp();
      await app.bootstrap();
      const registrar = app.make<{ createPermission: (i: { name: string }) => Promise<unknown>; createRole: (i: { name: string }) => Promise<unknown> }>('permissions');
      if (type === 'permission') {
        const created = await registrar.createPermission({ name });
        console.log(`Permission ready: ${name} (id ${(created as { id: number }).id})`);
      } else if (type === 'role') {
        const created = await registrar.createRole({ name });
        console.log(`Role ready: ${name} (id ${(created as { id: number }).id})`);
      } else {
        console.error('Type must be "permission" or "role".');
        process.exitCode = 1;
      }
    });
}
