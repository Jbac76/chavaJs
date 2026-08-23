import { Link, usePage } from '@inertiajs/react';
import { LayoutDashboard, Users, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  permission?: string;
  icon: 'dashboard' | 'users' | 'shield';
}

/**
 * The admin sidebar. Navigation mirrors config/admin.ts - routes/admin.ts
 * generates one route per entry, so editing that config reshapes the section.
 */
export default function AdminLayout({ children }: { children?: ReactNode }) {
  const { url, props } = usePage<{ auth?: { user?: { can?: Record<string, boolean> } | null } }>();
  const can = props.auth?.user?.can ?? {};

  const NAV_ITEMS: NavItem[] = [
    { label: 'Dashboard', href: '/admin', icon: 'dashboard' },
    { label: 'Users', href: '/admin/users', permission: 'users.view', icon: 'users' },
    { label: 'Roles & Permissions', href: '/admin/roles', permission: 'roles.view', icon: 'shield' },
  ];

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-64 shrink-0 flex-col border-r bg-card">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-mono text-sm font-bold text-primary-foreground">
            A
          </span>
          <span className="font-display text-lg font-bold tracking-tight">Admin</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV_ITEMS.filter((item) => !item.permission || can[item.permission] !== false).map((item) => {
            const Icon =
              item.icon === 'users' ? Users : item.icon === 'shield' ? ShieldCheck : LayoutDashboard;
            const active = url === item.href || (item.href !== '/admin' && url.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Back to app
          </Link>
        </div>
      </aside>

      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
