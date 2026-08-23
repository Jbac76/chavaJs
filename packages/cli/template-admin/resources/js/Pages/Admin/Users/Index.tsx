import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Card, CardContent } from '@/Components/ui/card';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import AdminLayout from '@/Layouts/AdminLayout';

interface UserRow {
  id: number;
  name: string;
  email: string;
}

export default function UsersIndex() {
  const page = usePage<{ users: { data: UserRow[]; current_page: number; last_page: number }; q: string }>().props as unknown as {
    users: { data: UserRow[]; current_page: number; last_page: number };
    q: string;
  };

  const [search, setSearch] = useState(page.q ?? '');
  const [selected, setSelected] = useState<number | null>(null);

  const go = (params: Record<string, unknown>) => {
    router.get('/admin/users', params, { preserveState: true });
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight">Users</h1>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            go({ q: search });
          }}
          className="flex gap-2"
        >
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or email..."
            className="w-64"
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
      </div>

      <Card className="mt-6">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(page.users?.data ?? []).map((user) => (
                <tr key={user.id} className="border-b last:border-0">
                  <td className="px-4 py-3">{user.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelected(selected === user.id ? null : user.id)}
                    >
                      Manage roles
                    </Button>
                    {selected === user.id && (
                      <RolesEditor
                        userId={user.id}
                        onDone={() => {
                          setSelected(null);
                          router.reload();
                        }}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Page {page.users?.current_page ?? 1} of {page.users?.last_page ?? 1}
        </span>
        {page.users && page.users.current_page > 1 && (
          <Button size="sm" variant="outline" onClick={() => go({ page: page.users.current_page - 1, q: search })}>
            Previous
          </Button>
        )}
        {page.users && page.users.current_page < page.users.last_page && (
          <Button size="sm" variant="outline" onClick={() => go({ page: page.users.current_page + 1, q: search })}>
            Next
          </Button>
        )}
      </div>
    </AdminLayout>
  );
}

function RolesEditor({ userId, onDone }: { userId: number; onDone: () => void }) {
  const all = usePage<{ roles?: string[] }>().props as unknown as { roles?: string[] };
  const [picked, setPicked] = useState<string[]>([]);

  return (
    <form
      className="mt-2 flex flex-wrap items-center gap-2 rounded-md border bg-secondary/40 p-2"
      onSubmit={async (event) => {
        event.preventDefault();
        await new Promise<void>((resolve) => {
          router.post(`/admin/users/${userId}/roles`, { roles: picked }, {
            onFinish: () => resolve(),
          });
        });
        onDone();
      }}
    >
      {(all.roles ?? []).map((role) => (
        <label key={role} className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={picked.includes(role)}
            onChange={(event) =>
              setPicked((current) =>
                event.target.checked ? [...current, role] : current.filter((name) => name !== role),
              )
            }
          />
          {role}
        </label>
      ))}
      <Button size="sm" type="submit">
        Save
      </Button>
    </form>
  );
}
