import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Card, CardContent } from '@/Components/ui/card';
import AdminLayout from '@/Layouts/AdminLayout';

interface RoleRow {
  id: number;
  name: string;
  permissions: string[];
}

export default function RolesIndex() {
  const page = usePage<{ permissions: string[]; roles: RoleRow[] }>().props as unknown as {
    permissions: string[];
    roles: RoleRow[];
  };

  const [busy, setBusy] = useState<number | null>(null);

  const toggle = (role: RoleRow, permission: string) => {
    const granted = role.permissions.includes(permission)
      ? role.permissions.filter((name) => name !== permission)
      : [...role.permissions, permission];
    setBusy(role.id);
    router.post(
      '/admin/roles/' + role.id + '/permissions',
      { permissions: granted },
      { onFinish: () => setBusy(null) },
    );
  };

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold tracking-tight">Roles &amp; Permissions</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Click a cell to grant or revoke - every change saves instantly.
      </p>

      <Card className="mt-6 overflow-x-auto">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Role</th>
                {(page.permissions ?? []).map((permission) => (
                  <th key={permission} className="px-4 py-3 font-medium">{permission}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(page.roles ?? []).map((role) => (
                <tr key={role.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{role.name}</td>
                  {(page.permissions ?? []).map((permission) => (
                    <td key={permission} className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={role.permissions.includes(permission)}
                        disabled={busy === role.id}
                        onChange={() => toggle(role, permission)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
