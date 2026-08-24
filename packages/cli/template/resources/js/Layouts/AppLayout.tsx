import { Link, router, usePage } from '@inertiajs/react';
import { Bell, LogOut, UserRound } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Badge } from '@/Components/ui/badge';
import { ThemeToggle } from '@/Components/theme-toggle';
import { cn } from '@/lib/utils';
import { useInertiaTransition } from '@/hooks/use-inertia-transition';

interface SharedProps {
  auth?: {
    user: { id: number; name: string; email: string; is_admin: boolean } | null;
    unreadNotifications?: number;
  };
  hasDocs?: boolean;
}

export default function AppLayout({ children }: { children?: ReactNode }) {
  const { url, props } = usePage<{ auth?: SharedProps['auth']; hasDocs?: boolean }>();
  const user = props.auth?.user ?? null;
  const unread = props.auth?.unreadNotifications ?? 0;
  const hasDocs = props.hasDocs ?? false;
  const transition = useInertiaTransition();

  // Members-only directory: guests never see a link that would bounce them.
  const NAV_ITEMS = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
    ...(user ? [{ href: '/users', label: 'Users' }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-mono text-sm font-bold text-primary-foreground shadow-sm">
              L
            </span>
            <span className="font-display text-lg font-bold tracking-tight">
              chava<span className="text-primary">Js</span>
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  url === item.href
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {item.label}
              </Link>
            ))}

            {hasDocs ? (
              <Link
                href="/docs"
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  url.startsWith('/docs')
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                Docs
              </Link>
            ) : (
              <a
                href="https://github.com/Jbac76/chavaJs/tree/master/packages/core/docs"
                target="_blank"
                rel="noreferrer"
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                )}
              >
                Docs <span aria-hidden>↗</span>
              </a>
            )}

            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className={cn(
                    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    url === '/dashboard'
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  Dashboard
                </Link>
                <Link
                  href="/notifications"
                  title="Notifications"
                  className={cn(
                    'relative flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    url === '/notifications'
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <Bell className="h-4 w-4" />
                  <span className="hidden lg:inline">Inbox</span>
                  <AnimatePresence>
                    {unread > 0 && (
                      <motion.span
                        key={unread}
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.4, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 16 }}
                        className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-bold text-primary-foreground"
                      >
                        {unread > 9 ? '9+' : unread}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Link>
                <span className="ml-1 hidden items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary sm:flex">
                  <UserRound className="h-3.5 w-3.5" />
                  {user.name.split(' ')[0]}
                </span>
                <button
                  type="button"
                  onClick={() => router.post('/logout')}
                  className="ml-1 flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  title="Log out"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden lg:inline">Logout</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className={cn(
                    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    url === '/login'
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className={cn(
                    'ml-1 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90',
                  )}
                >
                  Register
                </Link>
              </>
            )}

            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="w-full flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <motion.div {...transition}>{children}</motion.div>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>chavaJs — the Laravel framework for Node.js.</p>
          <p className="font-mono text-xs">100% JS/TS · 0% PHP</p>
        </div>
      </footer>
    </div>
  );
}
