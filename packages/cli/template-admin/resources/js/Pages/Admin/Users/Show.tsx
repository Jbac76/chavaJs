import { usePage } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import AdminLayout from '@/Layouts/AdminLayout';

export default function UserShow() {
  const page = usePage<{ user: Record<string, unknown>; roles: string[] }>().props as unknown as {
    user: Record<string, unknown>;
    roles: string[];
  };

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold tracking-tight">{String(page.user.name)}</h1>

      <Card className="mt-6 max-w-lg">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Profile</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{String(page.user.email)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Joined</span><span>{String(page.user.created_at ?? '-')}</span></div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Roles</span>
            <div className="flex gap-1">
              {(page.roles ?? []).length === 0
                ? <span className="text-muted-foreground">none</span>
                : page.roles!.map((role) => <Badge key={role} variant="secondary">{role}</Badge>)}
            </div>
          </div>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
