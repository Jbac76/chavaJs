import { usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';

export default function UserEdit() {
  const page = usePage<{ user: Record<string, unknown>; userRoles: string[]; allRoles: string[] }>().props as unknown as {
    user: Record<string, unknown>;
    userRoles: string[];
    allRoles: string[];
  };

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold tracking-tight">{String(page.user.name)}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{String(page.user.email)}</p>

      <div className="mt-6">
        <h2 className="text-sm font-medium">Roles</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {(page.userRoles ?? []).map((role) => (
            <li key={role} className="rounded-md bg-primary/10 px-3 py-1 w-fit">{role}</li>
          ))}
          {(page.userRoles ?? []).length === 0 && (
            <li className="text-muted-foreground">No roles assigned.</li>
          )}
        </ul>
      </div>
    </AdminLayout>
  );
}
