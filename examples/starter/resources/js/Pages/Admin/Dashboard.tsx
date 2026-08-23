import { usePage } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import AdminLayout from '@/Layouts/AdminLayout';

interface Props {
  stats: { users: number };
  recentUsers: Array<Record<string, unknown>>;
}

export default function Dashboard() {
  const props = usePage().props as unknown as Props;
  const { stats, recentUsers } = props;

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        A live view of your application.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.users ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Recent registrations</CardTitle>
        </CardHeader>
        <CardContent>
          {(recentUsers ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No users yet.</p>
          ) : (
            <ul className="divide-y">
              {(recentUsers ?? []).map((user) => (
                <li key={String(user.id)} className="flex items-center justify-between py-2 text-sm">
                  <span>{String(user.name)}</span>
                  <span className="text-muted-foreground">{String(user.email)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
