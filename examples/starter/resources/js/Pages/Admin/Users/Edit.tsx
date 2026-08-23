import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import AdminLayout from '@/Layouts/AdminLayout';

type Errors = Record<string, string[]>;

export default function UserEdit() {
  const page = usePage().props as unknown as {
    user: { id: number; name: string; email: string };
    userRoles: string[];
    allRoles: string[];
    errors?: Errors;
  };

  const [form, setForm] = useState({
    name: page.user.name,
    email: page.user.email,
    password: '',
    password_confirmation: '',
  });
  const [picked, setPicked] = useState<string[]>(page.userRoles ?? []);
  const errors = page.errors ?? {};

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: event.target.value });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    router.post(`/admin/users/${page.user.id}`, {
      ...form,
      roles: picked,
      _method: 'PUT',
    });
  };

  const field = (key: string) => errors[key]?.[0];

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold tracking-tight">Edit: {page.user.name}</h1>

      <form onSubmit={submit} className="mt-6 max-w-lg space-y-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Account</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <Input value={form.name} onChange={set('name')} />
              {field('name') && <p className="mt-1 text-xs text-destructive">{field('name')}</p>}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <Input type="email" value={form.email} onChange={set('email')} />
              {field('email') && <p className="mt-1 text-xs text-destructive">{field('email')}</p>}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                New password <span className="opacity-60">(leave blank to keep current)</span>
              </label>
              <Input type="password" value={form.password} onChange={set('password')} />
              {field('password') && <p className="mt-1 text-xs text-destructive">{field('password')}</p>}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Confirm new password</label>
              <Input type="password" value={form.password_confirmation} onChange={set('password_confirmation')} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Roles</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {(page.allRoles ?? []).map((role) => (
              <label key={role} className="flex items-center gap-2 text-sm">
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
            {field('roles') && <p className="text-xs text-destructive">{field('roles')}</p>}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit">Save changes</Button>
          <Button type="button" variant="outline" onClick={() => window.history.back()}>Cancel</Button>
        </div>
      </form>
    </AdminLayout>
  );
}
